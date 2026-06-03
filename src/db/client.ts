import { Env, UserRow } from '../types';

export class DbClient {
	private db: D1Database;

	constructor(db: D1Database) {
		this.db = db;
	}

	async getOrCreateUser(tgId: number, username: string): Promise<UserRow | null> {
		await this.db
			.prepare(`INSERT INTO users (tg_id, username) VALUES (?, ?) ON CONFLICT(tg_id) DO NOTHING`)
			.bind(tgId, username)
			.run();

		const user = await this.db
			.prepare(`SELECT * FROM users WHERE tg_id = ?`)
			.bind(tgId)
			.first<UserRow>();

		if (user && user.tier === 'free') {
			const lastReset = new Date(user.last_reset_at).getTime();
			const now = Date.now();
			// Reset user credits if 24 hours have passed since last reset
			if (now - lastReset > 24 * 60 * 60 * 1000) {
				await this.db
					.prepare(`UPDATE users SET credits = 5, last_reset_at = CURRENT_TIMESTAMP WHERE tg_id = ?`)
					.bind(tgId)
					.run();
				user.credits = 5;
			}
		}

		return user;
	}

	async checkCredits(tgId: number): Promise<{ allowed: boolean; tier: string; credits: number }> {
		const user = await this.db
			.prepare(`SELECT credits, tier FROM users WHERE tg_id = ?`)
			.bind(tgId)
			.first<{ credits: number; tier: string }>();

		if (!user) {
			return { allowed: false, tier: 'free', credits: 0 };
		}

		if (user.tier === 'free' && user.credits <= 0) {
			return { allowed: false, tier: user.tier, credits: user.credits };
		}

		return { allowed: true, tier: user.tier, credits: user.credits };
	}

	async createScan(tgId: number, target: string, tool: string): Promise<number> {
		const result = await this.db
			.prepare(`INSERT INTO scans (tg_id, target, tool, status) VALUES (?, ?, ?, 'pending') RETURNING id`)
			.bind(tgId, target, tool)
			.first<{ id: number }>();

		if (!result) {
			throw new Error('Database transaction failed while creating scan log');
		}

		return result.id;
	}

	async updateScanStatus(scanId: number, status: 'running' | 'completed' | 'failed'): Promise<void> {
		await this.db
			.prepare(`UPDATE scans SET status = ? WHERE id = ?`)
			.bind(status, scanId)
			.run();
	}

	async deductCredit(tgId: number): Promise<void> {
		await this.db
			.prepare(`UPDATE users SET credits = credits - 1 WHERE tg_id = ? AND tier = 'free'`)
			.bind(tgId)
			.run();
	}
}
