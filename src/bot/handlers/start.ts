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

		const msg = `🛡️ <b>Welcome to ReconBox, ${escapeHtml(username)}!</b>\n` +
			`━━━━━━━━━━━━━━━━━━━━━━\n` +
			`<i>Your Anonymous, Ephemeral, and Blazing Fast Security Sandbox. Built for elite Bug Bounty Hunters.</i>\n\n` +
			`📌 <b>Core Commands:</b>\n` +
			`🔹 <code>/recon target.com</code> - Instant Attack Surface Discovery\n` +
			`🔹 <code>/cli nmap -F target.com</code> - Run isolated OSINT tools\n` +
			`🔹 <code>/me</code> - Check your limits & upgrade\n\n` +
			`<i>🔒 Zero Logs. 100% Isolated. Containers self-destruct upon execution.</i>`;

		const keyboard = new InlineKeyboard()
			.url('📖 View Documentation', 'https://telegra.ph/Bot-Usage--Available-Tools-06-03')
			.row()
			.url('👨‍💻 Contact Founder', 'https://t.me/drkingbd');

		await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
	} catch (error) {
		await ctx.reply('⚠️ <b>System Error:</b> Failed to initialize your profile.', { parse_mode: 'HTML' });
	}
}
