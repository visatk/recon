import { CommandContext, Context } from 'grammy';
import { Env } from '../../types';
import { escapeHtml } from '../../utils/ui';

export async function handleUpgrade(ctx: CommandContext<Context>, env: Env) {
	const msg = `💎 <b>Upgrade to PRO Access</b>\n\n` +
		`Unlock the full power of ReconBox for professional bug bounty and pentesting.\n` +
		`✅ <b>Unlimited Daily Scans</b>\n` +
		`✅ <b>Deep Version Scanning (-sV)</b>\n` +
		`✅ <b>Max Execution Time (5 mins)</b>\n\n` +
		`💸 <b>Price:</b> 10 USDT / Month\n` +
		`💳 <b>Network:</b> Tron (TRC20)\n\n` +
		`🏦 <b>Send USDT to this address:</b>\n<code>${env.TRC20_WALLET || 'WALLET_NOT_SET'}</code>\n\n` +
		`<b>How to activate?</b>\n` +
		`1. Send exactly 10 USDT to the TRC20 address above.\n` +
		`2. Copy your Transaction ID (TxID / Hash).\n` +
		`3. Run this command to submit your payment:\n` +
		`👉 <code>/txid YOUR_TRANSACTION_HASH</code>\n\n` +
		`<i>⏳ An admin will verify your transaction on the blockchain and upgrade your account manually.</i>`;

	await ctx.reply(msg, { parse_mode: 'HTML' });
}

export async function handleTxid(ctx: CommandContext<Context>, env: Env) {
	const tgId = ctx.from?.id;
	const username = ctx.from?.username || 'Unknown';
	const txid = ctx.match?.trim();

	if (!tgId) return;

	if (!txid) {
		return ctx.reply('⚠️ <b>Usage:</b> <code>/txid &lt;your_transaction_hash&gt;</code>\nExample: <code>/txid 8a3f...d9e1</code>', { parse_mode: 'HTML' });
	}

	if (txid.length < 30) {
		return ctx.reply('❌ <b>Invalid TxID.</b> Please provide a valid TRC20 transaction hash.', { parse_mode: 'HTML' });
	}

	// Message to send to the Admin
	const adminMsg = `💰 <b>New PRO Payment Received!</b>\n\n` +
		`👤 <b>User:</b> @${escapeHtml(username)}\n` +
		`🆔 <b>ID:</b> <code>${tgId}</code>\n` +
		`🔗 <b>TxID:</b> <code>${escapeHtml(txid)}</code>\n\n` +
		`🔍 <a href="https://tronscan.org/#/transaction/${escapeHtml(txid)}">Verify on TronScan</a>\n\n` +
		`⚙️ <b>Action:</b> Click the command below to approve:\n` +
		`<code>/tier ${tgId} pro</code>`;

	try {
		// Notify Admin
		await ctx.api.sendMessage(env.ADMIN_TG_ID, adminMsg, { parse_mode: 'HTML', disable_web_page_preview: true });
		
		// Notify User
		await ctx.reply('✅ <b>Payment Submitted Successfully!</b>\n\nYour transaction has been sent to the admins for verification. You will receive a notification once your PRO status is activated.', { parse_mode: 'HTML' });
	} catch (e) {
		console.error("Failed to notify admin", e);
		await ctx.reply('⚠️ <b>System Error:</b> Could not contact the admin. Please message support directly.', { parse_mode: 'HTML' });
	}
}
