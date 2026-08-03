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

interface DetectedTrigger {
  id: string;
  label: string;
  description: string;
  icon: string;
  occurrences: number;
  totalSessions: number;
  frequency: number; // percentage
  confidence: 'low' | 'moderate' | 'high';
  impact: string;
}

const VIOLATION_TYPES = ['size_blocked', 'session_blocked', 'symbol_blocked', 'coach_blocked', 'stacking_blocked', 'bypass_attempt'];
const MIN_SESSIONS = 20;
const MIN_OCCURRENCES = 3; // Pattern must appear at least 3 times

/**
 * Trigger Detector - Detects repeated behavioral patterns
 * 
 * ONLY generates insights after enough data exists (20+ sessions).
 * Never generates insights from tiny samples.
 * 
 * Patterns detected:
 * - Losing first trade → worse day
 * - Trading after lunch → lower win rate
 * - Increasing size after loss
 * - Trading after daily target hit
 * - Loss streaks on specific weekdays
 * - Worse performance after violations
 * - Overtrading after wins
 */
export const TriggerDetector: React.FC = () => {
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
      console.error('TriggerDetector: failed to load', e);
    } finally {
      setLoading(false);
    }
  };

  // Group trades by day (session)
  const sessions = useMemo(() => {
    const byDay: Record<string, Trade[]> = {};
    trades.forEach(t => {
      const date = (t.entryTime || '').split('T')[0];
      if (date) {
        if (!byDay[date]) byDay[date] = [];
        byDay[date].push(t);
      }
    });
    // Sort trades within each day
    Object.values(byDay).forEach(dayTrades => {
      dayTrades.sort((a, b) => (a.entryTime || '').localeCompare(b.entryTime || ''));
    });
    return byDay;
  }, [trades]);

  const sessionCount = Object.keys(sessions).length;

  // Detect triggers
  const triggers = useMemo((): DetectedTrigger[] => {
    if (sessionCount < MIN_SESSIONS) return [];

    const detected: DetectedTrigger[] = [];
    const sortedDays = Object.keys(sessions).sort();

    // ─── TRIGGER 1: Losing first trade → worse day P&L ─────────────────
    let daysWithFirstLoss = 0;
    let avgPnlAfterFirstLoss = 0;
    let avgPnlAfterFirstWin = 0;
    let daysWithFirstWin = 0;

    sortedDays.forEach(day => {
      const dayTrades = sessions[day];
      if (dayTrades.length === 0) return;
      const firstTrade = dayTrades[0];
      const restPnl = dayTrades.slice(1).reduce((s, t) => s + t.pnl, 0);

      if (firstTrade.result === 'loss') {
        daysWithFirstLoss++;
        avgPnlAfterFirstLoss += restPnl;
      } else {
        daysWithFirstWin++;
        avgPnlAfterFirstWin += restPnl;
      }
    });

    if (daysWithFirstLoss >= MIN_OCCURRENCES && daysWithFirstWin >= MIN_OCCURRENCES) {
      const avgAfterLoss = avgPnlAfterFirstLoss / daysWithFirstLoss;
      const avgAfterWin = avgPnlAfterFirstWin / daysWithFirstWin;
      if (avgAfterLoss < avgAfterWin - 50) { // Meaningful difference
        detected.push({
          id: 'first_trade_loss',
          label: 'Losing first trade',
          description: 'Days that start with a loss tend to have worse remaining P&L.',
          icon: '1️⃣',
          occurrences: daysWithFirstLoss,
          totalSessions: sessionCount,
          frequency: Math.round((daysWithFirstLoss / sessionCount) * 100),
          confidence: daysWithFirstLoss >= 10 ? 'high' : daysWithFirstLoss >= 5 ? 'moderate' : 'low',
          impact: `Avg rest-of-day P&L after first loss: $${avgAfterLoss.toFixed(0)} vs $${avgAfterWin.toFixed(0)} after first win`,
        });
      }
    }

    // ─── TRIGGER 2: Trading after lunch (12-1PM) → lower win rate ────────
    let lunchTrades = 0;
    let lunchWins = 0;
    let nonLunchTrades = 0;
    let nonLunchWins = 0;

    trades.forEach(t => {
      const hour = new Date(t.entryTime).getHours();
      if (hour >= 12 && hour <= 13) {
        lunchTrades++;
        if (t.result === 'win') lunchWins++;
      } else {
        nonLunchTrades++;
        if (t.result === 'win') nonLunchWins++;
      }
    });

    if (lunchTrades >= MIN_OCCURRENCES && nonLunchTrades >= MIN_OCCURRENCES) {
      const lunchWinRate = (lunchWins / lunchTrades) * 100;
      const nonLunchWinRate = (nonLunchWins / nonLunchTrades) * 100;
      if (lunchWinRate < nonLunchWinRate - 10) { // 10%+ difference
        detected.push({
          id: 'lunch_trading',
          label: 'Trading after lunch',
          description: 'Trades entered between 12-1 PM have a notably lower win rate.',
          icon: '🍽',
          occurrences: lunchTrades,
          totalSessions: trades.length,
          frequency: Math.round((lunchTrades / trades.length) * 100),
          confidence: lunchTrades >= 20 ? 'high' : lunchTrades >= 8 ? 'moderate' : 'low',
          impact: `Lunch win rate: ${lunchWinRate.toFixed(0)}% vs ${nonLunchWinRate.toFixed(0)}% at other times`,
        });
      }
    }

    // ─── TRIGGER 3: Increasing size after loss ───────────────────────────
    let sizeIncreaseAfterLoss = 0;
    let sizeIncreaseWins = 0;
    const allSorted = [...trades].sort((a, b) => (a.entryTime || '').localeCompare(b.entryTime || ''));

    for (let i = 1; i < allSorted.length; i++) {
      if (allSorted[i - 1].result === 'loss' && allSorted[i].size > allSorted[i - 1].size) {
        // Same day check
        const prevDay = (allSorted[i - 1].entryTime || '').split('T')[0];
        const currDay = (allSorted[i].entryTime || '').split('T')[0];
        if (prevDay === currDay) {
          sizeIncreaseAfterLoss++;
          if (allSorted[i].result === 'win') sizeIncreaseWins++;
        }
      }
    }

    if (sizeIncreaseAfterLoss >= MIN_OCCURRENCES) {
      const winRate = (sizeIncreaseWins / sizeIncreaseAfterLoss) * 100;
      detected.push({
        id: 'size_after_loss',
        label: 'Increasing size after loss',
        description: 'You sometimes increase position size immediately after a losing trade.',
        icon: '📈',
        occurrences: sizeIncreaseAfterLoss,
        totalSessions: sessionCount,
        frequency: Math.round((sizeIncreaseAfterLoss / trades.length) * 100),
        confidence: sizeIncreaseAfterLoss >= 10 ? 'high' : sizeIncreaseAfterLoss >= 5 ? 'moderate' : 'low',
        impact: `Win rate when sizing up after loss: ${winRate.toFixed(0)}%`,
      });
    }

    // ─── TRIGGER 4: Trading after daily target ──────────────────────────
    let daysOvertraded = 0;
    let pnlAfterTarget = 0;
    const avgDayPnl = trades.reduce((s, t) => s + t.pnl, 0) / sessionCount;
    const target = Math.max(avgDayPnl * 0.8, 100); // Use 80% of avg day P&L or $100

    sortedDays.forEach(day => {
      const dayTrades = sessions[day];
      let runningPnl = 0;
      let hitTarget = false;
      let pnlAfterHit = 0;

      dayTrades.forEach(t => {
        if (hitTarget) {
          pnlAfterHit += t.pnl;
        } else {
          runningPnl += t.pnl;
          if (runningPnl >= target) {
            hitTarget = true;
          }
        }
      });

      if (hitTarget && pnlAfterHit !== 0) {
        daysOvertraded++;
        pnlAfterTarget += pnlAfterHit;
      }
    });

    if (daysOvertraded >= MIN_OCCURRENCES) {
      const avgAfter = pnlAfterTarget / daysOvertraded;
      if (avgAfter < 0) { // Only flag if it hurts them
        detected.push({
          id: 'after_target',
          label: 'Trading after daily target',
          description: 'Continuing to trade after hitting your daily goal tends to reduce your P&L.',
          icon: '🎯',
          occurrences: daysOvertraded,
          totalSessions: sessionCount,
          frequency: Math.round((daysOvertraded / sessionCount) * 100),
          confidence: daysOvertraded >= 10 ? 'high' : daysOvertraded >= 5 ? 'moderate' : 'low',
          impact: `Avg P&L after hitting target: $${avgAfter.toFixed(0)} (gave back profits)`,
        });
      }
    }

    // ─── TRIGGER 5: Worst weekday ───────────────────────────────────────
    const weekdayPnl: Record<number, { total: number; days: number }> = {};
    sortedDays.forEach(day => {
      const d = new Date(day + 'T12:00:00');
      const wd = d.getDay();
      if (wd < 1 || wd > 5) return;
      if (!weekdayPnl[wd]) weekdayPnl[wd] = { total: 0, days: 0 };
      weekdayPnl[wd].total += sessions[day].reduce((s, t) => s + t.pnl, 0);
      weekdayPnl[wd].days++;
    });

    const weekdayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const weekdayAvgs = Object.entries(weekdayPnl).map(([wd, data]) => ({
      weekday: parseInt(wd),
      avg: data.total / data.days,
      days: data.days,
    }));

    const overallAvg = weekdayAvgs.length > 0 ? weekdayAvgs.reduce((s, w) => s + w.avg, 0) / weekdayAvgs.length : 0;
    const worstDay = weekdayAvgs.filter(w => w.days >= 3).sort((a, b) => a.avg - b.avg)[0];

    if (worstDay && worstDay.avg < overallAvg - 100 && worstDay.days >= MIN_OCCURRENCES) {
      detected.push({
        id: 'worst_weekday',
        label: `${weekdayNames[worstDay.weekday]} trading`,
        description: `Your results on ${weekdayNames[worstDay.weekday]} are consistently below average.`,
        icon: '📅',
        occurrences: worstDay.days,
        totalSessions: sessionCount,
        frequency: Math.round((worstDay.days / sessionCount) * 100),
        confidence: worstDay.days >= 10 ? 'high' : worstDay.days >= 5 ? 'moderate' : 'low',
        impact: `${weekdayNames[worstDay.weekday]} avg: $${worstDay.avg.toFixed(0)}/day vs overall $${overallAvg.toFixed(0)}/day`,
      });
    }

    // ─── TRIGGER 6: Overtrading after wins ──────────────────────────────
    let overtradeDays = 0;
    let overtradePnlLost = 0;
    const avgTradesPerDay = trades.length / sessionCount;

    sortedDays.forEach(day => {
      const dayTrades = sessions[day];
      if (dayTrades.length <= avgTradesPerDay) return;

      // Check if first few trades were wins and then overtraded
      const firstThree = dayTrades.slice(0, 3);
      const firstThreeWins = firstThree.filter(t => t.result === 'win').length;
      if (firstThreeWins >= 2 && dayTrades.length > avgTradesPerDay * 1.5) {
        const excessPnl = dayTrades.slice(Math.ceil(avgTradesPerDay)).reduce((s, t) => s + t.pnl, 0);
        if (excessPnl < 0) {
          overtradeDays++;
          overtradePnlLost += excessPnl;
        }
      }
    });

    if (overtradeDays >= MIN_OCCURRENCES) {
      detected.push({
        id: 'overtrade_after_wins',
        label: 'Overtrading after wins',
        description: 'After winning early, you sometimes take excess trades that give back profits.',
        icon: '🔥',
        occurrences: overtradeDays,
        totalSessions: sessionCount,
        frequency: Math.round((overtradeDays / sessionCount) * 100),
        confidence: overtradeDays >= 8 ? 'high' : overtradeDays >= 4 ? 'moderate' : 'low',
        impact: `Avg P&L lost from excess trades: $${(overtradePnlLost / overtradeDays).toFixed(0)}/day`,
      });
    }

    // ─── TRIGGER 7: Worse performance after violations ──────────────────
    const violations = log.filter(e => VIOLATION_TYPES.includes(e.type));
    const violationDays = new Set(violations.map(v => {
      const ts = v.timestamp || '';
      return ts.includes('T') ? ts.split('T')[0] : ts.split(' ')[0];
    }));

    let pnlOnViolationDays = 0;
    let violDayCount = 0;
    let pnlOnCleanDays = 0;
    let cleanDayCount = 0;

    sortedDays.forEach(day => {
      const dayPnl = sessions[day].reduce((s, t) => s + t.pnl, 0);
      if (violationDays.has(day)) {
        pnlOnViolationDays += dayPnl;
        violDayCount++;
      } else {
        pnlOnCleanDays += dayPnl;
        cleanDayCount++;
      }
    });

    if (violDayCount >= MIN_OCCURRENCES && cleanDayCount >= MIN_OCCURRENCES) {
      const avgViolDay = pnlOnViolationDays / violDayCount;
      const avgCleanDay = pnlOnCleanDays / cleanDayCount;
      if (avgViolDay < avgCleanDay - 50) {
        detected.push({
          id: 'violation_days',
          label: 'Days with violations',
          description: 'Days where Sentinel blocks an order tend to have worse overall results.',
          icon: '🚫',
          occurrences: violDayCount,
          totalSessions: sessionCount,
          frequency: Math.round((violDayCount / sessionCount) * 100),
          confidence: violDayCount >= 10 ? 'high' : violDayCount >= 5 ? 'moderate' : 'low',
          impact: `Violation day avg: $${avgViolDay.toFixed(0)} vs clean day avg: $${avgCleanDay.toFixed(0)}`,
        });
      }
    }

    // Sort by confidence then frequency
    const confOrder = { high: 3, moderate: 2, low: 1 };
    detected.sort((a, b) => confOrder[b.confidence] - confOrder[a.confidence] || b.frequency - a.frequency);

    return detected;
  }, [trades, log, sessions, sessionCount]);

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
          <span className="text-lg" style={{ filter: `drop-shadow(0 0 4px ${colors.primary}50)` }}>🔍</span>
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gradient">Triggers</h2>
          <p className="text-[0.6rem] text-white/30">Repeated patterns from your data</p>
        </div>
      </div>

      {/* Sample Info */}
      <div className="mb-5 px-4 py-3 rounded-xl border border-white/[0.04] bg-white/[0.01]">
        <div className="flex items-center justify-between">
          <span className="text-[0.6rem] text-white/30 uppercase tracking-[1.5px]">Trading Sessions</span>
          <span className="text-sm font-bold font-mono" style={{ color: colors.primary }}>{sessionCount}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[0.6rem] text-white/30 uppercase tracking-[1.5px]">Minimum Required</span>
          <span className="text-sm font-bold font-mono text-white/30">{MIN_SESSIONS}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[0.6rem] text-white/30 uppercase tracking-[1.5px]">Status</span>
          <span className="text-[0.6rem] font-bold" style={{ color: sessionCount >= MIN_SESSIONS ? colors.primary : '#ef4444' }}>
            {sessionCount >= MIN_SESSIONS ? 'Active' : `Need ${MIN_SESSIONS - sessionCount} more sessions`}
          </span>
        </div>
      </div>

      {sessionCount < MIN_SESSIONS ? (
        <div className="relative rounded-xl p-8 overflow-hidden card-premium text-center">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}20, transparent)` }} />
          <div className="relative z-10">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm font-semibold text-white/50 mb-1">Not Enough Data</p>
            <p className="text-[0.6rem] text-white/25">
              Trigger detection requires at least {MIN_SESSIONS} trading sessions to avoid false patterns.
            </p>
            <p className="text-[0.6rem] text-white/15 mt-2">
              Current: {sessionCount} session{sessionCount !== 1 ? 's' : ''}
            </p>

            {/* Progress bar to MIN_SESSIONS */}
            <div className="mt-4 h-2 rounded-full bg-white/[0.04] overflow-hidden max-w-xs mx-auto">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, (sessionCount / MIN_SESSIONS) * 100)}%`, background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})` }}
              />
            </div>
            <p className="text-[0.5rem] text-white/15 mt-2">{Math.round((sessionCount / MIN_SESSIONS) * 100)}% to activation</p>
          </div>
        </div>
      ) : triggers.length === 0 ? (
        <div className="relative rounded-xl p-8 overflow-hidden card-premium text-center">
          <div className="relative z-10">
            <p className="text-2xl mb-2">✓</p>
            <p className="text-sm font-semibold text-white/50 mb-1">No Patterns Detected</p>
            <p className="text-[0.6rem] text-white/25">
              No repeated negative patterns found in your data. This is good — your behavior is consistent.
            </p>
            <p className="text-[0.6rem] text-white/15 mt-2">
              Analyzed {sessionCount} sessions, {trades.length} trades.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Detected Triggers */}
          <div className="space-y-4">
            {triggers.map((trigger) => (
              <div key={trigger.id} className="relative rounded-xl p-5 overflow-hidden card-premium">
                <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}15, transparent)` }} />
                <div className="relative z-10">
                  {/* Trigger Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{trigger.icon}</span>
                      <div>
                        <h3 className="text-sm font-bold text-white/70">{trigger.label}</h3>
                        <p className="text-[0.6rem] text-white/30 mt-0.5">{trigger.description}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[0.5rem] font-bold uppercase tracking-[1px] border ${
                      trigger.confidence === 'high' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' :
                      trigger.confidence === 'moderate' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' :
                      'bg-white/5 text-white/30 border-white/10'
                    }`}>
                      {trigger.confidence}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                      <p className="text-sm font-bold font-mono" style={{ color: colors.primary }}>{trigger.occurrences}</p>
                      <p className="text-[0.45rem] text-white/20 uppercase">Occurrences</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                      <p className="text-sm font-bold font-mono" style={{ color: colors.primary }}>{trigger.frequency}%</p>
                      <p className="text-[0.45rem] text-white/20 uppercase">Frequency</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                      <p className="text-sm font-bold font-mono text-white/40">{trigger.totalSessions}</p>
                      <p className="text-[0.45rem] text-white/20 uppercase">Sessions</p>
                    </div>
                  </div>

                  {/* Impact */}
                  <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <p className="text-[0.6rem] text-white/40">{trigger.impact}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="mt-6 px-4 py-3 rounded-xl border border-amber-400/10 bg-amber-400/[0.02]">
            <p className="text-[0.55rem] text-amber-300/50 leading-relaxed">
              ⚠ Patterns are correlations, not proven causes. Many factors can create these patterns.
              Use as self-awareness data, not trading rules.
            </p>
          </div>

          {/* Methodology */}
          <div className="mt-3 px-4 py-3 rounded-xl border border-white/[0.03] bg-white/[0.01]">
            <p className="text-[0.55rem] font-bold text-white/25 uppercase tracking-[1.5px] mb-2">Methodology</p>
            <div className="space-y-1 text-[0.55rem] text-white/20">
              <p>Minimum {MIN_SESSIONS} sessions required for any pattern detection</p>
              <p>Each pattern must occur at least {MIN_OCCURRENCES} times</p>
              <p>Confidence: Low (&lt;5x), Moderate (5-9x), High (10x+)</p>
              <p>Only flags patterns where measurable impact exceeds noise threshold</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
