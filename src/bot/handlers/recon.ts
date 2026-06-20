import { CommandContext, Context } from 'grammy';
import { Env, ScanJob } from '../../types';
import { DbClient } from '../../db/client';
import { escapeHtml } from '../../utils/ui';

export async function handleRecon(ctx: CommandContext<Context>, env: Env) {
	const tgId = ctx.from?.id;
	const domain = ctx.match?.trim();
	if (!tgId) return;

	if (!domain || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
		return ctx.reply('⚠️ <b>Invalid Target Format.</b>\nExample: <code>/recon target.com</code>', { parse_mode: 'HTML' });
	}

	const dbClient = new DbClient(env.DB);
	try {
		if (await dbClient.hasActiveScan(tgId)) return ctx.reply('⏳ <b>Scan already in progress.</b> Please wait for the current operation to conclude.', { parse_mode: 'HTML' });
		
		const access = await dbClient.checkCredits(tgId);
		if (!access.allowed) return ctx.reply('❌ <b>Compute Limit Reached.</b>\nWait 24 hours for reset or upgrade to <b>PRO</b> for unlimited access.', { parse_mode: 'HTML' });

		const isPro = access.tier === 'pro';
		const scanId = await dbClient.createScan(tgId, domain, 'multi-recon');
		if (!isPro) await dbClient.deductCredit(tgId);

		const progressMsg = await ctx.reply(`⏳ <b>Engine Initializing...</b>\n<blockquote>🎯 <b>Target:</b> <code>${escapeHtml(domain)}</code></blockquote>\n<i>Provisioning secure container. Scan will commence shortly.</i>`, { parse_mode: 'HTML' });

		const jobPayload: ScanJob = { type: 'recon', tgId, chatId: ctx.chat.id, messageId: progressMsg.message_id, scanId, payload: domain, isPro };
		await env.SCAN_QUEUE.send(jobPayload);
	} catch (error) {
		await ctx.reply('⚠️ <b>System Error:</b> Could not queue request.', { parse_mode: 'HTML' });
	}
}
