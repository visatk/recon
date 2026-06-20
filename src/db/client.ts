import { Env, UserRow } from '../types';

export class DbClient {
	private db: D1Database;

	constructor(db: D1Database) {
		this.db = db;
	}

	async getOrCreateUser(tgId: number, username: string): Promise<UserRow | null> {
		await this.db
			.prepare(`INSERT INTO users (tg_id, username) VALUES (?, ?) 
					  ON CONFLICT(tg_id) DO UPDATE SET username = excluded.username`)
			.bind(tgId, username)
			.run();

		await this.db
			.prepare(`UPDATE users 
					  SET credits = 5, last_reset_at = CURRENT_TIMESTAMP 
					  WHERE tg_id = ? AND tier = 'free' 
					  AND datetime(last_reset_at) <= datetime('now', '-1 day')`)
			.bind(tgId)
			.run();

		return await this.db.prepare(`SELECT * FROM users WHERE tg_id = ?`).bind(tgId).first<UserRow>();
	}

	async checkCredits(tgId: number): Promise<{ allowed: boolean; tier: string; credits: number }> {
		const user = await this.db.prepare(`SELECT credits, tier FROM users WHERE tg_id = ?`).bind(tgId).first<{ credits: number; tier: string }>();
		if (!user) return { allowed: false, tier: 'free', credits: 0 };
		if (user.tier === 'free' && user.credits <= 0) return { allowed: false, tier: user.tier, credits: user.credits };
		return { allowed: true, tier: user.tier, credits: user.credits };
	}

	async hasActiveScan(tgId: number): Promise<boolean> {
		const result = await this.db
			.prepare(`SELECT count(*) as count FROM scans WHERE tg_id = ? AND status IN ('pending', 'running') AND created_at >= datetime('now', '-5 minutes')`)
			.bind(tgId).first<{ count: number }>();
		return (result?.count ?? 0) > 0;
	}

	async createScan(tgId: number, target: string, tool: string): Promise<number> {
		const result = await this.db.prepare(`INSERT INTO scans (tg_id, target, tool, status) VALUES (?, ?, ?, 'pending') RETURNING id`).bind(tgId, target, tool).first<{ id: number }>();
		if (!result) throw new Error('DB Transaction Failed');
		return result.id;
	}

	async updateScanStatus(scanId: number, status: 'running' | 'completed' | 'failed'): Promise<void> {
		await this.db.prepare(`UPDATE scans SET status = ? WHERE id = ?`).bind(status, scanId).run();
	}

	async deductCredit(tgId: number): Promise<void> {
		await this.db.prepare(`UPDATE users SET credits = credits - 1 WHERE tg_id = ? AND tier = 'free'`).bind(tgId).run();
	}

	async setTier(tgId: number, tier: 'free' | 'pro'): Promise<boolean> {
		const res = await this.db.prepare(`UPDATE users SET tier = ? WHERE tg_id = ?`).bind(tier, tgId).run();
		return res.success;
	}

	async addCredits(tgId: number, amount: number): Promise<boolean> {
		const res = await this.db.prepare(`UPDATE users SET credits = credits + ? WHERE tg_id = ?`).bind(amount, tgId).run();
		return res.success;
	}

	async getSystemStats(): Promise<{ totalUsers: number; proUsers: number; totalScans: number }> {
		const users = await this.db.prepare(`SELECT count(*) as c FROM users`).first<{c: number}>();
		const pro = await this.db.prepare(`SELECT count(*) as c FROM users WHERE tier = 'pro'`).first<{c: number}>();
		const scans = await this.db.prepare(`SELECT count(*) as c FROM scans`).first<{c: number}>();
		return { totalUsers: users?.c || 0, proUsers: pro?.c || 0, totalScans: scans?.c || 0 };
	}
}
