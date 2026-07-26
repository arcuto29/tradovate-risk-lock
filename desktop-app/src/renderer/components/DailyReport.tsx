import React, { useState, useEffect } from 'react';

export const DailyReport: React.FC = () => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      const data = await (window as any).electronAPI?.getDisciplineScore?.();
      if (data) setReport(data);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <span className="text-white/20 text-sm">Loading...</span>;
  if (!report) return <span className="text-white/20 text-sm">No data yet</span>;

  const getGrade = (score: number) => {
    if (score >= 95) return { grade: 'A+', color: 'text-emerald-400', message: 'Perfect discipline. This is how funded traders stay funded.' };
    if (score >= 90) return { grade: 'A', color: 'text-emerald-400', message: 'Outstanding. You followed your plan almost perfectly.' };
    if (score >= 80) return { grade: 'B', color: 'text-cyan-400', message: 'Good day. Minor slip-ups but overall disciplined.' };
    if (score >= 70) return { grade: 'C', color: 'text-amber-400', message: 'Average. You broke some rules today. Review what happened.' };
    if (score >= 60) return { grade: 'D', color: 'text-orange-400', message: 'Below average. Multiple rule breaks. Tomorrow is a new day.' };
    return { grade: 'F', color: 'text-red-400', message: 'Failed. You ignored your own rules. This is how accounts blow.' };
  };

  const { grade, color, message } = getGrade(report.todayScore);
  const violations = report.violations || [];

  return (
    <div className="max-w-lg">
      <h2 className="text-4xl font-black tracking-tighter mb-3 text-glow-white">Daily Report</h2>
      <p className="text-white/35 text-sm mb-8 leading-relaxed">End of day summary. How disciplined were you?</p>

      {/* Grade */}
      <div className="glass rounded-xl p-8 mb-6 text-center">
        <p className="text-[0.55rem] font-semibold tracking-[3px] uppercase text-white/25 mb-4">Today's Grade</p>
        <p className={`text-6xl font-black ${color} mb-4`}>{grade}</p>
        <p className="text-sm text-white/40 leading-relaxed max-w-sm mx-auto">{message}</p>
      </div>

      {/* Score */}
      <div className="glass rounded-xl p-6 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/30">Discipline Score</span>
          <span className={`text-2xl font-bold font-mono ${color}`}>{report.todayScore}/100</span>
        </div>
      </div>

      {/* Violations */}
      {violations.length > 0 && (
        <div className="glass rounded-xl p-6 mb-4">
          <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-red-400/50 mb-4">Rules Broken</p>
          <div className="space-y-2">
            {violations.map((v: string, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400/50 mt-1.5 shrink-0" />
                <p className="text-xs text-white/40">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {violations.length === 0 && (
        <div className="glass rounded-xl p-6 mb-4 text-center">
          <p className="text-emerald-400/60 text-sm">No rules broken today</p>
        </div>
      )}

      {/* Streak */}
      <div className="glass rounded-xl p-6">
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/30">Current Streak</span>
          <span className="text-lg font-bold font-mono text-cyan-400">{report.streak} days</span>
        </div>
        <p className="text-[0.65rem] text-white/15 mt-2">Consecutive days with score above 80</p>
      </div>
    </div>
  );
};
