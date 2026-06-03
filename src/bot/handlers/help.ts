import { CommandContext, Context, InlineKeyboard } from 'grammy';
import { Env } from '../../types';

export async function handleHelp(ctx: CommandContext<Context>, env: Env) {
	const msg = `📖 <b>ReconBox User Manual</b>\n\n` +
		`Welcome to the ultimate Ephemeral Security Sandbox. Here are your commands:\n\n` +
		`🔍 <b>Core Security Tools:</b>\n` +
		`🔹 <code>/recon &lt;domain.com&gt;</code> - Full automated Attack Surface Discovery (Subdomains, Ports, Tech Stack).\n` +
		`🔹 <code>/cli &lt;command&gt;</code> - Run individual isolated tools. Example: <code>/cli nmap -F target.com</code>\n\n` +
		`👤 <b>Account & Billing:</b>\n` +
		`🔹 <code>/me</code> - View your tier, remaining credits, and limits.\n` +
		`🔹 <code>/upgrade</code> - Get PRO Access via USDT (TRC20).\n\n` +
		`🛠 <b>Supported CLI Tools:</b>\n` +
		`<code>nmap, subfinder, httpx, whois, dig, curl, wget, jq, grep, cat, ls, echo</code>\n\n` +
		`<i>⚠️ Note: For your security, all containers self-destruct immediately after execution. We store zero logs of your output.</i>`;

	const keyboard = new InlineKeyboard()
		.url('👨‍💻 Contact Support', 'https://t.me/drkingbd');

	await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
}
