import React, { useState, useEffect } from 'react';

interface DayScore {
  date: string;
  score: number;
  violations: string[];
}

export const DisciplineScore: React.FC = () => {
  const [todayScore, setTodayScore] = useState(100);
  const [violations, setViolations] = useState<string[]>([]);
  const [weeklyAvg, setWeeklyAvg] = useState(0);
  const [monthlyAvg, setMonthlyAvg] = useState(0);
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState<DayScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScore();
    const interval = setInterval(loadScore, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadScore = async () => {
    try {
      const data = await (window as any).electronAPI?.getDisciplineScore?.();
      if (data) {
        setTodayScore(data.todayScore);
        setViolations(data.violations || []);
        setWeeklyAvg(data.weeklyAvg);
        setMonthlyAvg(data.monthlyAvg);
        setStreak(data.streak);
        setHistory(data.history || []);
      }
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <span className="text-white/20 text-sm">Loading...</span>;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 70) return 'text-cyan-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreGlow = (score: number) => {
    if (score >= 90) return 'shadow-[0_0_20px_rgba(52,211,153,0.4)]';
    if (score >= 70) return 'shadow-[0_0_20px_rgba(56,189,248,0.4)]';
    if (score >= 50) return 'shadow-[0_0_20px_rgba(251,191,36,0.3)]';
    return 'shadow-[0_0_20px_rgba(248,113,113,0.4)]';
  };

  const getGrade = (score: number) => {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'A-';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'B-';
    if (score >= 65) return 'C+';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  };

  return (
    <div className="max-w-lg">
      <h2 className="text-4xl font-black tracking-tighter mb-3 text-glow-white">Discipline</h2>
      <p className="text-white/35 text-sm mb-8 leading-relaxed">
        Your discipline score. Starts at 100 every day. Drops when you break rules.
      </p>

      {/* Today's Score */}
      <div className="glass rounded-xl p-8 mb-6 text-center">
        <p className="text-[0.55rem] font-semibold tracking-[3px] uppercase text-white/25 mb-4">Today</p>
        <div className={`inline-block rounded-full w-28 h-28 flex items-center justify-center ${getScoreGlow(todayScore)} border border-white/[0.06]`}>
          <div>
            <p className={`text-4xl font-black font-mono ${getScoreColor(todayScore)}`}>{todayScore}</p>
            <p className={`text-sm font-bold ${getScoreColor(todayScore)}`}>{getGrade(todayScore)}</p>
          </div>
        </div>
        {violations.length > 0 && (
          <div className="mt-5 space-y-1">
            {violations.map((v, i) => (
              <p key={i} className="text-[0.7rem] text-red-400/60">{v}</p>
            ))}
          </div>
        )}
        {violations.length === 0 && (
          <p className="mt-5 text-xs text-emerald-400/60">Perfect discipline today</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass rounded-lg p-4 text-center">
          <p className="text-[0.5rem] font-semibold tracking-[1.5px] uppercase text-white/20 mb-2">7 Day Avg</p>
          <p className={`text-xl font-bold font-mono ${getScoreColor(weeklyAvg)}`}>{weeklyAvg}</p>
        </div>
        <div className="glass rounded-lg p-4 text-center">
          <p className="text-[0.5rem] font-semibold tracking-[1.5px] uppercase text-white/20 mb-2">30 Day Avg</p>
          <p className={`text-xl font-bold font-mono ${getScoreColor(monthlyAvg)}`}>{monthlyAvg}</p>
        </div>
        <div className="glass rounded-lg p-4 text-center">
          <p className="text-[0.5rem] font-semibold tracking-[1.5px] uppercase text-white/20 mb-2">Streak</p>
          <p className="text-xl font-bold font-mono text-cyan-400">{streak} days</p>
        </div>
      </div>

      {/* Recent History */}
      {history.length > 0 && (
        <div className="glass rounded-xl p-5">
          <p className="text-[0.55rem] font-semibold tracking-[2px] uppercase text-white/20 mb-4">Recent</p>
          <div className="space-y-2">
            {history.slice(0, 7).map((day, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                <span className="text-xs text-white/30">{day.date}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-mono font-bold ${getScoreColor(day.score)}`}>{day.score}</span>
                  <span className={`text-xs font-bold ${getScoreColor(day.score)}`}>{getGrade(day.score)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
