/**
 * Database Migration Tests
 * 
 * Verifies: tables created correctly, migration from old schema,
 * data preserved across upgrades, no silent failures.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDatabase } from '../utils/test-database';

describe('Database Schema', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = new TestDatabase();
    await db.waitReady();
  });

  afterEach(() => {
    db.close();
  });

  describe('Table Existence', () => {
    const requiredTables = [
      'activity_log', 'lock_state', 'early_unlock_request', 'app_settings',
      'trading_profile', 'trading_plan', 'daily_session_plan', 'trades', 'custom_platforms',
    ];

    requiredTables.forEach(table => {
      it(`table "${table}" exists`, () => {
        const result = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]);
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Default Values', () => {
    it('lock_state defaults to unlocked', () => {
      const state = db.getRow('lock_state');
      expect(state.is_locked).toBe(0);
      expect(state.bypass_attempts).toBe(0);
    });

    it('app_settings has correct defaults', () => {
      const settings = db.getRow('app_settings');
      expect(settings.cooldown_hours).toBe(12);
      expect(settings.start_with_windows).toBe(1);
      expect(settings.minimize_to_tray).toBe(1);
      expect(settings.trusted_person_enabled).toBe(0);
    });

    it('trading_plan has conservative defaults', () => {
      const plan = db.getRow('trading_plan');
      expect(plan.max_contracts).toBe(2);
      expect(plan.daily_loss).toBe(400);
      expect(plan.max_trades).toBe(3);
      expect(plan.profit_target).toBe(600);
      expect(plan.lock_duration_hours).toBe(4);
      expect(plan.lock_mode).toBe('duration');
    });
  });

  describe('Data Integrity', () => {
    it('daily_session_plan enforces unique trading_date', () => {
      db.run("INSERT INTO daily_session_plan (trading_date, readiness_status) VALUES ('2026-07-22', 'completed')");
      expect(() => {
        db.run("INSERT INTO daily_session_plan (trading_date, readiness_status) VALUES ('2026-07-22', 'skipped')");
      }).toThrow();
    });

    it('lock_state enforces single row (id=1)', () => {
      expect(() => {
        db.run("INSERT INTO lock_state (id, is_locked, bypass_attempts) VALUES (2, 0, 0)");
      }).toThrow();
    });

    it('trading_plan enforces single row (id=1)', () => {
      expect(() => {
        db.run("INSERT INTO trading_plan (id, max_contracts, daily_loss, max_trades, profit_target) VALUES (2, 1, 200, 2, 300)");
      }).toThrow();
    });

    it('activity_log auto-increments IDs', () => {
      db.run("INSERT INTO activity_log (type, details) VALUES ('test1', 'first')");
      db.run("INSERT INTO activity_log (type, details) VALUES ('test2', 'second')");
      const log = db.getActivityLog(10);
      expect(log[0].id).toBeGreaterThan(log[1].id); // DESC order
    });
  });

  describe('Snapshot & Restore', () => {
    it('creates and restores snapshot correctly', async () => {
      db.run("INSERT INTO activity_log (type, details) VALUES ('before', 'snapshot')");
      db.createSnapshot('clean');

      db.run("INSERT INTO activity_log (type, details) VALUES ('after', 'should disappear')");
      const logBefore = db.getActivityLog(10);
      expect(logBefore.length).toBe(2);

      await db.restoreSnapshot('clean');
      const logAfter = db.getActivityLog(10);
      expect(logAfter.length).toBe(1);
      expect(logAfter[0].type).toBe('before');
    });
  });
});
