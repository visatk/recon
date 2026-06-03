import { CommandContext, Context } from 'grammy';
import { Env } from '../../types';
import { DbClient } from '../../db/client';
import { getSandbox } from '@cloudflare/sandbox';

export async function handleRecon(ctx: CommandContext<Context>, env: Env, executionCtx: ExecutionContext) {
	const tgId = ctx.from?.id;
	const domain = ctx.match?.trim();

	if (!tgId) return;

	// Input Sanitation: Mitigate shell command injection vectors at the input boundary
	if (!domain || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
		await ctx.reply('⚠️ Invalid target format. Please enter a valid cleanly-formatted domain.\nExample: `/recon target.com`', {
			parse_mode: 'Markdown',
		});
		return;
	}

	const dbClient = new DbClient(env.DB);

	try {
		const access = await dbClient.checkCredits(tgId);
		if (!access.allowed) {
			await ctx.reply('❌ Credit Limit Reached. Daily limits are capped at 5 requests for free accounts.');
			return;
		}

		const scanId = await dbClient.createScan(tgId, domain, 'nmap');

		if (access.tier === 'free') {
			await dbClient.deductCredit(tgId);
		}

		const progressMessage = await ctx.reply('⏳ *[1/3]* Spin-up isolated container sandbox environment...', {
			parse_mode: 'Markdown',
		});

		// Defer processing to background event loops via waitUntil to instantly answer the incoming Telegram webhook
		executionCtx.waitUntil(
			(async () => {
				let sandbox = null;
				try {
					await dbClient.updateScanStatus(scanId, 'running');

					await ctx.api.editMessageText(
						ctx.chat.id,
						progressMessage.message_id,
						`🔍 *[2/3]* Sandbox initialized. Running network inspection tool on *${domain}*...`,
						{ parse_mode: 'Markdown' }
					);

					// Generate clean sandbox runtime scope using SDK standard helper interface
					const sandboxInstanceId = crypto.randomUUID();
					sandbox = getSandbox(env.Sandbox, sandboxInstanceId, { sleepAfter: '5m' });

					// Using fast scan connect approach due to restricted network capabilities inside strict sandbox layers
					const result = await sandbox.exec(`nmap -F -T4 ${domain}`, { timeout: 45000 });
					const rawLog = result.stdout || result.stderr || 'Host verification completed without open listening ports.';

					let formattedText = `✅ *Scan Output Matrix for ${domain}*\n\n\`\`\`\n${rawLog}\n\`\`\``;
					// Enforce strict upper bound constraints matching Telegram API message sizing limits
					if (formattedText.length > 4000) {
						formattedText = formattedText.substring(0, 3950) + '\n... [Data truncated due to message length limits]```';
					}

					await ctx.api.editMessageText(ctx.chat.id, progressMessage.message_id, formattedText, {
						parse_mode: 'Markdown',
					});

					await dbClient.updateScanStatus(scanId, 'completed');
				} catch (sandboxError: any) {
					console.error('Asynchronous scanning pipeline exception caught:', sandboxError);
					await ctx.api.editMessageText(
						ctx.chat.id,
						progressMessage.message_id,
						`❌ *Analysis Pipeline Aborted*\nSandbox orchestration failed: \`${sandboxError.message || 'Execution Timeout'}\``,
						{ parse_mode: 'Markdown' }
					);
					await dbClient.updateScanStatus(scanId, 'failed');
				} finally {
					// Always execute resource lifecycle release handlers explicitly
					if (sandbox) {
						try {
							await sandbox.destroy();
						} catch (destructionError) {
							console.error('Resource lifecycle deallocation failed:', destructionError);
						}
					}
				}
			})()
		);

	} catch (pipelineError) {
		console.error('Failed to trigger background scan operation:', pipelineError);
		await ctx.reply('⚠️ Infrastructure exception occurred. Unable to route command payload into security mesh.');
	}
}
