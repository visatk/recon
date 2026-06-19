import { Bot, webhookCallback } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { Env, ScanJob } from './types';
import { handleStart } from './bot/handlers/start';
import { handleHelp } from './bot/handlers/help';
import { handleMe } from './bot/handlers/me';
import { handleUpgrade, handleTxid } from './bot/handlers/upgrade';
import { handleAdmin, handleTier, handleAddCredits } from './bot/handlers/admin';
import { handleRecon } from './bot/handlers/recon';
import { handleCli } from './bot/handlers/cli';
import { processReconJob, processCliJob } from './bot/jobs/runner';

export { Sandbox } from '@cloudflare/sandbox';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method !== 'POST') {
			if (request.method === 'GET') {
				const url = new URL(request.url);
				if (url.pathname === '/setup') {
					const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
					await bot.api.setWebhook(`https://${url.host}/`, { allowed_updates: ['message', 'callback_query'] });
					return new Response(`Webhook set to https://${url.host}/`, { status: 200 });
				}
			}
			return new Response(JSON.stringify({ runtime: 'operational', system: 'ReconBox Secure Core Node' }), { 
				status: 200, 
				headers: { 'Content-Type': 'application/json' } 
			});
		}

		try {
			const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
			bot.api.config.use(autoRetry({ maxRetryAttempts: 3, retryOnInternalServerErrors: true }));

			bot.command('start', (ctx) => handleStart(ctx, env));
			bot.command('help', (ctx) => handleHelp(ctx, env));
			bot.command('me', (ctx) => handleMe(ctx, env));
			bot.command('stats', (ctx) => handleMe(ctx, env)); 
			bot.command('upgrade', (ctx) => handleUpgrade(ctx, env));
			bot.command('buy', (ctx) => handleUpgrade(ctx, env));
			bot.command('txid', (ctx) => handleTxid(ctx, env));

			bot.command('recon', (ctx) => handleRecon(ctx, env));
			bot.command('cli', (ctx) => handleCli(ctx, env));
			bot.command('run', (ctx) => handleCli(ctx, env)); 

			bot.command('admin', (ctx) => handleAdmin(ctx, env));
			bot.command('tier', (ctx) => handleTier(ctx, env));
			bot.command('addcredits', (ctx) => handleAddCredits(ctx, env));

			const routeWebhook = webhookCallback(bot, 'cloudflare-mod');
			return await routeWebhook(request);
		} catch (e) {
			return new Response('Routing Core Error', { status: 500 });
		}
	},

	async queue(batch: MessageBatch<ScanJob>, env: Env, ctx: ExecutionContext): Promise<void> {
		for (const msg of batch.messages) {
			try {
				const job = msg.body;
				if (job.type === 'recon') {
					await processReconJob(job, env);
				} else if (job.type === 'cli') {
					await processCliJob(job, env);
				}
				msg.ack();
			} catch (error) {
				console.error("Queue execution error:", error);
				msg.retry();
			}
		}
	}
};
