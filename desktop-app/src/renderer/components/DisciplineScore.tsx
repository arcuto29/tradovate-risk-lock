import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

interface DayScore {
  date: string;
  score: number;
  violations: string[];
}

export const DisciplineScore: React.FC = () => {
  const { theme } = useTheme();
  const themeColors = getThemeColors(theme);
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

  if (loading) return <span className="text-white/20 text-sm animate-pulse">Loading...</span>;

  const getScoreColor = (score: number) => {
    if (score >= 90) return `text-[${themeColors.primary}]`;
    if (score >= 70) return `text-[${themeColors.secondary}]`;
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 90) return `from-[${themeColors.primary}] to-[${themeColors.secondary}]`;
    if (score >= 70) return `from-[${themeColors.secondary}] to-[${themeColors.primary}]`;
    if (score >= 50) return 'from-amber-400 to-orange-400';
    return 'from-red-400 to-pink-400';
  };

  const getScoreRingColor = (score: number) => {
    // All themes use gradient rings now
    return 'url(#disciplineGrad)';
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

  // SVG ring calculations
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - todayScore / 100);
  const ringColor = getScoreRingColor(todayScore);

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2 animate-reveal">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/10 border border-cyan-500/20 flex items-center justify-center">
          <span className="text-lg" style={{filter: 'drop-shadow(0 0 4px rgba(56,189,248,0.5))'}}>📊</span>
        </div>
        <h2 className="text-3xl font-black tracking-tight text-gradient">Discipline</h2>
      </div>
      <p className="text-white/30 text-sm mb-8 leading-relaxed ml-14 animate-reveal">Starts at 100. Drops when you break rules.</p>


      {/* Today's Score - Circular Ring */}
      <div className="relative rounded-xl p-8 overflow-hidden card-premium mb-6 text-center animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
        <div className="relative z-10">
          <p className="text-[0.55rem] font-bold tracking-[3px] uppercase text-white/25 mb-6">Today</p>
          <div className="relative inline-block" style={{width: '200px', height: '200px'}}>

            {/* Outer orbit particles */}
            <svg width="200" height="200" className="absolute inset-0" style={{animation: 'spin 10s linear infinite'}}>
              <circle cx="100" cy="8" r="2" fill={themeColors.primary} opacity="0.6" />
              <circle cx="192" cy="100" r="1.5" fill={themeColors.secondary} opacity="0.4" />
              <circle cx="100" cy="192" r="2" fill={themeColors.primary} opacity="0.5" />
              <circle cx="8" cy="100" r="1.5" fill={themeColors.secondary} opacity="0.3" />
            </svg>

            {/* Counter-rotating outer ring */}
            <svg width="200" height="200" className="absolute inset-0" style={{animation: 'spin 20s linear infinite reverse'}}>
              <circle cx="100" cy="100" r="95" fill="none" stroke={`${themeColors.primary}10`} strokeWidth="0.5" strokeDasharray="3 8" />
            </svg>

            {/* SVG Ring */}
            <svg width="200" height="200" className="absolute inset-0 transform -rotate-90">
              {/* Gradient for all themes */}
              <defs>
                <linearGradient id="disciplineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={theme === 'nebula' ? '#22d3ee' : theme === 'aurora' ? '#10b981' : theme === 'sakura' ? '#f472b6' : theme === 'midnight' ? '#ef4444' : '#fbbf24'} />
                  <stop offset="50%" stopColor={theme === 'nebula' ? '#a78bfa' : theme === 'aurora' ? '#06b6d4' : theme === 'sakura' ? '#ec4899' : theme === 'midnight' ? '#ffffff' : '#f59e0b'} />
                  <stop offset="100%" stopColor={theme === 'nebula' ? '#818cf8' : theme === 'aurora' ? '#34d399' : theme === 'sakura' ? '#fb7185' : theme === 'midnight' ? '#3b82f6' : '#ef4444'} />
                </linearGradient>
              </defs>
              {/* Background track */}
              <circle cx="100" cy="100" r={radius} fill="none" stroke={`${themeColors.primary}12`} strokeWidth="6" />
              {/* Inner ring */}
              <circle cx="100" cy="100" r={radius - 12} fill="none" stroke={`${themeColors.primary}06`} strokeWidth="1" />
              {/* Main progress arc */}
              <circle
                cx="100" cy="100" r={radius} fill="none"
                stroke={ringColor}
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                className="transition-all duration-1000"
                style={{filter: `drop-shadow(0 0 10px ${themeColors.primary}90) drop-shadow(0 0 25px ${themeColors.primary}40)`}}
              />
              {/* Secondary thin arc */}
              <circle
                cx="100" cy="100" r={radius + 8} fill="none"
                stroke={`${themeColors.secondary}30`}
                strokeWidth="1.5"
                strokeDasharray={2 * Math.PI * (radius + 8)}
                strokeDashoffset={2 * Math.PI * (radius + 8) * (1 - todayScore / 100 * 0.95)}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>

            {/* Center glow backdrop */}
            <div className="absolute inset-[20px] rounded-full" style={{background: `radial-gradient(circle at 50% 45%, ${themeColors.primary}10 0%, transparent 60%)`}} />

            {/* Center Score */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-5xl font-black font-mono" style={{color: theme === 'midnight' ? '#ffffff' : themeColors.primary, textShadow: `0 0 20px ${themeColors.primary}60, 0 0 40px ${themeColors.primary}20`, animation: 'timerPulse 3s ease-in-out infinite'}}>
                {todayScore}
              </p>
              <p className="text-lg font-bold mt-1" style={{color: themeColors.secondary}}>
                {getGrade(todayScore)}
              </p>
            </div>
          </div>

          {violations.length > 0 && (
            <div className="mt-6 space-y-1.5">
              {violations.map((v, i) => (
                <p key={i} className="text-[0.7rem] text-red-400/60 animate-reveal" style={{animationDelay: `${i * 0.1}s`}}>{v}</p>
              ))}
            </div>
          )}
          {violations.length === 0 && (
            <p className="mt-6 text-xs text-emerald-400/60 flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
              Perfect discipline today
            </p>
          )}
        </div>
      </div>


      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-6 animate-reveal">
        <div className="relative rounded-xl p-5 overflow-hidden card-premium text-center hover-lift">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
          <div className="relative z-10">
            <p className="text-[0.5rem] font-bold tracking-[1.5px] uppercase text-white/20 mb-2">7 Day Avg</p>
            <p className={`text-2xl font-black font-mono ${getScoreColor(weeklyAvg)}`}>{weeklyAvg}</p>
          </div>
        </div>
        <div className="relative rounded-xl p-5 overflow-hidden card-premium text-center hover-lift">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />
          <div className="relative z-10">
            <p className="text-[0.5rem] font-bold tracking-[1.5px] uppercase text-white/20 mb-2">30 Day Avg</p>
            <p className={`text-2xl font-black font-mono ${getScoreColor(monthlyAvg)}`}>{monthlyAvg}</p>
          </div>
        </div>
        <div className="relative rounded-xl p-5 overflow-hidden card-premium text-center hover-lift">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
          <div className="relative z-10">
            <p className="text-[0.5rem] font-bold tracking-[1.5px] uppercase text-white/20 mb-2">Streak</p>
            <p className="text-2xl font-black font-mono text-cyan-400">{streak} <span className="text-sm text-white/20">days</span></p>
          </div>
        </div>
      </div>

      {/* Recent History */}
      {history.length > 0 && (
        <div className="relative rounded-xl p-6 overflow-hidden card-premium animate-reveal">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="relative z-10">
            <p className="text-[0.55rem] font-bold tracking-[2px] uppercase text-white/20 mb-5">Recent</p>
            <div className="space-y-2">
              {history.slice(0, 7).map((day, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.03] hover:border-white/[0.06] transition-all" style={{animationDelay: `${i * 0.05}s`}}>
                  <span className="text-xs text-white/30 font-medium">{day.date}</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-mono font-bold ${getScoreColor(day.score)}`}>{day.score}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md bg-white/[0.03] ${getScoreColor(day.score)}`}>{getGrade(day.score)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
