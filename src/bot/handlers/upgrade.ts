import { CommandContext, Context } from 'grammy';
import { Env } from '../../types';

export async function handleUpgrade(ctx: CommandContext<Context>, env: Env) {
	const title = 'RECONBOX PRO';
	const description = 'Unlimited Scans. Deep Execution. Priority Sandbox Node.';
	const payload = `pro_${ctx.from?.id}_${crypto.randomUUID()}`;
	
	// Absolute amount in Stars
	const prices = [{ label: '1 Month PRO', amount: 500 }]; 

	// For digital goods, provider_token must be an empty string and currency must be 'XTR'
	await ctx.replyWithInvoice(title, description, payload, '', 'XTR', prices);
}
