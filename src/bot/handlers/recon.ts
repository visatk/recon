import { CommandContext, Context } from 'grammy';
import { Env } from '../../types';
import { DbClient } from '../../db/client';
import { getSandbox } from '@cloudflare/sandbox';

export async function handleRecon(ctx: CommandContext<Context>, env: Env, executionCtx: ExecutionContext) {
	const tgId = ctx.from?.id;
	const domain = ctx.match?.trim();

	if (!tgId) return;

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

		const scanId = await dbClient.createScan(tgId, domain, 'multi-recon');

		if (access.tier === 'free') {
			await dbClient.deductCredit(tgId);
		}

		const progressMessage = await ctx.reply('⏳ *[1/3]* Provisioning isolated Sandbox container...', {
			parse_mode: 'Markdown',
		});

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
					sandbox = getSandbox(env.Sandbox, sandboxInstanceId, { sleepAfter: '2m' });

					// Helper function to prevent Promise.all from crashing if one tool fails or times out
					const safeExec = async (cmd: string, timeoutMs: number) => {
						try {
							return await sandbox!.exec(cmd, { timeout: timeoutMs });
						} catch (e: any) {
							return { stdout: '', stderr: `[Timeout or Error: ${e.message}]`, exitCode: 1, success: false };
						}
					};

					// 🚀 CONCURRENT EXECUTION
					const [subResult, nmapResult, httpxResult, whoisResult] = await Promise.all([
						safeExec(`subfinder -d ${domain} -silent -max-time 15`, 20000),
						safeExec(`nmap -sT -F -T4 ${domain}`, 30000), // -sT explicitly used for user-space networking
						safeExec(`echo ${domain} | httpx -silent -sc -td -title`, 20000),
						safeExec(`whois ${domain} | grep -iE "Registrar:|Creation Date:|Registry Expiry Date:" | head -n 4`, 15000)
					]);

					// Extracting outputs safely (handling both stdout and stderr fallbacks)
					const subLog = subResult.stdout || subResult.stderr || 'No subdomains found.';
					const nmapLog = nmapResult.stdout || nmapResult.stderr || 'Host seems down or ports are filtered.';
					const httpxLog = httpxResult.stdout || httpxResult.stderr || 'Target unresponsive to HTTP probes.';
					const whoisLog = whoisResult.stdout || whoisResult.stderr || 'Whois data protected or unavailable.';

					let formattedText = `✅ *Deep Recon Complete: ${domain}*\n\n`;
					
					formattedText += `🌐 *Web Tech (Httpx):*\n\`\`\`\n${httpxLog.trim()}\n\`\`\`\n`;
					formattedText += `ℹ️ *Domain Info:*\n\`\`\`\n${whoisLog.trim()}\n\`\`\`\n`;
					
					// Safely split and slice subdomains
					const subList = subLog.split('\n').filter(s => s.trim().length > 0);
					formattedText += `🔗 *Subdomains (Top 10 of ${subList.length}):*\n\`\`\`\n${subList.slice(0, 10).join('\n')}\n\`\`\`\n`;
					
					formattedText += `🛡️ *Port Scan (Nmap):*\n\`\`\`\n${nmapLog.trim().substring(0, 800)}\n\`\`\``;
					
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
					// 🧹 CRITICAL: Immediately destroy ephemeral container to prevent memory leaks and billing hits
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
