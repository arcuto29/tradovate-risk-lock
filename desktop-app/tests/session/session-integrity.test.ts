/**
 * SESSION DATA INTEGRITY TESTS
 * 
 * Tests:
 * - Crash recovery: active lock → same session resumes
 * - Crash recovery: expired lock → CRASH_RECOVERED
 * - No duplicate session_id
 * - session_id propagated to trade
 * - session_id propagated to activity log
 * - Legacy rows (null session_id) still queryable
 * - Journey query returns only correct session data
 * - No cross-session contamination
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════════
// Simulated session lifecycle for testing crash recovery logic
// ═══════════════════════════════════════════════════════════════════════════════

interface Session {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'CRASH_RECOVERED';
  peak_state: string;
}

let sessions: Session[] = [];
let lockActive = false;
let lockExpiresAt: string | null = null;
let currentSessionId: string | null = null;

// Simulated activity log with session_id
interface LogEntry { type: string; details: string; session_id: string | null; timestamp: string; }
let activityLog: LogEntry[] = [];

// Simulated trades with session_id
interface Trade { symbol: string; pnl: number; session_id: string | null; }
let trades: Trade[] = [];

function reset() {
  sessions = [];
  activityLog = [];
  trades = [];
  lockActive = false;
  lockExpiresAt = null;
  currentSessionId = null;
}

function createSession(id: string): void {
  sessions.push({ id, started_at: new Date().toISOString(), ended_at: null, status: 'ACTIVE', peak_state: 'NORMAL' });
}

function getActiveSession(): Session | null {
  return sessions.find(s => s.status === 'ACTIVE') || null;
}

function finalizeSession(id: string, status: 'COMPLETED' | 'CRASH_RECOVERED'): void {
  const s = sessions.find(s => s.id === id);
  if (s) { s.status = status; s.ended_at = new Date().toISOString(); }
}

function recoverCrashedSessions(): void {
  sessions.filter(s => s.status === 'ACTIVE').forEach(s => {
    s.status = 'CRASH_RECOVERED';
    s.ended_at = new Date().toISOString();
  });
}

/**
 * Smart crash recovery — matches the fixed LockManager logic.
 */
function restoreOrRecoverSession(): void {
  const active = getActiveSession();
  if (!active) return;

  if (lockActive && lockExpiresAt) {
    const expiryTime = new Date(lockExpiresAt).getTime();
    if (expiryTime > Date.now()) {
      // Lock still active + not expired → RESUME
      currentSessionId = active.id;
      return;
    }
  }
  // Cannot resume → mark as CRASH_RECOVERED
  recoverCrashedSessions();
}

function lock(sessionId: string, expiresAt: string): void {
  lockActive = true;
  lockExpiresAt = expiresAt;
  currentSessionId = sessionId;
  createSession(sessionId);
}

function logActivity(type: string, details: string): void {
  activityLog.push({ type, details, session_id: currentSessionId, timestamp: new Date().toISOString() });
}

function insertTrade(symbol: string, pnl: number): void {
  trades.push({ symbol, pnl, session_id: currentSessionId });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Session Data Integrity', () => {
  beforeEach(reset);

  describe('Crash Recovery Semantics', () => {
    it('crash + active lock → same ACTIVE session RESUMES (no CRASH_RECOVERED)', () => {
      // Simulate: session created, app crashes, restarts while lock still valid
      const futureExpiry = new Date(Date.now() + 3600000).toISOString(); // 1hr from now
      lock('sess_abc', futureExpiry);
      
      // Simulate crash: clear runtime state but keep DB state
      const savedSessionId = currentSessionId;
      currentSessionId = null; // Lost in crash

      // On restart: lock is restored from DB
      lockActive = true;
      lockExpiresAt = futureExpiry;

      // Smart recovery
      restoreOrRecoverSession();

      // Session should be RESUMED, not CRASH_RECOVERED
      expect(currentSessionId).toBe('sess_abc');
      const active = getActiveSession();
      expect(active).not.toBeNull();
      expect(active!.status).toBe('ACTIVE');
      expect(active!.id).toBe('sess_abc');
    });

    it('crash + expired lock → session marked CRASH_RECOVERED', () => {
      const pastExpiry = new Date(Date.now() - 1000).toISOString(); // Already expired
      lock('sess_expired', pastExpiry);
      
      // Simulate crash + restart
      currentSessionId = null;
      lockActive = false; // Lock expired
      lockExpiresAt = pastExpiry;

      restoreOrRecoverSession();

      // Session should be CRASH_RECOVERED
      expect(currentSessionId).toBeNull();
      const session = sessions.find(s => s.id === 'sess_expired');
      expect(session!.status).toBe('CRASH_RECOVERED');
    });

    it('crash + lock not active → session marked CRASH_RECOVERED', () => {
      lock('sess_unlocked', new Date(Date.now() + 3600000).toISOString());
      
      // Simulate: user unlocked before crash, but session still ACTIVE in DB
      currentSessionId = null;
      lockActive = false;

      restoreOrRecoverSession();

      expect(currentSessionId).toBeNull();
      expect(sessions[0].status).toBe('CRASH_RECOVERED');
    });

    it('no active sessions → nothing happens', () => {
      lockActive = true;
      lockExpiresAt = new Date(Date.now() + 3600000).toISOString();
      
      restoreOrRecoverSession();

      expect(currentSessionId).toBeNull(); // No session to resume
    });

    it('no duplicate session_id after resume', () => {
      const futureExpiry = new Date(Date.now() + 3600000).toISOString();
      lock('sess_unique', futureExpiry);
      
      // Simulate crash + restart
      currentSessionId = null;
      lockActive = true;
      lockExpiresAt = futureExpiry;

      restoreOrRecoverSession();

      // Should NOT create a new session
      expect(sessions.length).toBe(1);
      expect(sessions[0].id).toBe('sess_unique');
      expect(currentSessionId).toBe('sess_unique');
    });
  });

  describe('session_id Propagation', () => {
    it('trade is tagged with active session_id', () => {
      lock('sess_trades', new Date(Date.now() + 3600000).toISOString());
      insertTrade('NQ', 150);
      insertTrade('ES', -75);

      expect(trades[0].session_id).toBe('sess_trades');
      expect(trades[1].session_id).toBe('sess_trades');
    });

    it('activity log is tagged with active session_id', () => {
      lock('sess_logs', new Date(Date.now() + 3600000).toISOString());
      logActivity('size_blocked', 'Order too large');
      logActivity('state_transition', '{"from":"NORMAL","to":"CAUTION"}');

      expect(activityLog[0].session_id).toBe('sess_logs');
      expect(activityLog[1].session_id).toBe('sess_logs');
    });

    it('entries without lock have null session_id', () => {
      currentSessionId = null;
      insertTrade('NQ', 50);
      logActivity('app_start', 'Application started');

      expect(trades[0].session_id).toBeNull();
      expect(activityLog[0].session_id).toBeNull();
    });

    it('different sessions get different session_ids', () => {
      lock('sess_1', new Date(Date.now() + 3600000).toISOString());
      insertTrade('NQ', 100);
      logActivity('trade', 'win');

      // End session 1, start session 2
      finalizeSession('sess_1', 'COMPLETED');
      currentSessionId = 'sess_2';
      createSession('sess_2');

      insertTrade('ES', -50);
      logActivity('trade', 'loss');

      expect(trades[0].session_id).toBe('sess_1');
      expect(trades[1].session_id).toBe('sess_2');
      expect(activityLog[0].session_id).toBe('sess_1');
      expect(activityLog[1].session_id).toBe('sess_2');
    });
  });

  describe('Legacy Compatibility', () => {
    it('rows with null session_id are still accessible', () => {
      // Legacy trade (no session_id)
      trades.push({ symbol: 'NQ', pnl: 200, session_id: null });
      trades.push({ symbol: 'ES', pnl: -100, session_id: null });

      // All trades still queryable
      expect(trades.length).toBe(2);
      expect(trades.filter(t => t.session_id === null).length).toBe(2);
    });

    it('mixed old and new rows coexist', () => {
      // Legacy rows
      trades.push({ symbol: 'NQ', pnl: 50, session_id: null });
      activityLog.push({ type: 'lock_activated', details: '{}', session_id: null, timestamp: '2025-01-01' });

      // New rows with session_id
      lock('sess_new', new Date(Date.now() + 3600000).toISOString());
      insertTrade('ES', 100);
      logActivity('state_transition', 'data');

      // Both accessible
      expect(trades.length).toBe(2);
      expect(trades[0].session_id).toBeNull();
      expect(trades[1].session_id).toBe('sess_new');
    });
  });

  describe('No Cross-Session Contamination', () => {
    it('journey query for session_1 does not include session_2 data', () => {
      lock('sess_A', new Date(Date.now() + 3600000).toISOString());
      insertTrade('NQ', 100);
      logActivity('size_blocked', 'blocked in A');

      finalizeSession('sess_A', 'COMPLETED');
      currentSessionId = 'sess_B';
      createSession('sess_B');

      insertTrade('ES', -50);
      logActivity('coach_blocked', 'blocked in B');

      // Query session A
      const sessionATrades = trades.filter(t => t.session_id === 'sess_A');
      const sessionALogs = activityLog.filter(l => l.session_id === 'sess_A');

      expect(sessionATrades.length).toBe(1);
      expect(sessionATrades[0].symbol).toBe('NQ');
      expect(sessionALogs.length).toBe(1);
      expect(sessionALogs[0].details).toBe('blocked in A');

      // Query session B — no contamination
      const sessionBTrades = trades.filter(t => t.session_id === 'sess_B');
      const sessionBLogs = activityLog.filter(l => l.session_id === 'sess_B');

      expect(sessionBTrades.length).toBe(1);
      expect(sessionBTrades[0].symbol).toBe('ES');
      expect(sessionBLogs.length).toBe(1);
      expect(sessionBLogs[0].details).toBe('blocked in B');
    });
  });
});
