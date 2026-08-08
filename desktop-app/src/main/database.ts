import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
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

    // Add session columns if they don't exist
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN session_enabled INTEGER DEFAULT 0'); } catch {}
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN session_start TEXT DEFAULT "08:30"'); } catch {}
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN session_end TEXT DEFAULT "16:00"'); } catch {}
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN session_timezone TEXT DEFAULT "America/New_York"'); } catch {}

    // ─── Trading Plan Architecture Tables ─────────────────────────────────
    this.db.run(`
      CREATE TABLE IF NOT EXISTS trading_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        firm TEXT NOT NULL DEFAULT 'other',
        platform TEXT NOT NULL DEFAULT 'other',
        program TEXT NOT NULL DEFAULT '',
        account_stage TEXT NOT NULL DEFAULT 'evaluation',
        account_size TEXT NOT NULL DEFAULT '',
        rules_preset_id TEXT,
        rules_preset_version TEXT,
        firm_max_contracts INTEGER,
        firm_daily_loss INTEGER,
        firm_drawdown INTEGER,
        drawdown_type TEXT DEFAULT 'intraday_trailing',
        rules_last_verified_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    this.db.run(`
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
    `);

    this.db.run(`
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
    `);

    // ─── Economic Calendar Tables ───────────────────────────────────────────
    this.db.run(`
      CREATE TABLE IF NOT EXISTS economic_events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        event_type TEXT NOT NULL,
        starts_at_utc TEXT NOT NULL,
        impact TEXT NOT NULL DEFAULT 'high',
        source TEXT NOT NULL,
        source_url TEXT,
        affected_markets TEXT DEFAULT '[]',
        block_minutes_before INTEGER DEFAULT 30,
        block_minutes_after INTEGER DEFAULT 15,
        verification_status TEXT NOT NULL DEFAULT 'ESTIMATED',
        verified_at TEXT,
        last_verified_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS economic_source_status (
        id TEXT PRIMARY KEY,
        source_name TEXT NOT NULL,
        last_sync_at TEXT,
        last_success_at TEXT,
        last_error TEXT,
        events_count INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS economic_sync_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_type TEXT NOT NULL,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        events_added INTEGER DEFAULT 0,
        events_updated INTEGER DEFAULT 0,
        errors TEXT,
        status TEXT NOT NULL DEFAULT 'running'
      );
    `);

    // ─── Migration: Existing users → populate trading_plan from position_limits ─
    this.migrateExistingPlanData();

    // ─── Sessions Table (persistent session tracking for Review) ──────────────
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        starting_state TEXT NOT NULL DEFAULT 'NORMAL',
        ending_state TEXT,
        peak_state TEXT DEFAULT 'NORMAL',
        total_trades INTEGER DEFAULT 0,
        pnl REAL DEFAULT 0,
        escalation_count INTEGER DEFAULT 0,
        recovery_count INTEGER DEFAULT 0,
        first_escalation_at TEXT,
        worst_trigger TEXT,
        recovered_before_end INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        time_in_normal INTEGER DEFAULT 0,
        time_in_caution INTEGER DEFAULT 0,
        time_in_elevated INTEGER DEFAULT 0,
        time_in_high_risk INTEGER DEFAULT 0,
        time_in_lockdown INTEGER DEFAULT 0,
        checkpoint_json TEXT,
        summary_json TEXT
      );
    `);
    // Index for quick lookup by status
    this.db.run('CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)');

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
    cols.forEach((c: string, i: number) => { obj[c] = vals[i]; });
    return obj;
  }

  saveLockState(state: {
    isLocked: boolean; sessionEnded?: boolean; lockTime: string | null; resetTime: string | null;
    resetTimezone: string | null; dailyLossLimit: number | null;
    dailyProfitTarget: number | null; maxContracts: number | null; platform: string | null;
  }): void {
    // Ensure session_ended column exists
    try { this.db.run('ALTER TABLE lock_state ADD COLUMN session_ended INTEGER DEFAULT 0'); } catch {}
    this.db.run(
      'UPDATE lock_state SET is_locked=?, session_ended=?, lock_time=?, reset_time=?, reset_timezone=?, daily_loss_limit=?, daily_profit_target=?, max_contracts=?, platform=? WHERE id=1',
      [state.isLocked ? 1 : 0, state.sessionEnded ? 1 : 0, state.lockTime, state.resetTime, state.resetTimezone, state.dailyLossLimit, state.dailyProfitTarget, state.maxContracts, state.platform]
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
    cols.forEach((c: string, i: number) => { obj[c] = vals[i]; });
    // Ensure kill_browser column exists
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN kill_browser_on_bypass INTEGER DEFAULT 0'); } catch {}
    // Ensure sound_on_block column exists (opt-in: default OFF)
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN sound_on_block INTEGER DEFAULT 0'); } catch {}
    return obj;
  }

  updateSettings(settings: Partial<{ cooldownHours: number; startWithWindows: boolean; minimizeToTray: boolean; trustedPersonEnabled: boolean; trustedPasswordHash: string | null; killBrowserOnBypass: boolean; soundOnBlock: boolean; }>): void {
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
    // Kill browser setting
    if (settings.killBrowserOnBypass !== undefined) {
      try { this.db.run('ALTER TABLE app_settings ADD COLUMN kill_browser_on_bypass INTEGER DEFAULT 0'); } catch {}
      this.db.run('UPDATE app_settings SET kill_browser_on_bypass=? WHERE id=1', [settings.killBrowserOnBypass ? 1 : 0]);
    }
    // Sound on block setting (opt-in)
    if (settings.soundOnBlock !== undefined) {
      try { this.db.run('ALTER TABLE app_settings ADD COLUMN sound_on_block INTEGER DEFAULT 0'); } catch {}
      this.db.run('UPDATE app_settings SET sound_on_block=? WHERE id=1', [settings.soundOnBlock ? 1 : 0]);
    }
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
    cols.forEach((c: string, i: number) => { obj[c] = vals[i]; });
    return obj;
  }

  resolveUnlockRequest(id: number, approved: boolean): void {
    this.db.run('UPDATE early_unlock_request SET resolved = 1, approved = ? WHERE id = ?', [approved ? 1 : 0, id]);
    this.save();
  }

  close(): void { this.save(); }

  // ─── Migration: Populate trading_plan from existing position_limits ─────
  private migrateExistingPlanData(): void {
    // Only migrate if trading_plan is empty (first run after upgrade)
    const planExists = this.db.exec('SELECT COUNT(*) FROM trading_plan');
    if (planExists.length && planExists[0].values[0][0] as number > 0) return;

    // Try to extract from existing position_limits JSON in app_settings
    try {
      this.db.run('ALTER TABLE app_settings ADD COLUMN position_limits TEXT');
    } catch {} // Column may already exist

    const settings = this.db.exec('SELECT position_limits FROM app_settings WHERE id = 1');
    if (!settings.length || !settings[0].values.length) {
      // No existing data — insert defaults
      this.db.run('INSERT OR IGNORE INTO trading_plan (id) VALUES (1)');
      return;
    }

    const limitsJson = settings[0].values[0][0] as string | null;
    if (!limitsJson) {
      this.db.run('INSERT OR IGNORE INTO trading_plan (id) VALUES (1)');
      return;
    }

    try {
      const limits = JSON.parse(limitsJson);
      const maxContracts = limits.defaultMax || 2;
      const dailyLoss = limits.lossLimitAmount || 400;
      const maxTrades = limits.maxTradesPerDay || 3;
      const profitTarget = limits.profitTargetAmount || 600;

      this.db.run(
        'INSERT OR IGNORE INTO trading_plan (id, max_contracts, daily_loss, max_trades, profit_target) VALUES (1, ?, ?, ?, ?)',
        [maxContracts, dailyLoss, maxTrades, profitTarget]
      );
    } catch {
      this.db.run('INSERT OR IGNORE INTO trading_plan (id) VALUES (1)');
    }
  }

  // ─── Trading Profile CRUD ──────────────────────────────────────────────

  getTradingProfile(): any | null {
    const results = this.db.exec('SELECT * FROM trading_profile WHERE id = 1');
    if (!results.length || !results[0].values.length) return null;
    const cols = results[0].columns;
    const vals = results[0].values[0];
    const obj: any = {};
    cols.forEach((c: string, i: number) => { obj[c] = vals[i]; });
    return obj;
  }

  saveTradingProfile(profile: {
    firm: string; platform: string; program: string; accountStage: string;
    accountSize: string; firmMaxContracts?: number; firmDailyLoss?: number;
    firmDrawdown?: number; drawdownType?: string; rulesPresetId?: string;
    rulesPresetVersion?: string;
  }): void {
    const existing = this.getTradingProfile();
    if (existing) {
      this.db.run(
        `UPDATE trading_profile SET firm=?, platform=?, program=?, account_stage=?, account_size=?,
         firm_max_contracts=?, firm_daily_loss=?, firm_drawdown=?, drawdown_type=?,
         rules_preset_id=?, rules_preset_version=?, rules_last_verified_at=datetime('now'), updated_at=datetime('now')
         WHERE id=1`,
        [profile.firm, profile.platform, profile.program, profile.accountStage,
         profile.accountSize, profile.firmMaxContracts || null, profile.firmDailyLoss || null,
         profile.firmDrawdown || null, profile.drawdownType || 'intraday_trailing',
         profile.rulesPresetId || null, profile.rulesPresetVersion || null]
      );
    } else {
      this.db.run(
        `INSERT INTO trading_profile (id, firm, platform, program, account_stage, account_size,
         firm_max_contracts, firm_daily_loss, firm_drawdown, drawdown_type,
         rules_preset_id, rules_preset_version, rules_last_verified_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [profile.firm, profile.platform, profile.program, profile.accountStage,
         profile.accountSize, profile.firmMaxContracts || null, profile.firmDailyLoss || null,
         profile.firmDrawdown || null, profile.drawdownType || 'intraday_trailing',
         profile.rulesPresetId || null, profile.rulesPresetVersion || null]
      );
    }
    this.save();
  }

  // ─── Trading Plan CRUD ─────────────────────────────────────────────────

  getTradingPlan(): any | null {
    const results = this.db.exec('SELECT * FROM trading_plan WHERE id = 1');
    if (!results.length || !results[0].values.length) return null;
    const cols = results[0].columns;
    const vals = results[0].values[0];
    const obj: any = {};
    cols.forEach((c: string, i: number) => { obj[c] = vals[i]; });
    return obj;
  }

  saveTradingPlan(plan: {
    maxContracts: number; dailyLoss: number; maxTrades: number;
    profitTarget: number; lockDurationHours: number; lockMode: string;
    resetTime: string; resetTimezone: string;
  }): void {
    const existing = this.getTradingPlan();
    if (existing) {
      this.db.run(
        `UPDATE trading_plan SET max_contracts=?, daily_loss=?, max_trades=?, profit_target=?,
         lock_duration_hours=?, lock_mode=?, reset_time=?, reset_timezone=?, updated_at=datetime('now')
         WHERE id=1`,
        [plan.maxContracts, plan.dailyLoss, plan.maxTrades, plan.profitTarget,
         plan.lockDurationHours, plan.lockMode, plan.resetTime, plan.resetTimezone]
      );
    } else {
      this.db.run(
        `INSERT INTO trading_plan (id, max_contracts, daily_loss, max_trades, profit_target,
         lock_duration_hours, lock_mode, reset_time, reset_timezone)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [plan.maxContracts, plan.dailyLoss, plan.maxTrades, plan.profitTarget,
         plan.lockDurationHours, plan.lockMode, plan.resetTime, plan.resetTimezone]
      );
    }
    this.save();
  }

  // ─── Daily Session Plan CRUD ───────────────────────────────────────────

  getDailySessionPlan(tradingDate: string): any | null {
    const results = this.db.exec(
      'SELECT * FROM daily_session_plan WHERE trading_date = ?', [tradingDate]
    );
    if (!results.length || !results[0].values.length) return null;
    const cols = results[0].columns;
    const vals = results[0].values[0];
    const obj: any = {};
    cols.forEach((c: string, i: number) => { obj[c] = vals[i]; });
    // Parse JSON snapshots
    if (obj.baseline_plan_snapshot) {
      try { obj.baseline_plan_snapshot = JSON.parse(obj.baseline_plan_snapshot); } catch {}
    }
    if (obj.active_plan_snapshot) {
      try { obj.active_plan_snapshot = JSON.parse(obj.active_plan_snapshot); } catch {}
    }
    return obj;
  }

  saveDailySessionPlan(plan: {
    tradingDate: string; readinessStatus: string; readinessScore?: number;
    protectionLevel?: string; baselinePlanSnapshot?: any;
    activePlanSnapshot?: any; recommendationApplied?: boolean;
    readinessCompletedAt?: string;
  }): void {
    const baselineJson = plan.baselinePlanSnapshot ? JSON.stringify(plan.baselinePlanSnapshot) : null;
    const activeJson = plan.activePlanSnapshot ? JSON.stringify(plan.activePlanSnapshot) : null;

    const existing = this.getDailySessionPlan(plan.tradingDate);
    if (existing) {
      this.db.run(
        `UPDATE daily_session_plan SET readiness_status=?, readiness_score=?, protection_level=?,
         baseline_plan_snapshot=?, active_plan_snapshot=?, recommendation_applied=?,
         readiness_completed_at=?, updated_at=datetime('now')
         WHERE trading_date=?`,
        [plan.readinessStatus, plan.readinessScore || null, plan.protectionLevel || null,
         baselineJson, activeJson, plan.recommendationApplied ? 1 : 0,
         plan.readinessCompletedAt || null, plan.tradingDate]
      );
    } else {
      this.db.run(
        `INSERT INTO daily_session_plan (trading_date, readiness_status, readiness_score,
         protection_level, baseline_plan_snapshot, active_plan_snapshot,
         recommendation_applied, readiness_completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [plan.tradingDate, plan.readinessStatus, plan.readinessScore || null,
         plan.protectionLevel || null, baselineJson, activeJson,
         plan.recommendationApplied ? 1 : 0, plan.readinessCompletedAt || null]
      );
    }
    this.save();
  }

  getRecentSessionPlans(limit: number = 30): any[] {
    const results = this.db.exec(
      'SELECT * FROM daily_session_plan ORDER BY trading_date DESC LIMIT ?', [limit]
    );
    if (!results.length) return [];
    return results[0].values.map((row: any) => {
      const cols = results[0].columns;
      const obj: any = {};
      cols.forEach((c: string, i: number) => { obj[c] = row[i]; });
      if (obj.baseline_plan_snapshot) { try { obj.baseline_plan_snapshot = JSON.parse(obj.baseline_plan_snapshot); } catch {} }
      if (obj.active_plan_snapshot) { try { obj.active_plan_snapshot = JSON.parse(obj.active_plan_snapshot); } catch {} }
      return obj;
    });
  }

  // ─── Economic Calendar CRUD ────────────────────────────────────────────

  upsertEconomicEvent(event: {
    id: string; name: string; eventType: string; startsAtUtc: string;
    impact: string; source: string; sourceUrl?: string; affectedMarkets: string[];
    blockMinutesBefore?: number; blockMinutesAfter?: number;
    verificationStatus?: string; verifiedAt?: string;
  }): void {
    this.db.run(
      `INSERT OR REPLACE INTO economic_events (id, name, event_type, starts_at_utc, impact, source, source_url, affected_markets, block_minutes_before, block_minutes_after, verification_status, verified_at, last_verified_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [event.id, event.name, event.eventType, event.startsAtUtc, event.impact, event.source,
       event.sourceUrl || null, JSON.stringify(event.affectedMarkets),
       event.blockMinutesBefore || 30, event.blockMinutesAfter || 15,
       event.verificationStatus || 'ESTIMATED', event.verifiedAt || null]
    );
    this.save();
  }

  upsertManyEconomicEvents(events: Array<{
    id: string; name: string; eventType: string; startsAtUtc: string;
    impact: string; source: string; sourceUrl?: string; affectedMarkets: string[];
    blockMinutesBefore?: number; blockMinutesAfter?: number;
    verificationStatus?: string; verifiedAt?: string;
  }>): void {
    events.forEach(event => {
      this.db.run(
        `INSERT OR REPLACE INTO economic_events (id, name, event_type, starts_at_utc, impact, source, source_url, affected_markets, block_minutes_before, block_minutes_after, verification_status, verified_at, last_verified_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [event.id, event.name, event.eventType, event.startsAtUtc, event.impact, event.source,
         event.sourceUrl || null, JSON.stringify(event.affectedMarkets),
         event.blockMinutesBefore || 30, event.blockMinutesAfter || 15,
         event.verificationStatus || 'ESTIMATED', event.verifiedAt || null]
      );
    });
    this.save();
  }

  getEconomicEvents(fromDate?: string, toDate?: string): any[] {
    let sql = 'SELECT * FROM economic_events';
    const params: any[] = [];
    if (fromDate && toDate) {
      sql += ' WHERE starts_at_utc >= ? AND starts_at_utc <= ?';
      params.push(fromDate, toDate);
    } else if (fromDate) {
      sql += ' WHERE starts_at_utc >= ?';
      params.push(fromDate);
    }
    sql += ' ORDER BY starts_at_utc ASC';
    const results = this.db.exec(sql, params);
    if (!results.length) return [];
    return results[0].values.map((row: any) => {
      const cols = results[0].columns;
      const obj: any = {};
      cols.forEach((c: string, i: number) => { obj[c] = row[i]; });
      if (obj.affected_markets) { try { obj.affected_markets = JSON.parse(obj.affected_markets); } catch {} }
      return obj;
    });
  }

  getUpcomingEconomicEvents(limit: number = 20): any[] {
    const now = new Date().toISOString();
    const results = this.db.exec(
      'SELECT * FROM economic_events WHERE starts_at_utc >= ? ORDER BY starts_at_utc ASC LIMIT ?',
      [now, limit]
    );
    if (!results.length) return [];
    return results[0].values.map((row: any) => {
      const cols = results[0].columns;
      const obj: any = {};
      cols.forEach((c: string, i: number) => { obj[c] = row[i]; });
      if (obj.affected_markets) { try { obj.affected_markets = JSON.parse(obj.affected_markets); } catch {} }
      return obj;
    });
  }

  getNextNfpEvent(): any | null {
    const now = new Date().toISOString();
    const results = this.db.exec(
      "SELECT * FROM economic_events WHERE event_type = 'NFP' AND starts_at_utc >= ? ORDER BY starts_at_utc ASC LIMIT 1",
      [now]
    );
    if (!results.length || !results[0].values.length) return null;
    const cols = results[0].columns;
    const vals = results[0].values[0];
    const obj: any = {};
    cols.forEach((c: string, i: number) => { obj[c] = vals[i]; });
    if (obj.affected_markets) { try { obj.affected_markets = JSON.parse(obj.affected_markets); } catch {} }
    return obj;
  }

  updateSourceStatus(sourceId: string, status: { lastSyncAt?: string; lastSuccessAt?: string; lastError?: string; eventsCount?: number; status: string }): void {
    this.db.run(
      `INSERT OR REPLACE INTO economic_source_status (id, source_name, last_sync_at, last_success_at, last_error, events_count, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [sourceId, sourceId, status.lastSyncAt || null, status.lastSuccessAt || null, status.lastError || null, status.eventsCount || 0, status.status]
    );
    this.save();
  }

  getSourceStatuses(): any[] {
    const results = this.db.exec('SELECT * FROM economic_source_status ORDER BY source_name ASC');
    if (!results.length) return [];
    return results[0].values.map((row: any) => {
      const cols = results[0].columns;
      const obj: any = {};
      cols.forEach((c: string, i: number) => { obj[c] = row[i]; });
      return obj;
    });
  }

  addSyncHistoryEntry(entry: { syncType: string; status: string }): number {
    this.db.run(
      "INSERT INTO economic_sync_history (sync_type, status) VALUES (?, ?)",
      [entry.syncType, entry.status]
    );
    this.save();
    const result = this.db.exec('SELECT last_insert_rowid()');
    return result[0]?.values[0]?.[0] as number || 0;
  }

  completeSyncHistoryEntry(id: number, result: { eventsAdded: number; eventsUpdated: number; errors?: string; status: string }): void {
    this.db.run(
      "UPDATE economic_sync_history SET completed_at=datetime('now'), events_added=?, events_updated=?, errors=?, status=? WHERE id=?",
      [result.eventsAdded, result.eventsUpdated, result.errors || null, result.status, id]
    );
    this.save();
  }

  getLastSyncTime(): string | null {
    const results = this.db.exec("SELECT completed_at FROM economic_sync_history WHERE status='success' ORDER BY completed_at DESC LIMIT 1");
    if (!results.length || !results[0].values.length) return null;
    return results[0].values[0][0] as string | null;
  }

  // Session hours
  updateSessionHours(hours: { enabled: boolean; startTime: string; endTime: string; timezone: string }): void {
    this.db.run(
      `INSERT OR REPLACE INTO app_settings (id, cooldown_hours, start_with_windows, minimize_to_tray, trusted_person_enabled, trusted_password_hash, session_enabled, session_start, session_end, session_timezone)
       VALUES (1, (SELECT cooldown_hours FROM app_settings WHERE id=1), (SELECT start_with_windows FROM app_settings WHERE id=1), (SELECT minimize_to_tray FROM app_settings WHERE id=1), (SELECT trusted_person_enabled FROM app_settings WHERE id=1), (SELECT trusted_password_hash FROM app_settings WHERE id=1), ?, ?, ?, ?)`,
      [hours.enabled ? 1 : 0, hours.startTime, hours.endTime, hours.timezone]
    );
    this.save();
  }

  updatePositionLimits(limitsJson: string): void {
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN position_limits TEXT'); } catch {}
    this.db.run('UPDATE app_settings SET position_limits = ? WHERE id = 1', [limitsJson]);
    this.save();
  }

  updateCoachConfig(configJson: string): void {
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN coach_config TEXT'); } catch {}
    this.db.run('UPDATE app_settings SET coach_config = ? WHERE id = 1', [configJson]);
    this.save();
  }

  // Custom platforms for blocklist
  initCustomPlatforms(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS custom_platforms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        processes TEXT NOT NULL DEFAULT '[]',
        domains TEXT NOT NULL DEFAULT '[]',
        enabled INTEGER NOT NULL DEFAULT 1
      );
    `);
    this.save();
  }

  getCustomPlatforms(): any[] {
    try {
      const results = this.db.exec('SELECT id, name, processes, domains, enabled FROM custom_platforms');
      if (!results.length) return [];
      return results[0].values.map((row: any) => ({
        id: row[0],
        name: row[1],
        processes: JSON.parse(row[2] || '[]'),
        domains: JSON.parse(row[3] || '[]'),
        builtIn: false,
        enabled: row[4] === 1,
      }));
    } catch { return []; }
  }

  addCustomPlatform(platform: { id: string; name: string; processes: string[]; domains: string[] }): void {
    this.db.run(
      'INSERT OR REPLACE INTO custom_platforms (id, name, processes, domains, enabled) VALUES (?, ?, ?, ?, 1)',
      [platform.id, platform.name, JSON.stringify(platform.processes), JSON.stringify(platform.domains)]
    );
    this.save();
  }

  removeCustomPlatform(id: string): void {
    this.db.run('DELETE FROM custom_platforms WHERE id = ?', [id]);
    this.save();
  }

  updatePlatformEnabled(id: string, enabled: boolean): void {
    // Try custom first, then store built-in overrides
    this.db.run('UPDATE custom_platforms SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
    this.save();
  }

  // Store built-in platform enabled/disabled state
  getBlocklistConfig(): string | null {
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN blocklist_config TEXT'); } catch {}
    const results = this.db.exec('SELECT blocklist_config FROM app_settings WHERE id = 1');
    if (!results.length || !results[0].values.length) return null;
    return results[0].values[0][0] as string | null;
  }

  saveBlocklistConfig(configJson: string): void {
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN blocklist_config TEXT'); } catch {}
    this.db.run('UPDATE app_settings SET blocklist_config = ? WHERE id = 1', [configJson]);
    this.save();
  }

  // Day rules
  getDayRulesConfig(): string | null {
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN day_rules_config TEXT'); } catch {}
    const results = this.db.exec('SELECT day_rules_config FROM app_settings WHERE id = 1');
    if (!results.length || !results[0].values.length) return null;
    return results[0].values[0][0] as string | null;
  }

  saveDayRulesConfig(configJson: string): void {
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN day_rules_config TEXT'); } catch {}
    this.db.run('UPDATE app_settings SET day_rules_config = ? WHERE id = 1', [configJson]);
    this.save();
  }

  // News blocker
  getNewsBlockerConfig(): string | null {
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN news_blocker_config TEXT'); } catch {}
    const results = this.db.exec('SELECT news_blocker_config FROM app_settings WHERE id = 1');
    if (!results.length || !results[0].values.length) return null;
    return results[0].values[0][0] as string | null;
  }

  saveNewsBlockerConfig(configJson: string): void {
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN news_blocker_config TEXT'); } catch {}
    this.db.run('UPDATE app_settings SET news_blocker_config = ? WHERE id = 1', [configJson]);
    this.save();
  }

  // Advanced protection
  getAdvancedConfig(): string | null {
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN advanced_config TEXT'); } catch {}
    const results = this.db.exec('SELECT advanced_config FROM app_settings WHERE id = 1');
    if (!results.length || !results[0].values.length) return null;
    return results[0].values[0][0] as string | null;
  }

  saveAdvancedConfig(configJson: string): void {
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN advanced_config TEXT'); } catch {}
    this.db.run('UPDATE app_settings SET advanced_config = ? WHERE id = 1', [configJson]);
    this.save();
  }

  // ─── Trades Table (Analytics) ─────────────────────────────────────────────
  initTradesTable(): void {
    this.db.run(`
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
    `);
    this.save();
  }

  insertTrade(trade: { symbol: string; size: number; direction: string; entryTime: string; exitTime: string; pnl: number; result: string }): void {
    this.initTradesTable();
    // Calculate duration
    let duration = 0;
    try {
      const entry = new Date(trade.entryTime).getTime();
      const exit = new Date(trade.exitTime).getTime();
      duration = Math.max(0, Math.floor((exit - entry) / 1000));
    } catch {}
    this.db.run(
      'INSERT INTO trades (symbol, size, direction, entry_time, exit_time, pnl, result, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [trade.symbol, trade.size, trade.direction, trade.entryTime, trade.exitTime, trade.pnl, trade.result, duration]
    );
    this.save();
  }

  getTrades(limit: number = 500): any[] {
    this.initTradesTable();
    const results = this.db.exec('SELECT id, symbol, size, direction, entry_time, exit_time, pnl, result, duration_seconds FROM trades ORDER BY id DESC LIMIT ?', [limit]);
    if (!results.length) return [];
    return results[0].values.map((row: any) => ({
      id: row[0],
      symbol: row[1],
      size: row[2],
      direction: row[3],
      entryTime: row[4],
      exitTime: row[5],
      pnl: row[6],
      result: row[7],
      durationSeconds: row[8],
    }));
  }

  getTradesByDateRange(startDate: string, endDate: string): any[] {
    this.initTradesTable();
    const results = this.db.exec(
      'SELECT id, symbol, size, direction, entry_time, exit_time, pnl, result, duration_seconds FROM trades WHERE entry_time >= ? AND entry_time <= ? ORDER BY entry_time ASC',
      [startDate, endDate + 'T23:59:59']
    );
    if (!results.length) return [];
    return results[0].values.map((row: any) => ({
      id: row[0],
      symbol: row[1],
      size: row[2],
      direction: row[3],
      entryTime: row[4],
      exitTime: row[5],
      pnl: row[6],
      result: row[7],
      durationSeconds: row[8],
    }));
  }

  getTradeStats(): any {
    this.initTradesTable();
    const all = this.getTrades(10000);
    if (all.length === 0) return null;

    const wins = all.filter(t => t.result === 'win');
    const losses = all.filter(t => t.result === 'loss');
    const totalPnl = all.reduce((s, t) => s + t.pnl, 0);
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
    const winRate = all.length > 0 ? (wins.length / all.length) * 100 : 0;
    const avgDuration = all.length > 0 ? all.reduce((s, t) => s + (t.durationSeconds || 0), 0) / all.length : 0;
    const largestWin = wins.length > 0 ? Math.max(...wins.map(t => t.pnl)) : 0;
    const largestLoss = losses.length > 0 ? Math.min(...losses.map(t => t.pnl)) : 0;

    // Daily P&L grouping
    const byDate: Record<string, number> = {};
    all.forEach(t => {
      const date = t.entryTime?.split('T')[0] || '';
      if (date) byDate[date] = (byDate[date] || 0) + t.pnl;
    });
    const dailyPnLs = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]));
    const bestDay = dailyPnLs.length > 0 ? dailyPnLs.reduce((best, d) => d[1] > best[1] ? d : best) : ['', 0];
    const worstDay = dailyPnLs.length > 0 ? dailyPnLs.reduce((worst, d) => d[1] < worst[1] ? d : worst) : ['', 0];

    // By weekday
    const byWeekday: Record<number, { pnl: number; count: number }> = {};
    all.forEach(t => {
      const d = new Date(t.entryTime);
      const day = d.getDay();
      if (!byWeekday[day]) byWeekday[day] = { pnl: 0, count: 0 };
      byWeekday[day].pnl += t.pnl;
      byWeekday[day].count++;
    });

    // By hour
    const byHour: Record<number, { pnl: number; count: number; wins: number }> = {};
    all.forEach(t => {
      const d = new Date(t.entryTime);
      const h = d.getHours();
      if (!byHour[h]) byHour[h] = { pnl: 0, count: 0, wins: 0 };
      byHour[h].pnl += t.pnl;
      byHour[h].count++;
      if (t.result === 'win') byHour[h].wins++;
    });

    // Consecutive wins/losses
    let maxConsecWins = 0, maxConsecLosses = 0, curWins = 0, curLosses = 0;
    all.reverse().forEach(t => {
      if (t.result === 'win') { curWins++; curLosses = 0; maxConsecWins = Math.max(maxConsecWins, curWins); }
      else { curLosses++; curWins = 0; maxConsecLosses = Math.max(maxConsecLosses, curLosses); }
    });

    // Equity curve (cumulative P&L over time)
    let cumPnl = 0;
    const equityCurve = all.reverse().map(t => { cumPnl += t.pnl; return { date: t.entryTime?.split('T')[0] || '', pnl: cumPnl }; });

    return {
      totalTrades: all.length,
      wins: wins.length,
      losses: losses.length,
      winRate: Math.round(winRate * 10) / 10,
      totalPnl: Math.round(totalPnl * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossLoss: Math.round(grossLoss * 100) / 100,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      largestWin: Math.round(largestWin * 100) / 100,
      largestLoss: Math.round(largestLoss * 100) / 100,
      avgDurationSeconds: Math.round(avgDuration),
      maxConsecWins,
      maxConsecLosses,
      bestDay: { date: bestDay[0], pnl: Math.round((bestDay[1] as number) * 100) / 100 },
      worstDay: { date: worstDay[0], pnl: Math.round((worstDay[1] as number) * 100) / 100 },
      byWeekday,
      byHour,
      dailyPnLs: dailyPnLs.map(([date, pnl]) => ({ date, pnl: Math.round(pnl * 100) / 100 })),
      equityCurve,
      tradesPerDay: dailyPnLs.length > 0 ? Math.round((all.length / dailyPnLs.length) * 10) / 10 : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSIONS — Persistent session tracking for Review
  // ═══════════════════════════════════════════════════════════════════════════

  createSession(sessionId: string): void {
    this.db.run(
      'INSERT OR IGNORE INTO sessions (id, started_at, status) VALUES (?, ?, ?)',
      [sessionId, new Date().toISOString(), 'ACTIVE']
    );
    this.save();
  }

  getActiveSession(): any {
    const results = this.db.exec("SELECT * FROM sessions WHERE status = 'ACTIVE' ORDER BY started_at DESC LIMIT 1");
    if (!results.length || !results[0].values.length) return null;
    const cols = results[0].columns;
    const vals = results[0].values[0];
    const obj: any = {};
    cols.forEach((c: string, i: number) => { obj[c] = vals[i]; });
    return obj;
  }

  getSessionById(sessionId: string): any {
    const results = this.db.exec('SELECT * FROM sessions WHERE id = ?', [sessionId]);
    if (!results.length || !results[0].values.length) return null;
    const cols = results[0].columns;
    const vals = results[0].values[0];
    const obj: any = {};
    cols.forEach((c: string, i: number) => { obj[c] = vals[i]; });
    return obj;
  }

  checkpointSession(sessionId: string, checkpoint: {
    currentState?: string; peakState?: string; totalTrades?: number; pnl?: number;
    escalationCount?: number; recoveryCount?: number; firstEscalationAt?: string | null;
    worstTrigger?: string; recoveredBeforeEnd?: boolean;
    timeInNormal?: number; timeInCaution?: number; timeInElevated?: number;
    timeInHighRisk?: number; timeInLockdown?: number; checkpointJson?: string;
  }): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (checkpoint.currentState !== undefined) { fields.push('ending_state = ?'); values.push(checkpoint.currentState); }
    if (checkpoint.peakState !== undefined) { fields.push('peak_state = ?'); values.push(checkpoint.peakState); }
    if (checkpoint.totalTrades !== undefined) { fields.push('total_trades = ?'); values.push(checkpoint.totalTrades); }
    if (checkpoint.pnl !== undefined) { fields.push('pnl = ?'); values.push(checkpoint.pnl); }
    if (checkpoint.escalationCount !== undefined) { fields.push('escalation_count = ?'); values.push(checkpoint.escalationCount); }
    if (checkpoint.recoveryCount !== undefined) { fields.push('recovery_count = ?'); values.push(checkpoint.recoveryCount); }
    if (checkpoint.firstEscalationAt !== undefined) { fields.push('first_escalation_at = ?'); values.push(checkpoint.firstEscalationAt); }
    if (checkpoint.worstTrigger !== undefined) { fields.push('worst_trigger = ?'); values.push(checkpoint.worstTrigger); }
    if (checkpoint.recoveredBeforeEnd !== undefined) { fields.push('recovered_before_end = ?'); values.push(checkpoint.recoveredBeforeEnd ? 1 : 0); }
    if (checkpoint.timeInNormal !== undefined) { fields.push('time_in_normal = ?'); values.push(checkpoint.timeInNormal); }
    if (checkpoint.timeInCaution !== undefined) { fields.push('time_in_caution = ?'); values.push(checkpoint.timeInCaution); }
    if (checkpoint.timeInElevated !== undefined) { fields.push('time_in_elevated = ?'); values.push(checkpoint.timeInElevated); }
    if (checkpoint.timeInHighRisk !== undefined) { fields.push('time_in_high_risk = ?'); values.push(checkpoint.timeInHighRisk); }
    if (checkpoint.timeInLockdown !== undefined) { fields.push('time_in_lockdown = ?'); values.push(checkpoint.timeInLockdown); }
    if (checkpoint.checkpointJson !== undefined) { fields.push('checkpoint_json = ?'); values.push(checkpoint.checkpointJson); }

    if (fields.length === 0) return;
    values.push(sessionId);
    this.db.run(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`, values);
    this.save();
  }

  finalizeSession(sessionId: string, status: string, summaryJson?: string): void {
    this.db.run(
      'UPDATE sessions SET status = ?, ended_at = ?, summary_json = ? WHERE id = ?',
      [status, new Date().toISOString(), summaryJson || null, sessionId]
    );
    this.save();
  }

  getSessionJourney(sessionId: string): { session: any; transitions: any[]; trades: any[]; blocks: any[] } {
    const session = this.getSessionById(sessionId);
    if (!session) return { session: null, transitions: [], trades: [], blocks: [] };

    // Get state transitions for this session
    const transResults = this.db.exec(
      "SELECT id, timestamp, type, details FROM activity_log WHERE type = 'state_transition' AND details LIKE ? ORDER BY timestamp ASC",
      [`%${sessionId}%`]
    );
    const transitions = transResults.length ? transResults[0].values.map((row: any) => ({
      id: row[0], timestamp: row[1], type: row[2], details: row[3],
    })) : [];

    // Get trades during session period
    let trades: any[] = [];
    if (session.started_at) {
      const endTime = session.ended_at || new Date().toISOString();
      const tradeResults = this.db.exec(
        'SELECT id, symbol, size, direction, entry_time, exit_time, pnl, result, duration_seconds FROM trades WHERE entry_time >= ? AND entry_time <= ? ORDER BY entry_time ASC',
        [session.started_at, endTime]
      );
      if (tradeResults.length) {
        trades = tradeResults[0].values.map((row: any) => ({
          id: row[0], symbol: row[1], size: row[2], direction: row[3],
          entryTime: row[4], exitTime: row[5], pnl: row[6], result: row[7], durationSeconds: row[8],
        }));
      }
    }

    // Get blocks/violations during session period
    let blocks: any[] = [];
    if (session.started_at) {
      const endTime = session.ended_at || new Date().toISOString();
      const blockResults = this.db.exec(
        "SELECT id, timestamp, type, details FROM activity_log WHERE timestamp >= ? AND timestamp <= ? AND type IN ('size_blocked', 'session_blocked', 'symbol_blocked', 'coach_blocked', 'stacking_blocked', 'bypass_attempt') ORDER BY timestamp ASC",
        [session.started_at, endTime]
      );
      if (blockResults.length) {
        blocks = blockResults[0].values.map((row: any) => ({
          id: row[0], timestamp: row[1], type: row[2], details: row[3],
        }));
      }
    }

    return { session, transitions, trades, blocks };
  }

  recoverCrashedSessions(): void {
    // Find any ACTIVE sessions and mark them as CRASH_RECOVERED
    this.db.run(
      "UPDATE sessions SET status = 'CRASH_RECOVERED', ended_at = ? WHERE status = 'ACTIVE'",
      [new Date().toISOString()]
    );
    this.save();
  }
}
