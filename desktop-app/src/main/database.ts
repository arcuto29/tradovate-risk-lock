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
    cols.forEach((c: string, i: number) => { obj[c] = vals[i]; });
    // Ensure kill_browser column exists
    try { this.db.run('ALTER TABLE app_settings ADD COLUMN kill_browser_on_bypass INTEGER DEFAULT 0'); } catch {}
    return obj;
  }

  updateSettings(settings: Partial<{ cooldownHours: number; startWithWindows: boolean; minimizeToTray: boolean; trustedPersonEnabled: boolean; trustedPasswordHash: string | null; killBrowserOnBypass: boolean; }>): void {
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
}
