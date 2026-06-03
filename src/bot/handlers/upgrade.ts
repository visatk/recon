import { CommandContext, Context, InlineKeyboard } from 'grammy';
import { Env } from '../../types';
import { escapeHtml } from '../../utils/ui';

export async function handleUpgrade(ctx: CommandContext<Context>, env: Env) {
	const msg = `🚀 <b>RECONBOX PRO</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━\n` +
		`<i>Level up your bug bounty game with unlimited power.</i>\n\n` +
		`🔥 <b>PRO Features:</b>\n` +
		`• <b>Unlimited Scans:</b> Zero daily limits.\n` +
		`• <b>Deep Execution:</b> Access to intensive OSINT tools.\n` +
		`• <b>Extended Timeout:</b> 5-minute container lifespan.\n` +
		`• <b>Priority Node:</b> Instant sandbox provisioning.\n\n` +
		`💳 <b>Subscription:</b> <b>10 USDT / Month</b>\n` +
		`🔗 <b>Network:</b> Tron (TRC20)\n\n` +
		`🏦 <b>Payment Address:</b>\n<code>${env.TRC20_WALLET || 'WALLET_NOT_SET'}</code>\n\n` +
		`⚡ <b>Activation Steps:</b>\n` +
		`1️⃣ Send exactly <b>10 USDT</b> to the TRC20 address above.\n` +
		`2️⃣ Copy your TxID (Transaction Hash) from your wallet.\n` +
		`3️⃣ Submit your payment by replying with:\n` +
		`👉 <code>/txid YOUR_TRANSACTION_HASH</code>\n\n` +
		`<i>⏳ Accounts are activated manually after blockchain confirmation.</i>`;

	const keyboard = new InlineKeyboard().url('💬 Contact Billing Support', 'https://t.me/drkingbd');
	await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
}

export async function handleTxid(ctx: CommandContext<Context>, env: Env) {
	const tgId = ctx.from?.id;
	const username = ctx.from?.username || 'Unknown';
	const txid = ctx.match?.trim();

	if (!tgId) return;
	if (!txid) return ctx.reply('⚠️ <b>Usage Error:</b>\n<code>/txid 8a3fac49...</code>', { parse_mode: 'HTML' });
	if (txid.length < 30) return ctx.reply('❌ <b>Invalid Transaction Hash:</b>\nPlease provide a valid TRC20 TxID.', { parse_mode: 'HTML' });

	const adminMsg = `💰 <b>NEW PRO PAYMENT ALERT</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>User:</b> @${escapeHtml(username)}\n🆔 <b>ID:</b> <code>${tgId}</code>\n🔗 <b>TxID:</b> <code>${escapeHtml(txid)}</code>\n\n🔍 <a href="https://tronscan.org/#/transaction/${escapeHtml(txid)}">Verify on TronScan</a>\n\n⚙️ <b>Quick Action:</b>\n<code>/tier ${tgId} pro</code>`;

	try {
		await ctx.api.sendMessage(env.ADMIN_TG_ID, adminMsg, { parse_mode: 'HTML', disable_web_page_preview: true });
		await ctx.reply(`✅ <b>Payment Submitted Successfully!</b>\n━━━━━━━━━━━━━━━━━━━━━━\nYour TxID has been sent to our billing system. You will receive a direct notification once your <b>PRO status</b> is activated.`, { parse_mode: 'HTML' });
	} catch (e) {
		await ctx.reply('⚠️ <b>System Error:</b> Could not contact the billing admin.', { parse_mode: 'HTML' });
	}
}
