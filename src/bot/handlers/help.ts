import { CommandContext, Context } from 'grammy';
import { Env } from '../../types';

export async function handleHelp(ctx: CommandContext<Context>, env: Env) {
    const msg = `📖 <b>MANUAL</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Welcome to the ultimate Ephemeral Security Sandbox. All containers self-destruct after use.\n\n` +
        `🔍 <b>1. Security Scanning:</b>\n` +
        `├ <code>/recon &lt;domain&gt;</code> - Automated Attack Surface Discovery\n` +
        `└ <code>/cli &lt;cmd&gt;</code> - Run isolated OSINT tools\n` +
        `   <i>Example: <code>/cli nmap -F target.com</code></i>\n\n` +
        `👤 <b>2. Account & Billing:</b>\n` +
        `├ <code>/me</code> - View credits and tier\n` +
        `└ <code>/upgrade</code> - Purchase PRO with Telegram Stars\n\n` +
        `⚡ Powered by Cloudflare Workers & Durable Objects.`;

    await ctx.reply(msg, { parse_mode: 'HTML' });
}
