/**
 * Win Streak Protection Tests
 * 
 * Verifies: consecutive wins tracked, threshold triggers actions,
 * loss resets counter, triggered flag prevents re-fire.
 */

import { describe, it, expect, beforeEach } from 'vitest';

class WinStreakEngine {
  consecutiveWins = 0;
  winStreakTriggered = false;
  threshold = 3;
  enabled = true;

  actions: string[] = [];

  onTradeResult(result: 'win' | 'loss'): string[] {
    this.actions = [];

    if (result === 'loss') {
      this.consecutiveWins = 0;
      this.winStreakTriggered = false;
      return this.actions;
    }

    if (result === 'win') {
      this.consecutiveWins++;
      if (this.enabled && this.consecutiveWins >= this.threshold && !this.winStreakTriggered) {
        this.winStreakTriggered = true;
        this.actions.push('TRIGGERED');
      }
    }

    return this.actions;
  }

  reset(): void {
    this.consecutiveWins = 0;
    this.winStreakTriggered = false;
    this.actions = [];
  }
}

describe('Win Streak Protection', () => {
  let engine: WinStreakEngine;

  beforeEach(() => {
    engine = new WinStreakEngine();
    engine.threshold = 3;
    engine.enabled = true;
  });

  it('tracks consecutive wins', () => {
    engine.onTradeResult('win');
    expect(engine.consecutiveWins).toBe(1);
    engine.onTradeResult('win');
    expect(engine.consecutiveWins).toBe(2);
  });

  it('triggers at threshold', () => {
    engine.onTradeResult('win');
    engine.onTradeResult('win');
    const actions = engine.onTradeResult('win');
    expect(actions).toContain('TRIGGERED');
    expect(engine.winStreakTriggered).toBe(true);
  });

  it('does NOT trigger before threshold', () => {
    const a1 = engine.onTradeResult('win');
    const a2 = engine.onTradeResult('win');
    expect(a1).not.toContain('TRIGGERED');
    expect(a2).not.toContain('TRIGGERED');
  });

  it('loss resets consecutive wins', () => {
    engine.onTradeResult('win');
    engine.onTradeResult('win');
    engine.onTradeResult('loss');
    expect(engine.consecutiveWins).toBe(0);
  });

  it('loss resets winStreakTriggered', () => {
    engine.onTradeResult('win');
    engine.onTradeResult('win');
    engine.onTradeResult('win'); // triggers
    engine.onTradeResult('loss');
    expect(engine.winStreakTriggered).toBe(false);
  });

  it('does NOT re-trigger same streak', () => {
    engine.onTradeResult('win');
    engine.onTradeResult('win');
    engine.onTradeResult('win'); // triggers
    const a4 = engine.onTradeResult('win'); // 4th win
    expect(a4).not.toContain('TRIGGERED');
  });

  it('triggers again after loss breaks streak', () => {
    engine.onTradeResult('win');
    engine.onTradeResult('win');
    engine.onTradeResult('win'); // triggers
    engine.onTradeResult('loss'); // resets
    engine.onTradeResult('win');
    engine.onTradeResult('win');
    const actions = engine.onTradeResult('win'); // new trigger
    expect(actions).toContain('TRIGGERED');
  });

  it('does NOT trigger when disabled', () => {
    engine.enabled = false;
    engine.onTradeResult('win');
    engine.onTradeResult('win');
    const actions = engine.onTradeResult('win');
    expect(actions).not.toContain('TRIGGERED');
  });

  it('respects custom threshold', () => {
    engine.threshold = 5;
    for (let i = 0; i < 4; i++) engine.onTradeResult('win');
    expect(engine.winStreakTriggered).toBe(false);
    const actions = engine.onTradeResult('win'); // 5th
    expect(actions).toContain('TRIGGERED');
  });
});
