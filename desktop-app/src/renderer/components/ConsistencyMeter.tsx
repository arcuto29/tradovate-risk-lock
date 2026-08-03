import React, { useState, useEffect, useMemo } from 'react';
import { Ruler } from 'lucide-react';
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

interface ConsistencyFactor {
  label: string;
  description: string;
  score: number; // 0-100
  detail: string;
}

const VIOLATION_TYPES = ['size_blocked', 'session_blocked', 'symbol_blocked', 'coach_blocked', 'stacking_blocked', 'bypass_attempt'];

/**
 * Consistency Meter - Measurable behavioral consistency scoring
 * 
 * Measures ONLY observable behavior, NOT emotions.
 * 
 * Factors:
 * 1. Position size consistency (std deviation of sizes)
 * 2. Trade count consistency (std deviation of daily trade counts)
 * 3. Session start consistency (std deviation of first trade time)
 * 4. Session end consistency (std deviation of last trade time)
 * 5. Trading window consistency (% of trades within session hours)
 * 6. Rule-following consistency (% of days without violations)
 */
export const ConsistencyMeter: React.FC = () => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('30d');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [t, l] = await Promise.all([
        window.electronAPI.getTrades(5000),
        window.electronAPI.getActivityLog(10000),
      ]);
      setTrades(t || []);
      setLog(l || []);
    } catch (e) {
      console.error('ConsistencyMeter: failed to load', e);
    } finally {
      setLoading(false);
    }
  };

  // Filter by date range
  const filteredTrades = useMemo(() => {
    if (dateRange === 'all') return trades;
    const now = new Date();
    const days = dateRange === '7d' ? 7 : 30;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    return trades.filter(t => (t.entryTime || '') >= cutoff);
  }, [trades, dateRange]);

  const filteredLog = useMemo(() => {
    if (dateRange === 'all') return log;
    const now = new Date();
    const days = dateRange === '7d' ? 7 : 30;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    return log.filter(e => (e.timestamp || '') >= cutoff);
  }, [log, dateRange]);

  // Compute consistency factors
  const factors = useMemo((): ConsistencyFactor[] => {
    const sorted = [...filteredTrades].sort((a, b) => (a.entryTime || '').localeCompare(b.entryTime || ''));
    if (sorted.length < 3) return [];

    const result: ConsistencyFactor[] = [];

    // Group trades by day
    const byDay: Record<string, Trade[]> = {};
    sorted.forEach(t => {
      const date = (t.entryTime || '').split('T')[0];
      if (date) {
        if (!byDay[date]) byDay[date] = [];
        byDay[date].push(t);
      }
    });
    const tradingDays = Object.keys(byDay).sort();
    if (tradingDays.length < 2) return [];

    // 1. Position Size Consistency
    const sizes = sorted.map(t => t.size);
    const sizeStdDev = stdDev(sizes);
    const sizeMean = mean(sizes);
    const sizeCV = sizeMean > 0 ? (sizeStdDev / sizeMean) * 100 : 0; // Coefficient of variation
    const sizeScore = Math.max(0, Math.min(100, 100 - sizeCV * 2)); // Lower CV = higher score
    result.push({
      label: 'Position Size',
      description: 'How consistent your trade sizes are',
      score: Math.round(sizeScore),
      detail: `Avg: ${sizeMean.toFixed(1)} contracts, Std Dev: ${sizeStdDev.toFixed(1)} (CV: ${sizeCV.toFixed(0)}%)`,
    });

    // 2. Trade Count Consistency
    const dailyCounts = tradingDays.map(d => byDay[d].length);
    const countStdDev = stdDev(dailyCounts);
    const countMean = mean(dailyCounts);
    const countCV = countMean > 0 ? (countStdDev / countMean) * 100 : 0;
    const countScore = Math.max(0, Math.min(100, 100 - countCV * 1.5));
    result.push({
      label: 'Trade Count',
      description: 'How consistent your daily trade frequency is',
      score: Math.round(countScore),
      detail: `Avg: ${countMean.toFixed(1)} trades/day, Std Dev: ${countStdDev.toFixed(1)} (CV: ${countCV.toFixed(0)}%)`,
    });

    // 3. Session Start Consistency (first trade time of day)
    const startMinutes = tradingDays.map(d => {
      const first = byDay[d][0];
      const date = new Date(first.entryTime);
      return date.getHours() * 60 + date.getMinutes();
    });
    const startStdDev = stdDev(startMinutes);
    const startScore = Math.max(0, Math.min(100, 100 - startStdDev * 1.5)); // Lower std dev in minutes = better
    const startMean = mean(startMinutes);
    result.push({
      label: 'Session Start',
      description: 'How consistently you begin trading at the same time',
      score: Math.round(startScore),
      detail: `Avg start: ${minutesToTime(startMean)}, Std Dev: ${startStdDev.toFixed(0)} min`,
    });

    // 4. Session End Consistency (last trade time of day)
    const endMinutes = tradingDays.map(d => {
      const last = byDay[d][byDay[d].length - 1];
      const date = new Date(last.exitTime || last.entryTime);
      return date.getHours() * 60 + date.getMinutes();
    });
    const endStdDev = stdDev(endMinutes);
    const endScore = Math.max(0, Math.min(100, 100 - endStdDev * 1.5));
    const endMean = mean(endMinutes);
    result.push({
      label: 'Session End',
      description: 'How consistently you stop trading at the same time',
      score: Math.round(endScore),
      detail: `Avg end: ${minutesToTime(endMean)}, Std Dev: ${endStdDev.toFixed(0)} min`,
    });

    // 5. Trading Window Consistency (% of trades within 2 std devs of mean start/end)
    const windowStart = startMean - startStdDev;
    const windowEnd = endMean + endStdDev;
    const withinWindow = sorted.filter(t => {
      const d = new Date(t.entryTime);
      const min = d.getHours() * 60 + d.getMinutes();
      return min >= windowStart && min <= windowEnd;
    }).length;
    const windowPct = sorted.length > 0 ? (withinWindow / sorted.length) * 100 : 100;
    result.push({
      label: 'Trading Window',
      description: 'Percentage of trades within your typical trading window',
      score: Math.round(windowPct),
      detail: `${withinWindow}/${sorted.length} trades within ${minutesToTime(Math.max(0, windowStart))}–${minutesToTime(Math.min(1439, windowEnd))}`,
    });

    // 6. Rule-Following Consistency (% of trading days without violations)
    const violations = filteredLog.filter(e => VIOLATION_TYPES.includes(e.type));
    const violationDays = new Set(violations.map(v => {
      const ts = v.timestamp || '';
      return ts.includes('T') ? ts.split('T')[0] : ts.split(' ')[0];
    }));
    const cleanDays = tradingDays.filter(d => !violationDays.has(d)).length;
    const ruleScore = tradingDays.length > 0 ? (cleanDays / tradingDays.length) * 100 : 100;
    result.push({
      label: 'Rule-Following',
      description: 'Percentage of trading days with zero violations',
      score: Math.round(ruleScore),
      detail: `${cleanDays}/${tradingDays.length} days clean (${violationDays.size} days with violations)`,
    });

    return result;
  }, [filteredTrades, filteredLog]);

  // Overall score (average of all factors)
  const overallScore = useMemo(() => {
    if (factors.length === 0) return 0;
    return Math.round(factors.reduce((sum, f) => sum + f.score, 0) / factors.length);
  }, [factors]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: `${colors.primary}30`, borderTopColor: colors.primary }} />
      </div>
    );
  }

  const tradingDays = new Set(filteredTrades.map(t => (t.entryTime || '').split('T')[0])).size;
  const hasEnoughData = filteredTrades.length >= 3 && tradingDays >= 2;

  return (
    <div className="max-w-lg animate-reveal">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`, border: `1px solid ${colors.primary}20` }}>
          <Ruler size={18} style={{ color: colors.primary, filter: `drop-shadow(0 0 4px ${colors.primary}50)` }} />
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gradient">Consistency</h2>
          <p className="text-[0.6rem] text-white/30">Measurable behavioral consistency</p>
        </div>
      </div>

      {/* Date Range */}
      <div className="flex gap-2 mb-6">
        {(['7d', '30d', 'all'] as const).map(range => (
          <button
            key={range}
            onClick={() => setDateRange(range)}
            className="px-3 py-1.5 rounded-lg text-[0.6rem] font-bold uppercase tracking-[1.5px] transition-all"
            style={{
              background: dateRange === range ? `${colors.primary}20` : 'transparent',
              border: `1px solid ${dateRange === range ? colors.primary + '40' : 'rgba(255,255,255,0.06)'}`,
              color: dateRange === range ? colors.primary : 'rgba(255,255,255,0.3)',
            }}
          >
            {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Sample Info */}
      <div className="mb-5 px-4 py-3 rounded-xl border border-white/[0.04] bg-white/[0.01]">
        <div className="flex items-center justify-between">
          <span className="text-[0.6rem] text-white/30 uppercase tracking-[1.5px]">Trades Analyzed</span>
          <span className="text-sm font-bold font-mono" style={{ color: colors.primary }}>{filteredTrades.length}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[0.6rem] text-white/30 uppercase tracking-[1.5px]">Trading Days</span>
          <span className="text-sm font-bold font-mono" style={{ color: colors.primary }}>{tradingDays}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[0.6rem] text-white/30 uppercase tracking-[1.5px]">Confidence</span>
          <span className="text-[0.6rem] font-bold" style={{ color: tradingDays >= 15 ? colors.primary : tradingDays >= 5 ? '#fbbf24' : '#ef4444' }}>
            {tradingDays >= 15 ? 'High' : tradingDays >= 5 ? 'Moderate' : 'Low'}
          </span>
        </div>
      </div>

      {!hasEnoughData ? (
        <div className="relative rounded-xl p-8 overflow-hidden card-premium text-center">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}20, transparent)` }} />
          <div className="relative z-10">
            <Ruler size={20} style={{ color: colors.primary }} className="mb-2" />
            <p className="text-sm font-semibold text-white/50 mb-1">Not Enough Data</p>
            <p className="text-[0.6rem] text-white/25">Need at least 3 trades across 2 different days to measure consistency.</p>
            <p className="text-[0.6rem] text-white/15 mt-2">Current: {filteredTrades.length} trades, {tradingDays} days</p>
          </div>
        </div>
      ) : (
        <>
          {/* Overall Score */}
          <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-5">
            <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)` }} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase" style={{ color: `${colors.primary}80` }}>Overall Consistency</p>
                <span className="text-3xl font-black font-mono" style={{ color: getScoreColor(overallScore, colors) }}>
                  {overallScore}<span className="text-sm text-white/20">/100</span>
                </span>
              </div>

              {/* Overall bar */}
              <div className="h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${overallScore}%`, background: `linear-gradient(90deg, ${getScoreColor(overallScore, colors)}, ${colors.secondary})` }} />
              </div>

              <p className="text-[0.6rem] text-white/25 mt-3">{getScoreLabel(overallScore)}</p>
            </div>
          </div>

          {/* Factor Breakdown */}
          <div className="space-y-3">
            {factors.map((factor, idx) => (
              <div key={idx} className="relative rounded-xl p-4 overflow-hidden card-premium">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs font-bold text-white/60">{factor.label}</span>
                      <p className="text-[0.55rem] text-white/25">{factor.description}</p>
                    </div>
                    <span className="text-lg font-black font-mono" style={{ color: getScoreColor(factor.score, colors) }}>
                      {factor.score}
                    </span>
                  </div>

                  {/* Factor bar */}
                  <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden mb-1.5">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${factor.score}%`, background: getScoreColor(factor.score, colors) }} />
                  </div>

                  {/* Detail */}
                  <p className="text-[0.5rem] text-white/20 font-mono">{factor.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Calculation Explanation */}
          <div className="mt-6 px-4 py-3 rounded-xl border border-white/[0.03] bg-white/[0.01]">
            <p className="text-[0.55rem] font-bold text-white/25 uppercase tracking-[1.5px] mb-2">How It's Calculated</p>
            <div className="space-y-1 text-[0.55rem] text-white/20">
              <p>Position Size: Lower coefficient of variation = higher score</p>
              <p>Trade Count: Lower daily count variation = higher score</p>
              <p>Session Start/End: Lower time variation (std dev in minutes) = higher score</p>
              <p>Trading Window: % of trades within your typical hours</p>
              <p>Rule-Following: % of trading days with zero violations</p>
            </div>
          </div>

          {/* Footnote */}
          <p className="text-[0.5rem] text-white/15 text-center mt-4 italic">
            Measures observable behavior only. Does not measure emotions.
            Based on {filteredTrades.length} trades across {tradingDays} days.
          </p>
        </>
      )}
    </div>
  );
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function getScoreColor(score: number, colors: any): string {
  if (score >= 80) return colors.primary;
  if (score >= 60) return '#fbbf24';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Highly consistent — robot-like discipline';
  if (score >= 75) return 'Consistent — solid routine';
  if (score >= 60) return 'Moderate — some variation in habits';
  if (score >= 40) return 'Inconsistent — behavior varies significantly';
  return 'Very inconsistent — no established routine';
}
