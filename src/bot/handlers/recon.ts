import { CommandContext, Context } from 'grammy';
import { Env, ScanJob } from '../../types';
import { DbClient } from '../../db/client';

export async function handleRecon(ctx: CommandContext<Context>, env: Env) {
    const tgId = ctx.from?.id;
    const domain = ctx.match?.trim();
    if (!tgId) return;

    if (!domain || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
        return ctx.reply('⚠️ <b>Invalid target format.</b>\nExample: <code>/recon target.com</code>', { parse_mode: 'HTML' });
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

        const scanId = await dbClient.createScan(tgId, domain, 'recon');
        if (access.tier === 'free') {
            await dbClient.deductCredit(tgId);
        }

        const job: ScanJob = {
            type: 'recon',
            tgId,
            chatId: ctx.chat!.id,
            messageId: ctx.message!.message_id,
            scanId,
            payload: domain,
            isPro: access.tier === 'pro'
        };

        await env.SCAN_QUEUE.send(job);
        await ctx.reply('✅ <b>Recon Job Queued!</b> Container spinning up...', { parse_mode: 'HTML' });
    } catch (e) {
        console.error(e);
        await ctx.reply('⚠️ <b>Error queueing job.</b>', { parse_mode: 'HTML' });
    }
}
