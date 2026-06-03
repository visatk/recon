import { CommandContext, Context, InlineKeyboard } from 'grammy';
import { Env } from '../../types';
import { DbClient } from '../../db/client';
import { escapeHtml } from '../../utils/ui';

export async function handleStart(ctx: CommandContext<Context>, env: Env) {
	const tgId = ctx.from?.id;
	const username = ctx.from?.username || 'User';

	if (!tgId) return;

	try {
		const dbClient = new DbClient(env.DB);
		await dbClient.getOrCreateUser(tgId, username);

		// Premium UI formatting
		const msg = `🛡️ <b>Welcome to ReconBox, ${escapeHtml(username)}!</b>\n\n` +
			`<i>Your Anonymous, Ephemeral, and Blazing Fast Security Sandbox.</i>\n\n` +
			`📌 <b>Available Commands:</b>\n` +
			`🔹 <code>/recon example.com</code> - Full automated deep recon\n` +
			`🔹 <code>/cli nmap -sV target.com</code> - Run custom OSINT tools\n` +
			`🔹 <code>/me</code> - Check your account limits\n\n` +
			`<i>🔒 All containers are destroyed immediately after execution.</i>`;

		const keyboard = new InlineKeyboard()
			.url('📖 View Documentation', 'https://github.com')
			.url('👨‍💻 Developer Support', 'https://t.me/your_channel_or_username');

		await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
	} catch (error) {
		console.error('Start Command Error:', error);
		await ctx.reply('⚠️ <b>System Error:</b> Failed to initialize your profile.', { parse_mode: 'HTML' });
	}
}
