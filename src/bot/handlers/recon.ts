import { CommandContext, Context, InputFile } from 'grammy';
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

		const progressMessage = await ctx.reply('⏳ <b>[1/5]</b> Provisioning isolated Security Sandbox...', { parse_mode: 'HTML' });
		await ctx.replyWithChatAction('typing').catch(() => {});

		const safeEdit = async (text: string) => {
			try { await ctx.api.editMessageText(ctx.chat.id, progressMessage.message_id, text, { parse_mode: 'HTML' }); } catch (e) {}
		};

		executionCtx.waitUntil(
			(async () => {
				let sandbox = null;
				try {
					await dbClient.updateScanStatus(scanId, 'running');
					sandbox = getSandbox(env.Sandbox, crypto.randomUUID(), { sleepAfter: '2m' });

					const safeExec = async (cmd: string, timeout: number) => {
						try { return await sandbox!.exec(cmd, { timeout }); } 
						catch (e: any) { return { stdout: '', stderr: `[Timeout/Error: ${e.message}]`, success: false }; }
					};

					// Step 1: Subdomain Enumeration (Write to file for pipeline)
					await safeEdit(`🔍 <b>[2/5]</b> Enumerating Subdomains (Subfinder)...`);
					await safeExec(`subfinder -d ${domain} -all -silent -max-time 20 > /workspace/subs.txt`, 25000);
					const subResult = await safeExec(`cat /workspace/subs.txt`, 5000);
					
					const subList = (subResult.stdout || '').split('\n').filter(s => s.trim().length > 0);
					const subCount = subList.length;

					// Step 2: Live Host & Tech Stack Probing (Feed subdomains into Httpx)
					await safeEdit(`🔍 <b>[3/5]</b> Probing ${subCount > 0 ? subCount : 1} targets for Tech Stack (Httpx)...`);
					
					// If subfinder found subs, use them. Otherwise, fallback to the root domain.
					const httpxTarget = subCount > 0 ? 'cat /workspace/subs.txt' : `echo ${domain}`;
					// Flags: Status Code, Tech Detect, Server Header, IP, CNAME, Title
					const httpxResult = await safeExec(`${httpxTarget} | httpx -silent -sc -td -server -ip -cname -title`, 35000);

					// Step 3: Fast Service & Port Scanning (Nmap Top 100 ports with Service Versioning)
					await safeEdit(`🔍 <b>[4/5]</b> Scanning Open Ports & Service Versions (Nmap)...`);
					const nmapResult = await safeExec(`nmap -sT -sV -F -T4 --open -Pn ${domain}`, 40000);

					// Step 4: Identity & Registrar Extraction (Whois)
					await safeEdit(`🔍 <b>[5/5]</b> Extracting Domain Identity (Whois)...`);
					const whoisResult = await safeExec(`whois ${domain} | grep -iE "Registrar:|Creation Date:|Expiry Date:|Name Server:|Registrant Organization:" | awk '{$1=$1;print}' | sort -u | head -n 10`, 15000);

					// Final Report Generation
					const subFormatted = subCount > 0 ? subList.slice(0, 15).join('\n') : 'No subdomains found.';

					let finalOut = `✅ <b>Attack Surface Report:</b> <code>${escapeHtml(domain)}</code>\n\n`;
					finalOut += formatOutput('ℹ️ Domain Identity:', whoisResult.stdout || whoisResult.stderr);
					finalOut += formatOutput(`🔗 Discovered Subdomains (Top 15 of ${subCount}):`, subFormatted);
					finalOut += formatOutput('🌐 Live Web Services & Tech Stack:', httpxResult.stdout || httpxResult.stderr);
					finalOut += formatOutput('🛡️ Open Ports & Services (Top 100):', (nmapResult.stdout || nmapResult.stderr));

					// Send as Document if it exceeds Telegram limits
					if (finalOut.length > 3900) {
						const rawText = `=== ATTACK SURFACE REPORT FOR ${domain} ===\n\n` +
										`[DOMAIN IDENTITY]\n${whoisResult.stdout}\n\n` +
										`[ALL DISCOVERED SUBDOMAINS (${subCount})]\n${subResult.stdout}\n\n` +
										`[LIVE HOSTS & TECH STACK]\n${httpxResult.stdout}\n\n` +
										`[PORT SCAN & SERVICE VERSIONS]\n${nmapResult.stdout}`;
										
						const fileBytes = new Uint8Array(new TextEncoder().encode(rawText));
						
						await ctx.replyWithDocument(new InputFile(fileBytes, `${domain}_attack_surface.txt`), {
							caption: `✅ <b>Deep Recon Complete:</b> <code>${escapeHtml(domain)}</code>\n⚠️ Output too large, see attached detailed OSINT report.`,
							parse_mode: 'HTML'
						});
						await ctx.api.deleteMessage(ctx.chat.id, progressMessage.message_id).catch(() => {});
					} else {
						await safeEdit(finalOut);
					}

					await dbClient.updateScanStatus(scanId, 'completed');
				} catch (err: any) {
					await safeEdit(`❌ <b>Execution Failed:</b> <code>${escapeHtml(err.message)}</code>`);
					await dbClient.updateScanStatus(scanId, 'failed');
				} finally {
					// Ensure Sandbox is destroyed to prevent memory leaks and save costs
					if (sandbox) try { await sandbox.destroy(); } catch (e) {}
				}
			})()
		);
	} catch (error) {
		await ctx.reply('⚠️ <b>System Error:</b> Could not process request.', { parse_mode: 'HTML' });
	}
}
