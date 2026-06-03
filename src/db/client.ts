import { Env, UserRow } from '../types';

export class DbClient {
	private db: D1Database;

	constructor(db: D1Database) {
		this.db = db;
	}

	async getOrCreateUser(tgId: number, username: string): Promise<UserRow | null> {
		let user = await this.db
			.prepare(`INSERT INTO users (tg_id, username) VALUES (?, ?) 
					  ON CONFLICT(tg_id) DO UPDATE SET username = excluded.username 
					  RETURNING *`)
			.bind(tgId, username)
			.first<UserRow>();

		if (user && user.tier === 'free') {
			const safeDateString = user.last_reset_at.replace(' ', 'T') + 'Z';
			const lastReset = new Date(safeDateString).getTime();
			const now = Date.now();
			
			if (now - lastReset > 24 * 60 * 60 * 1000) {
				user = await this.db
					.prepare(`UPDATE users SET credits = 5, last_reset_at = CURRENT_TIMESTAMP WHERE tg_id = ? RETURNING *`)
					.bind(tgId)
					.first<UserRow>();
			}
		}

		return user;
	}

	async checkCredits(tgId: number): Promise<{ allowed: boolean; tier: string; credits: number }> {
		const user = await this.db
			.prepare(`SELECT credits, tier FROM users WHERE tg_id = ?`)
			.bind(tgId)
			.first<{ credits: number; tier: string }>();

		if (!user) return { allowed: false, tier: 'free', credits: 0 };
		if (user.tier === 'free' && user.credits <= 0) return { allowed: false, tier: user.tier, credits: user.credits };
		return { allowed: true, tier: user.tier, credits: user.credits };
	}

	// Concurrency Control: Check if user already has a scan running (Fixed Deadlock)
	async hasActiveScan(tgId: number): Promise<boolean> {
		const result = await this.db
			.prepare(`
				SELECT count(*) as count 
				FROM scans 
				WHERE tg_id = ? 
				AND status IN ('pending', 'running') 
				AND created_at >= datetime('now', '-5 minutes')
			`)
			.bind(tgId)
			.first<{ count: number }>();
		
		return (result?.count ?? 0) > 0;
	}

	async createScan(tgId: number, target: string, tool: string): Promise<number> {
		const result = await this.db
			.prepare(`INSERT INTO scans (tg_id, target, tool, status) VALUES (?, ?, ?, 'pending') RETURNING id`)
			.bind(tgId, target, tool)
			.first<{ id: number }>();

		if (!result) throw new Error('DB Transaction Failed');
		return result.id;
	}

	async updateScanStatus(scanId: number, status: 'running' | 'completed' | 'failed'): Promise<void> {
		await this.db.prepare(`UPDATE scans SET status = ? WHERE id = ?`).bind(status, scanId).run();
	}

	async deductCredit(tgId: number): Promise<void> {
		await this.db.prepare(`UPDATE users SET credits = credits - 1 WHERE tg_id = ? AND tier = 'free'`).bind(tgId).run();
	}
}
