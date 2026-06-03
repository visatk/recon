import { Bot, webhookCallback } from 'grammy';
// Cloudflare Sandbox SDK-এর Container Durable Object এক্সপোর্ট করা বাধ্যতামূলক
export { Sandbox } from '@cloudflare/sandbox';

export interface Env {
	TELEGRAM_BOT_TOKEN: string;
	DB: D1Database;
	Sandbox: DurableObjectNamespace;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// শুধুমাত্র POST রিকোয়েস্ট (Telegram Webhook) অ্যালাউ করব
		if (request.method !== 'POST') {
			return new Response('ReconBot API is running. Please use Telegram to interact.', { status: 200 });
		}

		const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

		// 1. Start Command: User Registration
		bot.command('start', async (c) => {
			const tgId = c.from?.id;
			const username = c.from?.username || 'Unknown';

			if (!tgId) return;

			try {
				// D1 Database-এ ইউজার সেভ করা (যদি আগে থেকে না থাকে)
				await env.DB.prepare(
					`INSERT INTO users (tg_id, username) VALUES (?, ?) ON CONFLICT(tg_id) DO NOTHING`
				)
					.bind(tgId, username)
					.run();

				await c.reply(
					'🛡️ *Welcome to ReconBox*\n\n_Anonymous, Ephemeral, and Blazing Fast._\n\nUse `/recon <domain>` to start a basic Nmap scan.',
					{ parse_mode: 'Markdown' }
				);
			} catch (error) {
				console.error('DB Error:', error);
				await c.reply('⚠️ Database error occurred.');
			}
		});

		// 2. Recon Command: Core Scanner Logic
		bot.command('recon', async (c) => {
			const tgId = c.from?.id;
			const domain = c.match; // ইউজারের ইনপুট করা ডোমেইন

			if (!tgId) return;

			// Security: Command Injection ঠেকানোর জন্য Strict Regex Validation
			if (!domain || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
				return c.reply('⚠️ Invalid domain format. Example: `/recon example.com`', { parse_mode: 'Markdown' });
			}

			try {
				// Step A: Check Credits & Tier
				const user = await env.DB.prepare(`SELECT credits, tier FROM users WHERE tg_id = ?`)
					.bind(tgId)
					.first<{ credits: number; tier: string }>();

				if (!user) {
					return c.reply('Please run `/start` to register first.');
				}

				if (user.tier === 'free' && user.credits <= 0) {
					return c.reply('❌ You have exhausted your daily free scan credits.');
				}

				// Step B: Insert Scan History (Status: pending)
				const scanInsert = await env.DB.prepare(
					`INSERT INTO scans (tg_id, target, tool, status) VALUES (?, ?, ?, ?) RETURNING id`
				)
					.bind(tgId, domain, 'nmap', 'pending')
					.first<{ id: number }>();

				// Deduct Credit for free users
				if (user.tier === 'free') {
					await env.DB.prepare(`UPDATE users SET credits = credits - 1 WHERE tg_id = ?`).bind(tgId).run();
				}

				// Initial Response to Telegram
				const statusMsg = await c.reply('⏳ Provisioning secure Sandbox...');

				// Step C: Async Background Processing (Webhook Timeout বাইপাস করার জন্য)
				ctx.waitUntil(
					(async () => {
						try {
							// Update status to running
							await env.DB.prepare(`UPDATE scans SET status = 'running' WHERE id = ?`)
								.bind(scanInsert?.id)
								.run();

							await bot.api.editMessageText(
								c.chat.id,
								statusMsg.message_id,
								`[🔍] Running Nmap Fast Scan on *${domain}*...`,
								{ parse_mode: 'Markdown' }
							);

							// 🚀 Instantiate Sandbox Container
							const sandboxId = env.Sandbox.newUniqueId();
							// @ts-ignore - Dynamic DO RPC call for SDK
							const sandboxStub = env.Sandbox.get(sandboxId);

							// Execute command via Sandbox RPC
							// NOTE: Make sure your Dockerfile has 'nmap' installed.
							const result = await sandboxStub.exec('nmap', ['-F', '-T4', domain]);
							const output = result.stdout || result.stderr || 'No output received.';

							// Format the result (Telegram has a 4096 char limit)
							let finalMessage = `✅ **Scan Complete for ${domain}**\n\n\`\`\`\n${output}\n\`\`\``;
							if (finalMessage.length > 4000) {
								finalMessage = finalMessage.substring(0, 4000) + '\n... [Truncated]```';
							}

							// Send Result & Update DB
							await bot.api.editMessageText(c.chat.id, statusMsg.message_id, finalMessage, {
								parse_mode: 'Markdown',
							});

							await env.DB.prepare(`UPDATE scans SET status = 'completed' WHERE id = ?`)
								.bind(scanInsert?.id)
								.run();

						} catch (executionError: any) {
							console.error('Sandbox Error:', executionError);
							await bot.api.editMessageText(
								c.chat.id,
								statusMsg.message_id,
								`❌ *Scan Failed:*\n\`${executionError.message}\``,
								{ parse_mode: 'Markdown' }
							);
							await env.DB.prepare(`UPDATE scans SET status = 'failed' WHERE id = ?`)
								.bind(scanInsert?.id)
								.run();
						}
					})()
				);
			} catch (error) {
				console.error('System Error:', error);
				await c.reply('⚠️ An unexpected error occurred while processing your request.');
			}
		});

		// Telegram Webhook Handler
		const handleWebhook = webhookCallback(bot, 'cloudflare-mod');
		return handleWebhook(request);
	},
};
