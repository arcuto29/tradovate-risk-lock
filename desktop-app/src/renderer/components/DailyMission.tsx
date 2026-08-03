import React, { useState, useEffect, useMemo } from 'react';
import { Target } from 'lucide-react';
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

interface Mission {
  id: string;
  title: string;
  description: string;
  icon: string;
  reason: string;
}

const VIOLATION_TYPES = ['size_blocked', 'session_blocked', 'symbol_blocked', 'coach_blocked', 'stacking_blocked', 'bypass_attempt'];

/**
 * Daily Mission - One discipline mission per day based on recent behavior
 * 
 * Selection is deterministic per day (seeded by date).
 * Mission is chosen based on which behavior pattern needs the most work.
 * Only ONE mission per day — never overloads the trader.
 * 
 * All logic is rule-based. No AI, no randomness (beyond date seed).
 */
export const DailyMission: React.FC = () => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(() => {
    const stored = localStorage.getItem('sentinel-mission-completed');
    if (!stored) return false;
    try {
      const { date } = JSON.parse(stored);
      return date === new Date().toISOString().split('T')[0];
    } catch { return false; }
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [t, l] = await Promise.all([
        window.electronAPI.getTrades(2000),
        window.electronAPI.getActivityLog(5000),
      ]);
      setTrades(t || []);
      setLog(l || []);
    } catch (e) {
      console.error('DailyMission: failed to load', e);
    } finally {
      setLoading(false);
    }
  };

  // Analyze recent behavior (last 7 days) to pick the most relevant mission
  const todaysMission = useMemo((): Mission | null => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Recent trades (last 7 days)
    const recentTrades = trades.filter(t => (t.entryTime || '') >= sevenDaysAgo);
    // Recent violations
    const recentViolations = log.filter(e => {
      if (!VIOLATION_TYPES.includes(e.type)) return false;
      const ts = e.timestamp || '';
      return ts >= sevenDaysAgo;
    });

    if (recentTrades.length === 0 && recentViolations.length === 0) return null;

    // ─── BEHAVIOR SCORES (higher = worse behavior, needs mission) ─────────
    const scores: { mission: Mission; score: number }[] = [];

    // 1. Overtrading: too many trades per day
    const tradeDays = new Set(recentTrades.map(t => (t.entryTime || '').split('T')[0])).size || 1;
    const tradesPerDay = recentTrades.length / tradeDays;
    if (tradesPerDay > 3) {
      scores.push({
        score: tradesPerDay,
        mission: {
          id: 'limit_trades',
          title: 'Take no more than 3 trades today',
          description: `You've averaged ${Math.round(tradesPerDay * 10) / 10} trades/day this week. Today, prove you can be selective.`,
          icon: '◎',
          reason: `Based on ${recentTrades.length} trades over ${tradeDays} days (avg ${Math.round(tradesPerDay * 10) / 10}/day)`,
        },
      });
    }

    // 2. Rapid re-entry after losses
    let rapidReentries = 0;
    const sortedRecent = [...recentTrades].sort((a, b) => (a.entryTime || '').localeCompare(b.entryTime || ''));
    for (let i = 0; i < sortedRecent.length - 1; i++) {
      if (sortedRecent[i].result === 'loss') {
        const exitTime = new Date(sortedRecent[i].exitTime || sortedRecent[i].entryTime).getTime();
        const nextEntry = new Date(sortedRecent[i + 1].entryTime).getTime();
        if (nextEntry - exitTime < 60000) rapidReentries++; // < 1 min
      }
    }
    if (rapidReentries > 0) {
      scores.push({
        score: rapidReentries * 3,
        mission: {
          id: 'wait_after_loss',
          title: 'Wait 5 minutes after every loss',
          description: `You had ${rapidReentries} rapid re-entries after losses this week. Give yourself time to reset.`,
          icon: '◷',
          reason: `Based on ${rapidReentries} trades entered within 1 minute of a loss (last 7 days)`,
        },
      });
    }

    // 3. Size violations
    const sizeViolations = recentViolations.filter(v => v.type === 'size_blocked').length;
    if (sizeViolations > 0) {
      scores.push({
        score: sizeViolations * 2,
        mission: {
          id: 'respect_size',
          title: 'Do not increase position size today',
          description: `Sentinel blocked ${sizeViolations} oversized orders this week. Trade your normal size.`,
          icon: '▱',
          reason: `Based on ${sizeViolations} size-blocked events in the last 7 days`,
        },
      });
    }

    // 4. Trading outside session
    const sessionViolations = recentViolations.filter(v => v.type === 'session_blocked').length;
    if (sessionViolations > 0) {
      scores.push({
        score: sessionViolations * 2.5,
        mission: {
          id: 'respect_session',
          title: 'Only trade during your session window',
          description: `${sessionViolations} trades were attempted outside your session hours. Respect the boundaries you set.`,
          icon: '◷',
          reason: `Based on ${sessionViolations} session-blocked events in the last 7 days`,
        },
      });
    }

    // 5. Losing streak without stopping
    let maxConsecLosses = 0;
    let curLosses = 0;
    for (const t of sortedRecent) {
      if (t.result === 'loss') { curLosses++; maxConsecLosses = Math.max(maxConsecLosses, curLosses); }
      else curLosses = 0;
    }
    if (maxConsecLosses >= 3) {
      scores.push({
        score: maxConsecLosses * 1.5,
        mission: {
          id: 'stop_after_target',
          title: 'Stop trading after 2 consecutive losses',
          description: `You had a ${maxConsecLosses}-loss streak this week. Set a hard stop after 2 losses in a row.`,
          icon: '⬡',
          reason: `Based on max consecutive loss streak of ${maxConsecLosses} in the last 7 days`,
        },
      });
    }

    // 6. Bypass attempts
    const bypassAttempts = recentViolations.filter(v => v.type === 'bypass_attempt').length;
    if (bypassAttempts > 0) {
      scores.push({
        score: bypassAttempts * 4,
        mission: {
          id: 'trust_rules',
          title: 'Trust your rules — do not attempt bypass',
          description: `You tried to bypass Sentinel ${bypassAttempts} time${bypassAttempts > 1 ? 's' : ''} this week. The rules exist for a reason.`,
          icon: '▲',
          reason: `Based on ${bypassAttempts} bypass attempts in the last 7 days`,
        },
      });
    }

    // 7. Low win rate — focus on quality
    const winRate = recentTrades.length > 0 ? (recentTrades.filter(t => t.result === 'win').length / recentTrades.length) * 100 : 50;
    if (winRate < 40 && recentTrades.length >= 5) {
      scores.push({
        score: (50 - winRate) / 5,
        mission: {
          id: 'quality_over_quantity',
          title: 'Only take A+ setups today',
          description: `Your win rate was ${Math.round(winRate)}% this week. Be extremely selective — quality over quantity.`,
          icon: '◆',
          reason: `Based on ${Math.round(winRate)}% win rate across ${recentTrades.length} trades (last 7 days)`,
        },
      });
    }

    // 8. Default fallback — general discipline
    if (scores.length === 0) {
      scores.push({
        score: 1,
        mission: {
          id: 'follow_plan',
          title: 'Follow your trading plan exactly',
          description: 'No specific issues detected. Focus on executing your plan with precision today.',
          icon: '✓',
          reason: 'No behavioral issues detected in the last 7 days — maintaining discipline',
        },
      });
    }

    // ─── SELECT MISSION ───────────────────────────────────────────────────
    // Sort by score (worst behavior first), then use date as tiebreaker
    // This ensures the same mission shows all day (deterministic per date)
    scores.sort((a, b) => b.score - a.score);

    // Use date hash to rotate if multiple missions have similar scores
    const dateHash = today.split('-').reduce((h, v) => h + parseInt(v), 0);
    const topScoreThreshold = scores[0].score * 0.8;
    const candidates = scores.filter(s => s.score >= topScoreThreshold);
    const selected = candidates[dateHash % candidates.length];

    return selected.mission;
  }, [trades, log]);

  const markCompleted = () => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('sentinel-mission-completed', JSON.stringify({ date: today }));
    setCompleted(true);
  };

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
          <Target size={18} style={{ color: colors.primary, filter: `drop-shadow(0 0 4px ${colors.primary}50)` }} />
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gradient">Daily Mission</h2>
          <p className="text-[0.6rem] text-white/30">One focus. One day. Full commitment.</p>
        </div>
      </div>

      {!todaysMission ? (
        <div className="relative rounded-xl p-8 overflow-hidden card-premium text-center">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}20, transparent)` }} />
          <div className="relative z-10">
            <p className="text-2xl mb-2">◻</p>
            <p className="text-sm font-semibold text-white/50 mb-1">No Mission Yet</p>
            <p className="text-[0.6rem] text-white/25">Start trading with Sentinel to generate daily missions based on your behavior.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Mission Card */}
          <div className={`relative rounded-xl p-6 overflow-hidden card-premium ${completed ? 'opacity-70' : ''}`}>
            <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}40, ${colors.secondary}30, transparent)` }} />
            {/* Subtle glow when active */}
            {!completed && (
              <div className="absolute inset-0 rounded-xl" style={{ boxShadow: `inset 0 0 30px ${colors.primary}08` }} />
            )}
            <div className="relative z-10">
              {/* Status badge */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[0.55rem] font-bold tracking-[2px] uppercase" style={{ color: `${colors.primary}60` }}>
                  Today's Mission
                </span>
                {completed ? (
                  <span className="px-2.5 py-1 rounded-full text-[0.55rem] font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                    ✓ Completed
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[0.55rem] font-bold border" style={{ background: `${colors.primary}10`, borderColor: `${colors.primary}25`, color: colors.primary }}>
                    Active
                  </span>
                )}
              </div>

              {/* Mission icon + title */}
              <div className="flex items-start gap-4 mb-4">
                <span className="text-3xl">{todaysMission.icon}</span>
                <div>
                  <h3 className="text-lg font-black text-white/90 leading-tight">{todaysMission.title}</h3>
                  <p className="text-xs text-white/40 mt-2 leading-relaxed">{todaysMission.description}</p>
                </div>
              </div>

              {/* Complete button */}
              {!completed && (
                <button
                  onClick={markCompleted}
                  className="w-full mt-4 py-3 rounded-xl text-[0.7rem] font-bold uppercase tracking-[2px] transition-all press-scale"
                  style={{
                    background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`,
                    border: `1px solid ${colors.primary}30`,
                    color: colors.primary,
                  }}
                >
                  Mark as Completed
                </button>
              )}
            </div>
          </div>

          {/* Why this mission */}
          <div className="mt-4 px-4 py-3 rounded-xl border border-white/[0.04] bg-white/[0.01]">
            <p className="text-[0.55rem] font-bold text-white/25 uppercase tracking-[1.5px] mb-1.5">Why This Mission</p>
            <p className="text-[0.6rem] text-white/30 leading-relaxed">{todaysMission.reason}</p>
          </div>

          {/* How it works */}
          <div className="mt-4 px-4 py-3 rounded-xl border border-white/[0.03] bg-white/[0.005]">
            <p className="text-[0.55rem] font-bold text-white/20 uppercase tracking-[1.5px] mb-1.5">How Missions Work</p>
            <div className="space-y-1 text-[0.55rem] text-white/15">
              <p>• One mission per day, chosen from your last 7 days of behavior</p>
              <p>• Targets your weakest area (most violations or worst pattern)</p>
              <p>• Self-reported completion — it's between you and your discipline</p>
              <p>• Resets daily at midnight</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
