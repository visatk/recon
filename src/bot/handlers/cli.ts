import { CommandContext, Context } from 'grammy';
import { Env } from '../../types';
import { DbClient } from '../../db/client';
import { getSandbox } from '@cloudflare/sandbox';

// Security Whitelist: Allowed base commands to prevent abuse
const ALLOWED_TOOLS = ['nmap', 'subfinder', 'httpx', 'whois', 'dig', 'curl', 'wget', 'jq', 'grep', 'cat', 'echo', 'ls'];

export async function handleCli(ctx: CommandContext<Context>, env: Env, executionCtx: ExecutionContext) {
	const tgId = ctx.from?.id;
	const rawCommand = ctx.match?.trim(); // Example: "nmap -sV -p- example.com"

	if (!tgId) return;

	if (!rawCommand) {
		await ctx.reply(
			'⚠️ *Please provide a command to run.*\n\nExample:\n`/cli nmap -sV -p 80,443 example.com`\n`/cli subfinder -d target.com`',
			{ parse_mode: 'Markdown' }
		);
		return;
	}

	// Extract the base tool (the first word)
	const baseTool = rawCommand.split(' ')[0].toLowerCase();

	if (!ALLOWED_TOOLS.includes(baseTool)) {
		await ctx.reply(
			`❌ *Tool Not Allowed!*\n\nAvailable tools:\n\`${ALLOWED_TOOLS.join(', ')}\``,
			{ parse_mode: 'Markdown' }
		);
		return;
	}

	const dbClient = new DbClient(env.DB);

	try {
		const access = await dbClient.checkCredits(tgId);
		if (!access.allowed) {
			await ctx.reply('❌ Credit Limit Reached. Daily limits are capped at 5 requests for free accounts.');
			return;
		}

		// Truncate command for DB logging to avoid long string errors
		let logTarget = rawCommand.length > 100 ? rawCommand.substring(0, 100) + '...' : rawCommand;
		const scanId = await dbClient.createScan(tgId, logTarget, baseTool);

		if (access.tier === 'free') {
			await dbClient.deductCredit(tgId);
		}

		const progressMessage = await ctx.reply(`⏳ *Executing:*\n\`$ ${rawCommand}\``, {
			parse_mode: 'Markdown',
		});

		executionCtx.waitUntil(
			(async () => {
				let sandbox = null;
				try {
					await dbClient.updateScanStatus(scanId, 'running');

					// Spin up ephemeral container
					const sandboxInstanceId = crypto.randomUUID();
					sandbox = getSandbox(env.Sandbox, sandboxInstanceId, { sleepAfter: '2m' });

					// 🚀 Execute the user's custom command
					const result = await sandbox.exec(rawCommand, { timeout: 60000 }); // 60s timeout for custom commands
					
					// Safely capture output
					const output = result.stdout || result.stderr || '[Command executed successfully, but returned no output]';

					// Format and truncate output for Telegram
					let formattedText = `✅ *Execution Complete*\n\n\`$ ${rawCommand}\`\n\n\`\`\`text\n${output}\n\`\`\``;
					
					if (formattedText.length > 4000) {
						formattedText = formattedText.substring(0, 3950) + '\n\n... [Output truncated due to Telegram limits]```';
					}

					await ctx.api.editMessageText(ctx.chat.id, progressMessage.message_id, formattedText, {
						parse_mode: 'Markdown',
					});

					await dbClient.updateScanStatus(scanId, 'completed');
				} catch (sandboxError: any) {
					console.error('Custom command execution failed:', sandboxError);
					await ctx.api.editMessageText(
						ctx.chat.id,
						progressMessage.message_id,
						`❌ *Execution Failed*\nSandbox orchestration error: \`${sandboxError.message || 'Execution Timeout'}\``,
						{ parse_mode: 'Markdown' }
					);
					await dbClient.updateScanStatus(scanId, 'failed');
				} finally {
					// 🧹 CRITICAL: Immediately destroy ephemeral container
					if (sandbox) {
						try { await sandbox.destroy(); } catch (e) {}
					}
				}
			})()
		);

	} catch (pipelineError) {
		console.error('Failed to trigger background CLI operation:', pipelineError);
		await ctx.reply('⚠️ Infrastructure exception occurred.');
	}
}
