import { CommandContext, Context, InlineKeyboard } from 'grammy';
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
		`├ <code>/me</code> - View limits & tier status\n` +
		`├ <code>/upgrade</code> - Get PRO Access (TRC20)\n` +
		`└ <code>/txid &lt;hash&gt;</code> - Submit USDT payment\n\n` +
		`🛠 <b>3. Supported CLI Binaries:</b>\n` +
		`<code>nmap, subfinder, httpx, whois, dig, curl, wget, jq, grep, cat, ls, echo</code>\n\n` +
		`<i>⚠️ Privacy: We store zero logs. Outputs exist only in your chat.</i>`;

	const keyboard = new InlineKeyboard().url('👨‍💻 Contact Founder & Support', 'https://t.me/drkingbd');
	await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
}
