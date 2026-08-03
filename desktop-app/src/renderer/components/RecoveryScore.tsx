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

interface ScoreFactor {
  label: string;
  description: string;
  points: number;
  maxPoints: number;
  passed: boolean;
}

interface RecoverySession {
  date: string;
  losstrade: Trade;
  factors: ScoreFactor[];
  totalScore: number;
  maxScore: number;
}

const VIOLATION_TYPES = ['size_blocked', 'session_blocked', 'symbol_blocked', 'coach_blocked', 'stacking_blocked', 'bypass_attempt'];

/**
 * Recovery Score - Transparent post-loss behavior scoring
 * 
 * Measures how well the trader behaved AFTER a loss.
 * Every point is explained. No hidden calculations.
 * 
 * Factors:
 * 1. Waited required cooldown (+25)
 * 2. Did not increase size (+25)
 * 3. No rapid re-entry (+20)
 * 4. Followed rules (no violations) (+20)
 * 5. Stopped after circuit breaker (+10)
 */
export const RecoveryScore: React.FC = () => {
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
      console.error('RecoveryScore: failed to load', e);
    } finally {
      setLoading(false);
    }
  };

  // Filter trades by date range
  const filteredTrades = useMemo(() => {
    if (dateRange === 'all') return trades;
    const now = new Date();
    const days = dateRange === '7d' ? 7 : 30;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    return trades.filter(t => (t.entryTime || '') >= cutoff);
  }, [trades, dateRange]);

  // Calculate recovery scores for each loss
  const recoverySessions = useMemo((): RecoverySession[] => {
    const sessions: RecoverySession[] = [];
    
    // Sort trades chronologically (oldest first)
    const sorted = [...filteredTrades].sort((a, b) => (a.entryTime || '').localeCompare(b.entryTime || ''));
    
    // Get violations from log
    const violations = log.filter(e => VIOLATION_TYPES.includes(e.type));

    for (let i = 0; i < sorted.length; i++) {
      const trade = sorted[i];
      if (trade.result !== 'loss' || trade.pnl >= 0) continue;

      const lossTime = new Date(trade.exitTime || trade.entryTime).getTime();
      const lossDate = (trade.entryTime || '').split('T')[0];
      
      // Find next trade after this loss
      const nextTrade = sorted[i + 1];
      const nextTradeTime = nextTrade ? new Date(nextTrade.entryTime).getTime() : null;
      
      // Find all trades on same day after this loss
      const sameDayTradesAfter = sorted.slice(i + 1).filter(t => (t.entryTime || '').startsWith(lossDate));
      
      // Find violations between this loss and next trade (or end of day)
      const endWindow = nextTradeTime || (lossTime + 24 * 60 * 60 * 1000);
      const violationsAfterLoss = violations.filter(v => {
        const vTime = new Date(v.timestamp.includes('T') ? v.timestamp : v.timestamp.replace(' ', 'T')).getTime();
        return vTime > lossTime && vTime < endWindow;
      });

      const factors: ScoreFactor[] = [];

      // Factor 1: Waited required cooldown (+25)
      // Cooldown = at least 2 minutes between loss exit and next entry
      const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes minimum
      let waitedCooldown = true;
      if (nextTrade && nextTradeTime) {
        const gap = nextTradeTime - lossTime;
        waitedCooldown = gap >= COOLDOWN_MS;
      }
      // If no next trade, they stopped (which is even better)
      factors.push({
        label: 'Waited cooldown',
        description: nextTrade 
          ? (waitedCooldown ? `Waited ${formatGap(nextTradeTime! - lossTime)} before next trade` : `Re-entered after only ${formatGap(nextTradeTime! - lossTime)}`)
          : 'No trade after loss (stopped)',
        points: waitedCooldown ? 25 : 0,
        maxPoints: 25,
        passed: waitedCooldown,
      });

      // Factor 2: Did not increase size (+25)
      let sizeIncreased = false;
      if (nextTrade && nextTrade.entryTime?.startsWith(lossDate)) {
        sizeIncreased = nextTrade.size > trade.size;
      }
      factors.push({
        label: 'Did not increase size',
        description: sizeIncreased 
          ? `Increased from ${trade.size} to ${nextTrade!.size} contracts`
          : (nextTrade && nextTrade.entryTime?.startsWith(lossDate) ? `Kept size at ${nextTrade.size} (loss was ${trade.size})` : 'No subsequent trade to compare'),
        points: sizeIncreased ? 0 : 25,
        maxPoints: 25,
        passed: !sizeIncreased,
      });

      // Factor 3: No rapid re-entry (+20)
      // Rapid = within 30 seconds
      const RAPID_MS = 30 * 1000;
      let rapidReentry = false;
      if (nextTrade && nextTradeTime) {
        rapidReentry = (nextTradeTime - lossTime) < RAPID_MS;
      }
      factors.push({
        label: 'No rapid re-entry',
        description: rapidReentry 
          ? `Re-entered within ${Math.round((nextTradeTime! - lossTime) / 1000)}s`
          : (nextTrade ? 'Took time before next entry' : 'Did not re-enter'),
        points: rapidReentry ? 0 : 20,
        maxPoints: 20,
        passed: !rapidReentry,
      });

      // Factor 4: Followed rules (+20)
      // No violations between this loss and end of window
      const hasViolations = violationsAfterLoss.length > 0;
      factors.push({
        label: 'Followed rules',
        description: hasViolations 
          ? `${violationsAfterLoss.length} violation${violationsAfterLoss.length > 1 ? 's' : ''} after loss`
          : 'No rule violations after loss',
        points: hasViolations ? 0 : 20,
        maxPoints: 20,
        passed: !hasViolations,
      });

      // Factor 5: Stopped after circuit breaker (+10)
      // If they had 3+ losses in a row and stopped, bonus
      const consecutiveLossesBefore = countConsecutiveLossesBefore(sorted, i);
      const stoppedAfterStreak = consecutiveLossesBefore >= 2 && sameDayTradesAfter.length === 0;
      // Only applies if there were multiple consecutive losses
      if (consecutiveLossesBefore >= 2) {
        factors.push({
          label: 'Stopped after streak',
          description: stoppedAfterStreak 
            ? `Stopped after ${consecutiveLossesBefore + 1} consecutive losses`
            : `Continued trading after ${consecutiveLossesBefore + 1} consecutive losses`,
          points: stoppedAfterStreak ? 10 : 0,
          maxPoints: 10,
          passed: stoppedAfterStreak,
        });
      } else {
        factors.push({
          label: 'Stopped after circuit breaker',
          description: 'N/A — no loss streak (single loss)',
          points: 10, // Give benefit of the doubt for single losses
          maxPoints: 10,
          passed: true,
        });
      }

      const totalScore = factors.reduce((sum, f) => sum + f.points, 0);
      const maxScore = factors.reduce((sum, f) => sum + f.maxPoints, 0);

      sessions.push({
        date: lossDate,
        lossTrace: trade,
        lossTradeId: trade.id,
        lossTime: trade.exitTime || trade.entryTime,
        lossAmount: trade.pnl,
        lossSymbol: trade.symbol,
        lossSize: trade.size,
        lossDirection: trade.direction,
        factors,
        totalScore,
        maxScore,
      } as any);
    }

    // Return most recent first
    return sessions.reverse();
  }, [filteredTrades, log, dateRange]);

  // Average score
  const averageScore = useMemo(() => {
    if (recoverySessions.length === 0) return 0;
    const total = recoverySessions.reduce((sum, s) => sum + s.totalScore, 0);
    return Math.round(total / recoverySessions.length);
  }, [recoverySessions]);

  // Trend (compare first half vs second half)
  const trend = useMemo(() => {
    if (recoverySessions.length < 4) return null;
    const mid = Math.floor(recoverySessions.length / 2);
    const recentHalf = recoverySessions.slice(0, mid);
    const olderHalf = recoverySessions.slice(mid);
    const recentAvg = recentHalf.reduce((s, r) => s + r.totalScore, 0) / recentHalf.length;
    const olderAvg = olderHalf.reduce((s, r) => s + r.totalScore, 0) / olderHalf.length;
    return { recent: Math.round(recentAvg), older: Math.round(olderAvg), improving: recentAvg > olderAvg };
  }, [recoverySessions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: `${colors.primary}30`, borderTopColor: colors.primary }} />
      </div>
    );
  }

  const sampleSize = recoverySessions.length;
  const hasEnoughData = sampleSize >= 2;

  return (
    <div className="max-w-lg animate-reveal">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`, border: `1px solid ${colors.primary}20` }}>
          <span className="text-lg" style={{ filter: `drop-shadow(0 0 4px ${colors.primary}50)` }}>💪</span>
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gradient">Recovery</h2>
          <p className="text-[0.6rem] text-white/30">How you behave after losses</p>
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

      {/* Sample Size */}
      <div className="mb-5 px-4 py-3 rounded-xl border border-white/[0.04] bg-white/[0.01]">
        <div className="flex items-center justify-between">
          <span className="text-[0.6rem] text-white/30 uppercase tracking-[1.5px]">Losses Analyzed</span>
          <span className="text-sm font-bold font-mono" style={{ color: colors.primary }}>{sampleSize}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[0.6rem] text-white/30 uppercase tracking-[1.5px]">Confidence</span>
          <span className="text-[0.6rem] font-bold" style={{ color: sampleSize >= 15 ? colors.primary : sampleSize >= 5 ? '#fbbf24' : '#ef4444' }}>
            {sampleSize >= 15 ? 'High' : sampleSize >= 5 ? 'Moderate' : 'Low'}
          </span>
        </div>
      </div>

      {!hasEnoughData ? (
        <div className="relative rounded-xl p-8 overflow-hidden card-premium text-center">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}20, transparent)` }} />
          <div className="relative z-10">
            <p className="text-2xl mb-2">📊</p>
            <p className="text-sm font-semibold text-white/50 mb-1">Not Enough Data</p>
            <p className="text-[0.6rem] text-white/25">Need at least 2 losing trades to calculate recovery scores.</p>
            <p className="text-[0.6rem] text-white/15 mt-2">Current: {sampleSize} loss{sampleSize !== 1 ? 'es' : ''}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Average Score Card */}
          <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-5">
            <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)` }} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase" style={{ color: `${colors.primary}80` }}>Average Recovery Score</p>
                <span className="text-3xl font-black font-mono" style={{ color: getScoreColor(averageScore, colors) }}>
                  {averageScore}<span className="text-sm text-white/20">/100</span>
                </span>
              </div>
              
              {/* Score bar */}
              <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${averageScore}%`, background: `linear-gradient(90deg, ${getScoreColor(averageScore, colors)}, ${colors.secondary})` }} />
              </div>

              {/* Grade */}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-white/30">{getScoreLabel(averageScore)}</span>
                {trend && (
                  <span className="text-[0.6rem] font-bold" style={{ color: trend.improving ? '#10b981' : '#ef4444' }}>
                    {trend.improving ? '↑' : '↓'} {trend.improving ? '+' : ''}{trend.recent - trend.older} vs earlier
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Recent Recovery Sessions */}
          <div className="space-y-4">
            {recoverySessions.slice(0, 8).map((session, idx) => (
              <div key={idx} className="relative rounded-xl p-5 overflow-hidden card-premium">
                <div className="relative z-10">
                  {/* Session Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-[0.6rem] text-white/25 font-mono">{formatDate(session.date)}</span>
                      <p className="text-xs text-white/50 mt-0.5">
                        Loss: <span className="text-red-400 font-bold">${Math.abs((session as any).lossAmount || 0).toFixed(0)}</span>
                        {' '}<span className="text-white/25">({(session as any).lossSymbol || ''})</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black font-mono" style={{ color: getScoreColor(session.totalScore, colors) }}>
                        {session.totalScore}
                      </span>
                      <span className="text-[0.6rem] text-white/20">/{session.maxScore}</span>
                    </div>
                  </div>

                  {/* Factor Breakdown */}
                  <div className="space-y-2">
                    {session.factors.map((factor, fi) => (
                      <div key={fi} className="flex items-center gap-3">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[0.5rem] font-bold ${factor.passed ? 'bg-emerald-400/20 text-emerald-400' : 'bg-red-400/20 text-red-400'}`}>
                          {factor.passed ? '✓' : '✗'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[0.65rem] text-white/50">{factor.label}</span>
                          <p className="text-[0.5rem] text-white/20 truncate">{factor.description}</p>
                        </div>
                        <span className="text-[0.6rem] font-bold font-mono" style={{ color: factor.passed ? '#10b981' : '#ef4444' }}>
                          +{factor.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Calculation Explanation */}
          <div className="mt-6 px-4 py-3 rounded-xl border border-white/[0.03] bg-white/[0.01]">
            <p className="text-[0.55rem] font-bold text-white/25 uppercase tracking-[1.5px] mb-2">How It's Calculated</p>
            <div className="space-y-1.5 text-[0.55rem] text-white/20">
              <p>Waited required cooldown (2min+): <span className="text-white/40">+25</span></p>
              <p>Did not increase size: <span className="text-white/40">+25</span></p>
              <p>No rapid re-entry (&lt;30s): <span className="text-white/40">+20</span></p>
              <p>Followed rules (no violations): <span className="text-white/40">+20</span></p>
              <p>Stopped after loss streak (3+): <span className="text-white/40">+10</span></p>
              <p className="pt-1 border-t border-white/[0.03]">Total possible: <span className="text-white/40">100</span></p>
            </div>
          </div>

          {/* Footnote */}
          <p className="text-[0.5rem] text-white/15 text-center mt-4 italic">
            Score based on {sampleSize} losing trade{sampleSize !== 1 ? 's' : ''}.
            {sampleSize < 10 && ' Low sample — score will stabilize with more data.'}
          </p>
        </>
      )}
    </div>
  );
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

function countConsecutiveLossesBefore(trades: Trade[], index: number): number {
  let count = 0;
  for (let i = index - 1; i >= 0; i--) {
    if (trades[i].result === 'loss') count++;
    else break;
  }
  return count;
}

function formatGap(ms: number): string {
  if (ms < 1000) return '<1s';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}

function getScoreColor(score: number, colors: any): string {
  if (score >= 80) return colors.primary;
  if (score >= 60) return '#fbbf24';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent recovery discipline';
  if (score >= 75) return 'Good recovery behavior';
  if (score >= 60) return 'Moderate — room to improve';
  if (score >= 40) return 'Poor — revenge trading risk';
  return 'Critical — likely tilting after losses';
}
