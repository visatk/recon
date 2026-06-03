import { Bot, webhookCallback } from 'grammy';
import { Env, ScanJob } from './types';
import { handleStart } from './bot/handlers/start';
import { handleRecon } from './bot/handlers/recon';
import { handleCli } from './bot/handlers/cli';
import { handleMe } from './bot/handlers/me';
import { handleHelp } from './bot/handlers/help';
import { handleUpgrade, handleTxid } from './bot/handlers/upgrade';
import { handleAdmin, handleTier, handleAddCredits } from './bot/handlers/admin';
import { processReconJob, processCliJob } from './bot/jobs/runner';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const bot = new Bot(env.BOT_TOKEN);

		bot.command('start', (ctx) => handleStart(ctx, env));
		bot.command('help', (ctx) => handleHelp(ctx, env));
		bot.command('me', (ctx) => handleMe(ctx, env));
		bot.command('upgrade', (ctx) => handleUpgrade(ctx, env));
		bot.command('recon', (ctx) => handleRecon(ctx, env));
		bot.command('cli', (ctx) => handleCli(ctx, env));
		bot.command('txid', (ctx) => handleTxid(ctx, env));
		
		// Admin
		bot.command('admin', (ctx) => handleAdmin(ctx, env));
		bot.command('tier', (ctx) => handleTier(ctx, env));
		bot.command('addcredits', (ctx) => handleAddCredits(ctx, env));

		const cb = webhookCallback(bot, 'cloudflare-mod');
		return cb(request);
	},

	// Cloudflare Queue Consumer
	async queue(batch: MessageBatch<ScanJob>, env: Env, ctx: ExecutionContext): Promise<void> {
		for (const msg of batch.messages) {
			try {
				const job = msg.body;
				if (job.type === 'recon') {
					await processReconJob(job, env);
				} else if (job.type === 'cli') {
					await processCliJob(job, env);
				}
				msg.ack(); // Successfully processed
			} catch (error) {
				console.error("Queue processing error:", error);
				msg.retry(); // Retry if system failure[cite: 3]
			}
		}
	}
};
