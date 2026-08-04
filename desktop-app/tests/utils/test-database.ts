/**
 * TestDatabase — Isolated SQLite for automated tests.
 * 
 * Never writes to the user's production database.
 * Creates a fresh in-memory database for each test suite.
 * Supports: snapshot, restore, reset, export.
 */

import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';

export class TestDatabase {
  private db!: SqlJsDatabase;
  private snapshots: Map<string, Uint8Array> = new Map();
  private ready: Promise<void>;

  constructor() {
    this.ready = this.initialize();
  }

  private async initialize(): Promise<void> {
    const SQL = await initSqlJs();
    this.db = new SQL.Database();

    // Create all tables matching production schema
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
        trusted_password_hash TEXT,
        session_enabled INTEGER DEFAULT 0,
        session_start TEXT DEFAULT '08:30',
        session_end TEXT DEFAULT '16:00',
        session_timezone TEXT DEFAULT 'America/New_York',
        position_limits TEXT,
        coach_config TEXT,
        blocklist_config TEXT,
        day_rules_config TEXT,
        news_blocker_config TEXT,
        advanced_config TEXT,
        kill_browser_on_bypass INTEGER DEFAULT 0
      );
      INSERT OR IGNORE INTO app_settings (id, cooldown_hours, start_with_windows, minimize_to_tray, trusted_person_enabled) VALUES (1, 12, 1, 1, 0);
      INSERT OR IGNORE INTO lock_state (id, is_locked, bypass_attempts) VALUES (1, 0, 0);

      CREATE TABLE IF NOT EXISTS trading_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        firm TEXT NOT NULL DEFAULT 'other',
        platform TEXT NOT NULL DEFAULT 'other',
        program TEXT NOT NULL DEFAULT '',
        account_stage TEXT NOT NULL DEFAULT 'evaluation',
        account_size TEXT NOT NULL DEFAULT '',
        firm_max_contracts INTEGER,
        firm_daily_loss INTEGER,
        firm_drawdown INTEGER,
        drawdown_type TEXT DEFAULT 'intraday_trailing',
        rules_last_verified_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS trading_plan (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        max_contracts INTEGER NOT NULL DEFAULT 2,
        daily_loss INTEGER NOT NULL DEFAULT 400,
        max_trades INTEGER NOT NULL DEFAULT 3,
        profit_target INTEGER NOT NULL DEFAULT 600,
        lock_duration_hours INTEGER NOT NULL DEFAULT 4,
        lock_mode TEXT NOT NULL DEFAULT 'duration',
        reset_time TEXT DEFAULT '17:00',
        reset_timezone TEXT DEFAULT 'America/New_York',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO trading_plan (id) VALUES (1);

      CREATE TABLE IF NOT EXISTS daily_session_plan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trading_date TEXT NOT NULL,
        readiness_status TEXT NOT NULL DEFAULT 'not_started',
        readiness_score INTEGER,
        protection_level TEXT,
        baseline_plan_snapshot TEXT,
        active_plan_snapshot TEXT,
        recommendation_applied INTEGER DEFAULT 0,
        readiness_completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(trading_date)
      );

      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        size INTEGER NOT NULL DEFAULT 1,
        direction TEXT NOT NULL DEFAULT 'Long',
        entry_time TEXT NOT NULL,
        exit_time TEXT NOT NULL,
        pnl REAL NOT NULL DEFAULT 0,
        result TEXT NOT NULL DEFAULT 'loss',
        duration_seconds INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS custom_platforms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        processes TEXT NOT NULL DEFAULT '[]',
        domains TEXT NOT NULL DEFAULT '[]',
        enabled INTEGER NOT NULL DEFAULT 1
      );
    `);
  }

  async waitReady(): Promise<void> { await this.ready; }

  /** Execute raw SQL */
  run(sql: string, params?: any[]): void {
    this.db.run(sql, params);
  }

  /** Query and return results */
  exec(sql: string, params?: any[]): any[] {
    return this.db.exec(sql, params);
  }

  /** Get a single row as object */
  getRow(table: string, id: number = 1): any | null {
    const results = this.db.exec(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    if (!results.length || !results[0].values.length) return null;
    const cols = results[0].columns;
    const vals = results[0].values[0];
    const obj: any = {};
    cols.forEach((c: string, i: number) => { obj[c] = vals[i]; });
    return obj;
  }

  /** Create a named snapshot of the current database state */
  createSnapshot(name: string): void {
    this.snapshots.set(name, this.db.export());
  }

  /** Restore a named snapshot */
  async restoreSnapshot(name: string): Promise<void> {
    const data = this.snapshots.get(name);
    if (!data) throw new Error(`Snapshot "${name}" not found`);
    const SQL = await initSqlJs();
    this.db = new SQL.Database(data);
  }

  /** Reset to clean state (re-initialize) */
  async reset(): Promise<void> {
    this.db.close();
    this.snapshots.clear();
    await this.initialize();
  }

  /** Export database as Buffer (for test reports) */
  export(): Uint8Array {
    return this.db.export();
  }

  /** Get activity log entries */
  getActivityLog(limit: number = 100): any[] {
    const results = this.db.exec('SELECT id, timestamp, type, details FROM activity_log ORDER BY id DESC LIMIT ?', [limit]);
    if (!results.length) return [];
    return results[0].values.map((row: any) => ({ id: row[0], timestamp: row[1], type: row[2], details: row[3] }));
  }

  /** Close the database */
  close(): void {
    this.db.close();
  }
}
