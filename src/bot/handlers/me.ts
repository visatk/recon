import { CommandContext, Context, InlineKeyboard } from 'grammy';
import { Env } from '../../types';
import { DbClient } from '../../db/client';
import { escapeHtml } from '../../utils/ui';

export async function handleMe(ctx: CommandContext<Context>, env: Env) {
	const tgId = ctx.from?.id;
	if (!tgId) return;

	try {
		const dbClient = new DbClient(env.DB);
		const user = await dbClient.getOrCreateUser(tgId, ctx.from?.username || 'Unknown');
		if (!user) return ctx.reply('⚠️ <b>Profile not found.</b> Run /start first.', { parse_mode: 'HTML' });

		const isPro = user.tier === 'pro';
		let msg = `📊 <b>ENTERPRISE WORKSPACE</b>\n` +
				  `━━━━━━━━━━━━━━━━━━━━━━\n` +
				  `👤 <b>Client:</b> ${escapeHtml(user.username)}\n` +
				  `🆔 <b>Account ID:</b> <code>${user.tg_id}</code>\n\n`;

		const keyboard = new InlineKeyboard();

		if (isPro) {
			msg += `💎 <b>Subscription:</b> ⭐ <b>PRO ELITE</b> ⭐\n⚡ <b>Compute Credits:</b> ♾️ <b>Unlimited</b>\n\n<i>🚀 Active: Max Execution Timeout & Unrestricted Deep Scans.</i>`;
		} else {
			msg += `💎 <b>Subscription:</b> <b>FREE TIER</b>\n⚡ <b>Compute Credits:</b> <b>${user.credits} / 5</b>\n\n<i>🔄 Credits reset every 24 hours. Upgrade to bypass limits.</i>`;
			keyboard.url('💎 Upgrade to PRO', 'https://t.me/drkingbd');
		}

		await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
	} catch (error) {
		await ctx.reply('⚠️ <b>Database Error:</b> Unable to fetch profile.', { parse_mode: 'HTML' });
	}
}
