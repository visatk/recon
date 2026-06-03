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

		// Update tool name in DB to reflect multiple tools
		const scanId = await dbClient.createScan(tgId, domain, 'multi-recon');

		if (access.tier === 'free') {
			await dbClient.deductCredit(tgId);
		}

		const progressMessage = await ctx.reply('⏳ *[1/3]* Provisioning isolated Sandbox container...', {
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
						`🔍 *[2/3]* Running Subfinder, Nmap, Httpx & Whois concurrently on *${domain}*...`,
						{ parse_mode: 'Markdown' }
					);

					const sandboxInstanceId = crypto.randomUUID();
					sandbox = getSandbox(env.Sandbox, sandboxInstanceId, { sleepAfter: '5m' });

					// 🚀 CONCURRENT EXECUTION: Running 4 heavy tools perfectly in parallel
					// Cloudflare Sandbox can handle multiple shell executions simultaneously
					const [subResult, nmapResult, httpxResult, whoisResult] = await Promise.all([
						// 1. Find Subdomains
						sandbox.exec(`subfinder -d ${domain} -silent -max-time 15`, { timeout: 20000 }),
						// 2. Fast Port Scan
						sandbox.exec(`nmap -F -T4 ${domain}`, { timeout: 30000 }),
						// 3. Tech Stack & Status Code Detection
						sandbox.exec(`echo ${domain} | httpx -silent -sc -td -title`, { timeout: 20000 }),
						// 4. Domain Info Extraction (Filtered for clean output)
						sandbox.exec(`whois ${domain} | grep -iE "Registrar:|Creation Date:|Registry Expiry Date:" | head -n 4`, { timeout: 15000 })
					]);

					// Extracting outputs safely
					const subLog = subResult.stdout || 'No subdomains found.';
					const nmapLog = nmapResult.stdout || 'Host seems down or ports are filtered.';
					const httpxLog = httpxResult.stdout || 'Target unresponsive to HTTP probes.';
					const whoisLog = whoisResult.stdout || 'Whois data protected or unavailable.';

					// Formatting the dynamic dashboard output for Telegram
					let formattedText = `✅ *Deep Recon Complete: ${domain}*\n\n`;
					
					formattedText += `🌐 *Web Tech (Httpx):*\n\`\`\`\n${httpxLog.trim()}\n\`\`\`\n`;
					formattedText += `ℹ️ *Domain Info (Whois):*\n\`\`\`\n${whoisLog.trim()}\n\`\`\`\n`;
					formattedText += `🔗 *Subdomains (Top 10):*\n\`\`\`\n${subLog.split('\n').slice(0, 10).join('\n')}\n\`\`\`\n`;
					formattedText += `🛡️ *Port Scan (Nmap):*\n\`\`\`\n${nmapLog.trim().substring(0, 800)}\n\`\`\``;
					
					// Enforce strict upper bound constraints matching Telegram API message sizing limits
					if (formattedText.length > 4000) {
						formattedText = formattedText.substring(0, 3950) + '\n... [Data truncated]```';
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
