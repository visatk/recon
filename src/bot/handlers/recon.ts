import { CommandContext, Context } from 'grammy';
import { Env } from '../../types';
import { DbClient } from '../../db/client';
import { getSandbox } from '@cloudflare/sandbox';
import { formatOutput, escapeHtml } from '../../utils/ui';

export async function handleRecon(ctx: CommandContext<Context>, env: Env, executionCtx: ExecutionContext) {
	const tgId = ctx.from?.id;
	const domain = ctx.match?.trim();

	if (!tgId) return;

	if (!domain || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
		return ctx.reply('⚠️ <b>Invalid target format.</b>\nExample: <code>/recon target.com</code>', { parse_mode: 'HTML' });
	}

	const dbClient = new DbClient(env.DB);

	try {
		const access = await dbClient.checkCredits(tgId);
		if (!access.allowed) {
			return ctx.reply('❌ <b>Credit Limit Reached.</b>\nWait 24 hours for free credits to reset.', { parse_mode: 'HTML' });
		}

		const scanId = await dbClient.createScan(tgId, domain, 'multi-recon');
		if (access.tier === 'free') await dbClient.deductCredit(tgId);

		const progressMessage = await ctx.reply('⏳ <b>[1/3]</b> Provisioning isolated Sandbox...', { parse_mode: 'HTML' });

		// Safe edit wrapper to avoid Telegram "not modified" crashes
		const safeEdit = async (text: string) => {
			try { await ctx.api.editMessageText(ctx.chat.id, progressMessage.message_id, text, { parse_mode: 'HTML' }); } catch (e) {}
		};

		executionCtx.waitUntil(
			(async () => {
				let sandbox = null;
				try {
					await dbClient.updateScanStatus(scanId, 'running');
					await safeEdit(`🔍 <b>[2/3]</b> Sandbox initialized. Running Subfinder, Nmap, Httpx & Whois on <b>${escapeHtml(domain)}</b>...`);

					const sandboxId = crypto.randomUUID();
					sandbox = getSandbox(env.Sandbox, sandboxId, { sleepAfter: '2m' });

					const safeExec = async (cmd: string, timeout: number) => {
						try { return await sandbox!.exec(cmd, { timeout }); } 
						catch (e: any) { return { stdout: '', stderr: `[Error: ${e.message}]`, success: false }; }
					};

					const [subResult, nmapResult, httpxResult, whoisResult] = await Promise.all([
						safeExec(`subfinder -d ${domain} -silent -max-time 15`, 20000),
						safeExec(`nmap -sT -F -T4 ${domain}`, 30000),
						safeExec(`echo ${domain} | httpx -silent -sc -td -title`, 20000),
						safeExec(`whois ${domain} | grep -iE "Registrar:|Creation Date:|Expiry Date:" | head -n 4`, 15000)
					]);

					const subList = (subResult.stdout || '').split('\n').filter(s => s.trim().length > 0);
					const subFormatted = subList.length > 0 ? subList.slice(0, 10).join('\n') : 'No subdomains found.';

					let finalOut = `✅ <b>Deep Recon Complete:</b> <code>${escapeHtml(domain)}</code>\n\n`;
					finalOut += formatOutput('🌐 Web Tech (Httpx):', httpxResult.stdout || httpxResult.stderr);
					finalOut += formatOutput('ℹ️ Domain Info:', whoisResult.stdout || whoisResult.stderr);
					finalOut += formatOutput(`🔗 Subdomains (Top 10 of ${subList.length}):`, subFormatted);
					finalOut += formatOutput('🛡️ Port Scan (Nmap):', (nmapResult.stdout || nmapResult.stderr).substring(0, 800));

					if (finalOut.length > 4000) {
						finalOut = finalOut.substring(0, 3950) + '\n... [Truncated for Telegram limits]</pre>';
					}

					await safeEdit(finalOut);
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
		await ctx.reply('⚠️ <b>System Error:</b> Could not process request.', { parse_mode: 'HTML' });
	}
}
