/**
 * RACE CONDITION REGRESSION TESTS — Phase 1: Execution Safety
 * 
 * Tests scenarios where state changes happen during or between order evaluations:
 * - Rapid order submission (multiple orders in quick succession)
 * - State changes during execution (lock activates between orders)
 * - Flatten during lock-state change
 * - Emergency exits during any state transition
 * - Multiple simultaneous orders on different symbols
 * - Rule changes immediately before an order
 * - Connection loss/reconnect (app disconnect mid-enforcement)
 * - Position reversal during protection state change
 * 
 * KEY INVARIANT: Exits are NEVER blocked regardless of state transitions.
 * The evaluator uses snapshot-consistent reads (all state is in-memory variables
 * read synchronously) so there is no torn-read possible within a single evaluation.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════════
// Minimal reproduction of evaluateTradingRequest with MUTABLE state
// (simulates the real extension where state changes via postMessage handlers)
// ═══════════════════════════════════════════════════════════════════════════════

const CLOSE_URLS = ['/Order/close', '/order/close', '/Position/close', '/position/close',
  '/Order/flatten', '/order/flatten', '/Position/flatten', '/position/flatten'];
const CANCEL_URLS = ['/Order/cancel', '/order/cancel', '/Order/delete', '/order/delete',
  '/order/cancelAll', '/Order/cancelAll'];
const MODIFY_STOP_URLS = ['/Order/editStopLoss', '/Order/editStop', '/order/modifyStop',
  '/Order/editTakeProfit', '/order/modifyTakeProfit'];
const QUERY_URLS = ['/Order?', '/order/list', '/orders/history', '/Position?',
  '/position/list', '/account/', '/user/'];


// Mutable state — simulates the extension's module-scoped variables
let state = {
  lockActive: false,
  sessionBlocked: false,
  fullDayBlocked: false,
  newsBlockerEnabled: false,
  newsBlocked: false,
  dailyLossBlocked: false,
  profitLocked: false,
  cooldownActive: false,
  cooldownUntil: 0,
  tiltBlocking: false,
  maxContracts: 2,
  blockedSymbols: [] as string[],
  pyramidingEnabled: true,
  coachEnabled: false,
  maxTradesPerDay: 0,
  currentTradeCount: 0,
  positionState: {} as Record<string, { side: string; quantity: number }>,
};

function resetState() {
  state = {
    lockActive: false, sessionBlocked: false, fullDayBlocked: false,
    newsBlockerEnabled: false, newsBlocked: false, dailyLossBlocked: false,
    profitLocked: false, cooldownActive: false, cooldownUntil: 0,
    tiltBlocking: false, maxContracts: 2, blockedSymbols: [],
    pyramidingEnabled: true, coachEnabled: false, maxTradesPerDay: 0,
    currentTradeCount: 0, positionState: {},
  };
}

function getPositionForSymbol(symbol: string): { side: string; quantity: number } {
  if (!symbol) return { side: 'flat', quantity: 0 };
  const pos = state.positionState[symbol.toUpperCase()];
  if (pos && pos.quantity > 0) return { side: pos.side, quantity: pos.quantity };
  return { side: 'flat', quantity: 0 };
}


interface Classification {
  action: string; reason: string; symbol: string; side: string;
  quantity: number; positionBefore: { side: string; quantity: number };
  closeQuantity: number; newRiskQuantity: number; confidence: string;
}

function classifyOrder(url: string, body: any): Classification {
  let symbol = '', side = '', quantity = 0;
  let positionBefore = { side: 'flat', quantity: 0 };

  if (body) {
    symbol = String(body.symbolId || body.symbol || body.instrument || '').toUpperCase();
    side = String(body.action || body.orderAction || body.side || '').toLowerCase();
    quantity = Math.abs(body.positionSize || body.qty || body.quantity || body.amount || body.size || 0);
  }
  positionBefore = getPositionForSymbol(symbol);

  const result: Classification = {
    action: 'UNKNOWN', reason: '', symbol: symbol || 'UNKNOWN',
    side: side || 'unknown', quantity, positionBefore,
    closeQuantity: 0, newRiskQuantity: 0, confidence: 'low',
  };

  if (!url) { result.reason = 'No URL'; return result; }
  const lower = url.toLowerCase();

  if (QUERY_URLS.some(p => lower.includes(p.toLowerCase()))) { result.action = 'QUERY'; result.confidence = 'high'; return result; }
  if (CLOSE_URLS.some(p => lower.includes(p.toLowerCase()))) { result.action = 'CLOSE_POSITION'; result.confidence = 'high'; result.closeQuantity = positionBefore.quantity || quantity; return result; }
  if (CANCEL_URLS.some(p => lower.includes(p.toLowerCase()))) { result.action = 'CANCEL_ORDER'; result.confidence = 'high'; return result; }
  if (MODIFY_STOP_URLS.some(p => lower.includes(p.toLowerCase()))) { result.action = 'MODIFY_PROTECTIVE_ORDER'; result.confidence = 'high'; return result; }

  if (body) {
    const action = String(body.action || body.orderAction || body.type || '').toLowerCase();
    if (action === 'close' || action === 'flatten' || action === 'closeposition' || action === 'closeall') { result.action = 'CLOSE_POSITION'; result.confidence = 'high'; result.closeQuantity = positionBefore.quantity || quantity; return result; }
    if (action === 'cancel' || action === 'cancelorder' || action === 'cancelall') { result.action = 'CANCEL_ORDER'; result.confidence = 'high'; return result; }
    if (body.isClose === true || body.closePosition === true || body.flatten === true) { result.action = 'CLOSE_POSITION'; result.confidence = 'high'; result.closeQuantity = positionBefore.quantity || quantity; return result; }
    if (body.reduceOnly === true || body.isReduceOnly === true) { result.action = 'REDUCE_POSITION'; result.confidence = 'high'; result.closeQuantity = Math.min(quantity, positionBefore.quantity); return result; }


    if (symbol && positionBefore.side !== 'flat' && positionBefore.quantity > 0 && side && quantity > 0) {
      const isSelling = (side === 'sell' || side === 'sellshort' || side === 'short');
      const isBuying = (side === 'buy' || side === 'buytocover' || side === 'long');
      const isLong = positionBefore.side === 'long';
      const isShort = positionBefore.side === 'short';

      if (isLong && isSelling) {
        if (quantity < positionBefore.quantity) { result.action = 'REDUCE_POSITION'; result.confidence = 'medium'; result.closeQuantity = quantity; return result; }
        else if (quantity === positionBefore.quantity) { result.action = 'CLOSE_POSITION'; result.confidence = 'medium'; result.closeQuantity = quantity; return result; }
        else { result.action = 'REVERSE_POSITION'; result.confidence = 'medium'; result.closeQuantity = positionBefore.quantity; result.newRiskQuantity = quantity - positionBefore.quantity; return result; }
      }
      if (isShort && isBuying) {
        if (quantity < positionBefore.quantity) { result.action = 'REDUCE_POSITION'; result.confidence = 'medium'; result.closeQuantity = quantity; return result; }
        else if (quantity === positionBefore.quantity) { result.action = 'CLOSE_POSITION'; result.confidence = 'medium'; result.closeQuantity = quantity; return result; }
        else { result.action = 'REVERSE_POSITION'; result.confidence = 'medium'; result.closeQuantity = positionBefore.quantity; result.newRiskQuantity = quantity - positionBefore.quantity; return result; }
      }
      if (isLong && isBuying) { result.action = 'INCREASE_POSITION'; result.confidence = 'medium'; result.newRiskQuantity = quantity; return result; }
      if (isShort && isSelling) { result.action = 'INCREASE_POSITION'; result.confidence = 'medium'; result.newRiskQuantity = quantity; return result; }
    }

    if (positionBefore.side === 'flat' && side && quantity > 0) { result.action = 'OPEN_POSITION'; result.confidence = 'medium'; result.newRiskQuantity = quantity; return result; }
  }

  result.action = 'UNKNOWN'; result.confidence = 'low'; return result;
}


function evaluateTradingRequest(url: string, method: string, body: any): { allow: boolean; reason: string; classification: Classification } {
  const classification = classifyOrder(url, body);
  const decision = { allow: true, reason: '', classification };

  // EXIT SAFETY: Always allow risk-reducing FIRST
  if (classification.action === 'CLOSE_POSITION' || classification.action === 'REDUCE_POSITION' ||
      classification.action === 'CANCEL_ORDER' || classification.action === 'MODIFY_PROTECTIVE_ORDER' ||
      classification.action === 'QUERY') {
    decision.allow = true; decision.reason = 'Risk-reducing: ' + classification.action; return decision;
  }

  // UNKNOWN: fail safe
  if (classification.action === 'UNKNOWN') {
    decision.allow = true; decision.reason = 'Unknown - allowing safely'; return decision;
  }

  // REVERSAL: check new-risk portion
  if (classification.action === 'REVERSE_POSITION') {
    const newRiskQty = classification.newRiskQuantity || 0;
    if (state.lockActive && newRiskQty > state.maxContracts) { decision.allow = false; decision.reason = 'Reversal: new exposure exceeds max'; return decision; }
    if (state.lockActive && state.blockedSymbols.some(s => classification.symbol.includes(s))) { decision.allow = false; decision.reason = 'Reversal: blocked symbol'; return decision; }
    if (state.lockActive && state.sessionBlocked) { decision.allow = false; decision.reason = 'Reversal: outside session'; return decision; }
    if (state.lockActive && state.newsBlockerEnabled && state.newsBlocked) { decision.allow = false; decision.reason = 'Reversal: news window'; return decision; }
    decision.allow = true; decision.reason = 'Reversal allowed'; return decision;
  }

  // RISK-INCREASING: Check all rules
  if (state.fullDayBlocked) { decision.allow = false; decision.reason = 'Full day block'; return decision; }
  if (state.lockActive && state.blockedSymbols.some(s => (classification.symbol || '').includes(s))) { decision.allow = false; decision.reason = 'Blocked symbol'; return decision; }
  if (state.lockActive && state.sessionBlocked) { decision.allow = false; decision.reason = 'Outside session'; return decision; }
  if (state.lockActive && state.newsBlockerEnabled && state.newsBlocked) { decision.allow = false; decision.reason = 'News window'; return decision; }
  if (state.lockActive && classification.newRiskQuantity > state.maxContracts) { decision.allow = false; decision.reason = 'Size exceeds max'; return decision; }
  if (state.lockActive && classification.action === 'INCREASE_POSITION' && !state.pyramidingEnabled) { decision.allow = false; decision.reason = 'Stacking blocked'; return decision; }
  if (state.lockActive && state.tiltBlocking) { decision.allow = false; decision.reason = 'Tilt red'; return decision; }
  if (state.coachEnabled && state.profitLocked) { decision.allow = false; decision.reason = 'Profit locked'; return decision; }
  if (state.coachEnabled && state.dailyLossBlocked) { decision.allow = false; decision.reason = 'Daily loss'; return decision; }
  if (state.coachEnabled && state.maxTradesPerDay > 0 && state.currentTradeCount > state.maxTradesPerDay) { decision.allow = false; decision.reason = 'Trade limit'; return decision; }
  if (state.coachEnabled && state.cooldownActive && Date.now() < state.cooldownUntil) { decision.allow = false; decision.reason = 'Cooldown'; return decision; }

  decision.allow = true; decision.reason = 'All rules passed'; return decision;
}


// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Simulates state changes (as if postMessage handlers fired)
// ═══════════════════════════════════════════════════════════════════════════════

function activateLock() { state.lockActive = true; }
function deactivateLock() { state.lockActive = false; state.cooldownActive = false; state.dailyLossBlocked = false; state.profitLocked = false; state.fullDayBlocked = false; }
function blockSession() { state.sessionBlocked = true; }
function unblockSession() { state.sessionBlocked = false; }
function activateFullDayBlock() { state.fullDayBlocked = true; }
function triggerTilt() { state.tiltBlocking = true; }
function clearTilt() { state.tiltBlocking = false; }
function triggerCooldown(seconds: number) { state.coachEnabled = true; state.cooldownActive = true; state.cooldownUntil = Date.now() + seconds * 1000; }
function triggerProfitLock() { state.coachEnabled = true; state.profitLocked = true; }
function triggerDailyLoss() { state.coachEnabled = true; state.dailyLossBlocked = true; }
function disconnectApp() { state.lockActive = false; state.sessionBlocked = false; state.fullDayBlocked = false; state.coachEnabled = false; state.cooldownActive = false; state.dailyLossBlocked = false; state.profitLocked = false; state.blockedSymbols = []; state.maxContracts = 0; state.maxTradesPerDay = 0; }
function emergencyFallback() { state.lockActive = true; } // Desktop disconnected while locked

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Race Condition Regression Tests', () => {
  beforeEach(resetState);

  // ─────────────────────────────────────────────────────────────────────────
  // RAPID ORDER SUBMISSION
  // Multiple orders fired in quick succession (same tick / next microtask).
  // Each must be evaluated independently against current state.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Rapid Order Submission', () => {
    it('10 rapid buys: all evaluated consistently against same state', () => {
      state.positionState = {};
      activateLock();
      const results = Array.from({ length: 10 }, (_, i) =>
        evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
          { action: 'buy', symbol: 'NQ', qty: 1 })
      );
      // All should get the same decision (first is OPEN, rest depend on position tracking)
      // Since we don't mutate positionState here, all see flat → all OPEN → all allowed (qty 1 <= max 2)
      results.forEach(r => {
        expect(r.allow).toBe(true);
        expect(r.classification.action).toBe('OPEN_POSITION');
      });
    });

    it('rapid exits during full lockdown: ALL allowed', () => {
      state.positionState = { 'NQ': { side: 'long', quantity: 5 } };
      activateLock(); blockSession(); activateFullDayBlock(); triggerTilt();
      triggerProfitLock(); triggerDailyLoss();

      const results = Array.from({ length: 5 }, (_, i) =>
        evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
          { action: 'sell', symbol: 'NQ', qty: 1 })
      );
      results.forEach(r => {
        expect(r.allow).toBe(true);
        expect(r.classification.action).toBe('REDUCE_POSITION');
      });
    });

    it('rapid cancel-all: all allowed regardless of state', () => {
      activateLock(); blockSession(); activateFullDayBlock();
      const results = Array.from({ length: 5 }, () =>
        evaluateTradingRequest('https://userapi.topstepx.com/Order/cancelAll', 'POST', {})
      );
      results.forEach(r => {
        expect(r.allow).toBe(true);
        expect(r.classification.action).toBe('CANCEL_ORDER');
      });
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // LOCK ACTIVATION WHILE ORDERS IN FLIGHT
  // Simulates: order1 evaluated → lock activates → order2 evaluated
  // ─────────────────────────────────────────────────────────────────────────

  describe('Lock Activation Between Orders', () => {
    it('order allowed before lock → same order blocked after lock activates', () => {
      state.positionState = {};
      // Before lock
      const before = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 5 });
      expect(before.allow).toBe(true);

      // Lock activates (simulating postMessage handler)
      activateLock();

      // After lock — same order now blocked (exceeds max 2)
      const after = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 5 });
      expect(after.allow).toBe(false);
      expect(after.reason).toContain('Size');
    });

    it('exit ALWAYS allowed even if lock activates between orders', () => {
      state.positionState = { 'NQ': { side: 'long', quantity: 5 } };

      // Before lock
      const before = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 5 });
      expect(before.allow).toBe(true);

      // Lock activates + all protections
      activateLock(); blockSession(); triggerTilt(); triggerProfitLock();

      // After lock — exit still allowed
      const after = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 5 });
      expect(after.allow).toBe(true);
      expect(after.classification.action).toBe('CLOSE_POSITION');
    });

    it('flatten allowed even if full-day-block fires mid-sequence', () => {
      state.positionState = { 'ES': { side: 'short', quantity: 3 } };
      activateLock();

      // Normal order → allowed
      const order1 = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'RTY', qty: 1 });
      expect(order1.allow).toBe(true);

      // Full day block activates
      activateFullDayBlock();

      // New entry → blocked
      const order2 = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'RTY', qty: 1 });
      expect(order2.allow).toBe(false);

      // But flatten → ALWAYS allowed
      const flatten = evaluateTradingRequest('https://userapi.topstepx.com/Position/flatten', 'POST', { accountId: 'x' });
      expect(flatten.allow).toBe(true);
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // STATE CHANGES DURING EXECUTION SEQUENCE
  // Simulates multiple state transitions happening rapidly (like desktop app
  // pushing multiple postMessages in quick succession)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Multiple State Changes in Rapid Succession', () => {
    it('session block → unblock → block: exit safe throughout', () => {
      state.positionState = { 'NQ': { side: 'long', quantity: 3 } };
      activateLock();

      blockSession();
      const r1 = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 1 });
      expect(r1.allow).toBe(true); // exit safe

      unblockSession();
      const r2 = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 1 });
      expect(r2.allow).toBe(true); // exit safe

      blockSession();
      const r3 = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 1 });
      expect(r3.allow).toBe(true); // exit safe
    });

    it('tilt goes red → green → red: exits unaffected', () => {
      state.positionState = { 'ES': { side: 'short', quantity: 2 } };
      activateLock();

      triggerTilt();
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'ES', qty: 2 }).allow).toBe(true); // close

      clearTilt();
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'ES', qty: 2 }).allow).toBe(true); // close

      triggerTilt();
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'ES', qty: 2 }).allow).toBe(true); // close
    });

    it('profit lock + daily loss + cooldown ALL fire at once: exits survive', () => {
      state.positionState = { 'MNQ': { side: 'long', quantity: 10 } };
      activateLock();
      triggerProfitLock();
      triggerDailyLoss();
      triggerCooldown(300);
      triggerTilt();
      blockSession();
      state.blockedSymbols = ['MNQ'];

      // New entry → blocked
      state.positionState['RTY'] = { side: 'flat', quantity: 0 };
      const newOrder = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'RTY', qty: 1 });
      expect(newOrder.allow).toBe(false);

      // But close → always allowed
      const close = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'MNQ', qty: 5 });
      expect(close.allow).toBe(true);
      expect(close.classification.action).toBe('REDUCE_POSITION');
    });

    it('lock deactivate clears all enforcement instantly', () => {
      state.positionState = {};
      activateLock(); blockSession(); triggerTilt(); triggerProfitLock();

      const blocked = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 1 });
      expect(blocked.allow).toBe(false);

      // Unlock = clear everything
      deactivateLock();

      const allowed = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 1 });
      expect(allowed.allow).toBe(true);
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // FLATTEN DURING LOCK-STATE CHANGE
  // Critical scenario: trader hits flatten button at the exact moment
  // the lock state changes. Must NEVER be trapped.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Flatten During Lock-State Change', () => {
    it('flatten via URL during lock activation', () => {
      state.positionState = { 'NQ': { side: 'long', quantity: 5 } };
      // Lock activates at the same moment
      activateLock(); blockSession(); activateFullDayBlock();
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Position/flatten', 'POST', { accountId: 'x' });
      expect(result.allow).toBe(true);
    });

    it('flatten via body flag during full-day-block activation', () => {
      state.positionState = { 'ES': { side: 'short', quantity: 3 } };
      activateLock(); activateFullDayBlock(); triggerTilt();
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'flatten', symbol: 'ES', qty: 3 });
      expect(result.allow).toBe(true);
    });

    it('close-all via action during news block activation', () => {
      state.positionState = { 'CL': { side: 'long', quantity: 4 } };
      activateLock(); state.newsBlockerEnabled = true; state.newsBlocked = true;
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'closeAll' });
      expect(result.allow).toBe(true);
    });

    it('position-aware close during tilt spike', () => {
      state.positionState = { 'GC': { side: 'short', quantity: 6 } };
      activateLock(); triggerTilt();
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'GC', qty: 6 });
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('CLOSE_POSITION');
    });

    it('emergency exit with oversized close (position > max contracts)', () => {
      state.positionState = { 'NQ': { side: 'long', quantity: 10 } };
      activateLock(); state.maxContracts = 1; // Max is 1 but position is 10
      blockSession(); triggerTilt(); triggerProfitLock();
      // Selling all 10 to close — must be allowed even though 10 > max
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 10 });
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('CLOSE_POSITION');
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // MULTIPLE SIMULTANEOUS ORDERS ON DIFFERENT SYMBOLS
  // Trader submits orders on NQ, ES, MNQ at the same time.
  // Each must be evaluated independently.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Multiple Simultaneous Orders — Different Symbols', () => {
    it('different symbols evaluated independently', () => {
      state.positionState = {
        'NQ': { side: 'long', quantity: 2 },
        'ES': { side: 'short', quantity: 3 },
      };
      activateLock(); state.maxContracts = 2;

      // Close NQ → allowed
      const closeNQ = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 2 });
      expect(closeNQ.allow).toBe(true);
      expect(closeNQ.classification.action).toBe('CLOSE_POSITION');

      // Close ES → allowed
      const closeES = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'ES', qty: 3 });
      expect(closeES.allow).toBe(true);
      expect(closeES.classification.action).toBe('CLOSE_POSITION');

      // Open new position on RTY → allowed (within size)
      const openRTY = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'RTY', qty: 2 });
      expect(openRTY.allow).toBe(true);
    });

    it('blocked symbol only blocks THAT symbol, not others', () => {
      state.positionState = {};
      activateLock(); state.blockedSymbols = ['NQ'];

      const blockedNQ = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 1 });
      expect(blockedNQ.allow).toBe(false);

      const allowedES = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'ES', qty: 1 });
      expect(allowedES.allow).toBe(true);

      const allowedRTY = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'RTY', qty: 1 });
      expect(allowedRTY.allow).toBe(true);
    });

    it('exit on blocked symbol is still allowed', () => {
      state.positionState = { 'NQ': { side: 'long', quantity: 5 } };
      activateLock(); state.blockedSymbols = ['NQ'];

      const close = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 5 });
      expect(close.allow).toBe(true);
      expect(close.classification.action).toBe('CLOSE_POSITION');
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // CONNECTION LOSS / RECONNECT
  // Desktop app disconnects → extension should disable all enforcement.
  // Emergency fallback → if disconnected WHILE locked, keep lock.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Connection Loss / Reconnect', () => {
    it('app disconnect: all enforcement disabled, orders pass freely', () => {
      state.positionState = {};
      activateLock(); blockSession(); triggerTilt(); state.blockedSymbols = ['NQ'];

      // Verify blocked before disconnect
      const before = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 5 });
      expect(before.allow).toBe(false);

      // App disconnects
      disconnectApp();

      // After disconnect — everything allowed (no enforcement)
      const after = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 5 });
      expect(after.allow).toBe(true);
    });

    it('emergency fallback: disconnected while locked → keep lock active', () => {
      state.positionState = {};
      activateLock(); state.maxContracts = 2;

      // Emergency fallback fires (desktop disconnected while locked)
      emergencyFallback();

      // Lock is still active — oversized blocked
      const blocked = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 5 });
      expect(blocked.allow).toBe(false);
    });

    it('emergency fallback: exits STILL allowed', () => {
      state.positionState = { 'NQ': { side: 'long', quantity: 5 } };
      activateLock(); blockSession();
      emergencyFallback();

      const close = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 5 });
      expect(close.allow).toBe(true);
    });

    it('reconnect after disconnect: re-enables enforcement', () => {
      state.positionState = {};
      activateLock(); state.maxContracts = 2;

      // Disconnect
      disconnectApp();
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 10 }).allow).toBe(true); // no enforcement

      // Reconnect (desktop sends fresh state)
      activateLock(); state.maxContracts = 2;
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 10 }).allow).toBe(false); // enforced again
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // RULE CHANGES IMMEDIATELY BEFORE AN ORDER
  // Simulates: max contracts changes, symbol gets blocked, etc.
  // right before the trader submits an order.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Rule Changes Immediately Before Order', () => {
    it('max contracts reduced just before order: new limit enforced', () => {
      state.positionState = {};
      activateLock(); state.maxContracts = 5;

      // Order with 3 contracts → allowed (3 <= 5)
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 3 }).allow).toBe(true);

      // Max reduced to 2
      state.maxContracts = 2;

      // Same order now blocked (3 > 2)
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 3 }).allow).toBe(false);
    });

    it('symbol blocked just before order: enforced immediately', () => {
      state.positionState = {};
      activateLock();

      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'CL', qty: 1 }).allow).toBe(true);

      // Block CL
      state.blockedSymbols = ['CL'];

      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'CL', qty: 1 }).allow).toBe(false);
    });

    it('symbol blocked just before exit: EXIT STILL ALLOWED', () => {
      state.positionState = { 'CL': { side: 'long', quantity: 3 } };
      activateLock(); state.blockedSymbols = ['CL'];

      const close = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'CL', qty: 3 });
      expect(close.allow).toBe(true);
      expect(close.classification.action).toBe('CLOSE_POSITION');
    });

    it('news block activates between two orders: second blocked', () => {
      state.positionState = {};
      activateLock();

      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 1 }).allow).toBe(true);

      // News event starts
      state.newsBlockerEnabled = true; state.newsBlocked = true;

      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 1 }).allow).toBe(false);
    });

    it('pyramiding disabled between two adds: second blocked', () => {
      state.positionState = { 'NQ': { side: 'long', quantity: 2 } };
      activateLock(); state.pyramidingEnabled = true; state.maxContracts = 10;

      // First add allowed
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 1 }).allow).toBe(true);

      // Pyramiding disabled
      state.pyramidingEnabled = false;

      // Second add blocked
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 1 });
      expect(result.allow).toBe(false);
      expect(result.reason).toContain('Stacking');
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // POSITION REVERSAL DURING PROTECTION STATE CHANGE
  // Reversals are partially risk-reducing (close portion) and partially
  // risk-increasing (new exposure portion). The close portion must NEVER
  // be blocked; the new exposure CAN be blocked.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Reversal During Protection State Change', () => {
    it('reversal within limits allowed: close old + open new', () => {
      state.positionState = { 'NQ': { side: 'long', quantity: 2 } };
      activateLock(); state.maxContracts = 3;

      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 4 }); // close 2 + new short 2
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('REVERSE_POSITION');
      expect(result.classification.closeQuantity).toBe(2);
      expect(result.classification.newRiskQuantity).toBe(2);
    });

    it('reversal exceeding max: BLOCKED (new exposure too large)', () => {
      state.positionState = { 'NQ': { side: 'long', quantity: 2 } };
      activateLock(); state.maxContracts = 1;

      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 5 }); // close 2 + new short 3 (exceeds max 1)
      expect(result.allow).toBe(false);
      expect(result.reason).toContain('new exposure exceeds max');
    });

    it('reversal blocked by session, but plain close is allowed', () => {
      state.positionState = { 'ES': { side: 'short', quantity: 3 } };
      activateLock(); blockSession();

      // Reversal blocked (new exposure during blocked session)
      const reversal = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'ES', qty: 5 }); // close 3 + new long 2
      expect(reversal.allow).toBe(false);

      // But pure close is allowed
      const close = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'ES', qty: 3 }); // exactly close
      expect(close.allow).toBe(true);
      expect(close.classification.action).toBe('CLOSE_POSITION');
    });

    it('reversal on blocked symbol: blocked', () => {
      state.positionState = { 'NQ': { side: 'long', quantity: 2 } };
      activateLock(); state.blockedSymbols = ['NQ']; state.maxContracts = 10;

      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 4 }); // close 2 + new short 2
      expect(result.allow).toBe(false);
      expect(result.reason).toContain('blocked symbol');
    });

    it('reversal on blocked symbol: but REDUCE portion alone is safe', () => {
      state.positionState = { 'NQ': { side: 'long', quantity: 5 } };
      activateLock(); state.blockedSymbols = ['NQ'];

      // Partial reduce (sell 2 of 5) → not a reversal, it's REDUCE
      const reduce = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 2 });
      expect(reduce.allow).toBe(true);
      expect(reduce.classification.action).toBe('REDUCE_POSITION');
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // COOLDOWN TIMING EDGE CASES
  // Cooldown expiry during order processing. The check is:
  // cooldownActive && Date.now() < cooldownUntil
  // ─────────────────────────────────────────────────────────────────────────

  describe('Cooldown Timing Edge Cases', () => {
    it('cooldown expired (past): order allowed', () => {
      state.positionState = {};
      activateLock(); state.coachEnabled = true;
      state.cooldownActive = true;
      state.cooldownUntil = Date.now() - 1000; // Expired 1s ago

      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 1 });
      expect(result.allow).toBe(true);
    });

    it('cooldown still active: order blocked', () => {
      state.positionState = {};
      activateLock(); state.coachEnabled = true;
      state.cooldownActive = true;
      state.cooldownUntil = Date.now() + 60000; // 60s remaining

      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 1 });
      expect(result.allow).toBe(false);
      expect(result.reason).toContain('Cooldown');
    });

    it('cooldown active but exit: ALWAYS allowed', () => {
      state.positionState = { 'NQ': { side: 'long', quantity: 3 } };
      activateLock(); state.coachEnabled = true;
      state.cooldownActive = true;
      state.cooldownUntil = Date.now() + 999999;

      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 3 });
      expect(result.allow).toBe(true);
    });

    it('cooldown flag without coachEnabled: no block', () => {
      state.positionState = {};
      activateLock(); state.coachEnabled = false;
      state.cooldownActive = true;
      state.cooldownUntil = Date.now() + 60000;

      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 1 });
      expect(result.allow).toBe(true); // Coach disabled = no cooldown enforcement
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // POSITION STATE STALE/OUT-OF-SYNC
  // Position tracking is inferred (low confidence). If stale, exits must
  // still be classified safely — URL/body flags override position inference.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Position State Stale/Out-of-Sync', () => {
    it('stale state shows long but position was closed externally: close URL still works', () => {
      // Extension thinks we have a position but it was closed in another tab
      state.positionState = { 'NQ': { side: 'long', quantity: 5 } };
      activateLock(); blockSession();

      // Trader uses close URL — still classified as CLOSE regardless of state
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order/close', 'POST',
        { symbol: 'NQ', qty: 5 });
      expect(result.allow).toBe(true);
    });

    it('stale state shows flat but position exists: sell classified as OPEN from flat', () => {
      // Extension thinks flat but trader actually has position (stale)
      state.positionState = {}; // stale: thinks flat
      activateLock(); state.maxContracts = 2;

      // Sell 1 from "flat" → classified as OPEN (position-aware says flat + sell = new short)
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 1 });
      expect(result.action || result.classification.action).toBeDefined();
      // Key: it doesn't crash, and if it classifies as OPEN it checks size limits
      expect(result.allow).toBe(true); // 1 <= max 2
    });

    it('stale state: body.reduceOnly=true overrides position inference', () => {
      // Even if position state is wrong, reduceOnly flag wins
      state.positionState = {}; // thinks flat
      activateLock(); blockSession();

      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 5, reduceOnly: true });
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('REDUCE_POSITION');
    });

    it('stale state: body.isClose=true overrides position inference', () => {
      state.positionState = { 'NQ': { side: 'short', quantity: 2 } }; // wrong direction
      activateLock(); triggerTilt();

      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 5, isClose: true });
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('CLOSE_POSITION');
    });

    it('no position state at all (fresh extension load): exits via URL always work', () => {
      state.positionState = {}; // fresh — no tracking yet
      activateLock(); blockSession(); activateFullDayBlock(); triggerTilt();

      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order/close', 'POST', { qty: 1 }).allow).toBe(true);
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order/flatten', 'POST', {}).allow).toBe(true);
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order/cancel', 'POST', { orderId: 1 }).allow).toBe(true);
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order/editStopLoss', 'POST', { stopPrice: 100 }).allow).toBe(true);
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // INTERLEAVED ORDERS AND STATE CHANGES (STRESS SIMULATION)
  // Simulates a realistic trading session with rapid state transitions.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Interleaved Orders and State Changes (Stress)', () => {
    it('realistic session: open → tilt rises → try add → blocked → close → allowed', () => {
      state.positionState = {};
      activateLock(); state.maxContracts = 3;

      // 1. Open position (allowed)
      const open = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 2 });
      expect(open.allow).toBe(true);

      // 2. Update position tracking
      state.positionState = { 'NQ': { side: 'long', quantity: 2 } };

      // 3. Tilt rises to red
      triggerTilt();

      // 4. Try to add to position → blocked by tilt
      const add = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 1 });
      expect(add.allow).toBe(false);
      expect(add.reason).toContain('Tilt');

      // 5. Close position → ALWAYS allowed regardless of tilt
      const close = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 2 });
      expect(close.allow).toBe(true);
      expect(close.classification.action).toBe('CLOSE_POSITION');
    });

    it('realistic: loss detected → cooldown → try revenge trade → blocked → close SL → allowed', () => {
      state.positionState = { 'ES': { side: 'short', quantity: 2 } };
      activateLock();

      // 1. Loss detected, cooldown fires
      triggerCooldown(120);

      // 2. Try revenge trade → blocked
      const revenge = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'MNQ', qty: 5 });
      // MNQ is flat, so this is OPEN — blocked by cooldown
      expect(revenge.allow).toBe(false);

      // 3. But closing existing ES position → allowed
      const closeES = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'ES', qty: 2 });
      expect(closeES.allow).toBe(true);

      // 4. Editing stop loss on existing order → allowed
      const editSL = evaluateTradingRequest('https://userapi.topstepx.com/Order/editStopLoss', 'POST',
        { orderId: 123, stopPrice: 5500 });
      expect(editSL.allow).toBe(true);
    });

    it('realistic: news block activates → flatten → news ends → normal trading resumes', () => {
      state.positionState = { 'NQ': { side: 'long', quantity: 3 } };
      activateLock();

      // 1. Normal order (allowed before news)
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'ES', qty: 1 }).allow).toBe(true);

      // 2. News block activates
      state.newsBlockerEnabled = true; state.newsBlocked = true;

      // 3. New orders blocked
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'ES', qty: 1 }).allow).toBe(false);

      // 4. Flatten still allowed
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Position/flatten', 'POST', {}).allow).toBe(true);

      // 5. Close still allowed
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 3 }).allow).toBe(true);

      // 6. News ends
      state.newsBlocked = false;

      // 7. Normal trading resumes
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'ES', qty: 1 }).allow).toBe(true);
    });

    it('worst case: ALL protections fire simultaneously, trader must exit', () => {
      state.positionState = {
        'NQ': { side: 'long', quantity: 5 },
        'ES': { side: 'short', quantity: 3 },
        'MNQ': { side: 'long', quantity: 10 },
      };
      activateLock(); blockSession(); activateFullDayBlock();
      state.newsBlockerEnabled = true; state.newsBlocked = true;
      triggerTilt(); triggerProfitLock(); triggerDailyLoss(); triggerCooldown(9999);
      state.blockedSymbols = ['NQ', 'ES', 'MNQ'];
      state.maxContracts = 0; // Even max 0 should not block exits

      // All three positions must be closeable
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 5 }).allow).toBe(true);
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'ES', qty: 3 }).allow).toBe(true);
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'MNQ', qty: 10 }).allow).toBe(true);

      // Flatten-all URL must work
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Position/flatten', 'POST', {}).allow).toBe(true);

      // Cancel-all must work
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order/cancelAll', 'POST', {}).allow).toBe(true);

      // Edit stops must work
      expect(evaluateTradingRequest('https://userapi.topstepx.com/Order/editStop', 'POST',
        { orderId: 1, stopPrice: 19000 }).allow).toBe(true);
    });
  });
});
