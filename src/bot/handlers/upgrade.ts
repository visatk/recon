import { CommandContext, Context, InlineKeyboard } from 'grammy';
import { Env } from '../../types';
import { escapeHtml } from '../../utils/ui';

export async function handleUpgrade(ctx: CommandContext<Context>, env: Env) {
	const msg = `🚀 <b>RECONBOX PRO ELITE</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━\n` +
		`<i>Unlock enterprise-grade infrastructure and dominate your targets.</i>\n\n` +
		`<blockquote>🔥 <b>Elite Advantages:</b>\n` +
		`• <b>Infinite Compute:</b> Zero daily limits or throttling\n` +
		`• <b>Deep Execution Engine:</b> Access robust, intensive OSINT tools\n` +
		`• <b>Extended TTL:</b> 5-minute container lifecycle\n` +
		`• <b>Dedicated Priority Node:</b> Instant, zero-wait provisioning</blockquote>\n\n` +
		`💳 <b>Enterprise License:</b> <b>10 USDT / Month</b>\n` +
		`🔗 <b>Payment Network:</b> Tron (TRC20)\n\n` +
		`<blockquote>🏦 <b>Payment Address:</b>\n` +
		`<code>${env.TRC20_WALLET || 'WALLET_NOT_SET'}</code></blockquote>\n\n` +
		`⚡ <b>Onboarding Steps:</b>\n` +
		`1️⃣ Transfer exactly <b>10 USDT</b> to the TRC20 address above.\n` +
		`2️⃣ Copy the transaction hash (TxID).\n` +
		`3️⃣ Submit for verification:\n` +
		`👉 <code>/txid YOUR_TRANSACTION_HASH</code>\n\n` +
		`<i>⏳ Licenses are provisioned securely upon blockchain confirmation.</i>`;

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

	const adminMsg = `💰 <b>NEW PRO PAYMENT ALERT</b>\n━━━━━━━━━━━━━━━━━━━━━━\n` +
		`<blockquote>👤 <b>User:</b> @${escapeHtml(username)}\n` +
		`🆔 <b>ID:</b> <code>${tgId}</code>\n` +
		`🔗 <b>TxID:</b> <code>${escapeHtml(txid)}</code></blockquote>\n\n` +
		`🔍 <a href="https://tronscan.org/#/transaction/${escapeHtml(txid)}">Verify on TronScan</a>\n\n` +
		`⚙️ <b>Quick Action:</b>\n<code>/tier ${tgId} pro</code>`;

	try {
		await ctx.api.sendMessage(env.ADMIN_TG_ID, adminMsg, { parse_mode: 'HTML', disable_web_page_preview: true });
		await ctx.reply(`✅ <b>Payment Verification Initiated!</b>\n━━━━━━━━━━━━━━━━━━━━━━\n<blockquote>Your transaction hash has been securely routed to our billing system. You will be notified instantly once your <b>PRO ELITE</b> license is provisioned.</blockquote>`, { parse_mode: 'HTML' });
	} catch (e) {
		await ctx.reply('⚠️ <b>System Error:</b> Could not contact the billing admin.', { parse_mode: 'HTML' });
	}
}
