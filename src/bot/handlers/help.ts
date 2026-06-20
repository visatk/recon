import { CommandContext, Context, InlineKeyboard } from 'grammy';
import { Env } from '../../types';

export async function handleHelp(ctx: CommandContext<Context>, env: Env) {
	const msg = `📖 <b>RECONBOX MANUAL</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━\n` +
		`Welcome to the ultimate Enterprise Security Sandbox. Built for precision and scale. All isolated environments self-destruct immediately after execution.\n\n` +
		`🔍 <b>1. Advanced Scanning:</b>\n` +
		`├ <code>/recon &lt;domain&gt;</code> - Automated Attack Surface Discovery\n` +
		`└ <code>/cli &lt;cmd&gt;</code> - Execute Isolated OSINT Tools\n` +
		`   <i>Example: <code>/cli nmap -p- target.com</code></i>\n\n` +
		`👤 <b>2. Workspace & Billing:</b>\n` +
		`├ <code>/me</code> - View Subscription & Quotas\n` +
		`├ <code>/upgrade</code> - Unlock PRO Capabilities (TRC20)\n` +
		`└ <code>/txid &lt;hash&gt;</code> - Submit USDT Payment Hash\n\n` +
		`🛠 <b>3. Supported Secure Binaries:</b>\n` +
		`<code>nmap, subfinder, httpx, whois, dig, curl, wget, jq, grep, cat, ls, echo</code>\n\n` +
		`<i>⚠️ Privacy Guarantee: Zero logs retained. Scan outputs are strictly confined to this chat.</i>`;

	const keyboard = new InlineKeyboard().url('👨‍💻 Contact Founder & Support', 'https://t.me/drkingbd');
	await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
}
