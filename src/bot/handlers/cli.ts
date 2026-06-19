import { CommandContext, Context } from 'grammy';
import { Env, ScanJob } from '../../types';
import { DbClient } from '../../db/client';

const ALLOWED_TOOLS = ['nmap', 'subfinder', 'httpx', 'whois', 'dig', 'curl', 'wget', 'jq', 'grep', 'cat', 'echo', 'ls'];

export async function handleCli(ctx: CommandContext<Context>, env: Env) {
    const tgId = ctx.from?.id;
    const rawCommand = ctx.match?.trim();
    if (!tgId) return;

    if (!rawCommand) {
        return ctx.reply('⚠️ <b>Please provide a command.</b>\nExample: <code>/cli nmap -F target.com</code>', { parse_mode: 'HTML' });
    }

    if (/[;&|`$\n\r<>]/.test(rawCommand)) {
        return ctx.reply('❌ <b>Security Alert:</b> Shell chaining and redirection operators are strictly prohibited.', { parse_mode: 'HTML' });
    }

    const baseTool = rawCommand.split(' ')[0];
    if (!ALLOWED_TOOLS.includes(baseTool)) {
        return ctx.reply(`❌ <b>Tool Not Allowed.</b>\nAllowed tools: ${ALLOWED_TOOLS.join(', ')}`, { parse_mode: 'HTML' });
    }

    const dbClient = new DbClient(env.DB);
    try {
        if (await dbClient.hasActiveScan(tgId)) {
            return ctx.reply('⏳ <b>Scan in progress!</b> Please wait.', { parse_mode: 'HTML' });
        }

        const access = await dbClient.checkCredits(tgId);
        if (!access.allowed) {
            return ctx.reply('❌ <b>Insufficient Credits!</b> Upgrade to PRO using /upgrade.', { parse_mode: 'HTML' });
        }

        const scanId = await dbClient.createScan(tgId, rawCommand, 'cli');
        if (access.tier === 'free') {
            await dbClient.deductCredit(tgId);
        }

        const job: ScanJob = {
            type: 'cli',
            tgId,
            chatId: ctx.chat!.id,
            messageId: ctx.message!.message_id,
            scanId,
            payload: rawCommand,
            isPro: access.tier === 'pro'
        };

        await env.SCAN_QUEUE.send(job);
        await ctx.reply('✅ <b>CLI Job Queued!</b> Provisioning execution boundary...', { parse_mode: 'HTML' });
    } catch (e) {
        console.error(e);
        await ctx.reply('⚠️ <b>Error queueing job.</b>', { parse_mode: 'HTML' });
    }
}
