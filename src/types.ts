import { Sandbox } from '@cloudflare/sandbox';

export interface Env {
	TELEGRAM_BOT_TOKEN: string;
	ADMIN_TG_ID: string;
	DB: D1Database;
	Sandbox: DurableObjectNamespace<Sandbox>;
}

export interface UserRow {
	tg_id: number;
	username: string;
	tier: 'free' | 'pro';
	credits: number;
	last_reset_at: string;
	created_at: string;
}

export interface ScanRow {
	id: number;
	tg_id: number;
	target: string;
	tool: string;
	status: 'pending' | 'running' | 'completed' | 'failed';
	created_at: string;
}
