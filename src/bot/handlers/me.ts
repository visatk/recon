import { CommandContext, Context } from 'grammy';
import { Env } from '../../types';
import { DbClient } from '../../db/client';
import { escapeHtml } from '../../utils/ui';

export async function handleMe(ctx: CommandContext<Context>, env: Env) {
	const tgId = ctx.from?.id;
	if (!tgId) return;

	try {
		const dbClient = new DbClient(env.DB);
		const user = await dbClient.getOrCreateUser(tgId, ctx.from?.username || 'Unknown');

		if (!user) return ctx.reply('⚠️ Profile not found. Run /start first.');

		const msg = `👤 <b>User Profile:</b> ${escapeHtml(user.username)}\n\n` +
					`🆔 <b>ID:</b> <code>${user.tg_id}</code>\n` +
					`💎 <b>Tier:</b> <b>${user.tier.toUpperCase()}</b>\n` +
					`⚡ <b>Credits Remaining:</b> <b>${user.credits}</b>\n\n` +
					`<i>🔄 Credits reset every 24 hours.</i>`;

		await ctx.reply(msg, { parse_mode: 'HTML' });
	} catch (error) {
		await ctx.reply('⚠️ <b>Database Error.</b>', { parse_mode: 'HTML' });
	}
}
