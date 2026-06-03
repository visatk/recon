import { CommandContext, Context } from 'grammy';
import { Env } from '../../types';
import { DbClient } from '../../db/client';

export async function handleStart(ctx: CommandContext<Context>, env: Env) {
	const tgId = ctx.from?.id;
	const username = ctx.from?.username || 'Unknown';

	if (!tgId) return;

	try {
		const dbClient = new DbClient(env.DB);
		await dbClient.getOrCreateUser(tgId, username);

		await ctx.reply(
			'🛡️ *Welcome to ReconBox*\n\n' +
			'_Anonymous, Ephemeral, and Blazing Fast Browser Security Sandbox._\n\n' +
			'📌 *Available Commands:*\n' +
			'🔹 `/recon <domain>` - Run full automated deep recon.\n' +
			'🔹 `/cli <command>` - Run custom tool commands (e.g., `/cli nmap -sV target.com`).\n' +
			'🔹 `/me` - Check your account credits.',
			{ parse_mode: 'Markdown' }
		);
	} catch (error) {
		console.error('Error handling start command:', error);
		await ctx.reply('⚠️ Failed to initialize your security profile. Please try again later.');
	}
}
