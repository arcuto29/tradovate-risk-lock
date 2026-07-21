import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

export interface ActivityLogEntry {
  id: number;
  timestamp: string;
  type: string;
  details: string;
}

export class DatabaseManager {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'risk-lock.db');
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        type TEXT NOT NULL,
        details TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lock_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        is_locked INTEGER NOT NULL DEFAULT 0,
        lock_time TEXT,
        reset_time TEXT,
        reset_timezone TEXT,
        daily_loss_limit REAL,
        daily_profit_target REAL,
        max_contracts INTEGER,
        platform TEXT,
        bypass_attempts INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS early_unlock_request (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reason TEXT NOT NULL,
        requested_at TEXT NOT NULL DEFAULT (datetime('now')),
        cooldown_hours INTEGER NOT NULL DEFAULT 12,
        available_at TEXT NOT NULL,
        approved INTEGER NOT NULL DEFAULT 0,
        resolved INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        cooldown_hours INTEGER NOT NULL DEFAULT 12,
        start_with_windows INTEGER NOT NULL DEFAULT 1,
        minimize_to_tray INTEGER NOT NULL DEFAULT 1,
        trusted_person_enabled INTEGER NOT NULL DEFAULT 0,
        trusted_password_hash TEXT
      );

      INSERT OR IGNORE INTO app_settings (id, cooldown_hours, start_with_windows, minimize_to_tray, trusted_person_enabled)
      VALUES (1, 12, 1, 1, 0);

      INSERT OR IGNORE INTO lock_state (id, is_locked, bypass_attempts)
      VALUES (1, 0, 0);
    `);
  }

  logActivity(type: string, details: string): void {
    const stmt = this.db.prepare('INSERT INTO activity_log (type, details) VALUES (?, ?)');
    stmt.run(type, details);
  }

  getActivityLog(limit: number = 50): ActivityLogEntry[] {
    const stmt = this.db.prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT ?');
    return stmt.all(limit) as ActivityLogEntry[];
  }

  getBypassAttemptCount(): number {
    const stmt = this.db.prepare('SELECT bypass_attempts FROM lock_state WHERE id = 1');
    const result = stmt.get() as { bypass_attempts: number } | undefined;
    return result?.bypass_attempts ?? 0;
  }

  incrementBypassAttempts(): void {
    this.db.prepare('UPDATE lock_state SET bypass_attempts = bypass_attempts + 1 WHERE id = 1').run();
  }

  getLockState(): any {
    return this.db.prepare('SELECT * FROM lock_state WHERE id = 1').get();
  }

  saveLockState(state: {
    isLocked: boolean; lockTime: string | null; resetTime: string | null;
    resetTimezone: string | null; dailyLossLimit: number | null;
    dailyProfitTarget: number | null; maxContracts: number | null; platform: string | null;
  }): void {
    this.db.prepare(`UPDATE lock_state SET is_locked=?, lock_time=?, reset_time=?, reset_timezone=?, daily_loss_limit=?, daily_profit_target=?, max_contracts=?, platform=? WHERE id=1`)
      .run(state.isLocked ? 1 : 0, state.lockTime, state.resetTime, state.resetTimezone, state.dailyLossLimit, state.dailyProfitTarget, state.maxContracts, state.platform);
  }

  resetBypassAttempts(): void {
    this.db.prepare('UPDATE lock_state SET bypass_attempts = 0 WHERE id = 1').run();
  }

  getSettings(): any {
    return this.db.prepare('SELECT * FROM app_settings WHERE id = 1').get();
  }

  updateSettings(settings: Partial<{ cooldownHours: number; startWithWindows: boolean; minimizeToTray: boolean; trustedPersonEnabled: boolean; trustedPasswordHash: string | null; }>): void {
    const current = this.getSettings();
    this.db.prepare(`UPDATE app_settings SET cooldown_hours=?, start_with_windows=?, minimize_to_tray=?, trusted_person_enabled=?, trusted_password_hash=? WHERE id=1`)
      .run(
        settings.cooldownHours ?? current.cooldown_hours,
        settings.startWithWindows !== undefined ? (settings.startWithWindows ? 1 : 0) : current.start_with_windows,
        settings.minimizeToTray !== undefined ? (settings.minimizeToTray ? 1 : 0) : current.minimize_to_tray,
        settings.trustedPersonEnabled !== undefined ? (settings.trustedPersonEnabled ? 1 : 0) : current.trusted_person_enabled,
        settings.trustedPasswordHash !== undefined ? settings.trustedPasswordHash : current.trusted_password_hash
      );
  }

  getTrustedPasswordHash(): string | null {
    const result = this.db.prepare('SELECT trusted_password_hash FROM app_settings WHERE id = 1').get() as any;
    return result?.trusted_password_hash ?? null;
  }

  saveEarlyUnlockRequest(reason: string, cooldownHours: number, availableAt: string): void {
    this.db.prepare('INSERT INTO early_unlock_request (reason, cooldown_hours, available_at) VALUES (?, ?, ?)').run(reason, cooldownHours, availableAt);
  }

  getActiveUnlockRequest(): any {
    return this.db.prepare('SELECT * FROM early_unlock_request WHERE resolved = 0 ORDER BY id DESC LIMIT 1').get();
  }

  resolveUnlockRequest(id: number, approved: boolean): void {
    this.db.prepare('UPDATE early_unlock_request SET resolved = 1, approved = ? WHERE id = ?').run(approved ? 1 : 0, id);
  }

  close(): void { this.db.close(); }
}
