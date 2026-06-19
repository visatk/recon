import { CommandContext, Context } from 'grammy';
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

        const msg = `🛡️ <b>Welcome to ReconBox, ${escapeHtml(username)}!</b>\n\n` +
            `<i>Your Anonymous, Ephemeral, and Blazing Fast Security Sandbox. Built for elite Bug Bounty Hunters.</i>\n\n` +
            `📌 <b>Core Commands:</b>\n` +
            `🔹 <code>/recon target.com</code> - Full Automated Scan\n` +
            `🔹 <code>/cli nmap target.com</code> - Raw Tool Execution\n` +
            `🔹 <code>/me</code> - Account Limits\n` +
            `🔹 <code>/upgrade</code> - Unlock PRO\n\n` +
            `<b>Cloudflare Edge Latency. Node.js Native Streams. Durable Object Isolation.</b>`;

        await ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (e) {
        console.error(e);
        await ctx.reply('⚠️ <b>Database Error.</b>', { parse_mode: 'HTML' });
    }
}
