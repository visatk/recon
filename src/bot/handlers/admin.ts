import { CommandContext, Context } from 'grammy';
import { Env } from '../../types';
import { DbClient } from '../../db/client';

const isAdmin = (ctx: CommandContext<Context>, env: Env) => ctx.from?.id.toString() === env.ADMIN_TG_ID;

export async function handleAdmin(ctx: CommandContext<Context>, env: Env) {
    if (!isAdmin(ctx, env)) return;
    const stats = await new DbClient(env.DB).getSystemStats();

    const msg = `👑 <b>SYSTEM COMMANDS</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📊 <b>Platform Analytics:</b>\n├ 👥 <b>Total Users:</b> ${stats.totalUsers}\n├ 💎 <b>PRO Users:</b> ${stats.proUsers}\n└ 🔍 <b>Total Scans:</b> ${stats.totalScans}\n\n🛠️ <b>Management Commands:</b>\n• <code>/tier [id] pro</code> - Upgrade\n• <code>/tier [id] free</code> - Downgrade\n• <code>/addcredits [id] [qty]</code> - Gift credits`;
    await ctx.reply(msg, { parse_mode: 'HTML' });
}

export async function handleTier(ctx: CommandContext<Context>, env: Env) {
    if (!isAdmin(ctx, env)) return;
    const args = ctx.match?.trim().split(/\s+/);
    if (!args || args.length !== 2) return ctx.reply('⚠️ Usage: <code>/tier [tg_id] [pro|free]</code>', { parse_mode: 'HTML' });

    const success = await new DbClient(env.DB).setTier(parseInt(args[0]), args[1] as 'free' | 'pro');
    await ctx.reply(success ? '✅ <b>Tier updated successfully.</b>' : '❌ <b>Update failed.</b>', { parse_mode: 'HTML' });
}

export async function handleAddCredits(ctx: CommandContext<Context>, env: Env) {
    if (!isAdmin(ctx, env)) return;
    const args = ctx.match?.trim().split(/\s+/);
    if (!args || args.length !== 2) return ctx.reply('⚠️ Usage: <code>/addcredits [tg_id] [amount]</code>', { parse_mode: 'HTML' });

    const success = await new DbClient(env.DB).addCredits(parseInt(args[0]), parseInt(args[1]));
    await ctx.reply(success ? '✅ <b>Credits added successfully.</b>' : '❌ <b>Update failed.</b>', { parse_mode: 'HTML' });
}
