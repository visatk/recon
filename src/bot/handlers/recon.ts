import { CommandContext, Context } from 'grammy';
import { Env, ScanJob } from '../../types';
import { DbClient } from '../../db/client';
import { escapeHtml } from '../../utils/ui';

export async function handleRecon(ctx: CommandContext<Context>, env: Env) {
	const tgId = ctx.from?.id;
	const domain = ctx.match?.trim();
	if (!tgId) return;

	if (!domain || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
		return ctx.reply('⚠️ <b>Invalid target format.</b>\nExample: <code>/recon target.com</code>', { parse_mode: 'HTML' });
	}

	const dbClient = new DbClient(env.DB);
	try {
		const isScanning = await dbClient.hasActiveScan(tgId);
		if (isScanning) {
			return ctx.reply('⏳ <b>Scan in progress!</b> Please wait.', { parse_mode: 'HTML' });
		}

		const access = await dbClient.checkCredits(tgId);
		if (!access.allowed) {
			return ctx.reply('❌ <b>Credit Limit Reached.</b>\nWait 24 hours or upgrade to PRO.', { parse_mode: 'HTML' });
		}

		const isPro = access.tier === 'pro';
		const scanId = await dbClient.createScan(tgId, domain, 'multi-recon');
		if (!isPro) await dbClient.deductCredit(tgId);

		const progressMsg = await ctx.reply(`⏳ <b>Scan Queued!</b>\nTarget: <code>${escapeHtml(domain)}</code>\n<i>Your job is in the queue and will start shortly...</i>`, { parse_mode: 'HTML' });

		// Send job to Cloudflare Queue[cite: 3]
		const jobPayload: ScanJob = {
			type: 'recon',
			tgId,
			chatId: ctx.chat.id,
			messageId: progressMsg.message_id,
			scanId,
			payload: domain,
			isPro
		};
		await env.SCAN_QUEUE.send(jobPayload);

	} catch (error) {
		await ctx.reply('⚠️ <b>System Error:</b> Could not queue request.', { parse_mode: 'HTML' });
	}
}
