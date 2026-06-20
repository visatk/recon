import { CommandContext, Context } from 'grammy';
import { Env } from '../../types';
import { DbClient } from '../../db/client';

const isAdmin = (ctx: CommandContext<Context>, env: Env) => ctx.from?.id.toString() === env.ADMIN_TG_ID;

export async function handleAdmin(ctx: CommandContext<Context>, env: Env) {
	if (!isAdmin(ctx, env)) return;
	const stats = await new DbClient(env.DB).getSystemStats();

	const msg = `👑 <b>ENTERPRISE COMMAND CENTER</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📊 <b>Platform Analytics:</b>\n` + 
				`<blockquote>👥 <b>Total Clients:</b> ${stats.totalUsers}\n` +
				`💎 <b>Elite Licenses:</b> ${stats.proUsers}\n` + 
				`🔍 <b>Total Executions:</b> ${stats.totalScans}</blockquote>\n\n` + 
				`🛠️ <b>License Management:</b>\n` +
				`• <code>/tier [id] pro</code> - Provision Elite\n` +
				`• <code>/tier [id] free</code> - Revoke Elite\n` +
				`• <code>/addcredits [id] [qty]</code> - Issue Compute Credits`;
	await ctx.reply(msg, { parse_mode: 'HTML' });
}

export async function handleTier(ctx: CommandContext<Context>, env: Env) {
	if (!isAdmin(ctx, env)) return;
	const args = ctx.match?.trim().split(/\s+/);
	if (!args || args.length !== 2 || !args[0]) return ctx.reply('⚠️ <code>/tier &lt;tg_id&gt; &lt;pro|free&gt;</code>', { parse_mode: 'HTML' });

	const targetId = parseInt(args[0]);
	const tier = args[1].toLowerCase();
	if (isNaN(targetId) || (tier !== 'pro' && tier !== 'free')) return ctx.reply('❌ Invalid format.');

	await new DbClient(env.DB).setTier(targetId, tier as 'pro' | 'free');
	await ctx.reply(`✅ <b>Success:</b> User <code>${targetId}</code> is now <b>${tier.toUpperCase()}</b>.`, { parse_mode: 'HTML' });

	if (tier === 'pro') {
		try { await ctx.api.sendMessage(targetId, `🎉 <b>PRO ELITE ACTIVATED!</b>\n━━━━━━━━━━━━━━━━━━━━━━\nYour enterprise license has been successfully provisioned. You now have unrestricted access to our deep execution engine.`, { parse_mode: 'HTML' }); } catch (e) {}
	}
}

export async function handleAddCredits(ctx: CommandContext<Context>, env: Env) {
	if (!isAdmin(ctx, env)) return;
	const args = ctx.match?.trim().split(/\s+/);
	if (!args || args.length !== 2 || !args[0]) return ctx.reply('⚠️ <code>/addcredits &lt;tg_id&gt; &lt;amount&gt;</code>', { parse_mode: 'HTML' });

	const targetId = parseInt(args[0]);
	const amount = parseInt(args[1]);
	if (isNaN(targetId) || isNaN(amount)) return ctx.reply('❌ Invalid format.');

	await new DbClient(env.DB).addCredits(targetId, amount);
	await ctx.reply(`✅ <b>Success:</b> Added ${amount} credits to User <code>${targetId}</code>.`, { parse_mode: 'HTML' });
	try { await ctx.api.sendMessage(targetId, `🎁 <b>COMPUTE CREDITS ISSUED!</b>\n━━━━━━━━━━━━━━━━━━━━━━\nThe system administrator has deposited <b>${amount}</b> additional execution credits to your workspace.`, { parse_mode: 'HTML' }); } catch (e) {}
}
