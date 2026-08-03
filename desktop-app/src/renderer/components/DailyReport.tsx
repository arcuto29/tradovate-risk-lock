import React, { useState, useEffect } from 'react';
import { Flag } from 'lucide-react';

export const DailyReport: React.FC = () => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReport(); }, []);

  const loadReport = async () => {
    try {
      const data = await (window as any).electronAPI?.getDisciplineScore?.();
      if (data) setReport(data);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <span className="text-white/20 text-sm animate-pulse">Loading...</span>;
  if (!report) return <span className="text-white/20 text-sm">No data yet</span>;

  const getGrade = (score: number) => {
    if (score >= 95) return { grade: 'A+', color: 'text-emerald-400', ringColor: '#34d399', message: 'Perfect discipline. This is how funded traders stay funded.' };
    if (score >= 90) return { grade: 'A', color: 'text-emerald-400', ringColor: '#34d399', message: 'Outstanding. You followed your plan almost perfectly.' };
    if (score >= 80) return { grade: 'B', color: 'text-cyan-400', ringColor: '#22d3ee', message: 'Good day. Minor slip-ups but overall disciplined.' };
    if (score >= 70) return { grade: 'C', color: 'text-amber-400', ringColor: '#fbbf24', message: 'Average. You broke some rules today. Review what happened.' };
    if (score >= 60) return { grade: 'D', color: 'text-orange-400', ringColor: '#fb923c', message: 'Below average. Multiple rule breaks. Tomorrow is a new day.' };
    return { grade: 'F', color: 'text-red-400', ringColor: '#f87171', message: 'Failed. You ignored your own rules. This is how accounts blow.' };
  };

  const { grade, color, ringColor, message } = getGrade(report.todayScore);
  const violations = report.violations || [];

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2 animate-reveal">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center">
          <Flag size={18} style={{color: 'rgb(251,191,36)', filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.5))'}} />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-gradient">Daily Report</h2>
      </div>
      <p className="text-white/30 text-sm mb-8 leading-relaxed ml-14 animate-reveal">End of day summary.</p>

      {/* Grade */}
      <div className="relative rounded-xl p-10 overflow-hidden card-premium mb-5 text-center animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
        <div className="relative z-10">
          <p className="text-[0.55rem] font-bold tracking-[3px] uppercase text-white/20 mb-5">Today's Grade</p>
          <div className="relative inline-block mb-5">
            <div className="w-28 h-28 rounded-full flex items-center justify-center border-2 transition-all" style={{
              borderColor: ringColor + '40',
              boxShadow: `0 0 30px ${ringColor}30, inset 0 0 20px ${ringColor}10`
            }}>
              <p className={`text-5xl font-black ${color}`} style={{textShadow: `0 0 20px ${ringColor}60`}}>{grade}</p>
            </div>
          </div>
          <p className="text-sm text-white/35 leading-relaxed max-w-sm mx-auto">{message}</p>
        </div>
      </div>

      {/* Score */}
      <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-4 animate-reveal">
        <div className="relative z-10 flex justify-between items-center">
          <span className="text-xs text-white/30 font-medium">Discipline Score</span>
          <span className={`text-2xl font-black font-mono ${color}`}>{report.todayScore}<span className="text-white/20 text-sm">/100</span></span>
        </div>
      </div>

      {/* Violations */}
      {violations.length > 0 && (
        <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-4 animate-reveal">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-400/40 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-red-400/60 text-sm">⚠</span>
              <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-red-400/50">Rules Broken</p>
            </div>
            <div className="space-y-2">
              {violations.map((v: string, i: number) => (
                <div key={i} className="flex items-start gap-3 py-2 px-3 rounded-lg bg-red-400/[0.03] border border-red-400/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400/50 mt-1.5 shrink-0" />
                  <p className="text-xs text-white/40">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {violations.length === 0 && (
        <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-4 text-center animate-reveal">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
          <div className="relative z-10 flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            <p className="text-emerald-400/60 text-sm font-medium">No rules broken today</p>
          </div>
        </div>
      )}

      {/* Streak */}
      <div className="relative rounded-xl p-5 overflow-hidden card-premium animate-reveal">
        <div className="relative z-10 flex justify-between items-center">
          <span className="text-xs text-white/30 font-medium">Current Streak</span>
          <span className="text-lg font-bold font-mono text-cyan-400">{report.streak} days</span>
        </div>
        <p className="text-[0.6rem] text-white/15 mt-2 relative z-10">Consecutive days with score above 80</p>
      </div>
    </div>
  );
};
