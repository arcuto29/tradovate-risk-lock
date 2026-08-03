import React, { useState, useEffect } from 'react';
import { BarChart3, ShieldCheck } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

export const Analytics: React.FC = () => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [todayScore, setTodayScore] = useState(100);
  const [violations, setViolations] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);
  const [todayTrades, setTodayTrades] = useState(0);
  const [todayPnL, setTodayPnL] = useState(0);
  const [totalBlocked, setTotalBlocked] = useState(0);
  const [totalViolations, setTotalViolations] = useState(0);
  const [ruleFollowedDays, setRuleFollowedDays] = useState(0);
  const [violationDays, setViolationDays] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [score, trades, log] = await Promise.all([
        window.electronAPI.getDisciplineScore(),
        window.electronAPI.getTrades(500),
        window.electronAPI.getActivityLog(2000),
      ]);

      if (score) {
        setTodayScore(score.todayScore);
        setViolations(score.violations || []);
        setStreak(score.streak);
      }

      // Today's trades and P&L
      const today = new Date().toISOString().split('T')[0];
      const todaysTrades = (trades || []).filter((t: any) => t.entryTime?.startsWith(today));
      setTodayTrades(todaysTrades.length);
      setTodayPnL(todaysTrades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0));

      // Count blocked orders and violations from activity log
      const violationTypes = ['size_blocked', 'session_blocked', 'symbol_blocked', 'coach_blocked', 'stacking_blocked', 'bypass_attempt'];
      const allViolations = (log || []).filter((e: any) => violationTypes.includes(e.type));
      setTotalBlocked(allViolations.length);
      setTotalViolations(allViolations.length);

      // Rule-following vs violation days (last 30 days)
      const last30: Record<string, boolean> = {};
      allViolations.forEach((v: any) => {
        const ts = v.timestamp || '';
        const date = ts.includes('T') ? ts.split('T')[0] : ts.split(' ')[0];
        if (date) last30[date] = true;
      });
      const vDays = Object.keys(last30).length;
      setViolationDays(vDays);
      setRuleFollowedDays(Math.max(0, 30 - vDays));
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <span className="text-white/20 text-sm animate-pulse">Loading...</span>;

  const getGrade = (score: number) => {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'A-';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'B-';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  };

  const grade = getGrade(todayScore);

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 animate-reveal">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`, border: `1px solid ${colors.primary}20`}}>
          <BarChart3 size={18} style={{color: colors.primary, filter: `drop-shadow(0 0 4px ${colors.primary}50)`}} />
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gradient">Today</h2>
          <p className="text-[0.6rem] text-white/30">Your session at a glance</p>
        </div>
      </div>

      {/* Daily Report Card */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-5 animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)`}} />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase" style={{color: `${colors.primary}80`}}>Daily Report Card</p>
            <span className="text-2xl font-black font-mono" style={{color: todayScore >= 80 ? colors.primary : todayScore >= 60 ? '#fbbf24' : '#ef4444'}}>{grade}</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className={`text-xl font-black font-mono ${todayPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {todayPnL >= 0 ? '+' : ''}{todayPnL.toFixed(0)}
              </p>
              <p className="text-[0.55rem] text-white/25 uppercase tracking-[1px] mt-1">P&L</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-black font-mono" style={{color: colors.primary}}>{todayScore}</p>
              <p className="text-[0.55rem] text-white/25 uppercase tracking-[1px] mt-1">Discipline</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-black font-mono text-white/60">{todayTrades}</p>
              <p className="text-[0.55rem] text-white/25 uppercase tracking-[1px] mt-1">Trades</p>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Violations */}
      <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5 animate-reveal">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase" style={{color: `${colors.secondary}80`}}>Today's Violations</p>
            <span className="text-sm font-bold font-mono" style={{color: violations.length === 0 ? colors.primary : '#ef4444'}}>
              {violations.length === 0 ? 'Clean' : violations.length}
            </span>
          </div>
          {violations.length === 0 ? (
            <p className="text-xs text-white/30">No rules broken today. Keep it up.</p>
          ) : (
            <div className="space-y-1.5">
              {violations.map((v, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-red-400/[0.04] border border-red-400/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span className="text-xs text-white/50">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Streak + Rule Following */}
      <div className="grid grid-cols-2 gap-3 mb-5 animate-reveal">
        <div className="relative rounded-xl p-5 overflow-hidden card-premium text-center">
          <p className="text-2xl font-black font-mono" style={{color: colors.primary}}>{streak}</p>
          <p className="text-[0.55rem] text-white/25 uppercase tracking-[1px] mt-1">Day Streak</p>
          <p className="text-[0.5rem] text-white/15 mt-0.5">Consecutive 80+ days</p>
        </div>
        <div className="relative rounded-xl p-5 overflow-hidden card-premium text-center">
          <p className="text-2xl font-black font-mono" style={{color: ruleFollowedDays > violationDays ? colors.primary : '#ef4444'}}>
            {ruleFollowedDays > 0 ? Math.round((ruleFollowedDays / (ruleFollowedDays + violationDays)) * 100) : 0}%
          </p>
          <p className="text-[0.55rem] text-white/25 uppercase tracking-[1px] mt-1">Rules Followed</p>
          <p className="text-[0.5rem] text-white/15 mt-0.5">Last 30 days</p>
        </div>
      </div>

      {/* Sentinel Saved You From */}
      <div className="relative rounded-xl p-5 overflow-hidden card-premium animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.primary}30, ${colors.secondary}20, transparent)`}} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={14} className="inline" />
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase" style={{color: `${colors.primary}80`}}>Sentinel Protected You</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Orders blocked</span>
              <span className="text-sm font-bold font-mono" style={{color: colors.primary}}>{totalBlocked}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Violations caught</span>
              <span className="text-sm font-bold font-mono" style={{color: colors.primary}}>{totalViolations}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Clean days (30d)</span>
              <span className="text-sm font-bold font-mono" style={{color: colors.primary}}>{ruleFollowedDays}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Current streak</span>
              <span className="text-sm font-bold font-mono" style={{color: colors.primary}}>{streak} days</span>
            </div>
          </div>
          {totalBlocked > 0 && (
            <p className="text-[0.6rem] text-white/20 mt-4 text-center italic">
              Sentinel blocked {totalBlocked} orders that would have broken your rules.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
