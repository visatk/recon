import { Bot, webhookCallback } from 'grammy';
import { Env } from '../types';
import { handleStart } from './handlers/start';
import { handleRecon } from './handlers/recon';
import { handleMe } from './handlers/me';
import { handleCli } from './handlers/cli'; 

export function createBotHandler(env: Env, executionCtx: ExecutionContext) {
	const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

	bot.command('start', (ctx) => handleStart(ctx, env));
	bot.command('recon', (ctx) => handleRecon(ctx, env, executionCtx));
	bot.command('me', (ctx) => handleMe(ctx, env));
	bot.command('stats', (ctx) => handleMe(ctx, env)); 
	bot.command('cli', (ctx) => handleCli(ctx, env, executionCtx));
	bot.command('run', (ctx) => handleCli(ctx, env, executionCtx)); 

	// Global Error Handler for Grammy
	bot.catch((err) => {
		console.error(`Error while handling update ${err.ctx.update.update_id}:`, err.error);
	});

	return webhookCallback(bot, 'cloudflare-mod');
}
