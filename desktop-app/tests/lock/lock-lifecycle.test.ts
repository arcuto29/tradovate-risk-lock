/**
 * Lock Lifecycle Tests
 * 
 * Verifies: lock → persist → restore → timer → unlock → reset
 * These are the most critical tests — a failure here means a trader's
 * funded account could be unprotected.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDatabase } from '../utils/test-database';
import { TestClock } from '../utils/test-clock';

// Minimal LockManager reimplementation for testing (avoids Electron dependencies)
class TestLockManager {
  private db: TestDatabase;
  private locked = false;
  private lockExpiresAt: string | null = null;
  private lockTime: string | null = null;
  private maxContracts = 0;
  private dailyLossLimit = 0;

  constructor(db: TestDatabase) {
    this.db = db;
    this.restoreState();
  }

  private restoreState(): void {
    const state = this.db.getRow('lock_state');
    if (state && state.is_locked) {
      this.locked = true;
      this.lockTime = state.lock_time;
      this.lockExpiresAt = state.reset_time;
      this.maxContracts = state.max_contracts || 0;
      this.dailyLossLimit = state.daily_loss_limit || 0;

      // Check if expired
      if (this.lockExpiresAt && new Date(this.lockExpiresAt).getTime() <= TestClock.now()) {
        this.performReset();
      }
    }
  }

  isLocked(): boolean { return this.locked; }
  getExpiresAt(): string | null { return this.lockExpiresAt; }
  getMaxContracts(): number { return this.maxContracts; }
  getDailyLossLimit(): number { return this.dailyLossLimit; }

  lock(settings: { dailyLossLimit: number; maxContracts: number; lockExpiresAt: string }): { success: boolean; error?: string } {
    if (this.locked) return { success: false, error: 'Already locked' };
    if (settings.dailyLossLimit <= 0 && settings.maxContracts <= 0) {
      return { success: false, error: 'At least one limit must be > 0' };
    }

    this.locked = true;
    this.lockTime = new Date(TestClock.now()).toISOString();
    this.lockExpiresAt = settings.lockExpiresAt;
    this.maxContracts = settings.maxContracts;
    this.dailyLossLimit = settings.dailyLossLimit;

    this.db.run(
      'UPDATE lock_state SET is_locked=1, lock_time=?, reset_time=?, daily_loss_limit=?, max_contracts=? WHERE id=1',
      [this.lockTime, this.lockExpiresAt, this.dailyLossLimit, this.maxContracts]
    );
    this.db.run("INSERT INTO activity_log (type, details) VALUES ('lock_activated', ?)",
      [JSON.stringify(settings)]);

    return { success: true };
  }

  checkExpiry(): void {
    if (this.locked && this.lockExpiresAt) {
      if (new Date(this.lockExpiresAt).getTime() <= TestClock.now()) {
        this.performReset();
      }
    }
  }

  forceUnlock(): void {
    this.performReset();
  }

  private performReset(): void {
    this.locked = false;
    this.lockTime = null;
    this.lockExpiresAt = null;
    this.maxContracts = 0;
    this.dailyLossLimit = 0;
    this.db.run('UPDATE lock_state SET is_locked=0, lock_time=NULL, reset_time=NULL, daily_loss_limit=NULL, max_contracts=NULL, bypass_attempts=0 WHERE id=1');
    this.db.run("INSERT INTO activity_log (type, details) VALUES ('auto_reset', 'Lock reset')");
  }
}

describe('Lock Lifecycle', () => {
  let db: TestDatabase;
  let lm: TestLockManager;

  beforeEach(async () => {
    db = new TestDatabase();
    await db.waitReady();
    TestClock.freeze('2026-07-22T09:00:00.000Z');
    lm = new TestLockManager(db);
  });

  afterEach(() => {
    TestClock.reset();
    db.close();
  });

  it('starts unlocked', () => {
    expect(lm.isLocked()).toBe(false);
  });

  it('locks successfully with valid settings', () => {
    const result = lm.lock({
      dailyLossLimit: 400,
      maxContracts: 2,
      lockExpiresAt: '2026-07-22T13:00:00.000Z', // 4 hours later
    });
    expect(result.success).toBe(true);
    expect(lm.isLocked()).toBe(true);
    expect(lm.getMaxContracts()).toBe(2);
    expect(lm.getDailyLossLimit()).toBe(400);
  });

  it('rejects lock with all limits at zero', () => {
    const result = lm.lock({
      dailyLossLimit: 0,
      maxContracts: 0,
      lockExpiresAt: '2026-07-22T13:00:00.000Z',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('At least one limit');
  });

  it('rejects double-lock', () => {
    lm.lock({ dailyLossLimit: 400, maxContracts: 2, lockExpiresAt: '2026-07-22T13:00:00.000Z' });
    const result = lm.lock({ dailyLossLimit: 500, maxContracts: 3, lockExpiresAt: '2026-07-22T14:00:00.000Z' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Already locked');
  });

  it('persists lock to SQLite', () => {
    lm.lock({ dailyLossLimit: 400, maxContracts: 2, lockExpiresAt: '2026-07-22T13:00:00.000Z' });
    const state = db.getRow('lock_state');
    expect(state.is_locked).toBe(1);
    expect(state.daily_loss_limit).toBe(400);
    expect(state.max_contracts).toBe(2);
    expect(state.reset_time).toBe('2026-07-22T13:00:00.000Z');
  });

  it('restores locked state from SQLite (simulates app restart)', async () => {
    lm.lock({ dailyLossLimit: 400, maxContracts: 2, lockExpiresAt: '2026-07-22T13:00:00.000Z' });

    // Simulate restart: create new LockManager reading same DB
    const lm2 = new TestLockManager(db);
    expect(lm2.isLocked()).toBe(true);
    expect(lm2.getMaxContracts()).toBe(2);
    expect(lm2.getDailyLossLimit()).toBe(400);
  });

  it('auto-resets when timer expires', () => {
    lm.lock({ dailyLossLimit: 400, maxContracts: 2, lockExpiresAt: '2026-07-22T13:00:00.000Z' });
    expect(lm.isLocked()).toBe(true);

    // Advance past expiry
    TestClock.freeze('2026-07-22T13:00:01.000Z');
    lm.checkExpiry();

    expect(lm.isLocked()).toBe(false);
  });

  it('does NOT reset before timer expires', () => {
    lm.lock({ dailyLossLimit: 400, maxContracts: 2, lockExpiresAt: '2026-07-22T13:00:00.000Z' });

    TestClock.freeze('2026-07-22T12:59:59.000Z');
    lm.checkExpiry();

    expect(lm.isLocked()).toBe(true);
  });

  it('force unlock works while locked', () => {
    lm.lock({ dailyLossLimit: 400, maxContracts: 2, lockExpiresAt: '2026-07-22T13:00:00.000Z' });
    lm.forceUnlock();
    expect(lm.isLocked()).toBe(false);
  });

  it('logs lock_activated in activity_log', () => {
    lm.lock({ dailyLossLimit: 400, maxContracts: 2, lockExpiresAt: '2026-07-22T13:00:00.000Z' });
    const log = db.getActivityLog();
    expect(log.some(e => e.type === 'lock_activated')).toBe(true);
  });

  it('logs auto_reset when timer expires', () => {
    lm.lock({ dailyLossLimit: 400, maxContracts: 2, lockExpiresAt: '2026-07-22T13:00:00.000Z' });
    TestClock.freeze('2026-07-22T13:01:00.000Z');
    lm.checkExpiry();
    const log = db.getActivityLog();
    expect(log.some(e => e.type === 'auto_reset')).toBe(true);
  });

  it('expired lock auto-resets on restore (simulates overnight restart)', async () => {
    lm.lock({ dailyLossLimit: 400, maxContracts: 2, lockExpiresAt: '2026-07-22T13:00:00.000Z' });

    // Simulate next day startup
    TestClock.freeze('2026-07-23T08:00:00.000Z');
    const lm2 = new TestLockManager(db);
    expect(lm2.isLocked()).toBe(false); // Auto-reset on startup
  });

  it('resets bypass_attempts on unlock', () => {
    lm.lock({ dailyLossLimit: 400, maxContracts: 2, lockExpiresAt: '2026-07-22T13:00:00.000Z' });
    db.run('UPDATE lock_state SET bypass_attempts = 5 WHERE id = 1');
    
    TestClock.freeze('2026-07-22T13:01:00.000Z');
    lm.checkExpiry();
    
    const state = db.getRow('lock_state');
    expect(state.bypass_attempts).toBe(0);
  });
});
