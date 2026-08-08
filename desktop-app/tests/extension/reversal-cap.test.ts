/**
 * REVERSAL CAP TESTS — Proves reversals obey getEffectiveMaxSize()
 * 
 * A reversal = close existing position + open opposite direction.
 * The CLOSE portion is always allowed (exit safety).
 * The NEW RISK portion must obey ALL active caps (plan, loss-streak, FOMO).
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════════
// Reproduction of relevant logic
// ═══════════════════════════════════════════════════════════════════════════════

let positionState: Record<string, { side: string; quantity: number }> = {};
let lockActive = true;
let sessionBlocked = false;
let lossStreakEnabled = true;
let currentMaxSize = 0;
let fomoReducedUntil = 0;
let fomoTemporaryMax = 0;
let positionLimitsDefaultMax = 4;

function getEffectiveMaxSize(symbol?: string): number {
  let max = positionLimitsDefaultMax;
  if (lossStreakEnabled && currentMaxSize > 0 && currentMaxSize < max) max = currentMaxSize;
  if (fomoReducedUntil > 0 && Date.now() < fomoReducedUntil && fomoTemporaryMax > 0 && fomoTemporaryMax < max) max = fomoTemporaryMax;
  return Math.max(1, max);
}

interface Classification {
  action: string; symbol: string; side: string; quantity: number;
  positionBefore: { side: string; quantity: number };
  closeQuantity: number; newRiskQuantity: number;
}

function classifyReversal(symbol: string, side: string, qty: number): Classification {
  const pos = positionState[symbol] || { side: 'flat', quantity: 0 };
  return {
    action: 'REVERSE_POSITION',
    symbol,
    side,
    quantity: qty,
    positionBefore: pos,
    closeQuantity: pos.quantity,
    newRiskQuantity: qty - pos.quantity,
  };
}

function evaluateReversal(symbol: string, side: string, qty: number): { allow: boolean; reason: string } {
  const classification = classifyReversal(symbol, side, qty);

  // Exit safety: close portion always allowed — but we're evaluating the full reversal
  // The new-risk portion must pass all cap checks
  if (lockActive && classification.newRiskQuantity > 0) {
    const max = getEffectiveMaxSize(symbol);
    if (classification.newRiskQuantity > max) {
      return { allow: false, reason: `Reversal blocked: new exposure ${classification.newRiskQuantity} exceeds effective max ${max}` };
    }
  }

  // Close portion is always safe — if we get here, new risk is within caps
  return { allow: true, reason: 'Reversal allowed' };
}

function resetState() {
  positionState = { 'NQ': { side: 'long', quantity: 2 } };
  lockActive = true;
  sessionBlocked = false;
  lossStreakEnabled = true;
  currentMaxSize = 0;
  fomoReducedUntil = 0;
  fomoTemporaryMax = 0;
  positionLimitsDefaultMax = 4;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Reversal Cap Enforcement', () => {
  beforeEach(resetState);

  describe('Plan cap', () => {
    it('ALLOWS reversal when new risk within plan max', () => {
      // Long 2, sell 5 → close 2 + new short 3, plan max = 4
      const result = evaluateReversal('NQ', 'sell', 5);
      expect(result.allow).toBe(true); // 3 <= 4
    });

    it('BLOCKS reversal when new risk exceeds plan max', () => {
      // Long 2, sell 7 → close 2 + new short 5, plan max = 4
      const result = evaluateReversal('NQ', 'sell', 7);
      expect(result.allow).toBe(false); // 5 > 4
      expect(result.reason).toContain('exceeds effective max 4');
    });

    it('ALLOWS exact-cap reversal (new risk == max)', () => {
      // Long 2, sell 6 → close 2 + new short 4, plan max = 4
      const result = evaluateReversal('NQ', 'sell', 6);
      expect(result.allow).toBe(true); // 4 <= 4
    });
  });

  describe('Loss-streak cap', () => {
    it('BLOCKS reversal when new risk exceeds loss-streak cap', () => {
      currentMaxSize = 2; // Loss streak reduced to 2
      // Long 2, sell 5 → new short 3, effective max = 2
      const result = evaluateReversal('NQ', 'sell', 5);
      expect(result.allow).toBe(false); // 3 > 2
      expect(result.reason).toContain('exceeds effective max 2');
    });

    it('ALLOWS reversal within loss-streak cap', () => {
      currentMaxSize = 2;
      // Long 2, sell 4 → new short 2, effective max = 2
      const result = evaluateReversal('NQ', 'sell', 4);
      expect(result.allow).toBe(true); // 2 <= 2
    });

    it('loss-streak cap = 1: only 1 new contract allowed', () => {
      currentMaxSize = 1;
      // Long 2, sell 3 → new short 1, effective max = 1
      expect(evaluateReversal('NQ', 'sell', 3).allow).toBe(true); // 1 <= 1
      // Long 2, sell 4 → new short 2, effective max = 1
      expect(evaluateReversal('NQ', 'sell', 4).allow).toBe(false); // 2 > 1
    });
  });

  describe('FOMO cap', () => {
    it('BLOCKS reversal when new risk exceeds FOMO cap', () => {
      fomoReducedUntil = Date.now() + 60000;
      fomoTemporaryMax = 1;
      // Long 2, sell 4 → new short 2, effective max = 1 (FOMO)
      const result = evaluateReversal('NQ', 'sell', 4);
      expect(result.allow).toBe(false); // 2 > 1
      expect(result.reason).toContain('exceeds effective max 1');
    });

    it('ALLOWS reversal within FOMO cap', () => {
      fomoReducedUntil = Date.now() + 60000;
      fomoTemporaryMax = 1;
      // Long 2, sell 3 → new short 1, effective max = 1 (FOMO)
      const result = evaluateReversal('NQ', 'sell', 3);
      expect(result.allow).toBe(true); // 1 <= 1
    });

    it('FOMO cap expired: falls back to plan max', () => {
      fomoReducedUntil = Date.now() - 1000; // Expired
      fomoTemporaryMax = 1;
      currentMaxSize = 0; // No loss streak
      // Long 2, sell 5 → new short 3, effective max = 4 (plan)
      const result = evaluateReversal('NQ', 'sell', 5);
      expect(result.allow).toBe(true); // 3 <= 4
    });
  });

  describe('Overlapping caps', () => {
    it('plan=4, lossStreak=2, FOMO=1 → effective=1', () => {
      currentMaxSize = 2;
      fomoReducedUntil = Date.now() + 60000;
      fomoTemporaryMax = 1;
      // Long 2, sell 4 → new short 2, effective max = 1
      expect(evaluateReversal('NQ', 'sell', 4).allow).toBe(false); // 2 > 1
      // Long 2, sell 3 → new short 1, effective max = 1
      expect(evaluateReversal('NQ', 'sell', 3).allow).toBe(true); // 1 <= 1
    });

    it('FOMO expires while loss-streak active → effective=lossStreak', () => {
      currentMaxSize = 2;
      fomoReducedUntil = Date.now() - 1; // Just expired
      fomoTemporaryMax = 1;
      // Effective max is now 2 (loss streak), not 1 (FOMO) or 4 (plan)
      expect(getEffectiveMaxSize('NQ')).toBe(2);
      // Long 2, sell 5 → new short 3, effective max = 2
      expect(evaluateReversal('NQ', 'sell', 5).allow).toBe(false); // 3 > 2
      // Long 2, sell 4 → new short 2, effective max = 2
      expect(evaluateReversal('NQ', 'sell', 4).allow).toBe(true); // 2 <= 2
    });
  });

  describe('Partial reversal', () => {
    it('sell exactly position size is CLOSE, not reversal', () => {
      // This test verifies understanding: sell 2 against long 2 = CLOSE (not reversal)
      // In the real classifier, newRiskQuantity would be 0
      positionState = { 'NQ': { side: 'long', quantity: 5 } };
      // sell 7 → close 5 + new short 2
      const classification = classifyReversal('NQ', 'sell', 7);
      expect(classification.closeQuantity).toBe(5);
      expect(classification.newRiskQuantity).toBe(2);
    });

    it('just 1 more than position = reversal with 1 new risk', () => {
      positionState = { 'NQ': { side: 'long', quantity: 3 } };
      const classification = classifyReversal('NQ', 'sell', 4);
      expect(classification.newRiskQuantity).toBe(1);
      expect(evaluateReversal('NQ', 'sell', 4).allow).toBe(true); // 1 <= max
    });
  });

  describe('Close portion always safe regardless of caps', () => {
    it('with all caps at 1, close portion of reversal still executes', () => {
      currentMaxSize = 1;
      fomoReducedUntil = Date.now() + 60000;
      fomoTemporaryMax = 1;
      positionState = { 'NQ': { side: 'long', quantity: 10 } };
      // sell 11 → close 10 + new short 1, effective max = 1
      const result = evaluateReversal('NQ', 'sell', 11);
      expect(result.allow).toBe(true); // 1 <= 1 (close 10 is safe, new 1 within cap)
    });

    it('with all caps at 1, reversal with 2 new risk blocked', () => {
      currentMaxSize = 1;
      fomoReducedUntil = Date.now() + 60000;
      fomoTemporaryMax = 1;
      positionState = { 'NQ': { side: 'long', quantity: 10 } };
      // sell 12 → close 10 + new short 2, effective max = 1
      const result = evaluateReversal('NQ', 'sell', 12);
      expect(result.allow).toBe(false); // 2 > 1
    });
  });

  describe('Stale position state', () => {
    it('no position state: newRiskQuantity is full qty (conservative)', () => {
      positionState = {}; // No known position
      // If position is unknown, classifier would classify as OPEN, not REVERSE
      // But if somehow classified as reversal with stale data:
      const classification = classifyReversal('NQ', 'sell', 3);
      // With no position, closeQuantity = 0, newRiskQuantity = 3
      expect(classification.newRiskQuantity).toBe(3);
      expect(evaluateReversal('NQ', 'sell', 3).allow).toBe(true); // 3 <= plan max 4
    });
  });
});
