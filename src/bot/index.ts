import { Bot, webhookCallback } from 'grammy';
import { Env } from '../types';
import { handleStart } from './handlers/start';
import { handleRecon } from './handlers/recon';

export function createBotHandler(env: Env, executionCtx: ExecutionContext) {
	const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

	// Register clean isolated routing functions
	bot.command('start', (ctx) => handleStart(ctx, env));
	bot.command('recon', (ctx) => handleRecon(ctx, env, executionCtx));

	return webhookCallback(bot, 'cloudflare-mod');
}
