/**
 * ORDER CLASSIFICATION RELIABILITY TESTS — Phase 1: Execution Safety
 * 
 * Tests edge cases in classifyOrder():
 * - Bracket orders (OCO/OSO with SL+TP)
 * - Position reversals (close + open opposite direction)
 * - Partial fills and remaining qty
 * - Cancel/replace patterns
 * - Numeric action codes (TopstepX)
 * - Mixed/ambiguous body fields
 * - Various platform URL patterns
 * - Edge: zero quantity, negative qty, missing fields
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════════
// FAITHFUL classifyOrder reproduction (same as exit-invariant.test.ts)
// ═══════════════════════════════════════════════════════════════════════════════

const CLOSE_URLS = ['/Order/close', '/order/close', '/Position/close', '/position/close',
  '/Order/flatten', '/order/flatten', '/Position/flatten', '/position/flatten'];
const CANCEL_URLS = ['/Order/cancel', '/order/cancel', '/Order/delete', '/order/delete',
  '/order/cancelAll', '/Order/cancelAll'];
const MODIFY_STOP_URLS = ['/Order/editStopLoss', '/Order/editStop', '/order/modifyStop',
  '/Order/editTakeProfit', '/order/modifyTakeProfit'];
const QUERY_URLS = ['/Order?', '/order/list', '/orders/history', '/Position?',
  '/position/list', '/account/', '/user/'];

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
    action: 'UNKNOWN', reason: '', symbol: symbol || 'UNKNOWN',
    side: side || 'unknown', quantity, positionBefore,
    closeQuantity: 0, newRiskQuantity: 0, confidence: 'low',
  };

  if (!url) { result.reason = 'No URL provided'; return result; }
  const lower = url.toLowerCase();


  // URL-based classification
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
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Order Classification Edge Cases', () => {
  beforeEach(() => {
    positionState = {};
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BRACKET ORDERS (OCO/OSO)
  // A bracket order is a parent entry + child SL + child TP.
  // The children are protective; only the parent carries new risk.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Bracket Orders (OCO/OSO)', () => {
    it('classifies bracket parent (new entry) as OPEN_POSITION', () => {
      positionState = {}; // flat
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbol: 'NQ', qty: 2,
        bracket: { stopLoss: 19800, takeProfit: 20200 }
      });
      expect(result.action).toBe('OPEN_POSITION');
      expect(result.newRiskQuantity).toBe(2);
    });

    it('classifies stop loss edit as MODIFY_PROTECTIVE_ORDER (URL-based)', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order/editStopLoss', {
        orderId: 123, stopPrice: 19750
      });
      expect(result.action).toBe('MODIFY_PROTECTIVE_ORDER');
    });

    it('classifies take profit edit as MODIFY_PROTECTIVE_ORDER (URL-based)', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order/editTakeProfit', {
        orderId: 456, limitPrice: 20300
      });
      expect(result.action).toBe('MODIFY_PROTECTIVE_ORDER');
    });

    it('classifies OCO cancel-one-triggers-cancel-other as CANCEL_ORDER', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order/cancel', {
        orderId: 789, ocoGroupId: 'oco-123'
      });
      expect(result.action).toBe('CANCEL_ORDER');
    });

    it('handles bracket with only stop (no TP) as new position', () => {
      positionState = {};
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'sell', symbol: 'ES', qty: 1, stopLoss: 5600
      });
      expect(result.action).toBe('OPEN_POSITION');
      expect(result.newRiskQuantity).toBe(1);
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // POSITION REVERSALS
  // Selling more than current long = close long + open short
  // Buying more than current short = close short + open long
  // ─────────────────────────────────────────────────────────────────────────

  describe('Position Reversals', () => {
    it('sell 6 against long 4 = REVERSE (close 4 + new short 2)', () => {
      positionState = { 'NQ': { side: 'long', quantity: 4 } };
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'sell', symbol: 'NQ', qty: 6
      });
      expect(result.action).toBe('REVERSE_POSITION');
      expect(result.closeQuantity).toBe(4);
      expect(result.newRiskQuantity).toBe(2);
    });

    it('buy 5 against short 3 = REVERSE (close 3 + new long 2)', () => {
      positionState = { 'ES': { side: 'short', quantity: 3 } };
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbol: 'ES', qty: 5
      });
      expect(result.action).toBe('REVERSE_POSITION');
      expect(result.closeQuantity).toBe(3);
      expect(result.newRiskQuantity).toBe(2);
    });

    it('sell exactly double long = REVERSE (close N + new short N)', () => {
      positionState = { 'MNQ': { side: 'long', quantity: 3 } };
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'sell', symbol: 'MNQ', qty: 6
      });
      expect(result.action).toBe('REVERSE_POSITION');
      expect(result.closeQuantity).toBe(3);
      expect(result.newRiskQuantity).toBe(3);
    });

    it('buy just 1 more than short = REVERSE (close short + new long 1)', () => {
      positionState = { 'CL': { side: 'short', quantity: 2 } };
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbol: 'CL', qty: 3
      });
      expect(result.action).toBe('REVERSE_POSITION');
      expect(result.closeQuantity).toBe(2);
      expect(result.newRiskQuantity).toBe(1);
    });

    it('reversal confidence is medium (position-inferred)', () => {
      positionState = { 'NQ': { side: 'long', quantity: 2 } };
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'sell', symbol: 'NQ', qty: 4
      });
      expect(result.confidence).toBe('medium');
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // PARTIAL FILLS — position tracking accuracy
  // After a partial fill, position size changes. Subsequent orders must be
  // classified correctly against the UPDATED position.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Partial Fill Scenarios', () => {
    it('partial close: sell 1 of long 5 = REDUCE', () => {
      positionState = { 'NQ': { side: 'long', quantity: 5 } };
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'sell', symbol: 'NQ', qty: 1
      });
      expect(result.action).toBe('REDUCE_POSITION');
      expect(result.closeQuantity).toBe(1);
    });

    it('after partial fill leaves 3: sell 3 = CLOSE (not reduce)', () => {
      positionState = { 'NQ': { side: 'long', quantity: 3 } };
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'sell', symbol: 'NQ', qty: 3
      });
      expect(result.action).toBe('CLOSE_POSITION');
      expect(result.closeQuantity).toBe(3);
    });

    it('after partial fill leaves 1: sell 2 = REVERSE (close 1 + new short 1)', () => {
      positionState = { 'NQ': { side: 'long', quantity: 1 } };
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'sell', symbol: 'NQ', qty: 2
      });
      expect(result.action).toBe('REVERSE_POSITION');
      expect(result.closeQuantity).toBe(1);
      expect(result.newRiskQuantity).toBe(1);
    });

    it('sell 1 of short 5 = INCREASE (same direction)', () => {
      positionState = { 'ES': { side: 'short', quantity: 5 } };
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'sell', symbol: 'ES', qty: 1
      });
      expect(result.action).toBe('INCREASE_POSITION');
      expect(result.newRiskQuantity).toBe(1);
    });

    it('buy 1 of long 3 = INCREASE (same direction)', () => {
      positionState = { 'MNQ': { side: 'long', quantity: 3 } };
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbol: 'MNQ', qty: 1
      });
      expect(result.action).toBe('INCREASE_POSITION');
      expect(result.newRiskQuantity).toBe(1);
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // CANCEL/REPLACE PATTERNS
  // Platform sends cancel + new order to modify an existing order.
  // Cancel must always be allowed; new order may be blocked by rules.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Cancel/Replace Patterns', () => {
    it('cancel portion: URL /Order/cancel = CANCEL_ORDER', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order/cancel', {
        orderId: 1234
      });
      expect(result.action).toBe('CANCEL_ORDER');
    });

    it('cancel portion: body action=cancel = CANCEL_ORDER', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'cancel', orderId: 1234
      });
      expect(result.action).toBe('CANCEL_ORDER');
    });

    it('replace portion (new entry): classified as OPEN if flat', () => {
      positionState = {};
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbol: 'NQ', qty: 2, replacesOrderId: 1234
      });
      expect(result.action).toBe('OPEN_POSITION');
    });

    it('replace with modified size: still classified correctly', () => {
      positionState = { 'NQ': { side: 'long', quantity: 2 } };
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbol: 'NQ', qty: 3, replacesOrderId: 1234
      });
      // Buying when already long = INCREASE
      expect(result.action).toBe('INCREASE_POSITION');
    });

    it('cancel-all URL = CANCEL_ORDER', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order/cancelAll', {});
      expect(result.action).toBe('CANCEL_ORDER');
    });

    it('delete URL = CANCEL_ORDER', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order/delete', {
        orderId: 999
      });
      expect(result.action).toBe('CANCEL_ORDER');
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // TOPSTEPX NUMERIC ACTION CODES
  // TopstepX sends action: 1 (Buy), action: 2 (Sell), etc. as numbers.
  // String() wrapping prevents crash. These should NOT match "close"/"cancel".
  // ─────────────────────────────────────────────────────────────────────────

  describe('TopstepX Numeric Action Codes', () => {
    it('action: 1 (Buy) from flat = OPEN_POSITION', () => {
      positionState = {};
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 1, symbol: 'NQU26', qty: 2
      });
      expect(result.action).toBe('OPEN_POSITION');
      expect(result.side).toBe('1'); // String coerced
    });

    it('action: 2 (Sell) from flat = OPEN_POSITION', () => {
      positionState = {};
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 2, symbol: 'NQU26', qty: 1
      });
      expect(result.action).toBe('OPEN_POSITION');
    });

    it('action: 0 (unknown numeric) does not crash', () => {
      expect(() => classifyOrder('https://userapi.topstepx.com/Order', {
        action: 0, symbol: 'ES', qty: 1
      })).not.toThrow();
    });

    it('action: -1 (negative numeric) does not crash', () => {
      expect(() => classifyOrder('https://userapi.topstepx.com/Order', {
        action: -1, symbol: 'ES', qty: 1
      })).not.toThrow();
    });

    it('action: 99 does not match close/cancel/flatten', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 99, symbol: 'NQ', qty: 1
      });
      // Should NOT be classified as close/cancel
      expect(result.action).not.toBe('CLOSE_POSITION');
      expect(result.action).not.toBe('CANCEL_ORDER');
    });

    it('action: NaN does not crash', () => {
      expect(() => classifyOrder('https://userapi.topstepx.com/Order', {
        action: NaN, symbol: 'NQ', qty: 1
      })).not.toThrow();
    });

    it('action: undefined does not crash', () => {
      expect(() => classifyOrder('https://userapi.topstepx.com/Order', {
        action: undefined, symbol: 'NQ', qty: 1
      })).not.toThrow();
    });

    it('action: null does not crash', () => {
      expect(() => classifyOrder('https://userapi.topstepx.com/Order', {
        action: null, symbol: 'NQ', qty: 1
      })).not.toThrow();
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // MIXED / AMBIGUOUS BODY FIELDS
  // When multiple signals conflict, URL-based always wins.
  // Body flags (isClose, reduceOnly) beat position-inference.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Mixed/Ambiguous Body Fields', () => {
    it('URL close wins even if body says buy (close URL is definitive)', () => {
      positionState = {};
      const result = classifyOrder('https://userapi.topstepx.com/Order/close', {
        action: 'buy', symbol: 'NQ', qty: 5
      });
      expect(result.action).toBe('CLOSE_POSITION');
      expect(result.confidence).toBe('high');
    });

    it('body.isClose=true wins over position-inferred INCREASE', () => {
      positionState = { 'NQ': { side: 'long', quantity: 5 } };
      // Buying when long would normally be INCREASE, but isClose overrides
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbol: 'NQ', qty: 2, isClose: true
      });
      expect(result.action).toBe('CLOSE_POSITION');
    });

    it('body.reduceOnly=true wins over position-inferred OPEN', () => {
      positionState = {}; // flat
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'sell', symbol: 'NQ', qty: 1, reduceOnly: true
      });
      expect(result.action).toBe('REDUCE_POSITION');
    });

    it('body action=close wins over contradicting side field', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'close', side: 'buy', symbol: 'NQ', qty: 3
      });
      expect(result.action).toBe('CLOSE_POSITION');
    });

    it('both isClose and reduceOnly: isClose checked first', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        isClose: true, reduceOnly: true, symbol: 'NQ', qty: 2
      });
      expect(result.action).toBe('CLOSE_POSITION');
    });

    it('empty action string with isClose flag: CLOSE wins', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: '', isClose: true, symbol: 'ES', qty: 1
      });
      expect(result.action).toBe('CLOSE_POSITION');
    });

    it('body with only price fields (no side/qty) = UNKNOWN', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        limitPrice: 20000, stopPrice: 19800
      });
      expect(result.action).toBe('UNKNOWN');
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // EDGE CASES: Zero quantity, negative qty, missing fields
  // ─────────────────────────────────────────────────────────────────────────

  describe('Zero/Negative/Missing Quantity', () => {
    it('qty: 0 from flat = UNKNOWN (no quantity to classify)', () => {
      positionState = {};
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbol: 'NQ', qty: 0
      });
      // With qty=0 and flat position, the "flat + side + quantity > 0" check fails
      expect(result.action).toBe('UNKNOWN');
    });

    it('negative qty is Math.abs-ed correctly', () => {
      positionState = {};
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbol: 'NQ', qty: -3
      });
      // Math.abs(-3) = 3, so this is a valid open with qty 3
      expect(result.action).toBe('OPEN_POSITION');
      expect(result.quantity).toBe(3);
    });

    it('missing symbol: still classifies action from URL', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order/close', {
        qty: 2
      });
      expect(result.action).toBe('CLOSE_POSITION');
    });

    it('missing body entirely (null): URL-only classification', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order/flatten', null);
      expect(result.action).toBe('CLOSE_POSITION');
    });

    it('body with no recognizable fields = UNKNOWN', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        foo: 'bar', baz: 123
      });
      expect(result.action).toBe('UNKNOWN');
    });

    it('symbol as number (TopstepX contract ID) is string-coerced', () => {
      positionState = {};
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbolId: 12345, qty: 1
      });
      expect(result.symbol).toBe('12345');
      expect(result.action).toBe('OPEN_POSITION');
    });

    it('very large quantity does not crash', () => {
      positionState = { 'NQ': { side: 'long', quantity: 100 } };
      expect(() => classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'sell', symbol: 'NQ', qty: 999999
      })).not.toThrow();
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // PLATFORM URL VARIATIONS
  // Different broker platforms use different URL patterns.
  // All must be correctly classified.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Platform URL Variations', () => {
    it('Tradovate live API: /order/close', () => {
      const result = classifyOrder('https://live.tradovateapi.com/v1/order/close', { orderId: 1 });
      expect(result.action).toBe('CLOSE_POSITION');
    });

    it('Tradovate demo API: /order/cancel', () => {
      const result = classifyOrder('https://demo.tradovateapi.com/v1/order/cancel', { orderId: 2 });
      expect(result.action).toBe('CANCEL_ORDER');
    });

    it('TopstepX: /Position/flatten', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Position/flatten', { accountId: 'x' });
      expect(result.action).toBe('CLOSE_POSITION');
    });

    it('TopstepX: /Order/editStop', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order/editStop', { orderId: 3, stopPrice: 100 });
      expect(result.action).toBe('MODIFY_PROTECTIVE_ORDER');
    });

    it('Position list query: /Position?accountId=123', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Position?accountId=123', null);
      expect(result.action).toBe('QUERY');
    });

    it('Order list query: /order/list', () => {
      const result = classifyOrder('https://api.tradovate.com/order/list', null);
      expect(result.action).toBe('QUERY');
    });

    it('Account query: /account/info', () => {
      const result = classifyOrder('https://api.tradovate.com/account/info', null);
      expect(result.action).toBe('QUERY');
    });

    it('User profile query: /user/profile', () => {
      const result = classifyOrder('https://api.tradovate.com/user/profile', null);
      expect(result.action).toBe('QUERY');
    });

    it('History query: /orders/history', () => {
      const result = classifyOrder('https://api.tradovate.com/orders/history?since=2025-01-01', null);
      expect(result.action).toBe('QUERY');
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // SIDE FIELD VARIATIONS
  // Different platforms use different terms for buy/sell directions.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Side Field Variations', () => {
    beforeEach(() => {
      positionState = { 'NQ': { side: 'long', quantity: 5 }, 'ES': { side: 'short', quantity: 3 } };
    });

    it('side="sell" against long = REDUCE/CLOSE', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'sell', symbol: 'NQ', qty: 5
      });
      expect(result.action).toBe('CLOSE_POSITION');
    });

    it('side="sellshort" against long = REDUCE/CLOSE', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'sellshort', symbol: 'NQ', qty: 3
      });
      expect(result.action).toBe('REDUCE_POSITION');
    });

    it('side="short" against long = REDUCE/CLOSE', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'short', symbol: 'NQ', qty: 2
      });
      expect(result.action).toBe('REDUCE_POSITION');
    });

    it('side="buy" against short = REDUCE/CLOSE', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbol: 'ES', qty: 3
      });
      expect(result.action).toBe('CLOSE_POSITION');
    });

    it('side="buytocover" against short = REDUCE/CLOSE', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buytocover', symbol: 'ES', qty: 1
      });
      expect(result.action).toBe('REDUCE_POSITION');
    });

    it('side="long" against short = REDUCE/CLOSE', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'long', symbol: 'ES', qty: 2
      });
      expect(result.action).toBe('REDUCE_POSITION');
    });

    it('orderAction field used if action missing', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        orderAction: 'sell', symbol: 'NQ', qty: 1
      });
      expect(result.action).toBe('REDUCE_POSITION');
    });

    it('side field used if action and orderAction missing', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        side: 'sell', symbol: 'NQ', qty: 4
      });
      expect(result.action).toBe('REDUCE_POSITION');
    });

    it('UPPERCASE action is lowercased correctly', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'SELL', symbol: 'NQ', qty: 5
      });
      expect(result.action).toBe('CLOSE_POSITION');
    });

    it('Mixed case "Close" is recognized', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'Close', symbol: 'NQ', qty: 5
      });
      expect(result.action).toBe('CLOSE_POSITION');
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // QUANTITY FIELD VARIATIONS
  // Different platforms use different field names for order size.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Quantity Field Variations', () => {
    beforeEach(() => {
      positionState = {};
    });

    it('positionSize field recognized', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbol: 'NQ', positionSize: 3
      });
      expect(result.quantity).toBe(3);
      expect(result.action).toBe('OPEN_POSITION');
    });

    it('qty field recognized', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbol: 'NQ', qty: 4
      });
      expect(result.quantity).toBe(4);
    });

    it('quantity field recognized', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbol: 'NQ', quantity: 2
      });
      expect(result.quantity).toBe(2);
    });

    it('amount field recognized', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbol: 'NQ', amount: 1
      });
      expect(result.quantity).toBe(1);
    });

    it('size field recognized', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbol: 'NQ', size: 6
      });
      expect(result.quantity).toBe(6);
    });

    it('positionSize takes priority (checked first in OR chain)', () => {
      const result = classifyOrder('https://userapi.topstepx.com/Order', {
        action: 'buy', symbol: 'NQ', positionSize: 5, qty: 3, quantity: 2
      });
      expect(result.quantity).toBe(5);
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // CONFIDENCE LEVELS
  // URL-based = high, body-flag = high, position-inferred = medium, unknown = low
  // ─────────────────────────────────────────────────────────────────────────

  describe('Confidence Levels', () => {
    it('URL-based classification = high confidence', () => {
      expect(classifyOrder('https://api.topstepx.com/Order/close', { qty: 1 }).confidence).toBe('high');
      expect(classifyOrder('https://api.topstepx.com/Order/cancel', { orderId: 1 }).confidence).toBe('high');
      expect(classifyOrder('https://api.topstepx.com/Order/editStopLoss', { stopPrice: 1 }).confidence).toBe('high');
      expect(classifyOrder('https://api.topstepx.com/Order?accountId=1', null).confidence).toBe('high');
    });

    it('body-flag classification = high confidence', () => {
      expect(classifyOrder('https://api.topstepx.com/Order', { action: 'close' }).confidence).toBe('high');
      expect(classifyOrder('https://api.topstepx.com/Order', { action: 'cancel' }).confidence).toBe('high');
      expect(classifyOrder('https://api.topstepx.com/Order', { isClose: true }).confidence).toBe('high');
      expect(classifyOrder('https://api.topstepx.com/Order', { reduceOnly: true, action: 'sell', symbol: 'X', qty: 1 }).confidence).toBe('high');
    });

    it('position-inferred classification = medium confidence', () => {
      positionState = { 'NQ': { side: 'long', quantity: 5 } };
      expect(classifyOrder('https://api.topstepx.com/Order', { action: 'sell', symbol: 'NQ', qty: 3 }).confidence).toBe('medium');
    });

    it('flat + new order = medium confidence', () => {
      positionState = {};
      expect(classifyOrder('https://api.topstepx.com/Order', { action: 'buy', symbol: 'NQ', qty: 1 }).confidence).toBe('medium');
    });

    it('unknown = low confidence', () => {
      positionState = {};
      expect(classifyOrder('https://api.topstepx.com/Order', { weirdField: true }).confidence).toBe('low');
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // SYMBOL MATCHING (case-insensitive)
  // Position state is keyed by uppercase symbol. Body may have mixed case.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Symbol Matching', () => {
    it('lowercase body symbol matches uppercase position state', () => {
      positionState = { 'NQ': { side: 'long', quantity: 3 } };
      const result = classifyOrder('https://api.topstepx.com/Order', {
        action: 'sell', symbol: 'nq', qty: 3
      });
      expect(result.action).toBe('CLOSE_POSITION');
    });

    it('mixed case body symbol matches position state', () => {
      positionState = { 'MNQ': { side: 'short', quantity: 2 } };
      const result = classifyOrder('https://api.topstepx.com/Order', {
        action: 'buy', symbol: 'Mnq', qty: 2
      });
      expect(result.action).toBe('CLOSE_POSITION');
    });

    it('symbolId field used when symbol missing', () => {
      positionState = { '12345': { side: 'long', quantity: 1 } };
      const result = classifyOrder('https://api.topstepx.com/Order', {
        action: 'sell', symbolId: '12345', qty: 1
      });
      expect(result.action).toBe('CLOSE_POSITION');
    });

    it('instrument field used when symbol and symbolId missing', () => {
      positionState = { 'ESUSD': { side: 'long', quantity: 2 } };
      const result = classifyOrder('https://api.topstepx.com/Order', {
        action: 'sell', instrument: 'ESUSD', qty: 1
      });
      expect(result.action).toBe('REDUCE_POSITION');
    });

    it('unrecognized symbol with position-aware side = OPEN (flat)', () => {
      positionState = { 'NQ': { side: 'long', quantity: 5 } };
      // Different symbol, no position for it → flat → OPEN
      const result = classifyOrder('https://api.topstepx.com/Order', {
        action: 'buy', symbol: 'RTY', qty: 1
      });
      expect(result.action).toBe('OPEN_POSITION');
    });
  });
});
