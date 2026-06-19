import { Bot, webhookCallback } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { Env } from '../types';
import { handleStart } from './handlers/start';
import { handleRecon } from './handlers/recon';
import { handleMe } from './handlers/me';
import { handleCli } from './handlers/cli';
import { handleAdmin, handleTier, handleAddCredits } from './handlers/admin';
import { handleHelp } from './handlers/help';
import { handleUpgrade, handleTxid } from './handlers/upgrade';

export function createBotHandler(env: Env, executionCtx: ExecutionContext) {
	const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

	bot.api.config.use(autoRetry({
		maxRetryAttempts: 3, 
		retryOnInternalServerErrors: true 
	}));

	// General & Utility Commands
	bot.command('start', (ctx) => handleStart(ctx, env));
	bot.command('help', (ctx) => handleHelp(ctx, env));

	// Core Security Commands
	bot.command('recon', (ctx) => handleRecon(ctx, env, executionCtx));
	bot.command('cli', (ctx) => handleCli(ctx, env, executionCtx));
	bot.command('run', (ctx) => handleCli(ctx, env, executionCtx)); 

	// Account & Billing Commands
	bot.command('me', (ctx) => handleMe(ctx, env));
	bot.command('stats', (ctx) => handleMe(ctx, env)); 
	bot.command('upgrade', (ctx) => handleUpgrade(ctx, env));
	bot.command('buy', (ctx) => handleUpgrade(ctx, env));
	bot.command('txid', (ctx) => handleTxid(ctx, env));

	// Admin Commands
	bot.command('admin', (ctx) => handleAdmin(ctx, env));
	bot.command('tier', (ctx) => handleTier(ctx, env));
	bot.command('addcredits', (ctx) => handleAddCredits(ctx, env));

	bot.catch((err) => {
		console.error(`Error while handling update ${err.ctx.update.update_id}:`, err.error);
	});

	return webhookCallback(bot, 'cloudflare-mod');
}
