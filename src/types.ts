export interface Env {
	DB: D1Database;
	Sandbox: any;
	BOT_TOKEN: string;
	ADMIN_TG_ID: string;
	TRC20_WALLET?: string;
	SCAN_QUEUE: Queue<ScanJob>;
	REPORTS_BUCKET: R2Bucket;
}

export type ScanJob = {
	type: 'recon' | 'cli';
	tgId: number;
	chatId: number;
	messageId: number;
	scanId: number;
	payload: string;
	isPro: boolean;
};

export interface UserRow {
	id: number;
	tg_id: number;
	username: string;
	tier: 'free' | 'pro';
	credits: number;
	last_reset_at: string;
}
