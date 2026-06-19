import { createBotHandler } from './bot';
import { processReconJob } from './bot/jobs/runner';
import { Env, ScanJob } from './types';

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        if (request.method === 'POST') {
            try {
                const handler = createBotHandler(env, ctx);
                return await handler(request);
            } catch (e) {
                console.error('[HTTP Router] Execution Failed:', e);
                return new Response('Internal Server Error', { status: 500 });
            }
        }
        return new Response('ReconBox Edge Gateway Active.', { status: 200 });
    },

    async queue(batch: MessageBatch<ScanJob>, env: Env, ctx: ExecutionContext): Promise<void> {
        for (const message of batch.messages) {
            try {
                await processReconJob(message.body, env, ctx);
                message.ack();
            } catch (e) {
                console.error('[Queue Consumer] Job Failed:', e);
                message.retry();
            }
        }
    }
};
