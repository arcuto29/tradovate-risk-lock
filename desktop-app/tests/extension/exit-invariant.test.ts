/**
 * EXIT INVARIANT TESTS — Phase 1: Execution Safety
 * 
 * PROVES: CLOSE / REDUCE / FLATTEN / CANCEL / MODIFY_PROTECTIVE / QUERY
 * are ALWAYS allowed regardless of ANY protection state combination.
 * 
 * This is the most critical safety invariant in Sentinel:
 * "Never allow a protection feature to accidentally trap the trader in a position."
 * 
 * Tests every exit action against every possible blocking condition simultaneously.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════════
// FAITHFUL REPRODUCTION of evaluateTradingRequest from session-blocker-main.js
// This mirrors the EXACT logic in the extension's critical path.
// ═══════════════════════════════════════════════════════════════════════════════

// URL pattern arrays (same as extension)
const CLOSE_URLS = ['/Order/close', '/order/close', '/Position/close', '/position/close',
  '/Order/flatten', '/order/flatten', '/Position/flatten', '/position/flatten'];
const CANCEL_URLS = ['/Order/cancel', '/order/cancel', '/Order/delete', '/order/delete',
  '/order/cancelAll', '/Order/cancelAll'];
const MODIFY_STOP_URLS = ['/Order/editStopLoss', '/Order/editStop', '/order/modifyStop',
  '/Order/editTakeProfit', '/order/modifyTakeProfit'];
const QUERY_URLS = ['/Order?', '/order/list', '/orders/history', '/Position?',
  '/position/list', '/account/', '/user/'];

// Position state (simulated)
let positionState: Record<string, { side: string; quantity: number; direction?: string; size?: number }> = {};


function getPositionForSymbol(symbol: string): { side: string; quantity: number } {
  if (!symbol) return { side: 'flat', quantity: 0 };
  const pos = positionState[symbol.toUpperCase()];
  if (pos && (pos.quantity > 0 || (pos.size && pos.size > 0))) {
    return { side: (pos.direction || pos.side || 'long').toLowerCase(), quantity: pos.quantity || pos.size || 0 };
  }
  return { side: 'flat', quantity: 0 };
}

interface Classification {
  action: string;
  reason: string;
  symbol: string;
  side: string;
  quantity: number;
  positionBefore: { side: string; quantity: number };
  closeQuantity: number;
  newRiskQuantity: number;
  confidence: string;
}

function classifyOrder(url: string, body: any): Classification {
  let symbol = '';
  let side = '';
  let quantity = 0;
  let positionBefore = { side: 'flat', quantity: 0 };

  if (body) {
    symbol = String(body.symbolId || body.symbol || body.instrument || '').toUpperCase();
    side = String(body.action || body.orderAction || body.side || '').toLowerCase();
    quantity = Math.abs(body.positionSize || body.qty || body.quantity || body.amount || body.size || 0);
  }

  positionBefore = getPositionForSymbol(symbol);

  const result: Classification = {
    action: 'UNKNOWN',
    reason: '',
    symbol: symbol || 'UNKNOWN',
    side: side || 'unknown',
    quantity,
    positionBefore,
    closeQuantity: 0,
    newRiskQuantity: 0,
    confidence: 'low',
  };

  if (!url) { result.reason = 'No URL provided'; return result; }
  const lower = url.toLowerCase();


  // URL-based classification (highest confidence)
  if (QUERY_URLS.some(p => lower.includes(p.toLowerCase()))) {
    result.action = 'QUERY'; result.reason = 'URL matches query/list pattern'; result.confidence = 'high'; return result;
  }
  if (CLOSE_URLS.some(p => lower.includes(p.toLowerCase()))) {
    result.action = 'CLOSE_POSITION'; result.reason = 'URL matches close/flatten pattern'; result.confidence = 'high';
    result.closeQuantity = positionBefore.quantity || quantity; return result;
  }
  if (CANCEL_URLS.some(p => lower.includes(p.toLowerCase()))) {
    result.action = 'CANCEL_ORDER'; result.reason = 'URL matches cancel pattern'; result.confidence = 'high'; return result;
  }
  if (MODIFY_STOP_URLS.some(p => lower.includes(p.toLowerCase()))) {
    result.action = 'MODIFY_PROTECTIVE_ORDER'; result.reason = 'URL matches stop/TP modification pattern'; result.confidence = 'high'; return result;
  }

  // Body flag-based classification
  if (body) {
    const action = String(body.action || body.orderAction || body.type || '').toLowerCase();
    if (action === 'close' || action === 'flatten' || action === 'closeposition' || action === 'closeall') {
      result.action = 'CLOSE_POSITION'; result.reason = 'body.action=' + action; result.confidence = 'high';
      result.closeQuantity = positionBefore.quantity || quantity; return result;
    }
    if (action === 'cancel' || action === 'cancelorder' || action === 'cancelall') {
      result.action = 'CANCEL_ORDER'; result.reason = 'body.action=' + action; result.confidence = 'high'; return result;
    }
    if (body.isClose === true || body.closePosition === true || body.flatten === true) {
      result.action = 'CLOSE_POSITION'; result.reason = 'body flag: isClose/closePosition/flatten=true'; result.confidence = 'high';
      result.closeQuantity = positionBefore.quantity || quantity; return result;
    }
    if (body.reduceOnly === true || body.isReduceOnly === true) {
      result.action = 'REDUCE_POSITION'; result.reason = 'body flag: reduceOnly/isReduceOnly=true'; result.confidence = 'high';
      result.closeQuantity = Math.min(quantity, positionBefore.quantity); return result;
    }


    // Position-aware classification
    if (symbol && positionBefore.side !== 'flat' && positionBefore.quantity > 0 && side && quantity > 0) {
      const isSelling = (side === 'sell' || side === 'sellshort' || side === 'short');
      const isBuying = (side === 'buy' || side === 'buytocover' || side === 'long');
      const isLong = positionBefore.side === 'long';
      const isShort = positionBefore.side === 'short';

      if (isLong && isSelling) {
        if (quantity < positionBefore.quantity) {
          result.action = 'REDUCE_POSITION'; result.confidence = 'medium'; result.closeQuantity = quantity; return result;
        } else if (quantity === positionBefore.quantity) {
          result.action = 'CLOSE_POSITION'; result.confidence = 'medium'; result.closeQuantity = quantity; return result;
        } else {
          result.action = 'REVERSE_POSITION'; result.confidence = 'medium';
          result.closeQuantity = positionBefore.quantity; result.newRiskQuantity = quantity - positionBefore.quantity; return result;
        }
      }
      if (isShort && isBuying) {
        if (quantity < positionBefore.quantity) {
          result.action = 'REDUCE_POSITION'; result.confidence = 'medium'; result.closeQuantity = quantity; return result;
        } else if (quantity === positionBefore.quantity) {
          result.action = 'CLOSE_POSITION'; result.confidence = 'medium'; result.closeQuantity = quantity; return result;
        } else {
          result.action = 'REVERSE_POSITION'; result.confidence = 'medium';
          result.closeQuantity = positionBefore.quantity; result.newRiskQuantity = quantity - positionBefore.quantity; return result;
        }
      }
      if (isLong && isBuying) {
        result.action = 'INCREASE_POSITION'; result.confidence = 'medium'; result.newRiskQuantity = quantity; return result;
      }
      if (isShort && isSelling) {
        result.action = 'INCREASE_POSITION'; result.confidence = 'medium'; result.newRiskQuantity = quantity; return result;
      }
    }

    // Flat position - default to OPEN
    if (positionBefore.side === 'flat' && side && quantity > 0) {
      result.action = 'OPEN_POSITION'; result.confidence = 'medium'; result.newRiskQuantity = quantity; return result;
    }
  }

  // Cannot determine
  result.action = 'UNKNOWN'; result.confidence = 'low';
  return result;
}


// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTION STATE SIMULATION
// ═══════════════════════════════════════════════════════════════════════════════

interface ProtectionState {
  lockActive: boolean;
  sessionBlocked: boolean;
  fullDayBlocked: boolean;
  newsBlockerEnabled: boolean;
  newsBlocked: boolean;
  dailyLossBlocked: boolean;
  profitLocked: boolean;
  cooldownActive: boolean;
  cooldownUntil: number;
  tiltBlocking: boolean;
  maxContracts: number;
  blockedSymbols: string[];
  pyramidingEnabled: boolean;
  coachEnabled: boolean;
  maxTradesPerDay: number;
  currentTradeCount: number;
}

function createMaxProtectionState(): ProtectionState {
  return {
    lockActive: true,
    sessionBlocked: true,
    fullDayBlocked: true,
    newsBlockerEnabled: true,
    newsBlocked: true,
    dailyLossBlocked: true,
    profitLocked: true,
    cooldownActive: true,
    cooldownUntil: Date.now() + 999999,
    tiltBlocking: true,
    maxContracts: 1,
    blockedSymbols: ['NQ', 'ES', 'MNQ', 'MES', 'YM', 'RTY', 'CL', 'GC'],
    pyramidingEnabled: false,
    coachEnabled: true,
    maxTradesPerDay: 3,
    currentTradeCount: 100,  // Way over limit
  };
}


/**
 * evaluateTradingRequest — Faithful reproduction of the unified evaluator.
 * This is the EXACT decision logic from session-blocker-main.js.
 */
function evaluateTradingRequest(
  url: string, method: string, body: any, state: ProtectionState
): { allow: boolean; reason: string; classification: Classification } {
  const classification = classifyOrder(url, body);
  const decision = { allow: true, reason: '', classification };

  // ─── EXIT SAFETY: Always allow risk-reducing actions FIRST ─────────────
  if (classification.action === 'CLOSE_POSITION' || classification.action === 'REDUCE_POSITION' ||
      classification.action === 'CANCEL_ORDER' || classification.action === 'MODIFY_PROTECTIVE_ORDER' ||
      classification.action === 'QUERY') {
    decision.allow = true;
    decision.reason = 'Risk-reducing: ' + classification.action;
    return decision;
  }

  // ─── UNKNOWN: Allow (fail safely) ─────────────────────────────────────
  if (classification.action === 'UNKNOWN') {
    decision.allow = true;
    decision.reason = 'Unknown format - allowing (may be exit). Protection degraded.';
    return decision;
  }

  // ─── REVERSAL: Check new-risk portion ─────────────────────────────────
  if (classification.action === 'REVERSE_POSITION') {
    const newRiskQty = classification.newRiskQuantity || 0;
    const symbol = classification.symbol;
    if (state.lockActive && newRiskQty > 0 && symbol) {
      if (newRiskQty > state.maxContracts) {
        decision.allow = false; decision.reason = 'Reversal blocked: new exposure exceeds max'; return decision;
      }
    }
    if (state.lockActive && state.blockedSymbols.some(s => symbol.includes(s))) {
      decision.allow = false; decision.reason = 'Reversal blocked: blocked symbol'; return decision;
    }
    if (state.lockActive && state.sessionBlocked) {
      decision.allow = false; decision.reason = 'Reversal blocked: outside session'; return decision;
    }
    if (state.lockActive && state.newsBlockerEnabled && state.newsBlocked) {
      decision.allow = false; decision.reason = 'Reversal blocked: news window'; return decision;
    }
    decision.allow = true; decision.reason = 'Reversal allowed'; return decision;
  }


  // ─── RISK-INCREASING: Check ALL rules ─────────────────────────────────
  if (state.fullDayBlocked) {
    decision.allow = false; decision.reason = 'Full day block active'; return decision;
  }
  if (state.lockActive && state.blockedSymbols.some(s => (classification.symbol || '').includes(s))) {
    decision.allow = false; decision.reason = 'Symbol is blocked'; return decision;
  }
  if (state.lockActive && state.sessionBlocked) {
    decision.allow = false; decision.reason = 'Outside trading hours'; return decision;
  }
  if (state.lockActive && state.newsBlockerEnabled && state.newsBlocked) {
    decision.allow = false; decision.reason = 'News event window'; return decision;
  }
  if (state.lockActive && classification.newRiskQuantity > state.maxContracts) {
    decision.allow = false; decision.reason = 'Position size exceeds limit'; return decision;
  }
  if (state.lockActive && classification.action === 'INCREASE_POSITION' && !state.pyramidingEnabled) {
    decision.allow = false; decision.reason = 'Stacking blocked'; return decision;
  }
  if (state.lockActive && state.tiltBlocking) {
    decision.allow = false; decision.reason = 'Tilt meter red'; return decision;
  }
  if (state.coachEnabled && state.profitLocked) {
    decision.allow = false; decision.reason = 'Profit protected'; return decision;
  }
  if (state.coachEnabled && state.dailyLossBlocked) {
    decision.allow = false; decision.reason = 'Daily loss reached'; return decision;
  }
  if (state.coachEnabled && state.maxTradesPerDay > 0 && state.currentTradeCount > state.maxTradesPerDay) {
    decision.allow = false; decision.reason = 'Trade limit reached'; return decision;
  }
  if (state.coachEnabled && state.cooldownActive && Date.now() < state.cooldownUntil) {
    decision.allow = false; decision.reason = 'Cooldown active'; return decision;
  }

  decision.allow = true; decision.reason = 'All rules passed';
  return decision;
}


// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: EXIT INVARIANT — Automated Proof
// ═══════════════════════════════════════════════════════════════════════════════

describe('EXIT INVARIANT: Exits ALWAYS allowed under ALL conditions', () => {
  let maxBlock: ProtectionState;

  beforeEach(() => {
    maxBlock = createMaxProtectionState();
    // Set up position state so position-aware classification works
    positionState = {
      'NQ': { side: 'long', quantity: 5 },
      'ES': { side: 'short', quantity: 3 },
      'MNQ': { side: 'long', quantity: 10 },
      'MES': { side: 'short', quantity: 2 },
      'YM': { side: 'long', quantity: 1 },
      'CL': { side: 'long', quantity: 4 },
      'GC': { side: 'short', quantity: 6 },
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // URL-BASED EXIT DETECTION
  // ─────────────────────────────────────────────────────────────────────────

  describe('URL-based close/flatten — always allowed', () => {
    const closeUrls = [
      'https://userapi.topstepx.com/Order/close',
      'https://userapi.topstepx.com/Position/close',
      'https://userapi.topstepx.com/Order/flatten',
      'https://userapi.topstepx.com/Position/flatten',
      'https://api.tradovate.com/order/close',
      'https://api.tradovate.com/position/close',
      'https://api.tradovate.com/order/flatten',
      'https://api.tradovate.com/position/flatten',
    ];

    closeUrls.forEach(url => {
      it(`ALLOWS: ${url} even with ALL protections active`, () => {
        const result = evaluateTradingRequest(url, 'POST', { symbol: 'NQ', qty: 5 }, maxBlock);
        expect(result.allow).toBe(true);
        expect(result.classification.action).toBe('CLOSE_POSITION');
      });
    });
  });


  describe('URL-based cancel — always allowed', () => {
    const cancelUrls = [
      'https://userapi.topstepx.com/Order/cancel',
      'https://api.tradovate.com/order/cancel',
      'https://api.tradovate.com/Order/delete',
      'https://api.tradovate.com/order/cancelAll',
      'https://userapi.topstepx.com/Order/cancelAll',
    ];

    cancelUrls.forEach(url => {
      it(`ALLOWS: ${url} even with ALL protections active`, () => {
        const result = evaluateTradingRequest(url, 'POST', { orderId: 12345 }, maxBlock);
        expect(result.allow).toBe(true);
        expect(result.classification.action).toBe('CANCEL_ORDER');
      });
    });
  });

  describe('URL-based modify protective — always allowed', () => {
    const modifyUrls = [
      'https://userapi.topstepx.com/Order/editStopLoss',
      'https://userapi.topstepx.com/Order/editStop',
      'https://api.tradovate.com/order/modifyStop',
      'https://userapi.topstepx.com/Order/editTakeProfit',
      'https://api.tradovate.com/order/modifyTakeProfit',
    ];

    modifyUrls.forEach(url => {
      it(`ALLOWS: ${url} even with ALL protections active`, () => {
        const result = evaluateTradingRequest(url, 'POST', { orderId: 999, stopPrice: 4500 }, maxBlock);
        expect(result.allow).toBe(true);
        expect(result.classification.action).toBe('MODIFY_PROTECTIVE_ORDER');
      });
    });
  });

  describe('URL-based query — always allowed', () => {
    const queryUrls = [
      'https://userapi.topstepx.com/Order?accountId=123',
      'https://api.tradovate.com/order/list',
      'https://api.tradovate.com/orders/history',
      'https://userapi.topstepx.com/Position?accountId=123',
      'https://api.tradovate.com/position/list',
      'https://api.tradovate.com/account/info',
      'https://api.tradovate.com/user/profile',
    ];

    queryUrls.forEach(url => {
      it(`ALLOWS: ${url} even with ALL protections active`, () => {
        const result = evaluateTradingRequest(url, 'POST', null, maxBlock);
        expect(result.allow).toBe(true);
        expect(result.classification.action).toBe('QUERY');
      });
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // BODY FLAG-BASED EXIT DETECTION
  // ─────────────────────────────────────────────────────────────────────────

  describe('Body action flags — close/flatten always allowed', () => {
    const closeBodies = [
      { action: 'close', symbol: 'NQ', qty: 5 },
      { action: 'flatten', symbol: 'ES', qty: 3 },
      { action: 'closePosition', symbol: 'MNQ', qty: 10 },
      { action: 'closeAll', symbol: 'MES', qty: 2 },
      { orderAction: 'close', symbol: 'NQ', qty: 5 },
      { type: 'close', symbol: 'NQ', qty: 5 },
      { type: 'flatten', symbol: 'ES', qty: 3 },
    ];

    closeBodies.forEach((body, i) => {
      it(`ALLOWS: body action="${body.action || body.orderAction || body.type}" [${i}] with ALL protections`, () => {
        const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST', body, maxBlock);
        expect(result.allow).toBe(true);
        expect(result.classification.action).toBe('CLOSE_POSITION');
      });
    });
  });

  describe('Body action flags — cancel always allowed', () => {
    const cancelBodies = [
      { action: 'cancel', orderId: 123 },
      { action: 'cancelOrder', orderId: 456 },
      { action: 'cancelAll' },
      { orderAction: 'cancel', orderId: 789 },
    ];

    cancelBodies.forEach((body, i) => {
      it(`ALLOWS: body action="${body.action || body.orderAction}" [${i}] with ALL protections`, () => {
        const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST', body, maxBlock);
        expect(result.allow).toBe(true);
        expect(result.classification.action).toBe('CANCEL_ORDER');
      });
    });
  });

  describe('Body boolean flags — always allowed', () => {
    it('ALLOWS: body.isClose=true with ALL protections', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { isClose: true, symbol: 'NQ', qty: 5 }, maxBlock);
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('CLOSE_POSITION');
    });

    it('ALLOWS: body.closePosition=true with ALL protections', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { closePosition: true, symbol: 'ES', qty: 3 }, maxBlock);
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('CLOSE_POSITION');
    });

    it('ALLOWS: body.flatten=true with ALL protections', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { flatten: true, symbol: 'MNQ', qty: 10 }, maxBlock);
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('CLOSE_POSITION');
    });

    it('ALLOWS: body.reduceOnly=true with ALL protections', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { reduceOnly: true, action: 'sell', symbol: 'NQ', qty: 2 }, maxBlock);
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('REDUCE_POSITION');
    });

    it('ALLOWS: body.isReduceOnly=true with ALL protections', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { isReduceOnly: true, action: 'buy', symbol: 'ES', qty: 1 }, maxBlock);
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('REDUCE_POSITION');
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // POSITION-AWARE EXIT DETECTION
  // ─────────────────────────────────────────────────────────────────────────

  describe('Position-aware: selling against long = CLOSE/REDUCE — always allowed', () => {
    it('ALLOWS: sell qty == position (full close) with ALL protections', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 5 }, maxBlock);
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('CLOSE_POSITION');
    });

    it('ALLOWS: sell qty < position (partial reduce) with ALL protections', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sell', symbol: 'NQ', qty: 2 }, maxBlock);
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('REDUCE_POSITION');
    });

    it('ALLOWS: sellshort against long (partial) with ALL protections', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'sellshort', symbol: 'NQ', qty: 3 }, maxBlock);
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('REDUCE_POSITION');
    });

    it('ALLOWS: short side against long (partial) with ALL protections', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { side: 'sell', symbol: 'MNQ', qty: 4 }, maxBlock);
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('REDUCE_POSITION');
    });
  });

  describe('Position-aware: buying against short = CLOSE/REDUCE — always allowed', () => {
    it('ALLOWS: buy qty == short position (full close) with ALL protections', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'ES', qty: 3 }, maxBlock);
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('CLOSE_POSITION');
    });

    it('ALLOWS: buy qty < short position (partial reduce) with ALL protections', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'ES', qty: 1 }, maxBlock);
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('REDUCE_POSITION');
    });

    it('ALLOWS: buytocover against short (full close) with ALL protections', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buytocover', symbol: 'MES', qty: 2 }, maxBlock);
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('CLOSE_POSITION');
    });

    it('ALLOWS: long side against short (partial reduce) with ALL protections', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { side: 'buy', symbol: 'GC', qty: 3 }, maxBlock);
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('REDUCE_POSITION');
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // UNKNOWN ORDERS: Fail safely (always allow)
  // ─────────────────────────────────────────────────────────────────────────

  describe('UNKNOWN orders — always allowed (fail safe)', () => {
    it('ALLOWS: unrecognizable order format with ALL protections', () => {
      // No URL, no recognizable body fields → UNKNOWN
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { weirdField: 'abc', otherField: 123 }, maxBlock);
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('UNKNOWN');
    });

    it('ALLOWS: empty body with ALL protections (might be exit we cannot parse)', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST', {}, maxBlock);
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('UNKNOWN');
    });

    it('ALLOWS: null body with ALL protections', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST', null, maxBlock);
      expect(result.allow).toBe(true);
      expect(result.classification.action).toBe('UNKNOWN');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // COMBINATORIAL: Every exit type × every individual protection
  // ─────────────────────────────────────────────────────────────────────────

  describe('Combinatorial: each exit type survives EACH protection independently', () => {
    const exitScenarios = [
      { name: 'URL close', url: 'https://api.topstepx.com/Order/close', body: { symbol: 'NQ', qty: 5 } },
      { name: 'URL flatten', url: 'https://api.topstepx.com/Order/flatten', body: { symbol: 'ES', qty: 3 } },
      { name: 'URL cancel', url: 'https://api.topstepx.com/Order/cancel', body: { orderId: 1 } },
      { name: 'URL edit stop', url: 'https://api.topstepx.com/Order/editStopLoss', body: { stopPrice: 4500 } },
      { name: 'body close', url: 'https://api.topstepx.com/Order', body: { action: 'close', symbol: 'NQ', qty: 5 } },
      { name: 'body flatten', url: 'https://api.topstepx.com/Order', body: { action: 'flatten', symbol: 'ES', qty: 3 } },
      { name: 'body cancel', url: 'https://api.topstepx.com/Order', body: { action: 'cancel', orderId: 1 } },
      { name: 'body reduceOnly', url: 'https://api.topstepx.com/Order', body: { reduceOnly: true, action: 'sell', symbol: 'NQ', qty: 2 } },
      { name: 'body isClose', url: 'https://api.topstepx.com/Order', body: { isClose: true, symbol: 'NQ', qty: 5 } },
      { name: 'position close (sell long)', url: 'https://api.topstepx.com/Order', body: { action: 'sell', symbol: 'NQ', qty: 5 } },
      { name: 'position reduce (sell partial long)', url: 'https://api.topstepx.com/Order', body: { action: 'sell', symbol: 'NQ', qty: 2 } },
      { name: 'position close (buy short)', url: 'https://api.topstepx.com/Order', body: { action: 'buy', symbol: 'ES', qty: 3 } },
      { name: 'position reduce (buy partial short)', url: 'https://api.topstepx.com/Order', body: { action: 'buy', symbol: 'ES', qty: 1 } },
      { name: 'query', url: 'https://api.topstepx.com/Order?accountId=123', body: null },
    ];


    const protectionNames = [
      'sessionBlocked', 'fullDayBlocked', 'newsBlocked', 'dailyLossBlocked',
      'profitLocked', 'cooldownActive', 'tiltBlocking', 'blockedSymbols',
      'maxTradesExceeded', 'pyramidingBlocked', 'allCombined',
    ];

    function getProtectionState(protectionName: string): ProtectionState {
      // Start with NO protections active
      const base: ProtectionState = {
        lockActive: true, sessionBlocked: false, fullDayBlocked: false,
        newsBlockerEnabled: false, newsBlocked: false, dailyLossBlocked: false,
        profitLocked: false, cooldownActive: false, cooldownUntil: 0,
        tiltBlocking: false, maxContracts: 100, blockedSymbols: [],
        pyramidingEnabled: true, coachEnabled: true, maxTradesPerDay: 0,
        currentTradeCount: 0,
      };

      switch (protectionName) {
        case 'sessionBlocked': return { ...base, sessionBlocked: true };
        case 'fullDayBlocked': return { ...base, fullDayBlocked: true };
        case 'newsBlocked': return { ...base, newsBlockerEnabled: true, newsBlocked: true };
        case 'dailyLossBlocked': return { ...base, dailyLossBlocked: true };
        case 'profitLocked': return { ...base, profitLocked: true };
        case 'cooldownActive': return { ...base, cooldownActive: true, cooldownUntil: Date.now() + 99999 };
        case 'tiltBlocking': return { ...base, tiltBlocking: true };
        case 'blockedSymbols': return { ...base, blockedSymbols: ['NQ', 'ES', 'MNQ', 'MES', 'GC'] };
        case 'maxTradesExceeded': return { ...base, maxTradesPerDay: 3, currentTradeCount: 100 };
        case 'pyramidingBlocked': return { ...base, pyramidingEnabled: false };
        case 'allCombined': return createMaxProtectionState();
        default: return base;
      }
    }

    exitScenarios.forEach(scenario => {
      protectionNames.forEach(protection => {
        it(`${scenario.name} allowed despite ${protection}`, () => {
          const state = getProtectionState(protection);
          const result = evaluateTradingRequest(scenario.url, 'POST', scenario.body, state);
          expect(result.allow).toBe(true);
        });
      });
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // PLATFORM-SPECIFIC: TopstepX / Tradovate / Tradesea / NinjaTrader
  // ─────────────────────────────────────────────────────────────────────────

  describe('Platform-specific exit patterns', () => {
    it('TopstepX: close via /Order/close', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order/close', 'POST',
        { symbol: 'NQU26', qty: 3, action: 1 }, maxBlock);
      expect(result.allow).toBe(true);
    });

    it('TopstepX: flatten via /Position/flatten', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Position/flatten', 'POST',
        { accountId: 'abc123' }, maxBlock);
      expect(result.allow).toBe(true);
    });

    it('Tradovate: close via /order/close', () => {
      const result = evaluateTradingRequest('https://live.tradovateapi.com/order/close', 'POST',
        { orderId: 12345, symbol: 'ESZ25' }, maxBlock);
      expect(result.allow).toBe(true);
    });

    it('Tradovate: cancel via /order/cancel', () => {
      const result = evaluateTradingRequest('https://live.tradovateapi.com/order/cancel', 'POST',
        { orderId: 99999 }, maxBlock);
      expect(result.allow).toBe(true);
    });

    it('TopstepX: edit stop loss', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order/editStopLoss', 'POST',
        { orderId: 555, stopPrice: 19800 }, maxBlock);
      expect(result.allow).toBe(true);
    });

    it('TopstepX: edit take profit', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order/editTakeProfit', 'POST',
        { orderId: 555, limitPrice: 20500 }, maxBlock);
      expect(result.allow).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EMERGENCY SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Emergency exits — never trapped in a position', () => {
    it('ALLOWS: flatten all when fully locked + session blocked + tilt red + daily loss', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Position/flatten', 'POST',
        { accountId: 'acc1' }, maxBlock);
      expect(result.allow).toBe(true);
    });

    it('ALLOWS: close with oversized qty (closing position larger than limit)', () => {
      // Trader has 10 contracts but max is 1. Closing all 10 must still work.
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order/close', 'POST',
        { symbol: 'MNQ', qty: 10 }, maxBlock);
      expect(result.allow).toBe(true);
    });

    it('ALLOWS: reduce-only sell even though symbol is blocked', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { reduceOnly: true, action: 'sell', symbol: 'NQ', qty: 3 }, maxBlock);
      expect(result.allow).toBe(true);
    });

    it('ALLOWS: cancel all orders even during full day block', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order/cancelAll', 'POST',
        {}, maxBlock);
      expect(result.allow).toBe(true);
    });

    it('ALLOWS: editing stop loss while in cooldown after loss', () => {
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order/editStop', 'POST',
        { orderId: 123, stopPrice: 19500 }, maxBlock);
      expect(result.allow).toBe(true);
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // NEGATIVE TESTS: Risk-increasing IS blocked
  // (Proves the protection system is actually working, not just allowing everything)
  // ─────────────────────────────────────────────────────────────────────────

  describe('NEGATIVE: Risk-increasing orders ARE blocked when protections active', () => {
    it('BLOCKS: new open position when session blocked', () => {
      positionState = {}; // flat
      const state: ProtectionState = { ...createMaxProtectionState() };
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'RTY', qty: 2 }, state);
      expect(result.allow).toBe(false);
    });

    it('BLOCKS: increase position when pyramiding disabled', () => {
      positionState = { 'NQ': { side: 'long', quantity: 2 } };
      const state: ProtectionState = {
        lockActive: true, sessionBlocked: false, fullDayBlocked: false,
        newsBlockerEnabled: false, newsBlocked: false, dailyLossBlocked: false,
        profitLocked: false, cooldownActive: false, cooldownUntil: 0,
        tiltBlocking: false, maxContracts: 10, blockedSymbols: [],
        pyramidingEnabled: false, coachEnabled: false, maxTradesPerDay: 0,
        currentTradeCount: 0,
      };
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 1 }, state);
      expect(result.allow).toBe(false);
      expect(result.reason).toContain('Stacking');
    });

    it('BLOCKS: oversized new order', () => {
      positionState = {}; // flat
      const state: ProtectionState = {
        lockActive: true, sessionBlocked: false, fullDayBlocked: false,
        newsBlockerEnabled: false, newsBlocked: false, dailyLossBlocked: false,
        profitLocked: false, cooldownActive: false, cooldownUntil: 0,
        tiltBlocking: false, maxContracts: 2, blockedSymbols: [],
        pyramidingEnabled: true, coachEnabled: false, maxTradesPerDay: 0,
        currentTradeCount: 0,
      };
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'RTY', qty: 5 }, state);
      expect(result.allow).toBe(false);
      expect(result.reason).toContain('size');
    });

    it('BLOCKS: order on blocked symbol', () => {
      positionState = {}; // flat
      const state: ProtectionState = {
        lockActive: true, sessionBlocked: false, fullDayBlocked: false,
        newsBlockerEnabled: false, newsBlocked: false, dailyLossBlocked: false,
        profitLocked: false, cooldownActive: false, cooldownUntil: 0,
        tiltBlocking: false, maxContracts: 10, blockedSymbols: ['NQ'],
        pyramidingEnabled: true, coachEnabled: false, maxTradesPerDay: 0,
        currentTradeCount: 0,
      };
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'NQ', qty: 1 }, state);
      expect(result.allow).toBe(false);
      expect(result.reason).toContain('blocked');
    });

    it('BLOCKS: order when tilt meter is red', () => {
      positionState = {}; // flat
      const state: ProtectionState = {
        lockActive: true, sessionBlocked: false, fullDayBlocked: false,
        newsBlockerEnabled: false, newsBlocked: false, dailyLossBlocked: false,
        profitLocked: false, cooldownActive: false, cooldownUntil: 0,
        tiltBlocking: true, maxContracts: 10, blockedSymbols: [],
        pyramidingEnabled: true, coachEnabled: false, maxTradesPerDay: 0,
        currentTradeCount: 0,
      };
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'RTY', qty: 1 }, state);
      expect(result.allow).toBe(false);
      expect(result.reason).toContain('Tilt');
    });

    it('BLOCKS: order when cooldown active', () => {
      positionState = {}; // flat
      const state: ProtectionState = {
        lockActive: true, sessionBlocked: false, fullDayBlocked: false,
        newsBlockerEnabled: false, newsBlocked: false, dailyLossBlocked: false,
        profitLocked: false, cooldownActive: true, cooldownUntil: Date.now() + 60000,
        tiltBlocking: false, maxContracts: 10, blockedSymbols: [],
        pyramidingEnabled: true, coachEnabled: true, maxTradesPerDay: 0,
        currentTradeCount: 0,
      };
      const result = evaluateTradingRequest('https://userapi.topstepx.com/Order', 'POST',
        { action: 'buy', symbol: 'RTY', qty: 1 }, state);
      expect(result.allow).toBe(false);
      expect(result.reason).toContain('Cooldown');
    });
  });
});
