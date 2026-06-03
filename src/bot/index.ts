import { Bot, webhookCallback } from 'grammy';
import { Env } from '../types';
import { handleStart } from './handlers/start';
import { handleRecon } from './handlers/recon';
import { handleMe } from './handlers/me';
import { handleCli } from './handlers/cli'; // New Handler imported

export function createBotHandler(env: Env, executionCtx: ExecutionContext) {
	const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

	// Register clean isolated routing functions
	bot.command('start', (ctx) => handleStart(ctx, env));
	bot.command('recon', (ctx) => handleRecon(ctx, env, executionCtx));
	bot.command('me', (ctx) => handleMe(ctx, env));
	bot.command('stats', (ctx) => handleMe(ctx, env)); 
	
	// Register the new custom command execution route
	bot.command('cli', (ctx) => handleCli(ctx, env, executionCtx));
	bot.command('run', (ctx) => handleCli(ctx, env, executionCtx)); // Alias for /cli

	return webhookCallback(bot, 'cloudflare-mod');
}
