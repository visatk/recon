import { Bot, InputFile } from 'grammy';
import { Env, ScanJob } from '../../types';
import { DbClient } from '../../db/client';
import { getSandbox } from '@cloudflare/sandbox';
import { formatOutput, escapeHtml, getProgressBar } from '../../utils/ui';

export async function processReconJob(job: ScanJob, env: Env) {
	const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
	const dbClient = new DbClient(env.DB);
	let sandbox = null;

	const safeEdit = async (step: number, text: string) => {
		try { 
			const bar = getProgressBar(step, 4);
			await bot.api.editMessageText(job.chatId, job.messageId, `⏳ <b>Scanning: ${escapeHtml(job.payload)}</b>\n<code>${bar}</code>\n${text}`, { parse_mode: 'HTML' }); 
		} catch (e) {}
	};

	try {
		await dbClient.updateScanStatus(job.scanId, 'running');
		sandbox = getSandbox(env.Sandbox, crypto.randomUUID(), { sleepAfter: job.isPro ? '5m' : '2m', enableDefaultSession: false });

		const safeExec = async (cmd: string, timeout: number) => {
			try { 
				const res = await sandbox!.exec(cmd, { timeout }); 
				return { stdout: (res.stdout + '\n' + res.stderr).trim(), stderr: res.stderr, success: res.success, exitCode: res.exitCode };
			} 
			catch (e: any) { return { stdout: '', stderr: `[Timeout/Error: ${e.message}]`, success: false, exitCode: 1 }; }
		};

		await safeEdit(1, '🔍 Enumerating Subdomains...');
		await safeExec(`subfinder -d ${job.payload} -all -silent -max-time ${job.isPro ? 20 : 10} > /workspace/subs.txt`, job.isPro ? 25000 : 15000);
		const subResult = await safeExec(`cat /workspace/subs.txt 2>/dev/null || echo ""`, 5000);
		const subList = (subResult.stdout || '').split('\n').filter(s => s.trim().length > 0);

		await safeEdit(2, `⚡ Probing targets...`);
		const httpxTarget = subList.length > 0 ? 'cat /workspace/subs.txt' : `echo ${job.payload}`;
		const httpxResult = await safeExec(`${httpxTarget} | httpx -silent -sc -td -server -title -t 50`, job.isPro ? 30000 : 20000);

		await safeEdit(3, `🌐 Extracting Domain Identity...`);
		const whoisResult = await safeExec(`whois ${job.payload} | grep -iE "Registrar:|Creation Date:|Expiry Date:|Name Server:" | awk '{$1=$1;print}' | sort -u | head -n 10`, 10000);

		await safeEdit(4, `✅ Uploading Report to R2 Secure Storage...`);
		
		const rawText = `=== RECONBOX ATTACK SURFACE REPORT FOR ${job.payload} ===\n\n[DOMAIN IDENTITY]\n${whoisResult.stdout}\n\n[ALL DISCOVERED SUBDOMAINS (${subList.length})]\n${subResult.stdout}\n\n[LIVE HOSTS & TECH STACK]\n${httpxResult.stdout}`;
		const fileKey = `reports/${job.tgId}/${job.payload}_${Date.now()}.txt`;
		
		await env.REPORTS_BUCKET.put(fileKey, rawText);
		const r2Object = await env.REPORTS_BUCKET.get(fileKey);
		
		const subFormatted = subList.length > 0 ? subList.slice(0, 15).join('\n') : 'No subdomains found.';
		let finalOut = `✅ <b>${job.isPro ? '🚀 PRO ' : ''}Recon Complete:</b> <code>${escapeHtml(job.payload)}</code>\n\n`;
		finalOut += formatOutput('ℹ️ Identity:', whoisResult.stdout);
		finalOut += formatOutput(`🔗 Top Subdomains:`, subFormatted);
		finalOut += formatOutput('🌐 Tech Stack:', httpxResult.stdout);

		if (finalOut.length > 3900 && r2Object) {
			const arrayBuffer = await r2Object.arrayBuffer();
			await bot.api.sendDocument(job.chatId, new InputFile(new Uint8Array(arrayBuffer), `${job.payload}_recon.txt`), {
				caption: `✅ <b>Fast Recon Complete</b>\n📁 <i>Report securely loaded from R2 Storage.</i>`,
				parse_mode: 'HTML'
			});
			await bot.api.deleteMessage(job.chatId, job.messageId).catch(() => {});
		} else {
			finalOut += `\n📁 <i>Full backup saved to R2 Cloud Storage.</i>`;
			await safeEdit(4, finalOut);
		}

		await dbClient.updateScanStatus(job.scanId, 'completed');
	} catch (err: any) {
		try { await bot.api.editMessageText(job.chatId, job.messageId, `❌ <b>Execution Failed:</b> <code>${escapeHtml(err.message)}</code>`, { parse_mode: 'HTML' }); } catch(e) {}
		await dbClient.updateScanStatus(job.scanId, 'failed');
	} finally {
		if (sandbox) try { await sandbox.destroy(); } catch (e) {}
	}
}

export async function processCliJob(job: ScanJob, env: Env) {
	const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
	const dbClient = new DbClient(env.DB);
	let sandbox = null;

	try {
		await dbClient.updateScanStatus(job.scanId, 'running');
		sandbox = getSandbox(env.Sandbox, crypto.randomUUID(), { sleepAfter: job.isPro ? '5m' : '2m', enableDefaultSession: false });

		const result = await sandbox.exec(job.payload, { timeout: job.isPro ? 120000 : 45000 });
		
		let output = '';
		if (result.stdout) output += result.stdout + '\n';
		if (result.stderr) output += result.stderr + '\n';
		output = output.trim() || '[No Output]';

		if (output.length > 3900) {
			const fileKey = `cli/${job.tgId}/execution_${Date.now()}.txt`;
			await env.REPORTS_BUCKET.put(fileKey, output);
			const r2Object = await env.REPORTS_BUCKET.get(fileKey);

			if (r2Object) {
				const arrayBuffer = await r2Object.arrayBuffer();
				await bot.api.sendDocument(job.chatId, new InputFile(new Uint8Array(arrayBuffer), `cli_output.txt`), {
					caption: `✅ <b>Execution Complete</b>\n<code>$ ${escapeHtml(job.payload)}</code>`,
					parse_mode: 'HTML'
				});
				await bot.api.deleteMessage(job.chatId, job.messageId).catch(() => {});
			}
		} else {
			const finalOut = `✅ <b>Execution Complete</b>\n<code>$ ${escapeHtml(job.payload)}</code>\n\n<pre>${escapeHtml(output)}</pre>`;
			await bot.api.editMessageText(job.chatId, job.messageId, finalOut, { parse_mode: 'HTML' });
		}

		await dbClient.updateScanStatus(job.scanId, 'completed');
	} catch (err: any) {
		const errorMsg = `❌ <b>Execution Failed:</b>\n<code>${escapeHtml(err.message)}</code>\n\n<i>Note: Commands taking too long will be killed automatically.</i>`;
		await bot.api.editMessageText(job.chatId, job.messageId, errorMsg, { parse_mode: 'HTML' }).catch(()=>{});
		await dbClient.updateScanStatus(job.scanId, 'failed');
	} finally {
		if (sandbox) try { await sandbox.destroy(); } catch (e) {}
	}
}
