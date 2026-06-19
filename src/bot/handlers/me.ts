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
        if (!user) return ctx.reply('⚠️ <b>Profile not found.</b> Run /start first.', { parse_mode: 'HTML' });

        const isPro = user.tier === 'pro';
        let msg = `👤 <b>ACCOUNT DASHBOARD</b>\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `📝 <b>User:</b> ${escapeHtml(user.username)} (<code>${user.tg_id}</code>)\n` +
                  `🎖️ <b>Tier:</b> ${isPro ? '💎 PRO' : '🆓 FREE'}\n` +
                  `🔋 <b>Credits:</b> ${isPro ? 'Unlimited' : `${user.credits}/5`}\n\n`;

        if (!isPro) {
            msg += `<i>Credits reset daily. Upgrade using /upgrade for unlimited execution, priority queues, and longer timeouts.</i>`;
        }

        await ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (e) {
        console.error(e);
        await ctx.reply('⚠️ <b>Database Error.</b>', { parse_mode: 'HTML' });
    }
}
