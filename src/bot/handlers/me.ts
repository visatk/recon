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

		let msg = `👤 <b>ACCOUNT DASHBOARD</b>\n` +
				  `━━━━━━━━━━━━━━━━━━━━━━\n` +
				  `📝 <b>User:</b> ${escapeHtml(user.username)}\n` +
				  `🆔 <b>ID:</b> <code>${user.tg_id}</code>\n\n`;

		const keyboard = new InlineKeyboard();

		if (isPro) {
			msg += `💎 <b>Plan:</b> ⭐ <b>PRO ACCESS</b> ⭐\n` +
				   `⚡ <b>Credits:</b> ♾️ <b>Unlimited</b>\n\n` +
				   `<i>🚀 You have unlocked Max Execution Time & Deep Scans!</i>`;
		} else {
			msg += `💎 <b>Plan:</b> <b>FREE TIER</b>\n` +
				   `⚡ <b>Credits Left:</b> <b>${user.credits} / 5</b>\n\n` +
				   `<i>🔄 Free credits reset every 24 hours.</i>`;
			keyboard.text('🚀 Upgrade to PRO', 'upgrade_prompt'); // Assuming you handle this callback or just point to /upgrade
		}

		await ctx.reply(msg, { parse_mode: 'HTML' });
	} catch (error) {
		await ctx.reply('⚠️ <b>Database Error:</b> Unable to fetch profile.', { parse_mode: 'HTML' });
	}
}
