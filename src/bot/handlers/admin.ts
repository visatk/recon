import { CommandContext, Context } from 'grammy';
import { Env } from '../../types';
import { DbClient } from '../../db/client';

const isAdmin = (ctx: CommandContext<Context>, env: Env) => {
	return ctx.from?.id.toString() === env.ADMIN_TG_ID;
};

export async function handleAdmin(ctx: CommandContext<Context>, env: Env) {
	if (!isAdmin(ctx, env)) return;

	const dbClient = new DbClient(env.DB);
	const stats = await dbClient.getSystemStats();

	const msg = `👑 <b>SYSTEM COMMAND CENTER</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━\n` +
		`📊 <b>Platform Analytics:</b>\n` +
		`├ 👥 <b>Total Users:</b> ${stats.totalUsers}\n` +
		`├ 💎 <b>PRO Users:</b> ${stats.proUsers}\n` +
		`└ 🔍 <b>Total Scans:</b> ${stats.totalScans}\n\n` +
		`🛠️ <b>Management Commands:</b>\n` +
		`• <code>/tier [id] pro</code> - Upgrade user\n` +
		`• <code>/tier [id] free</code> - Downgrade user\n` +
		`• <code>/addcredits [id] [qty]</code> - Gift credits`;

	await ctx.reply(msg, { parse_mode: 'HTML' });
}

export async function handleTier(ctx: CommandContext<Context>, env: Env) {
	if (!isAdmin(ctx, env)) return;

	const args = ctx.match?.split(' ');
	if (!args || args.length !== 2) {
		return ctx.reply('⚠️ <b>Syntax Error:</b>\n<code>/tier &lt;tg_id&gt; &lt;pro|free&gt;</code>', { parse_mode: 'HTML' });
	}

	const targetId = parseInt(args[0]);
	const tier = args[1].toLowerCase();

	if (isNaN(targetId) || (tier !== 'pro' && tier !== 'free')) {
		return ctx.reply('❌ <b>Invalid format.</b> Tier must be "pro" or "free".', { parse_mode: 'HTML' });
	}

	const dbClient = new DbClient(env.DB);
	await dbClient.setTier(targetId, tier as 'pro' | 'free');

	await ctx.reply(`✅ <b>Success:</b> User <code>${targetId}</code> is now updated to <b>${tier.toUpperCase()}</b>.`, { parse_mode: 'HTML' });

	// Notify the user
	if (tier === 'pro') {
		try {
			await ctx.api.sendMessage(targetId, `🎉 <b>ACCOUNT UPGRADED!</b>\n━━━━━━━━━━━━━━━━━━━━━━\nYour account has been upgraded to <b>PRO</b> status by the system admin. Enjoy unlimited deep scans!`, { parse_mode: 'HTML' });
		} catch (e) {
			console.log("Could not DM user.");
		}
	}
}

export async function handleAddCredits(ctx: CommandContext<Context>, env: Env) {
	if (!isAdmin(ctx, env)) return;

	const args = ctx.match?.split(' ');
	if (!args || args.length !== 2) {
		return ctx.reply('⚠️ <b>Syntax Error:</b>\n<code>/addcredits &lt;tg_id&gt; &lt;amount&gt;</code>', { parse_mode: 'HTML' });
	}

	const targetId = parseInt(args[0]);
	const amount = parseInt(args[1]);

	if (isNaN(targetId) || isNaN(amount)) {
		return ctx.reply('❌ <b>Invalid format.</b> ID and amount must be numbers.', { parse_mode: 'HTML' });
	}

	const dbClient = new DbClient(env.DB);
	await dbClient.addCredits(targetId, amount);

	await ctx.reply(`✅ <b>Success:</b> Added ${amount} credits to User <code>${targetId}</code>.`, { parse_mode: 'HTML' });
	
	try {
		await ctx.api.sendMessage(targetId, `🎁 <b>SYSTEM BONUS!</b>\n━━━━━━━━━━━━━━━━━━━━━━\nAn admin has gifted you <b>${amount}</b> additional scan credits. Happy hunting!`, { parse_mode: 'HTML' });
	} catch (e) {}
}
