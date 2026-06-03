import { CommandContext, Context, InputFile } from 'grammy';
import { Env } from '../../types';
import { DbClient } from '../../db/client';
import { getSandbox } from '@cloudflare/sandbox';
import { escapeHtml } from '../../utils/ui';

const ALLOWED_TOOLS = ['nmap', 'subfinder', 'httpx', 'whois', 'dig', 'curl', 'wget', 'jq', 'grep', 'cat', 'echo', 'ls'];

export async function handleCli(ctx: CommandContext<Context>, env: Env, executionCtx: ExecutionContext) {
	const tgId = ctx.from?.id;
	const rawCommand = ctx.match?.trim();

	if (!tgId) return;

	if (!rawCommand) {
		return ctx.reply('⚠️ <b>Please provide a command.</b>\nExample: <code>/cli nmap -sV target.com</code>', { parse_mode: 'HTML' });
	}

	// Security: Prevent Shell Command Injection
	if (/[;&|`$]/.test(rawCommand) || rawCommand.includes('>') || rawCommand.includes('<')) {
		return ctx.reply('❌ <b>Security Alert:</b> Shell chaining operators (;, &, |, $, >) are strictly prohibited.', { parse_mode: 'HTML' });
	}

	const baseTool = rawCommand.split(' ')[0].toLowerCase();
	if (!ALLOWED_TOOLS.includes(baseTool)) {
		return ctx.reply(`❌ <b>Tool Restricted!</b>\nAllowed tools: <code>${ALLOWED_TOOLS.join(', ')}</code>`, { parse_mode: 'HTML' });
	}

	const dbClient = new DbClient(env.DB);
	try {
		const access = await dbClient.checkCredits(tgId);
		if (!access.allowed) return ctx.reply('❌ <b>Credit Limit Reached.</b>', { parse_mode: 'HTML' });

		const logTarget = rawCommand.length > 100 ? rawCommand.substring(0, 100) + '...' : rawCommand;
		const scanId = await dbClient.createScan(tgId, logTarget, baseTool);

		if (access.tier === 'free') await dbClient.deductCredit(tgId);

		const progress = await ctx.reply(`⏳ <b>Executing:</b> <code>${escapeHtml(rawCommand)}</code>`, { parse_mode: 'HTML' });
		await ctx.replyWithChatAction('typing').catch(() => {});

		const safeEdit = async (text: string) => {
			try { await ctx.api.editMessageText(ctx.chat.id, progress.message_id, text, { parse_mode: 'HTML' }); } catch (e) {}
		};

		executionCtx.waitUntil(
			(async () => {
				let sandbox = null;
				try {
					await dbClient.updateScanStatus(scanId, 'running');
					sandbox = getSandbox(env.Sandbox, crypto.randomUUID(), { sleepAfter: '2m' });

					const result = await sandbox.exec(rawCommand, { timeout: 60000 });
					const output = result.stdout || result.stderr || '[No Output]';

					if (output.length > 3900) {
						const fileBytes = new Uint8Array(new TextEncoder().encode(output));
						await ctx.replyWithDocument(new InputFile(fileBytes, `cli_output.txt`), {
							caption: `✅ <b>Execution Complete</b>\n<code>$ ${escapeHtml(rawCommand)}</code>`,
							parse_mode: 'HTML'
						});
						await ctx.api.deleteMessage(ctx.chat.id, progress.message_id).catch(() => {});
					} else {
						const finalOut = `✅ <b>Execution Complete</b>\n<code>$ ${escapeHtml(rawCommand)}</code>\n\n<pre>${escapeHtml(output)}</pre>`;
						await safeEdit(finalOut);
					}

					await dbClient.updateScanStatus(scanId, 'completed');
				} catch (err: any) {
					await safeEdit(`❌ <b>Execution Failed:</b> <code>${escapeHtml(err.message)}</code>`);
					await dbClient.updateScanStatus(scanId, 'failed');
				} finally {
					if (sandbox) try { await sandbox.destroy(); } catch (e) {}
				}
			})()
		);
	} catch (error) {
		await ctx.reply('⚠️ <b>System Error occurred.</b>', { parse_mode: 'HTML' });
	}
}
