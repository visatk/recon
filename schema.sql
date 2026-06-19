DROP TABLE IF EXISTS scans;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS transactions;

CREATE TABLE users (
    tg_id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free', 
    credits INTEGER NOT NULL DEFAULT 5,
    last_reset_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id INTEGER NOT NULL,
    target TEXT NOT NULL,
    tool TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tg_id) REFERENCES users(tg_id) ON DELETE CASCADE
);

CREATE TABLE transactions (
    charge_id TEXT PRIMARY KEY,
    tg_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'XTR',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tg_id) REFERENCES users(tg_id) ON DELETE CASCADE
);

CREATE INDEX idx_users_tier ON users(tier);
CREATE INDEX idx_scans_tg_id ON scans(tg_id);
CREATE INDEX idx_transactions_tg_id ON transactions(tg_id);
