import React, { useState, useEffect, useMemo } from 'react';
import { LayoutGrid } from 'lucide-react';
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

type RiskLevel = 'normal' | 'elevated' | 'high' | 'recovery';

interface HourBlock {
  hour: number;
  weekday: number;
  level: RiskLevel;
  tradeCount: number;
  violations: number;
  rapidEntries: number;
  tiltScore: number;
}

const VIOLATION_TYPES = ['size_blocked', 'session_blocked', 'symbol_blocked', 'coach_blocked', 'stacking_blocked', 'bypass_attempt'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 6); // 6AM to 7PM

/**
 * Behavioral Heatmap - NOT "emotional" heatmap
 * 
 * Uses only measurable behavioral data:
 * - Trade frequency
 * - Violations / blocked attempts
 * - Rapid entries (< 1 min between trades)
 * - Cooldowns triggered
 * 
 * Levels:
 * - Normal: Low activity, no issues
 * - Elevated: Higher than usual activity OR minor violations
 * - High Risk: Multiple violations, rapid entries, high frequency
 * - Recovery: Period after cooldown/kill switch (reduced activity)
 */
export const BehavioralHeatmap: React.FC = () => {
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
      console.error('BehavioralHeatmap: failed to load', e);
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

  // Build heatmap grid: weekday x hour
  const heatmapData = useMemo((): HourBlock[][] => {
    const grid: HourBlock[][] = WEEKDAYS.map((_, wi) =>
      HOURS.map(h => ({ hour: h, weekday: wi, level: 'normal' as RiskLevel, tradeCount: 0, violations: 0, rapidEntries: 0, tiltScore: 0 }))
    );

    // Count trades per weekday+hour
    const sorted = [...filteredTrades].sort((a, b) => (a.entryTime || '').localeCompare(b.entryTime || ''));
    sorted.forEach(t => {
      const d = new Date(t.entryTime);
      const weekday = d.getDay(); // 0=Sun, 1=Mon...
      const hour = d.getHours();
      // Map to Mon-Fri (1-5 → 0-4)
      if (weekday < 1 || weekday > 5) return;
      const wi = weekday - 1;
      const hi = HOURS.indexOf(hour);
      if (hi === -1) return;
      grid[wi][hi].tradeCount++;
    });

    // Count rapid entries (< 60s between consecutive trades in same hour)
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].exitTime || sorted[i - 1].entryTime).getTime();
      const curr = new Date(sorted[i].entryTime).getTime();
      if (curr - prev < 60000) { // < 1 minute
        const d = new Date(sorted[i].entryTime);
        const weekday = d.getDay();
        const hour = d.getHours();
        if (weekday < 1 || weekday > 5) continue;
        const wi = weekday - 1;
        const hi = HOURS.indexOf(hour);
        if (hi === -1) continue;
        grid[wi][hi].rapidEntries++;
      }
    }

    // Count violations per weekday+hour
    const violations = filteredLog.filter(e => VIOLATION_TYPES.includes(e.type));
    violations.forEach(v => {
      const ts = v.timestamp || '';
      const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T'));
      const weekday = d.getDay();
      const hour = d.getHours();
      if (weekday < 1 || weekday > 5) return;
      const wi = weekday - 1;
      const hi = HOURS.indexOf(hour);
      if (hi === -1) return;
      grid[wi][hi].violations++;
    });

    // Check for recovery periods (cooldown/kill switch active)
    const recoveryEvents = filteredLog.filter(e => e.type === 'coach_blocked' || e.type === 'kill_switch');
    recoveryEvents.forEach(v => {
      const ts = v.timestamp || '';
      const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T'));
      const weekday = d.getDay();
      const hour = d.getHours();
      if (weekday < 1 || weekday > 5) return;
      const wi = weekday - 1;
      // Mark next 1-2 hours as recovery
      for (let offset = 1; offset <= 2; offset++) {
        const hi = HOURS.indexOf(hour + offset);
        if (hi !== -1) grid[wi][hi].level = 'recovery';
      }
    });

    // Calculate tilt score and assign levels
    const maxTrades = Math.max(1, ...grid.flat().map(b => b.tradeCount));
    grid.forEach(row => {
      row.forEach(block => {
        if (block.level === 'recovery') return; // Already assigned

        // Tilt score: weighted combination of behavioral signals
        const freqScore = (block.tradeCount / maxTrades) * 30;
        const violationScore = block.violations * 20;
        const rapidScore = block.rapidEntries * 15;
        block.tiltScore = Math.min(100, freqScore + violationScore + rapidScore);

        // Assign level
        if (block.tiltScore >= 50 || block.violations >= 3 || block.rapidEntries >= 3) {
          block.level = 'high';
        } else if (block.tiltScore >= 25 || block.violations >= 1 || block.rapidEntries >= 1) {
          block.level = 'elevated';
        } else {
          block.level = 'normal';
        }
      });
    });

    return grid;
  }, [filteredTrades, filteredLog]);

  // Summary stats
  const summary = useMemo(() => {
    const flat = heatmapData.flat();
    const total = flat.length;
    const normal = flat.filter(b => b.level === 'normal').length;
    const elevated = flat.filter(b => b.level === 'elevated').length;
    const high = flat.filter(b => b.level === 'high').length;
    const recovery = flat.filter(b => b.level === 'recovery').length;

    // Find worst time slots
    const worst = [...flat].filter(b => b.level === 'high').sort((a, b) => b.tiltScore - a.tiltScore).slice(0, 3);

    return { total, normal, elevated, high, recovery, worst };
  }, [heatmapData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: `${colors.primary}30`, borderTopColor: colors.primary }} />
      </div>
    );
  }

  const hasEnoughData = filteredTrades.length >= 5;

  return (
    <div className="max-w-lg animate-reveal">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`, border: `1px solid ${colors.primary}20` }}>
          <LayoutGrid size={18} style={{ color: colors.primary, filter: `drop-shadow(0 0 4px ${colors.primary}50)` }} />
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gradient">Behavioral Heatmap</h2>
          <p className="text-[0.6rem] text-white/30">Risk patterns by time and day</p>
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
          <span className="text-[0.6rem] text-white/30 uppercase tracking-[1.5px]">Confidence</span>
          <span className="text-[0.6rem] font-bold" style={{ color: filteredTrades.length >= 30 ? colors.primary : filteredTrades.length >= 10 ? '#fbbf24' : '#ef4444' }}>
            {filteredTrades.length >= 30 ? 'High' : filteredTrades.length >= 10 ? 'Moderate' : 'Low'}
          </span>
        </div>
      </div>

      {!hasEnoughData ? (
        <div className="relative rounded-xl p-8 overflow-hidden card-premium text-center">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}20, transparent)` }} />
          <div className="relative z-10">
            <LayoutGrid size={20} style={{ color: colors.primary }} className="mb-2" />
            <p className="text-sm font-semibold text-white/50 mb-1">Not Enough Data</p>
            <p className="text-[0.6rem] text-white/25">Need at least 5 trades to build a behavioral heatmap.</p>
            <p className="text-[0.6rem] text-white/15 mt-2">Current: {filteredTrades.length} trades</p>
          </div>
        </div>
      ) : (
        <>
          {/* Heatmap Grid */}
          <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5">
            <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}20, transparent)` }} />
            <div className="relative z-10">
              {/* Hour labels */}
              <div className="flex mb-2">
                <div className="w-8" /> {/* Spacer for weekday labels */}
                {HOURS.map(h => (
                  <div key={h} className="flex-1 text-center text-[0.45rem] text-white/20 font-mono">
                    {h > 12 ? h - 12 : h}{h >= 12 ? 'p' : 'a'}
                  </div>
                ))}
              </div>

              {/* Grid rows */}
              <div className="space-y-1">
                {WEEKDAYS.map((day, wi) => (
                  <div key={day} className="flex items-center gap-1">
                    <span className="w-8 text-[0.5rem] text-white/25 font-mono">{day}</span>
                    <div className="flex-1 flex gap-[2px]">
                      {heatmapData[wi].map((block, hi) => (
                        <div
                          key={hi}
                          className="flex-1 h-6 rounded-sm transition-all cursor-default group relative"
                          style={{ background: getLevelColor(block.level, colors, block.tradeCount > 0) }}
                          title={`${day} ${formatHour(block.hour)}: ${block.tradeCount} trades, ${block.violations} violations, ${block.rapidEntries} rapid entries`}
                        >
                          {block.tradeCount > 2 && (
                            <span className="absolute inset-0 flex items-center justify-center text-[0.4rem] font-mono font-bold text-white/40">
                              {block.tradeCount}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-white/[0.04]">
                {([
                  ['Normal', 'normal'],
                  ['Elevated', 'elevated'],
                  ['High Risk', 'high'],
                  ['Recovery', 'recovery'],
                ] as const).map(([label, level]) => (
                  <div key={level} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: getLevelColor(level, colors, true) }} />
                    <span className="text-[0.5rem] text-white/30">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            {([
              ['Normal', summary.normal, colors.primary],
              ['Elevated', summary.elevated, '#fbbf24'],
              ['High Risk', summary.high, '#ef4444'],
              ['Recovery', summary.recovery, '#8b5cf6'],
            ] as const).map(([label, count, color]) => (
              <div key={label} className="relative rounded-xl p-3 overflow-hidden card-premium text-center">
                <p className="text-lg font-black font-mono" style={{ color }}>{count}</p>
                <p className="text-[0.45rem] text-white/25 uppercase tracking-[1px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Worst Time Slots */}
          {summary.worst.length > 0 && (
            <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5">
              <div className="relative z-10">
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-3" style={{ color: '#ef444480' }}>Highest Risk Time Slots</p>
                <div className="space-y-2">
                  {summary.worst.map((block, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-red-400/[0.04] border border-red-400/10">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        <span className="text-xs text-white/50">
                          {WEEKDAYS[block.weekday]} {formatHour(block.hour)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[0.6rem] font-mono text-white/30">
                          {block.tradeCount} trades, {block.violations} violations
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* What the heatmap measures */}
          <div className="px-4 py-3 rounded-xl border border-white/[0.03] bg-white/[0.01]">
            <p className="text-[0.55rem] font-bold text-white/25 uppercase tracking-[1.5px] mb-2">What This Measures</p>
            <div className="space-y-1 text-[0.55rem] text-white/20">
              <p>Trade frequency per time slot</p>
              <p>Violations and blocked attempts</p>
              <p>Rapid entries (&lt;1 min between trades)</p>
              <p>Cooldown/kill switch recovery periods</p>
            </div>
            <p className="text-[0.5rem] text-white/15 mt-2 italic">Does not measure emotions. Based on observable actions only.</p>
          </div>

          {/* Footnote */}
          <p className="text-[0.5rem] text-white/15 text-center mt-4 italic">
            Based on {filteredTrades.length} trades. {filteredTrades.length < 30 && 'Low sample — patterns may shift with more data.'}
          </p>
        </>
      )}
    </div>
  );
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

function getLevelColor(level: RiskLevel, colors: any, hasData: boolean): string {
  if (!hasData) return 'rgba(255,255,255,0.02)';
  switch (level) {
    case 'normal': return `${colors.primary}15`;
    case 'elevated': return 'rgba(251,191,36,0.2)';
    case 'high': return 'rgba(239,68,68,0.3)';
    case 'recovery': return 'rgba(139,92,246,0.2)';
    default: return 'rgba(255,255,255,0.02)';
  }
}

function formatHour(h: number): string {
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:00 ${period}`;
}
