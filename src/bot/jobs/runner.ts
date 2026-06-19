import { Bot } from 'grammy';
import { Env, ScanJob } from '../../types';
import { DbClient } from '../../db/client';
import { getSandbox } from '@cloudflare/sandbox';
import { formatOutput, escapeHtml, getProgressBar } from '../../utils/ui';

export async function processReconJob(job: ScanJob, env: Env, ctx: ExecutionContext) {
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
        
        sandbox = getSandbox(env.Sandbox, crypto.randomUUID(), { 
            sleepAfter: job.isPro ? '5m' : '2m', 
            enableDefaultSession: false 
        });

        const safeExec = async (cmd: string, timeout: number) => {
            try { 
                const res = await sandbox!.exec(cmd, { timeout }); 
                return { stdout: (res.stdout + '\n' + res.stderr).trim(), stderr: res.stderr, success: res.success, exitCode: res.exitCode };
            } 
            catch (e: any) { return { stdout: '', stderr: `[Timeout/Error: ${e.message}]`, success: false, exitCode: 1 }; }
        };

        if (job.type === 'recon') {
            await safeEdit(1, '🔍 Enumerating Subdomains...');
            await safeExec(`subfinder -d ${job.payload} -all -silent -max-time ${job.isPro ? 20 : 10} > /workspace/subs.txt`, job.isPro ? 25000 : 15000);
            const subResult = await safeExec(`cat /workspace/subs.txt 2>/dev/null || echo ""`, 5000);
            const subList = (subResult.stdout || '').split('\n').filter(s => s.trim().length > 0);

            await safeEdit(2, `⚡ Probing targets...`);
            const httpxTarget = subList.length > 0 ? 'cat /workspace/subs.txt' : `echo ${job.payload}`;
            await safeExec(`${httpxTarget} | httpx -silent -sc -td -server -title -t 50 > /workspace/httpx.txt`, job.isPro ? 30000 : 20000);

            await safeEdit(3, `🌐 Extracting Domain Identity...`);
            const whoisResult = await safeExec(`whois ${job.payload} | grep -iE "Registrar:|Creation Date:|Expiry Date:|Name Server:" | awk '{$1=$1;print}' | sort -u | head -n 10`, 10000);

            await safeEdit(4, `✅ Uploading Report to R2...`);
            const reportData = await safeExec(`cat /workspace/httpx.txt`, 5000);
            
            // Native Streaming to R2 without chunking into isolate memory bounds
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(reportData.stdout));
                    controller.close();
                }
            });

            const reportKey = `recon-${crypto.randomUUID()}.txt`;
            await env.REPORTS_BUCKET.put(reportKey, stream);

            const finalMsg = `✅ <b>Recon Completed</b>\n\n` +
                `<b>WHOIS Identity:</b>\n<pre>${escapeHtml(whoisResult.stdout || 'No Data')}</pre>\n\n` +
                `<b>Live Hosts Discovered:</b> ${subList.length}\n` +
                `<b>Report:</b> Saved to R2 (Key: <code>${reportKey}</code>)`;

            await bot.api.sendMessage(job.chatId, finalMsg, { parse_mode: 'HTML', reply_to_message_id: job.messageId });
        } else {
            // CLI Mode Execution
            await safeEdit(1, `🛠️ Executing: <code>${job.payload}</code>`);
            const res = await safeExec(job.payload, job.isPro ? 45000 : 15000);
            
            let output = res.stdout || res.stderr;
            if (output.length > 3500) {
                output = output.substring(0, 3500) + '\n...[TRUNCATED]';
            }

            const finalMsg = formatOutput('Execution Result', output);
            await bot.api.sendMessage(job.chatId, finalMsg, { parse_mode: 'HTML', reply_to_message_id: job.messageId });
        }

        await dbClient.updateScanStatus(job.scanId, 'completed');
    } catch (e: any) {
        console.error(e);
        await bot.api.sendMessage(job.chatId, `❌ <b>Execution Failed</b>\n<pre>${escapeHtml(e.message)}</pre>`, { parse_mode: 'HTML' });
        await dbClient.updateScanStatus(job.scanId, 'failed');
    }
}
