import { CommandContext, Context } from 'grammy';
import { Env, ScanJob } from '../../types';
import { DbClient } from '../../db/client';
import { escapeHtml } from '../../utils/ui';

const ALLOWED_TOOLS = ['nmap', 'subfinder', 'httpx', 'whois', 'dig', 'curl', 'wget', 'jq', 'grep', 'cat', 'echo', 'ls'];

export async function handleCli(ctx: CommandContext<Context>, env: Env) {
	const tgId = ctx.from?.id;
	const rawCommand = ctx.match?.trim();
	if (!tgId) return;

	if (!rawCommand) return ctx.reply('⚠️ <b>Command Required.</b>\nExample: <code>/cli nmap -p- target.com</code>', { parse_mode: 'HTML' });
	if (/[;&|`$\n\r<>]/.test(rawCommand)) {
		return ctx.reply('❌ <b>Security Alert:</b> Shell chaining and redirection operators are strictly prohibited.', { parse_mode: 'HTML' });
	}

	const baseTool = rawCommand.split(' ')[0].toLowerCase();
	if (!ALLOWED_TOOLS.includes(baseTool)) return ctx.reply(`❌ <b>Execution Blocked.</b>\nUnauthorized binary. Allowed tools: <code>${ALLOWED_TOOLS.join(', ')}</code>`, { parse_mode: 'HTML' });

	const dbClient = new DbClient(env.DB);
	try {
		const access = await dbClient.checkCredits(tgId);
		if (!access.allowed) return ctx.reply('❌ <b>Compute Limit Reached.</b> Please upgrade to PRO for unrestricted access.', { parse_mode: 'HTML' });
		
		const isPro = access.tier === 'pro';
		const logTarget = rawCommand.length > 100 ? rawCommand.substring(0, 100) + '...' : rawCommand;
		const scanId = await dbClient.createScan(tgId, logTarget, baseTool);
		if (!isPro) await dbClient.deductCredit(tgId);

		const progressMsg = await ctx.reply(`⏳ <b>Initiating Isolated Execution...</b>\n<blockquote><code>$ ${escapeHtml(rawCommand)}</code></blockquote>\n<i>Provisioning secure environment...</i>`, { parse_mode: 'HTML' });

		const jobPayload: ScanJob = { type: 'cli', tgId, chatId: ctx.chat.id, messageId: progressMsg.message_id, scanId, payload: rawCommand, isPro };
		await env.SCAN_QUEUE.send(jobPayload);
	} catch (error) {
		await ctx.reply('⚠️ <b>System Error occurred.</b>', { parse_mode: 'HTML' });
	}
}
