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

interface LogEntry {
  id: number;
  timestamp: string;
  type: string;
  details: string;
}

interface FeatureEffect {
  feature: string;
  icon: string;
  enabled: boolean;
  enabledDate: string | null;
  metrics: MetricChange[];
  sampleBefore: number;
  sampleAfter: number;
  hasEnoughData: boolean;
}

interface MetricChange {
  label: string;
  before: number;
  after: number;
  unit: string;
  betterDirection: 'lower' | 'higher';
}

const MIN_SAMPLE = 5; // Minimum trades/days in each period to show comparison

/**
 * Rule Effectiveness - Shows how each Sentinel feature affected behavior
 * 
 * Compares behavior BEFORE vs AFTER enabling each feature.
 * Does NOT claim causation. Clearly states "Based on observed historical data."
 * 
 * Features tracked:
 * - Cooldown (coach)
 * - Session Hours
 * - Position Size Limits
 * - Symbol Blocklist
 * - News Blocker
 * - Kill Switch usage
 * - Tilt Meter
 */
export const RuleEffectiveness: React.FC = () => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [t, l] = await Promise.all([
        window.electronAPI.getTrades(10000),
        window.electronAPI.getActivityLog(10000),
      ]);
      setTrades(t || []);
      setLog(l || []);
    } catch (e) {
      console.error('RuleEffectiveness: failed to load', e);
    } finally {
      setLoading(false);
    }
  };

  // Find when features were first enabled based on activity log
  const featureEnableDates = useMemo(() => {
    const dates: Record<string, string> = {};
    
    // Sort log chronologically (oldest first)
    const sorted = [...log].sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    
    for (const entry of sorted) {
      const ts = entry.timestamp || '';
      const date = ts.includes('T') ? ts.split('T')[0] : ts.split(' ')[0];
      if (!date) continue;

      // Detect feature activation from log entries
      if (entry.type === 'lock_activated' && !dates.lock) dates.lock = date;
      if (entry.type === 'coach_blocked' && !dates.cooldown) dates.cooldown = date;
      if (entry.type === 'session_blocked' && !dates.session) dates.session = date;
      if (entry.type === 'size_blocked' && !dates.size) dates.size = date;
      if (entry.type === 'symbol_blocked' && !dates.symbol) dates.symbol = date;
      if (entry.type === 'kill_switch' && !dates.killswitch) dates.killswitch = date;
      if (entry.type === 'stacking_blocked' && !dates.stacking) dates.stacking = date;
    }

    return dates;
  }, [log]);

  // Compute feature effects
  const featureEffects = useMemo((): FeatureEffect[] => {
    const effects: FeatureEffect[] = [];
    const sortedTrades = [...trades].sort((a, b) => (a.entryTime || '').localeCompare(b.entryTime || ''));
    
    if (sortedTrades.length < MIN_SAMPLE * 2) return effects;

    const allDates = [...new Set(sortedTrades.map(t => (t.entryTime || '').split('T')[0]).filter(Boolean))].sort();
    if (allDates.length < 2) return effects;

    // Helper: compute metrics for a subset of trades
    const computeMetrics = (subset: Trade[]) => {
      if (subset.length === 0) return null;
      const days = new Set(subset.map(t => (t.entryTime || '').split('T')[0])).size || 1;
      const wins = subset.filter(t => t.result === 'win').length;
      const losses = subset.filter(t => t.result === 'loss').length;
      const totalPnl = subset.reduce((s, t) => s + t.pnl, 0);
      const avgSize = subset.reduce((s, t) => s + t.size, 0) / subset.length;
      const tradesPerDay = subset.length / days;
      const winRate = subset.length > 0 ? (wins / subset.length) * 100 : 0;
      const avgPnlPerTrade = subset.length > 0 ? totalPnl / subset.length : 0;
      const avgDuration = subset.length > 0 ? subset.reduce((s, t) => s + (t.durationSeconds || 0), 0) / subset.length : 0;
      
      return { days, wins, losses, totalPnl, avgSize, tradesPerDay, winRate, avgPnlPerTrade, avgDuration, count: subset.length };
    };

    // Helper: count violations in a date range
    const countViolations = (startDate: string, endDate: string) => {
      const violationTypes = ['size_blocked', 'session_blocked', 'symbol_blocked', 'coach_blocked', 'stacking_blocked', 'bypass_attempt'];
      return log.filter(e => {
        if (!violationTypes.includes(e.type)) return false;
        const ts = e.timestamp || '';
        const date = ts.includes('T') ? ts.split('T')[0] : ts.split(' ')[0];
        return date >= startDate && date <= endDate;
      }).length;
    };

    // ─── COOLDOWN (Coach) ────────────────────────────────────────────────
    if (featureEnableDates.cooldown) {
      const splitDate = featureEnableDates.cooldown;
      const before = sortedTrades.filter(t => (t.entryTime || '').split('T')[0] < splitDate);
      const after = sortedTrades.filter(t => (t.entryTime || '').split('T')[0] >= splitDate);
      const mBefore = computeMetrics(before);
      const mAfter = computeMetrics(after);

      if (mBefore && mAfter && before.length >= MIN_SAMPLE && after.length >= MIN_SAMPLE) {
        effects.push({
          feature: 'Cooldown',
          icon: '⏸',
          enabled: true,
          enabledDate: splitDate,
          sampleBefore: before.length,
          sampleAfter: after.length,
          hasEnoughData: true,
          metrics: [
            { label: 'Trades/day', before: round(mBefore.tradesPerDay), after: round(mAfter.tradesPerDay), unit: '', betterDirection: 'lower' },
            { label: 'Win rate', before: round(mBefore.winRate), after: round(mAfter.winRate), unit: '%', betterDirection: 'higher' },
            { label: 'Avg P&L/trade', before: round(mBefore.avgPnlPerTrade), after: round(mAfter.avgPnlPerTrade), unit: '$', betterDirection: 'higher' },
          ],
        });
      }
    }

    // ─── SESSION HOURS ────────────────────────────────────────────────────
    if (featureEnableDates.session) {
      const splitDate = featureEnableDates.session;
      const before = sortedTrades.filter(t => (t.entryTime || '').split('T')[0] < splitDate);
      const after = sortedTrades.filter(t => (t.entryTime || '').split('T')[0] >= splitDate);
      const mBefore = computeMetrics(before);
      const mAfter = computeMetrics(after);

      if (mBefore && mAfter && before.length >= MIN_SAMPLE && after.length >= MIN_SAMPLE) {
        // Count session violations before/after
        const vBefore = countViolations(allDates[0], splitDate);
        const vAfter = countViolations(splitDate, allDates[allDates.length - 1]);

        effects.push({
          feature: 'Session Hours',
          icon: '◷',
          enabled: true,
          enabledDate: splitDate,
          sampleBefore: before.length,
          sampleAfter: after.length,
          hasEnoughData: true,
          metrics: [
            { label: 'Trades/day', before: round(mBefore.tradesPerDay), after: round(mAfter.tradesPerDay), unit: '', betterDirection: 'lower' },
            { label: 'Win rate', before: round(mBefore.winRate), after: round(mAfter.winRate), unit: '%', betterDirection: 'higher' },
            { label: 'Avg trade duration', before: Math.round(mBefore.avgDuration / 60), after: Math.round(mAfter.avgDuration / 60), unit: 'min', betterDirection: 'higher' },
          ],
        });
      }
    }

    // ─── POSITION SIZE LIMITS ─────────────────────────────────────────────
    if (featureEnableDates.size) {
      const splitDate = featureEnableDates.size;
      const before = sortedTrades.filter(t => (t.entryTime || '').split('T')[0] < splitDate);
      const after = sortedTrades.filter(t => (t.entryTime || '').split('T')[0] >= splitDate);
      const mBefore = computeMetrics(before);
      const mAfter = computeMetrics(after);

      if (mBefore && mAfter && before.length >= MIN_SAMPLE && after.length >= MIN_SAMPLE) {
        effects.push({
          feature: 'Size Limits',
          icon: '📐',
          enabled: true,
          enabledDate: splitDate,
          sampleBefore: before.length,
          sampleAfter: after.length,
          hasEnoughData: true,
          metrics: [
            { label: 'Avg position size', before: round(mBefore.avgSize), after: round(mAfter.avgSize), unit: ' contracts', betterDirection: 'lower' },
            { label: 'Win rate', before: round(mBefore.winRate), after: round(mAfter.winRate), unit: '%', betterDirection: 'higher' },
            { label: 'Avg P&L/trade', before: round(mBefore.avgPnlPerTrade), after: round(mAfter.avgPnlPerTrade), unit: '$', betterDirection: 'higher' },
          ],
        });
      }
    }

    // ─── OVERALL LOCK USAGE ───────────────────────────────────────────────
    if (featureEnableDates.lock) {
      const splitDate = featureEnableDates.lock;
      const before = sortedTrades.filter(t => (t.entryTime || '').split('T')[0] < splitDate);
      const after = sortedTrades.filter(t => (t.entryTime || '').split('T')[0] >= splitDate);
      const mBefore = computeMetrics(before);
      const mAfter = computeMetrics(after);

      if (mBefore && mAfter && before.length >= MIN_SAMPLE && after.length >= MIN_SAMPLE) {
        effects.push({
          feature: 'Risk Lock',
          icon: '🔒',
          enabled: true,
          enabledDate: splitDate,
          sampleBefore: before.length,
          sampleAfter: after.length,
          hasEnoughData: true,
          metrics: [
            { label: 'Win rate', before: round(mBefore.winRate), after: round(mAfter.winRate), unit: '%', betterDirection: 'higher' },
            { label: 'Avg P&L/trade', before: round(mBefore.avgPnlPerTrade), after: round(mAfter.avgPnlPerTrade), unit: '$', betterDirection: 'higher' },
            { label: 'Trades/day', before: round(mBefore.tradesPerDay), after: round(mAfter.tradesPerDay), unit: '', betterDirection: 'lower' },
          ],
        });
      }
    }

    // ─── STACKING PROTECTION ──────────────────────────────────────────────
    if (featureEnableDates.stacking) {
      const splitDate = featureEnableDates.stacking;
      const before = sortedTrades.filter(t => (t.entryTime || '').split('T')[0] < splitDate);
      const after = sortedTrades.filter(t => (t.entryTime || '').split('T')[0] >= splitDate);
      const mBefore = computeMetrics(before);
      const mAfter = computeMetrics(after);

      if (mBefore && mAfter && before.length >= MIN_SAMPLE && after.length >= MIN_SAMPLE) {
        effects.push({
          feature: 'Anti-Stacking',
          icon: '🧱',
          enabled: true,
          enabledDate: splitDate,
          sampleBefore: before.length,
          sampleAfter: after.length,
          hasEnoughData: true,
          metrics: [
            { label: 'Avg position size', before: round(mBefore.avgSize), after: round(mAfter.avgSize), unit: ' contracts', betterDirection: 'lower' },
            { label: 'Win rate', before: round(mBefore.winRate), after: round(mAfter.winRate), unit: '%', betterDirection: 'higher' },
            { label: 'Avg P&L/trade', before: round(mBefore.avgPnlPerTrade), after: round(mAfter.avgPnlPerTrade), unit: '$', betterDirection: 'higher' },
          ],
        });
      }
    }

    // If no features have enough split data, show a general "since first use" comparison
    if (effects.length === 0 && sortedTrades.length >= MIN_SAMPLE * 2) {
      const mid = Math.floor(sortedTrades.length / 2);
      const firstHalf = sortedTrades.slice(0, mid);
      const secondHalf = sortedTrades.slice(mid);
      const mFirst = computeMetrics(firstHalf);
      const mSecond = computeMetrics(secondHalf);

      if (mFirst && mSecond) {
        effects.push({
          feature: 'Overall Progress',
          icon: '📈',
          enabled: true,
          enabledDate: null,
          sampleBefore: firstHalf.length,
          sampleAfter: secondHalf.length,
          hasEnoughData: true,
          metrics: [
            { label: 'Win rate', before: round(mFirst.winRate), after: round(mSecond.winRate), unit: '%', betterDirection: 'higher' },
            { label: 'Avg P&L/trade', before: round(mFirst.avgPnlPerTrade), after: round(mSecond.avgPnlPerTrade), unit: '$', betterDirection: 'higher' },
            { label: 'Trades/day', before: round(mFirst.tradesPerDay), after: round(mSecond.tradesPerDay), unit: '', betterDirection: 'lower' },
          ],
        });
      }
    }

    return effects;
  }, [trades, log, featureEnableDates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: `${colors.primary}30`, borderTopColor: colors.primary }} />
      </div>
    );
  }

  const totalTrades = trades.length;
  const hasEnoughData = totalTrades >= MIN_SAMPLE * 2;

  return (
    <div className="max-w-lg animate-reveal">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`, border: `1px solid ${colors.primary}20` }}>
          <span className="text-lg" style={{ filter: `drop-shadow(0 0 4px ${colors.primary}50)` }}>📊</span>
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gradient">Effectiveness</h2>
          <p className="text-[0.6rem] text-white/30">How each feature affected your behavior</p>
        </div>
      </div>

      {/* Sample Info */}
      <div className="mb-5 px-4 py-3 rounded-xl border border-white/[0.04] bg-white/[0.01]">
        <div className="flex items-center justify-between">
          <span className="text-[0.6rem] text-white/30 uppercase tracking-[1.5px]">Total Trades Analyzed</span>
          <span className="text-sm font-bold font-mono" style={{ color: colors.primary }}>{totalTrades}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[0.6rem] text-white/30 uppercase tracking-[1.5px]">Features Tracked</span>
          <span className="text-sm font-bold font-mono" style={{ color: colors.primary }}>{featureEffects.length}</span>
        </div>
      </div>

      {!hasEnoughData ? (
        <div className="relative rounded-xl p-8 overflow-hidden card-premium text-center">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}20, transparent)` }} />
          <div className="relative z-10">
            <p className="text-2xl mb-2">📉</p>
            <p className="text-sm font-semibold text-white/50 mb-1">Not Enough Data</p>
            <p className="text-[0.6rem] text-white/25">Need at least {MIN_SAMPLE * 2} trades to compare before/after behavior.</p>
            <p className="text-[0.6rem] text-white/15 mt-2">Current: {totalTrades} trade{totalTrades !== 1 ? 's' : ''}</p>
          </div>
        </div>
      ) : featureEffects.length === 0 ? (
        <div className="relative rounded-xl p-8 overflow-hidden card-premium text-center">
          <div className="relative z-10">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm font-semibold text-white/50 mb-1">No Feature Comparisons Available</p>
            <p className="text-[0.6rem] text-white/25">Features need enough trades both before and after activation.</p>
            <p className="text-[0.6rem] text-white/15 mt-2">Keep trading with Sentinel active to build comparison data.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Feature Cards */}
          <div className="space-y-5">
            {featureEffects.map((effect, idx) => (
              <div key={idx} className="relative rounded-xl p-5 overflow-hidden card-premium">
                <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}20, transparent)` }} />
                <div className="relative z-10">
                  {/* Feature Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{effect.icon}</span>
                      <span className="text-sm font-bold text-white/70">{effect.feature}</span>
                    </div>
                    {effect.enabledDate && (
                      <span className="text-[0.55rem] text-white/20 font-mono">since {effect.enabledDate}</span>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="space-y-3">
                    {effect.metrics.map((metric, mi) => {
                      const diff = metric.after - metric.before;
                      const pctChange = metric.before !== 0 ? (diff / Math.abs(metric.before)) * 100 : 0;
                      const isImproved = metric.betterDirection === 'higher' ? diff > 0 : diff < 0;
                      const isNeutral = Math.abs(pctChange) < 2;

                      return (
                        <div key={mi}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[0.65rem] text-white/40">{metric.label}</span>
                            <span className="text-[0.6rem] font-bold" style={{ color: isNeutral ? 'rgba(255,255,255,0.3)' : isImproved ? '#10b981' : '#ef4444' }}>
                              {isNeutral ? '—' : (isImproved ? '↑' : '↓')} {Math.abs(Math.round(pctChange))}%
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-[0.55rem] text-white/20 mb-0.5">
                                <span>Before</span>
                                <span className="font-mono">{metric.before}{metric.unit}</span>
                              </div>
                              <div className="h-1 rounded-full bg-white/[0.04]">
                                <div className="h-full rounded-full bg-white/10" style={{ width: `${Math.min(100, Math.abs(metric.before) / Math.max(Math.abs(metric.before), Math.abs(metric.after), 1) * 100)}%` }} />
                              </div>
                            </div>
                            <span className="text-white/10">→</span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-[0.55rem] text-white/20 mb-0.5">
                                <span>After</span>
                                <span className="font-mono">{metric.after}{metric.unit}</span>
                              </div>
                              <div className="h-1 rounded-full bg-white/[0.04]">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.abs(metric.after) / Math.max(Math.abs(metric.before), Math.abs(metric.after), 1) * 100)}%`, background: isImproved ? colors.primary : '#ef4444' }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Sample sizes */}
                  <div className="mt-3 pt-3 border-t border-white/[0.03] flex items-center justify-between">
                    <span className="text-[0.5rem] text-white/15">Before: {effect.sampleBefore} trades</span>
                    <span className="text-[0.5rem] text-white/15">After: {effect.sampleAfter} trades</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="mt-6 px-4 py-3 rounded-xl border border-amber-400/10 bg-amber-400/[0.02]">
            <p className="text-[0.55rem] text-amber-300/50 leading-relaxed">
              ⚠ Based on observed historical data. Does not claim causation.
              Many factors affect trading results — these comparisons show correlation with feature activation dates only.
            </p>
          </div>

          {/* Sample footnote */}
          <p className="text-[0.5rem] text-white/15 text-center mt-3 italic">
            Minimum {MIN_SAMPLE} trades required in each period for comparison.
          </p>
        </>
      )}
    </div>
  );
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
