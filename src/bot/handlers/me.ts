import { CommandContext, Context } from 'grammy';
import { Env } from '../../types';
import { DbClient } from '../../db/client';

export async function handleMe(ctx: CommandContext<Context>, env: Env) {
	const tgId = ctx.from?.id;
	if (!tgId) return;

	try {
		const dbClient = new DbClient(env.DB);
		const user = await dbClient.getOrCreateUser(tgId, ctx.from?.username || 'Unknown');

		if (!user) {
			await ctx.reply('⚠️ Profile not found. Please run /start first.');
			return;
		}

		const msg = `👤 *User Profile*\n\n` +
					`ID: \`${user.tg_id}\`\n` +
					`Tier: *${user.tier.toUpperCase()}*\n` +
					`Credits Remaining: *${user.credits}*\n\n` +
					`_Credits reset every 24 hours._`;

		await ctx.reply(msg, { parse_mode: 'Markdown' });
	} catch (error) {
		await ctx.reply('⚠️ Database error occurred.');
	}
}
