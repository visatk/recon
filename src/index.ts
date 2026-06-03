import { Env } from './types';
import { createBotHandler } from './bot';

// CRITICAL INFRASTRUCTURE RE-EXPORT: Mandatory class footprint required by the Cloudflare Control Plane
export { Sandbox } from '@cloudflare/sandbox';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response(
				JSON.stringify({ runtime: 'operational', system: 'ReconBox Secure Core Node' }),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		}

		try {
			const routeWebhook = createBotHandler(env, ctx);
			return await routeWebhook(request);
		} catch (globalRouterException) {
			console.error('Root boundary execution context crash intercepted:', globalRouterException);
			return new Response('Fatal Routing Core Error State', { status: 500 });
		}
	},
};
