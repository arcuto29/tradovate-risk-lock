import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

interface LogEntry {
  id: number;
  type: string;
  details: string;
  timestamp: string;
}

interface Insight {
  text: string;
  confidence: 'high' | 'medium';
  sampleSize: number;
}

export const Analytics: React.FC = () => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const log = await window.electronAPI.getActivityLog(2000);
      setEntries(log || []);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <span className="text-white/20 text-sm animate-pulse">Loading analytics...</span>;

  // ─── Process Data ─────────────────────────────────────────────────────────

  const now = new Date();
  const last30Days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last30Days.push(d.toISOString().split('T')[0]);
  }

  // Group entries by date
  const byDate: Record<string, LogEntry[]> = {};
  entries.forEach(e => {
    const ts = e.timestamp || '';
    const date = ts.includes('T') ? ts.split('T')[0] : ts.split(' ')[0];
    if (date) {
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(e);
    }
  });

  // Violation types
  const violationTypes = ['size_blocked', 'session_blocked', 'symbol_blocked', 'coach_blocked', 'stacking_blocked', 'bypass_attempt', 'extension_disconnected', 'kill_switch'];
  const violationCounts: Record<string, number> = {};
  violationTypes.forEach(t => { violationCounts[t] = 0; });
  entries.forEach(e => {
    if (violationTypes.includes(e.type)) {
      violationCounts[e.type] = (violationCounts[e.type] || 0) + 1;
    }
  });
  const totalViolations = Object.values(violationCounts).reduce((a, b) => a + b, 0);

  // Violations by hour
  const byHour: number[] = new Array(24).fill(0);
  entries.forEach(e => {
    if (violationTypes.includes(e.type)) {
      const ts = e.timestamp || '';
      let hour = 0;
      if (ts.includes('T')) {
        hour = parseInt(ts.split('T')[1]?.split(':')[0] || '0');
      } else {
        hour = parseInt(ts.split(' ')[1]?.split(':')[0] || '0');
      }
      if (!isNaN(hour)) byHour[hour]++;
    }
  });

  // Violations by day of week
  const byDayOfWeek: number[] = new Array(7).fill(0);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  entries.forEach(e => {
    if (violationTypes.includes(e.type)) {
      const ts = e.timestamp || '';
      const date = ts.includes('T') ? ts.split('T')[0] : ts.split(' ')[0];
      if (date) {
        const d = new Date(date);
        if (!isNaN(d.getTime())) byDayOfWeek[d.getDay()]++;
      }
    }
  });

  // Calendar heatmap scores (simplified - count violations per day)
  const calendarData = last30Days.map(date => {
    const dayEntries = byDate[date] || [];
    const violations = dayEntries.filter(e => violationTypes.includes(e.type)).length;
    // Score: 100 minus deductions
    const score = Math.max(0, 100 - violations * 12);
    return { date, score, violations, hasData: dayEntries.length > 0 };
  });

  // ─── AI Insights ──────────────────────────────────────────────────────────

  const insights: Insight[] = [];

  // Insight: Worst hour
  const maxHourViolations = Math.max(...byHour);
  if (maxHourViolations >= 3) {
    const worstHour = byHour.indexOf(maxHourViolations);
    const hourStr = worstHour === 0 ? '12 AM' : worstHour < 12 ? `${worstHour} AM` : worstHour === 12 ? '12 PM' : `${worstHour - 12} PM`;
    insights.push({
      text: `Most rule violations happen around ${hourStr}. Consider tightening limits or ending your session before this time.`,
      confidence: maxHourViolations >= 5 ? 'high' : 'medium',
      sampleSize: maxHourViolations,
    });
  }

  // Insight: Worst day of week
  const maxDayViolations = Math.max(...byDayOfWeek);
  if (maxDayViolations >= 3) {
    const worstDay = byDayOfWeek.indexOf(maxDayViolations);
    insights.push({
      text: `${dayNames[worstDay]} has the most rule violations (${maxDayViolations} total). Your discipline drops on this day.`,
      confidence: maxDayViolations >= 5 ? 'high' : 'medium',
      sampleSize: maxDayViolations,
    });
  }

  // Insight: Most common violation
  const sortedViolations = Object.entries(violationCounts).filter(([_, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (sortedViolations.length > 0) {
    const [topType, topCount] = sortedViolations[0];
    const typeLabels: Record<string, string> = {
      size_blocked: 'exceeding position size limits',
      session_blocked: 'trading outside session hours',
      symbol_blocked: 'trading blocked symbols',
      coach_blocked: 'ignoring cooldown timers',
      stacking_blocked: 'stacking/pyramiding violations',
      bypass_attempt: 'attempting to bypass protections',
      extension_disconnected: 'disconnecting the extension',
      kill_switch: 'using the kill switch',
    };
    if (topCount >= 3) {
      insights.push({
        text: `Your most common violation is ${typeLabels[topType] || topType} (${topCount} times). This is your biggest discipline weakness.`,
        confidence: topCount >= 5 ? 'high' : 'medium',
        sampleSize: topCount,
      });
    }
  }

  // Insight: Back-to-back violations
  let backToBack = 0;
  const sortedEntries = [...entries].filter(e => violationTypes.includes(e.type)).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (let i = 1; i < sortedEntries.length; i++) {
    const prev = new Date(sortedEntries[i-1].timestamp).getTime();
    const curr = new Date(sortedEntries[i].timestamp).getTime();
    if (curr - prev < 300000) backToBack++; // Within 5 minutes
  }
  if (backToBack >= 3) {
    insights.push({
      text: `${backToBack} times you broke rules within 5 minutes of a previous violation. When you slip once, you tend to spiral. Consider the kill switch after the first violation.`,
      confidence: backToBack >= 5 ? 'high' : 'medium',
      sampleSize: backToBack,
    });
  }

  // Insight: Clean days vs violation days
  const cleanDays = calendarData.filter(d => d.hasData && d.violations === 0).length;
  const violationDays = calendarData.filter(d => d.violations > 0).length;
  if (cleanDays + violationDays >= 5) {
    const cleanPct = Math.round((cleanDays / (cleanDays + violationDays)) * 100);
    if (cleanPct >= 70) {
      insights.push({
        text: `${cleanPct}% of your trading days are violation-free. You're building strong discipline habits. Keep the streak going.`,
        confidence: 'high',
        sampleSize: cleanDays + violationDays,
      });
    } else if (cleanPct < 50) {
      insights.push({
        text: `Only ${cleanPct}% of your trading days are clean. More than half your sessions have rule violations. Focus on following your plan.`,
        confidence: 'high',
        sampleSize: cleanDays + violationDays,
      });
    }
  }

  // Insight: Weekend/Friday pattern
  if (byDayOfWeek[5] > 0 && byDayOfWeek[5] >= byDayOfWeek[1] + byDayOfWeek[2] + byDayOfWeek[3]) {
    insights.push({
      text: `Friday accounts for a disproportionate number of violations. Traders often push to "finish the week green." Your Friday protection rules are important.`,
      confidence: 'medium',
      sampleSize: byDayOfWeek[5],
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const getScoreColor = (score: number) => {
    if (score >= 90) return colors.primary;
    if (score >= 70) return colors.secondary;
    if (score >= 50) return '#fbbf24';
    return '#ef4444';
  };

  const getViolationLabel = (type: string) => {
    const labels: Record<string, string> = {
      size_blocked: 'Oversize',
      session_blocked: 'Session',
      symbol_blocked: 'Symbol',
      coach_blocked: 'Cooldown',
      stacking_blocked: 'Stacking',
      bypass_attempt: 'Bypass',
      extension_disconnected: 'Extension',
      kill_switch: 'Kill Switch',
    };
    return labels[type] || type;
  };

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2 animate-reveal">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`, border: `1px solid ${colors.primary}20`}}>
          <span className="text-lg" style={{filter: `drop-shadow(0 0 4px ${colors.primary}50)`}}>📈</span>
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gradient">Analytics</h2>
          <p className="text-[0.6rem] text-white/30">Patterns, insights, and discipline trends</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3 mt-6 mb-6 animate-reveal">
        {[
          { label: 'Total Violations', value: totalViolations, color: totalViolations > 10 ? '#ef4444' : colors.primary },
          { label: 'Clean Days (30d)', value: cleanDays, color: colors.primary },
          { label: 'Violation Days', value: violationDays, color: violationDays > 15 ? '#ef4444' : '#fbbf24' },
          { label: 'Active Days', value: Object.keys(byDate).length, color: colors.secondary },
        ].map((stat, i) => (
          <div key={i} className="relative rounded-xl p-4 overflow-hidden card-premium text-center">
            <p className="text-2xl font-black font-mono" style={{color: stat.color}}>{stat.value}</p>
            <p className="text-[0.55rem] text-white/25 uppercase tracking-[1px] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Calendar Heatmap */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-5 animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)`}} />
        <div className="relative z-10">
          <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-4" style={{color: `${colors.primary}80`}}>Last 30 Days</p>
          <div className="grid grid-cols-10 gap-1.5">
            {calendarData.map((day, i) => (
              <div
                key={i}
                className="aspect-square rounded-md flex items-center justify-center relative group cursor-default"
                style={{
                  background: !day.hasData ? 'rgba(255,255,255,0.02)' : `${getScoreColor(day.score)}20`,
                  border: `1px solid ${!day.hasData ? 'rgba(255,255,255,0.04)' : getScoreColor(day.score) + '30'}`,
                }}
                title={`${day.date}: Score ${day.score}, ${day.violations} violations`}
              >
                <span className="text-[0.5rem] font-mono text-white/30">{parseInt(day.date.split('-')[2])}</span>
                {day.violations > 0 && (
                  <span className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-red-400/80" />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[0.5rem] text-white/20">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{background: `${colors.primary}30`}} /> Clean</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400/30" /> Some issues</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400/30" /> Bad day</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-white/[0.03]" /> No data</span>
          </div>
        </div>
      </div>

      {/* Violation Breakdown */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-5 animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.secondary}30, transparent)`}} />
        <div className="relative z-10">
          <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-4" style={{color: `${colors.secondary}80`}}>Violation Breakdown</p>
          {totalViolations === 0 ? (
            <p className="text-xs text-white/20 text-center py-4">No violations recorded yet. Keep it up.</p>
          ) : (
            <div className="space-y-2.5">
              {sortedViolations.map(([type, count]) => {
                const pct = Math.round((count / totalViolations) * 100);
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/50 font-medium">{getViolationLabel(type)}</span>
                      <span className="text-[0.6rem] text-white/30 font-mono">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{width: `${pct}%`, background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`}} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Violations by Hour */}
      {totalViolations > 0 && (
        <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-5 animate-reveal">
          <div className="relative z-10">
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-4 text-white/30">Violations by Hour</p>
            <div className="flex items-end gap-0.5 h-20">
              {byHour.slice(6, 20).map((count, i) => {
                const hour = i + 6;
                const maxH = Math.max(...byHour.slice(6, 20), 1);
                const height = (count / maxH) * 100;
                return (
                  <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-sm" style={{height: `${Math.max(height, 2)}%`, background: count === maxH && count > 0 ? '#ef4444' : count > 0 ? `${colors.primary}60` : 'rgba(255,255,255,0.04)'}} />
                    <span className="text-[0.45rem] text-white/15">{hour}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[0.5rem] text-white/15 mt-2 text-center">Hours shown: 6AM - 8PM ET</p>
          </div>
        </div>
      )}

      {/* Violations by Day of Week */}
      {totalViolations > 0 && (
        <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-5 animate-reveal">
          <div className="relative z-10">
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-4 text-white/30">Violations by Weekday</p>
            <div className="flex items-end gap-2 h-16">
              {byDayOfWeek.slice(1, 6).map((count, i) => {
                const maxD = Math.max(...byDayOfWeek.slice(1, 6), 1);
                const height = (count / maxD) * 100;
                const dayLabel = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i];
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-sm" style={{height: `${Math.max(height, 4)}%`, background: count === maxD && count > 0 ? '#ef4444' : count > 0 ? `${colors.primary}60` : 'rgba(255,255,255,0.04)'}} />
                    <span className="text-[0.55rem] text-white/25 font-medium">{dayLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-5 animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.primary}30, ${colors.secondary}20, transparent)`}} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm">🧠</span>
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase" style={{color: `${colors.primary}80`}}>AI Insights</p>
          </div>
          {insights.length === 0 ? (
            <p className="text-xs text-white/20 text-center py-4">Not enough data yet. Trade for a few more sessions and insights will appear here.</p>
          ) : (
            <div className="space-y-3">
              {insights.map((insight, i) => (
                <div key={i} className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-xs text-white/60 leading-relaxed">{insight.text}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-[0.5rem] px-1.5 py-0.5 rounded font-bold uppercase tracking-[0.5px] ${insight.confidence === 'high' ? 'bg-emerald-400/10 text-emerald-400/70 border border-emerald-400/20' : 'bg-amber-400/10 text-amber-400/70 border border-amber-400/20'}`}>
                      {insight.confidence} confidence
                    </span>
                    <span className="text-[0.5rem] text-white/15">Based on {insight.sampleSize} data points</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
