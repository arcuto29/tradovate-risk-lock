import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface ActivityLogEntry {
  id: number;
  timestamp: string;
  type: string;
  details: string;
}

export class DatabaseManager {
  private db!: SqlJsDatabase;
  private dbPath: string;
  private ready: Promise<void>;

  constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'risk-lock.db');
    this.ready = this.initialize();
  }

  private async initialize(): Promise<void> {
    const SQL = await initSqlJs();

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db.run(`
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
      INSERT OR IGNORE INTO app_settings (id, cooldown_hours, start_with_windows, minimize_to_tray, trusted_person_enabled) VALUES (1, 12, 1, 1, 0);
      INSERT OR IGNORE INTO lock_state (id, is_locked, bypass_attempts) VALUES (1, 0, 0);
    `);
    this.save();
  }

  async waitReady(): Promise<void> { await this.ready; }

  private save(): void {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  logActivity(type: string, details: string): void {
    this.db.run('INSERT INTO activity_log (type, details) VALUES (?, ?)', [type, details]);
    this.save();
  }

  getActivityLog(limit: number = 50): ActivityLogEntry[] {
    const results = this.db.exec('SELECT id, timestamp, type, details FROM activity_log ORDER BY id DESC LIMIT ?', [limit]);
    if (!results.length) return [];
    return results[0].values.map((row: any) => ({ id: row[0], timestamp: row[1], type: row[2], details: row[3] }));
  }

  getBypassAttemptCount(): number {
    const results = this.db.exec('SELECT bypass_attempts FROM lock_state WHERE id = 1');
    if (!results.length || !results[0].values.length) return 0;
    return results[0].values[0][0] as number;
  }

  incrementBypassAttempts(): void {
    this.db.run('UPDATE lock_state SET bypass_attempts = bypass_attempts + 1 WHERE id = 1');
    this.save();
  }

  getLockState(): any {
    const results = this.db.exec('SELECT * FROM lock_state WHERE id = 1');
    if (!results.length || !results[0].values.length) return null;
    const cols = results[0].columns;
    const vals = results[0].values[0];
    const obj: any = {};
    cols.forEach((c, i) => { obj[c] = vals[i]; });
    return obj;
  }

  saveLockState(state: {
    isLocked: boolean; lockTime: string | null; resetTime: string | null;
    resetTimezone: string | null; dailyLossLimit: number | null;
    dailyProfitTarget: number | null; maxContracts: number | null; platform: string | null;
  }): void {
    this.db.run(
      'UPDATE lock_state SET is_locked=?, lock_time=?, reset_time=?, reset_timezone=?, daily_loss_limit=?, daily_profit_target=?, max_contracts=?, platform=? WHERE id=1',
      [state.isLocked ? 1 : 0, state.lockTime, state.resetTime, state.resetTimezone, state.dailyLossLimit, state.dailyProfitTarget, state.maxContracts, state.platform]
    );
    this.save();
  }

  resetBypassAttempts(): void {
    this.db.run('UPDATE lock_state SET bypass_attempts = 0 WHERE id = 1');
    this.save();
  }

  getSettings(): any {
    const results = this.db.exec('SELECT * FROM app_settings WHERE id = 1');
    if (!results.length || !results[0].values.length) return null;
    const cols = results[0].columns;
    const vals = results[0].values[0];
    const obj: any = {};
    cols.forEach((c, i) => { obj[c] = vals[i]; });
    return obj;
  }

  updateSettings(settings: Partial<{ cooldownHours: number; startWithWindows: boolean; minimizeToTray: boolean; trustedPersonEnabled: boolean; trustedPasswordHash: string | null; }>): void {
    const current = this.getSettings();
    this.db.run(
      'UPDATE app_settings SET cooldown_hours=?, start_with_windows=?, minimize_to_tray=?, trusted_person_enabled=?, trusted_password_hash=? WHERE id=1',
      [
        settings.cooldownHours ?? current.cooldown_hours,
        settings.startWithWindows !== undefined ? (settings.startWithWindows ? 1 : 0) : current.start_with_windows,
        settings.minimizeToTray !== undefined ? (settings.minimizeToTray ? 1 : 0) : current.minimize_to_tray,
        settings.trustedPersonEnabled !== undefined ? (settings.trustedPersonEnabled ? 1 : 0) : current.trusted_person_enabled,
        settings.trustedPasswordHash !== undefined ? settings.trustedPasswordHash : current.trusted_password_hash
      ]
    );
    this.save();
  }

  getTrustedPasswordHash(): string | null {
    const results = this.db.exec('SELECT trusted_password_hash FROM app_settings WHERE id = 1');
    if (!results.length || !results[0].values.length) return null;
    return results[0].values[0][0] as string | null;
  }

  saveEarlyUnlockRequest(reason: string, cooldownHours: number, availableAt: string): void {
    this.db.run('INSERT INTO early_unlock_request (reason, cooldown_hours, available_at) VALUES (?, ?, ?)', [reason, cooldownHours, availableAt]);
    this.save();
  }

  getActiveUnlockRequest(): any {
    const results = this.db.exec('SELECT * FROM early_unlock_request WHERE resolved = 0 ORDER BY id DESC LIMIT 1');
    if (!results.length || !results[0].values.length) return null;
    const cols = results[0].columns;
    const vals = results[0].values[0];
    const obj: any = {};
    cols.forEach((c, i) => { obj[c] = vals[i]; });
    return obj;
  }

  resolveUnlockRequest(id: number, approved: boolean): void {
    this.db.run('UPDATE early_unlock_request SET resolved = 1, approved = ? WHERE id = ?', [approved ? 1 : 0, id]);
    this.save();
  }

  close(): void { this.save(); }
}
