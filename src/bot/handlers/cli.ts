import { CommandContext, Context } from 'grammy';
import { Env, ScanJob } from '../../types';
import { DbClient } from '../../db/client';
import { escapeHtml } from '../../utils/ui';

const ALLOWED_TOOLS = ['nmap', 'subfinder', 'httpx', 'whois', 'dig', 'curl', 'wget', 'jq', 'grep', 'cat', 'echo', 'ls'];

export async function handleCli(ctx: CommandContext<Context>, env: Env) {
	const tgId = ctx.from?.id;
	const rawCommand = ctx.match?.trim();
	if (!tgId) return;

	if (!rawCommand) return ctx.reply('⚠️ <b>Please provide a command.</b>\nExample: <code>/cli nmap -F target.com</code>', { parse_mode: 'HTML' });
	if (/[;&|`$\n\r]/.test(rawCommand) || rawCommand.includes('>') || rawCommand.includes('<')) {
		return ctx.reply('❌ <b>Security Alert:</b> Shell chaining operators are strictly prohibited.', { parse_mode: 'HTML' });
	}

	const baseTool = rawCommand.split(' ')[0].toLowerCase();
	if (!ALLOWED_TOOLS.includes(baseTool)) return ctx.reply(`❌ <b>Tool Restricted!</b>\nAllowed tools: <code>${ALLOWED_TOOLS.join(', ')}</code>`, { parse_mode: 'HTML' });

	const dbClient = new DbClient(env.DB);
	try {
		const access = await dbClient.checkCredits(tgId);
		if (!access.allowed) return ctx.reply('❌ <b>Credit Limit Reached.</b>', { parse_mode: 'HTML' });
		
		const isPro = access.tier === 'pro';
		const logTarget = rawCommand.length > 100 ? rawCommand.substring(0, 100) + '...' : rawCommand;
		const scanId = await dbClient.createScan(tgId, logTarget, baseTool);
		if (!isPro) await dbClient.deductCredit(tgId);

		const progressMsg = await ctx.reply(`⏳ <b>Command Queued!</b>\n<code>$ ${escapeHtml(rawCommand)}</code>\n<i>Awaiting secure sandbox provisioning...</i>`, { parse_mode: 'HTML' });

		const jobPayload: ScanJob = { type: 'cli', tgId, chatId: ctx.chat.id, messageId: progressMsg.message_id, scanId, payload: rawCommand, isPro };
		await env.SCAN_QUEUE.send(jobPayload);
	} catch (error) {
		await ctx.reply('⚠️ <b>System Error occurred.</b>', { parse_mode: 'HTML' });
	}
}
