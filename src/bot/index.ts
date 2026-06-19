import { Bot, webhookCallback } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { Env } from '../types';
import { handleStart } from './handlers/start';
import { handleRecon } from './handlers/recon';
import { handleMe } from './handlers/me';
import { handleCli } from './handlers/cli';
import { handleAdmin, handleTier, handleAddCredits } from './handlers/admin';
import { handleHelp } from './handlers/help';
import { handleUpgrade } from './handlers/upgrade';
import { DbClient } from '../db/client';

export function createBotHandler(env: Env, executionCtx: ExecutionContext) {
    const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

    bot.api.config.use(autoRetry({
        maxRetryAttempts: 3, 
        retryOnInternalServerErrors: true 
    }));

    bot.command('start', (ctx) => handleStart(ctx, env));
    bot.command('help', (ctx) => handleHelp(ctx, env));
    bot.command('recon', (ctx) => handleRecon(ctx, env));
    bot.command('cli', (ctx) => handleCli(ctx, env));
    bot.command('run', (ctx) => handleCli(ctx, env)); 
    bot.command('me', (ctx) => handleMe(ctx, env));
    bot.command('stats', (ctx) => handleMe(ctx, env)); 
    bot.command('upgrade', (ctx) => handleUpgrade(ctx, env));
    bot.command('buy', (ctx) => handleUpgrade(ctx, env));
    bot.command('admin', (ctx) => handleAdmin(ctx, env));
    bot.command('tier', (ctx) => handleTier(ctx, env));
    bot.command('addcredits', (ctx) => handleAddCredits(ctx, env));

    // Natively handle Stars Checkout Protocol
    bot.on('pre_checkout_query', async (ctx) => {
        await ctx.answerPreCheckoutQuery(true).catch(console.error);
    });

    bot.on('message:successful_payment', async (ctx) => {
        const tgId = ctx.from?.id;
        const payment = ctx.message?.successful_payment;

        if (!tgId || !payment) return;

        const chargeId = payment.telegram_payment_charge_id;
        const amount = payment.total_amount;
        
        const dbClient = new DbClient(env.DB);
        
        const recorded = await dbClient.recordTransaction(chargeId, tgId, amount);
        if (!recorded) return; 

        const success = await dbClient.setTier(tgId, 'pro');

        if (success) {
            await ctx.reply('✅ <b>PRO Access Provisioned!</b>\nLimits removed.', { parse_mode: 'HTML' });

            executionCtx.waitUntil(
                ctx.api.sendMessage(
                    env.ADMIN_TG_ID,
                    `💰 <b>PRO UPGRADE VIA STARS</b>\nUser: <code>${tgId}</code>\nStars: ${amount}\nCharge ID: <code>${chargeId}</code>`,
                    { parse_mode: 'HTML' }
                ).catch(console.error)
            );
        } else {
            await ctx.reply('⚠️ <b>System Error:</b> DB sync failed. Contact an admin.', { parse_mode: 'HTML' });
        }
    });

    bot.catch((err) => {
        console.error(`Error handling update ${err.ctx.update.update_id}:`, err.error);
    });

    return webhookCallback(bot, 'cloudflare-mod');
}
