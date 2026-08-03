import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

interface Trade {
  id: number;
  symbol: string;
  size: number;
  direction: string;
  entryTime: string;
  exitTime: string;
  pnl: number;
  result: string;
  durationSeconds: number;
}

interface WhatIfScenario {
  id: string;
  label: string;
  description: string;
  icon: string;
  simulatedResult: number;
  actualResult: number;
  difference: number;
  tradesRemoved: number;
  applicable: boolean;
}

/**
 * What If Analysis - Simulated alternative outcomes
 * 
 * Every result is clearly labeled "Simulation".
 * Never presents simulated values as actual history.
 * 
 * Scenarios:
 * - If you stopped after Trade N
 * - If max trades were N
 * - If you skipped the worst trade
 * - If you stopped after hitting target
 * - If you traded only the first 2 hours
 */
export const WhatIf: React.FC = () => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>('today');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const t = await window.electronAPI.getTrades(2000);
      setTrades(t || []);
    } catch (e) {
      console.error('WhatIf: failed to load', e);
    } finally {
      setLoading(false);
    }
  };

  // Get available days
  const availableDays = useMemo(() => {
    const days = new Set(trades.map(t => (t.entryTime || '').split('T')[0]).filter(Boolean));
    return [...days].sort().reverse().slice(0, 14); // Last 14 trading days
  }, [trades]);

  const today = new Date().toISOString().split('T')[0];
  const targetDay = selectedDay === 'today' ? today : selectedDay;

  // Get trades for selected day
  const dayTrades = useMemo(() => {
    return trades
      .filter(t => (t.entryTime || '').startsWith(targetDay))
      .sort((a, b) => (a.entryTime || '').localeCompare(b.entryTime || ''));
  }, [trades, targetDay]);

  const actualPnl = dayTrades.reduce((s, t) => s + t.pnl, 0);

  // Generate What If scenarios
  const scenarios = useMemo((): WhatIfScenario[] => {
    if (dayTrades.length < 2) return [];

    const results: WhatIfScenario[] = [];

    // ─── Scenario 1: If you stopped after Trade 2 ────────────────────────
    if (dayTrades.length > 2) {
      const firstTwo = dayTrades.slice(0, 2).reduce((s, t) => s + t.pnl, 0);
      results.push({
        id: 'stop_after_2',
        label: 'If you stopped after Trade 2',
        description: `Only the first 2 trades count`,
        icon: '✌️',
        simulatedResult: firstTwo,
        actualResult: actualPnl,
        difference: firstTwo - actualPnl,
        tradesRemoved: dayTrades.length - 2,
        applicable: true,
      });
    }

    // ─── Scenario 2: If you stopped after Trade 3 ────────────────────────
    if (dayTrades.length > 3) {
      const firstThree = dayTrades.slice(0, 3).reduce((s, t) => s + t.pnl, 0);
      results.push({
        id: 'stop_after_3',
        label: 'If you stopped after Trade 3',
        description: `Only the first 3 trades count`,
        icon: '3️⃣',
        simulatedResult: firstThree,
        actualResult: actualPnl,
        difference: firstThree - actualPnl,
        tradesRemoved: dayTrades.length - 3,
        applicable: true,
      });
    }

    // ─── Scenario 3: If max trades were limited ──────────────────────────
    const avgTradesPerDay = trades.length > 0 ? Math.round(trades.length / new Set(trades.map(t => (t.entryTime || '').split('T')[0])).size) : 3;
    const maxLimit = Math.max(2, Math.min(avgTradesPerDay, dayTrades.length - 1));
    if (dayTrades.length > maxLimit) {
      const limited = dayTrades.slice(0, maxLimit).reduce((s, t) => s + t.pnl, 0);
      results.push({
        id: 'max_trades',
        label: `If max trades were ${maxLimit}`,
        description: `Based on your average (${avgTradesPerDay}/day)`,
        icon: '🔒',
        simulatedResult: limited,
        actualResult: actualPnl,
        difference: limited - actualPnl,
        tradesRemoved: dayTrades.length - maxLimit,
        applicable: true,
      });
    }

    // ─── Scenario 4: If you skipped the worst trade ──────────────────────
    if (dayTrades.length >= 2) {
      const worstTrade = dayTrades.reduce((worst, t) => t.pnl < worst.pnl ? t : worst, dayTrades[0]);
      const withoutWorst = actualPnl - worstTrade.pnl;
      results.push({
        id: 'skip_worst',
        label: 'If you skipped the worst trade',
        description: `Removed: ${worstTrade.direction} ${worstTrade.symbol} ($${worstTrade.pnl.toFixed(0)})`,
        icon: '🗑',
        simulatedResult: withoutWorst,
        actualResult: actualPnl,
        difference: withoutWorst - actualPnl,
        tradesRemoved: 1,
        applicable: true,
      });
    }

    // ─── Scenario 5: If you stopped after hitting positive ───────────────
    let peakPnl = 0;
    let peakTradeIndex = 0;
    let runningPnl = 0;
    dayTrades.forEach((t, i) => {
      runningPnl += t.pnl;
      if (runningPnl > peakPnl) {
        peakPnl = runningPnl;
        peakTradeIndex = i;
      }
    });

    if (peakPnl > 0 && peakTradeIndex < dayTrades.length - 1) {
      results.push({
        id: 'stop_at_peak',
        label: 'If you stopped at peak P&L',
        description: `Stopped after trade ${peakTradeIndex + 1} (highest point)`,
        icon: '⛰',
        simulatedResult: peakPnl,
        actualResult: actualPnl,
        difference: peakPnl - actualPnl,
        tradesRemoved: dayTrades.length - peakTradeIndex - 1,
        applicable: peakPnl > actualPnl,
      });
    }

    // ─── Scenario 6: If you only traded first 2 hours ────────────────────
    if (dayTrades.length >= 2) {
      const firstTradeTime = new Date(dayTrades[0].entryTime).getTime();
      const twoHourCutoff = firstTradeTime + 2 * 60 * 60 * 1000;
      const firstTwoHours = dayTrades.filter(t => new Date(t.entryTime).getTime() <= twoHourCutoff);
      if (firstTwoHours.length < dayTrades.length && firstTwoHours.length > 0) {
        const twoHourPnl = firstTwoHours.reduce((s, t) => s + t.pnl, 0);
        results.push({
          id: 'first_2_hours',
          label: 'If you only traded the first 2 hours',
          description: `${firstTwoHours.length} of ${dayTrades.length} trades`,
          icon: '⏰',
          simulatedResult: twoHourPnl,
          actualResult: actualPnl,
          difference: twoHourPnl - actualPnl,
          tradesRemoved: dayTrades.length - firstTwoHours.length,
          applicable: true,
        });
      }
    }

    // Sort: biggest positive difference first (scenarios where they'd have done better)
    results.sort((a, b) => b.difference - a.difference);

    return results.filter(r => r.applicable);
  }, [dayTrades, actualPnl, trades]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: `${colors.primary}30`, borderTopColor: colors.primary }} />
      </div>
    );
  }

  return (
    <div className="max-w-lg animate-reveal">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`, border: `1px solid ${colors.primary}20` }}>
          <span className="text-lg" style={{ filter: `drop-shadow(0 0 4px ${colors.primary}50)` }}>🔮</span>
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gradient">What If</h2>
          <p className="text-[0.6rem] text-white/30">Simulated alternative outcomes</p>
        </div>
      </div>

      {/* Day Selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedDay('today')}
          className="px-3 py-1.5 rounded-lg text-[0.6rem] font-bold uppercase tracking-[1.5px] transition-all shrink-0"
          style={{
            background: selectedDay === 'today' ? `${colors.primary}20` : 'transparent',
            border: `1px solid ${selectedDay === 'today' ? colors.primary + '40' : 'rgba(255,255,255,0.06)'}`,
            color: selectedDay === 'today' ? colors.primary : 'rgba(255,255,255,0.3)',
          }}
        >
          Today
        </button>
        {availableDays.filter(d => d !== today).slice(0, 6).map(day => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className="px-3 py-1.5 rounded-lg text-[0.6rem] font-bold tracking-[1px] transition-all shrink-0"
            style={{
              background: selectedDay === day ? `${colors.primary}20` : 'transparent',
              border: `1px solid ${selectedDay === day ? colors.primary + '40' : 'rgba(255,255,255,0.06)'}`,
              color: selectedDay === day ? colors.primary : 'rgba(255,255,255,0.3)',
            }}
          >
            {formatShortDate(day)}
          </button>
        ))}
      </div>

      {/* Actual Result */}
      <div className="mb-5 px-4 py-3 rounded-xl border border-white/[0.04] bg-white/[0.01]">
        <div className="flex items-center justify-between">
          <span className="text-[0.6rem] text-white/30 uppercase tracking-[1.5px]">Actual Result</span>
          <span className="text-lg font-black font-mono" style={{ color: actualPnl >= 0 ? '#10b981' : '#ef4444' }}>
            {actualPnl >= 0 ? '+' : ''}${actualPnl.toFixed(0)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[0.6rem] text-white/30 uppercase tracking-[1.5px]">Trades</span>
          <span className="text-sm font-bold font-mono text-white/40">{dayTrades.length}</span>
        </div>
      </div>

      {dayTrades.length < 2 ? (
        <div className="relative rounded-xl p-8 overflow-hidden card-premium text-center">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}20, transparent)` }} />
          <div className="relative z-10">
            <p className="text-2xl mb-2">🔮</p>
            <p className="text-sm font-semibold text-white/50 mb-1">Not Enough Trades</p>
            <p className="text-[0.6rem] text-white/25">Need at least 2 trades in a session to generate What If scenarios.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Scenarios */}
          <div className="space-y-3">
            {scenarios.map((scenario) => {
              const isBetter = scenario.difference > 0;
              return (
                <div key={scenario.id} className="relative rounded-xl p-4 overflow-hidden card-premium">
                  <div className="relative z-10">
                    {/* Simulation badge */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{scenario.icon}</span>
                        <span className="text-xs font-bold text-white/60">{scenario.label}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[0.45rem] font-bold uppercase tracking-[1px] bg-white/5 text-white/20 border border-white/[0.06]">
                        Simulation
                      </span>
                    </div>

                    <p className="text-[0.55rem] text-white/25 mb-3">{scenario.description}</p>

                    {/* Results comparison */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 p-2 rounded-lg bg-white/[0.02] text-center">
                        <p className="text-[0.45rem] text-white/20 uppercase mb-0.5">Simulated</p>
                        <p className="text-sm font-black font-mono" style={{ color: scenario.simulatedResult >= 0 ? '#10b981' : '#ef4444' }}>
                          {scenario.simulatedResult >= 0 ? '+' : ''}${scenario.simulatedResult.toFixed(0)}
                        </p>
                      </div>
                      <span className="text-white/15 text-xs">vs</span>
                      <div className="flex-1 p-2 rounded-lg bg-white/[0.02] text-center">
                        <p className="text-[0.45rem] text-white/20 uppercase mb-0.5">Actual</p>
                        <p className="text-sm font-black font-mono" style={{ color: actualPnl >= 0 ? '#10b981' : '#ef4444' }}>
                          {actualPnl >= 0 ? '+' : ''}${actualPnl.toFixed(0)}
                        </p>
                      </div>
                      <div className="flex-1 p-2 rounded-lg text-center" style={{ background: isBetter ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)' }}>
                        <p className="text-[0.45rem] text-white/20 uppercase mb-0.5">Difference</p>
                        <p className="text-sm font-black font-mono" style={{ color: isBetter ? '#10b981' : '#ef4444' }}>
                          {scenario.difference >= 0 ? '+' : ''}${scenario.difference.toFixed(0)}
                        </p>
                      </div>
                    </div>

                    {/* Trades removed info */}
                    <p className="text-[0.5rem] text-white/15 mt-2">
                      {scenario.tradesRemoved} trade{scenario.tradesRemoved !== 1 ? 's' : ''} removed from simulation
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Disclaimer */}
          <div className="mt-5 px-4 py-3 rounded-xl border border-amber-400/10 bg-amber-400/[0.02]">
            <p className="text-[0.55rem] text-amber-300/50 leading-relaxed">
              ⚠ All results labeled "Simulation" are hypothetical. They assume perfect execution and
              no market impact from changes. Never present simulated values as actual history.
            </p>
          </div>

          {/* Purpose */}
          <div className="mt-3 px-4 py-3 rounded-xl border border-white/[0.03] bg-white/[0.01]">
            <p className="text-[0.55rem] font-bold text-white/25 uppercase tracking-[1.5px] mb-1">Purpose</p>
            <p className="text-[0.55rem] text-white/20">
              What If helps you see how discipline rules (trade limits, time limits, stopping at targets) could have changed your results.
              Use it to reinforce why rules matter — not as a trading strategy.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}
