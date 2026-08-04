/**
 * Loss Reaction Tests
 * 
 * Verifies: single loss = no trigger, 2 consecutive = trigger,
 * win resets counter, grace period after dismiss, close-order suppression.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestClock } from '../utils/test-clock';

// Extracted loss-reaction logic for testability
class LossReactionEngine {
  consecutiveLosses = 0;
  lastTriggerTime = 0;
  overlayDismissedAt = 0;
  lastCloseOrderTime = 0;
  lastLossDetectedTime = 0;
  triggered = false;

  readonly MIN_TRIGGER_INTERVAL = 60000;
  readonly GRACE_PERIOD = 120000;
  readonly CLOSE_SUPPRESSION = 30000;
  readonly LOSS_DEBOUNCE = 60000;
  readonly MIN_LOSS_AMOUNT = 10;
  readonly THRESHOLD = 2;

  /** Simulate a P&L drop detected by the poller */
  detectPnLDrop(amount: number, now: number): boolean {
    // Check suppression windows
    if (amount < this.MIN_LOSS_AMOUNT) return false;
    if ((now - this.lastLossDetectedTime) < this.LOSS_DEBOUNCE) return false;
    if ((now - this.lastCloseOrderTime) < this.CLOSE_SUPPRESSION) return false;

    this.lastLossDetectedTime = now;
    return true; // Loss is valid, will fire TRL_TRADE_RESULT
  }

  /** Process a verified trade result */
  onTradeResult(result: 'win' | 'loss', now: number): 'trigger' | 'counted' | 'ignored' | 'reset' {
    // Grace period check
    if ((now - this.overlayDismissedAt) < this.GRACE_PERIOD) return 'ignored';

    if (result === 'loss') {
      this.consecutiveLosses++;
      if (this.consecutiveLosses >= this.THRESHOLD && (now - this.lastTriggerTime) > this.MIN_TRIGGER_INTERVAL) {
        this.lastTriggerTime = now;
        this.triggered = true;
        return 'trigger';
      }
      return 'counted';
    }

    if (result === 'win') {
      this.consecutiveLosses = 0;
      return 'reset';
    }

    return 'ignored';
  }

  /** Simulate overlay dismiss */
  dismiss(now: number): void {
    this.overlayDismissedAt = now;
  }

  /** Simulate a close order being allowed */
  onCloseOrder(now: number): void {
    this.lastCloseOrderTime = now;
  }
}

describe('Loss Reaction', () => {
  let engine: LossReactionEngine;
  let now: number;

  beforeEach(() => {
    engine = new LossReactionEngine();
    now = new Date('2026-07-22T10:00:00.000Z').getTime();
  });

  describe('Threshold Logic', () => {
    it('does NOT trigger on single loss', () => {
      const result = engine.onTradeResult('loss', now);
      expect(result).toBe('counted');
      expect(engine.triggered).toBe(false);
      expect(engine.consecutiveLosses).toBe(1);
    });

    it('TRIGGERS on 2 consecutive losses', () => {
      engine.onTradeResult('loss', now);
      const result = engine.onTradeResult('loss', now + 61000);
      expect(result).toBe('trigger');
      expect(engine.triggered).toBe(true);
      expect(engine.consecutiveLosses).toBe(2);
    });

    it('does NOT trigger on loss-win-loss (resets on win)', () => {
      engine.onTradeResult('loss', now);
      engine.onTradeResult('win', now + 30000);
      const result = engine.onTradeResult('loss', now + 90000);
      expect(result).toBe('counted');
      expect(engine.consecutiveLosses).toBe(1);
      expect(engine.triggered).toBe(false);
    });

    it('win resets counter to 0', () => {
      engine.onTradeResult('loss', now);
      engine.onTradeResult('loss', now + 61000);
      engine.onTradeResult('win', now + 120000);
      expect(engine.consecutiveLosses).toBe(0);
    });
  });

  describe('Debounce & Suppression', () => {
    it('rejects P&L drops < $10', () => {
      expect(engine.detectPnLDrop(5, now)).toBe(false);
      expect(engine.detectPnLDrop(9.99, now)).toBe(false);
    });

    it('accepts P&L drops >= $10', () => {
      expect(engine.detectPnLDrop(10, now)).toBe(true);
      expect(engine.detectPnLDrop(500, now + 61000)).toBe(true);
    });

    it('rejects P&L drop within 60s of last detection', () => {
      engine.detectPnLDrop(100, now);
      expect(engine.detectPnLDrop(100, now + 30000)).toBe(false);
      expect(engine.detectPnLDrop(100, now + 59999)).toBe(false);
      expect(engine.detectPnLDrop(100, now + 60001)).toBe(true);
    });

    it('suppresses detection for 30s after close order', () => {
      engine.onCloseOrder(now);
      expect(engine.detectPnLDrop(200, now + 5000)).toBe(false);
      expect(engine.detectPnLDrop(200, now + 29000)).toBe(false);
      expect(engine.detectPnLDrop(200, now + 31000)).toBe(true);
    });
  });

  describe('Grace Period After Dismiss', () => {
    it('ignores trade results during 2-min grace period', () => {
      engine.onTradeResult('loss', now);
      engine.onTradeResult('loss', now + 61000); // triggers
      engine.dismiss(now + 62000);

      // During grace period
      const result = engine.onTradeResult('loss', now + 63000);
      expect(result).toBe('ignored');
    });

    it('accepts trade results after grace period expires', () => {
      engine.dismiss(now);
      const result = engine.onTradeResult('loss', now + 121000);
      expect(result).toBe('counted');
    });
  });

  describe('Re-trigger Prevention', () => {
    it('does NOT re-trigger within 60s of last trigger', () => {
      engine.onTradeResult('loss', now);
      engine.onTradeResult('loss', now + 1000); // triggers
      
      // Third loss within 60s
      const result = engine.onTradeResult('loss', now + 30000);
      expect(result).toBe('counted'); // counted but no new trigger
    });
  });
});
