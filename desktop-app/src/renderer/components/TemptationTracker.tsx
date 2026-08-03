import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

interface BlockedEvent {
  id: number;
  timestamp: string;
  type: string;
  details: string;
}

interface GroupedData {
  label: string;
  count: number;
  percentage: number;
}

const VIOLATION_TYPES = ['size_blocked', 'session_blocked', 'symbol_blocked', 'coach_blocked', 'stacking_blocked', 'bypass_attempt'];

const TYPE_LABELS: Record<string, string> = {
  size_blocked: 'Oversized Order',
  session_blocked: 'Outside Session',
  symbol_blocked: 'Blocked Symbol',
  coach_blocked: 'Coach Block',
  stacking_blocked: 'Stacking / Pyramiding',
  bypass_attempt: 'Bypass Attempt',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseSymbolFromDetails(details: string): string {
  // Try to extract symbol from details like "BLOCKED on ...: Position size exceeds limit"
  // or from JSON-like content
  const symbolMatch = details.match(/symbol[:\s]*["']?([A-Z0-9]{2,10})["']?/i);
  if (symbolMatch) return symbolMatch[1].toUpperCase();
  // Try common futures symbols in the text
  const futuresMatch = details.match(/\b(NQ|ES|YM|RTY|MNQ|MES|ZB|ZN|ZC|ZS|ZW|GC|SI|CL|NG|6E|6J|6B)\w{0,4}\b/);
  if (futuresMatch) return futuresMatch[0].toUpperCase();
  return 'Unknown';
}

function parsePlatformFromDetails(details: string): string {
  if (details.includes('tradovate')) return 'Tradovate';
  if (details.includes('topstepx') || details.includes('topstep')) return 'TopstepX';
  if (details.includes('tradingview') || details.includes('TradingView')) return 'TradingView';
  if (details.includes('tradesea')) return 'Tradesea';
  if (details.includes('ninjatrader')) return 'NinjaTrader';
  return 'Unknown';
}

function estimateRiskFromDetails(details: string): number {
  // Try to extract qty or size from details
  const qtyMatch = details.match(/(\d+)\s*(contracts?|lots?|qty)/i);
  if (qtyMatch) return parseInt(qtyMatch[1]) * 50; // rough $50/tick estimate per contract
  const sizeMatch = details.match(/size\s*[:=]\s*(\d+)/i);
  if (sizeMatch) return parseInt(sizeMatch[1]) * 50;
  // Default: 1 contract * $50 average tick value
  return 50;
}

export const TemptationTracker: React.FC = () => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [allBlocked, setAllBlocked] = useState<BlockedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('30d');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const log = await window.electronAPI.getActivityLog(10000);
      const blocked = (log || []).filter((e: any) => VIOLATION_TYPES.includes(e.type));
      setAllBlocked(blocked);
    } catch (e) {
      console.error('TemptationTracker: failed to load', e);
    } finally {
      setLoading(false);
    }
  };

  // Filter by date range
  const filteredEvents = useMemo(() => {
    if (dateRange === 'all') return allBlocked;
    const now = new Date();
    const days = dateRange === '7d' ? 7 : 30;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    return allBlocked.filter(e => {
      const ts = e.timestamp || '';
      return ts >= cutoff;
    });
  }, [allBlocked, dateRange]);

  // ─── GROUPINGS ──────────────────────────────────────────────────────────
  const byType = useMemo((): GroupedData[] => {
    const counts: Record<string, number> = {};
    filteredEvents.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1; });
    const total = filteredEvents.length || 1;
    return Object.entries(counts)
      .map(([type, count]) => ({ label: TYPE_LABELS[type] || type, count, percentage: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [filteredEvents]);

  const byHour = useMemo((): GroupedData[] => {
    const counts: Record<number, number> = {};
    filteredEvents.forEach(e => {
      const ts = e.timestamp || '';
      const date = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T'));
      const hour = date.getHours();
      if (!isNaN(hour)) counts[hour] = (counts[hour] || 0) + 1;
    });
    const total = filteredEvents.length || 1;
    return Object.entries(counts)
      .map(([h, count]) => ({ label: `${String(h).padStart(2, '0')}:00`, count, percentage: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [filteredEvents]);

  const byWeekday = useMemo((): GroupedData[] => {
    const counts: Record<number, number> = {};
    filteredEvents.forEach(e => {
      const ts = e.timestamp || '';
      const date = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T'));
      const day = date.getDay();
      if (!isNaN(day)) counts[day] = (counts[day] || 0) + 1;
    });
    const total = filteredEvents.length || 1;
    return Object.entries(counts)
      .map(([d, count]) => ({ label: WEEKDAYS[parseInt(d)], count, percentage: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [filteredEvents]);

  const bySymbol = useMemo((): GroupedData[] => {
    const counts: Record<string, number> = {};
    filteredEvents.forEach(e => {
      const sym = parseSymbolFromDetails(e.details);
      counts[sym] = (counts[sym] || 0) + 1;
    });
    const total = filteredEvents.length || 1;
    return Object.entries(counts)
      .map(([sym, count]) => ({ label: sym, count, percentage: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [filteredEvents]);

  const byDay = useMemo((): { date: string; count: number }[] => {
    const counts: Record<string, number> = {};
    filteredEvents.forEach(e => {
      const ts = e.timestamp || '';
      const date = ts.includes('T') ? ts.split('T')[0] : ts.split(' ')[0];
      if (date) counts[date] = (counts[date] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredEvents]);

  // ─── INSIGHTS ───────────────────────────────────────────────────────────
  const mostCommonTemptation = byType[0] || null;
  const mostCommonHour = byHour[0] || null;
  const peakWeekday = byWeekday[0] || null;

  const totalEstimatedRisk = useMemo(() => {
    return filteredEvents.reduce((sum, e) => sum + estimateRiskFromDetails(e.details), 0);
  }, [filteredEvents]);

  const mostExpensiveType = useMemo(() => {
    const riskByType: Record<string, number> = {};
    filteredEvents.forEach(e => {
      const risk = estimateRiskFromDetails(e.details);
      riskByType[e.type] = (riskByType[e.type] || 0) + risk;
    });
    const sorted = Object.entries(riskByType).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return null;
    return { label: TYPE_LABELS[sorted[0][0]] || sorted[0][0], risk: sorted[0][1] };
  }, [filteredEvents]);

  // ─── FREQUENCY OVER TIME (sparkline-like) ───────────────────────────────
  const maxDayCount = byDay.length > 0 ? Math.max(...byDay.map(d => d.count)) : 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: `${colors.primary}30`, borderTopColor: colors.primary }} />
      </div>
    );
  }

  const sampleSize = filteredEvents.length;
  const hasEnoughData = sampleSize >= 3;

  return (
    <div className="max-w-lg animate-reveal">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`, border: `1px solid ${colors.primary}20` }}>
          <span className="text-lg" style={{ filter: `drop-shadow(0 0 4px ${colors.primary}50)` }}>🎯</span>
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gradient">Temptations</h2>
          <p className="text-[0.6rem] text-white/30">Every blocked attempt, analyzed</p>
        </div>
      </div>

      {/* Date Range Selector */}
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

      {/* Sample Size + Confidence */}
      <div className="mb-5 px-4 py-3 rounded-xl border border-white/[0.04] bg-white/[0.01]">
        <div className="flex items-center justify-between">
          <span className="text-[0.6rem] text-white/30 uppercase tracking-[1.5px]">Sample Size</span>
          <span className="text-sm font-bold font-mono" style={{ color: colors.primary }}>{sampleSize}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[0.6rem] text-white/30 uppercase tracking-[1.5px]">Confidence</span>
          <span className="text-[0.6rem] font-bold" style={{ color: sampleSize >= 20 ? colors.primary : sampleSize >= 5 ? '#fbbf24' : '#ef4444' }}>
            {sampleSize >= 20 ? 'High' : sampleSize >= 5 ? 'Moderate' : 'Low'}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[0.6rem] text-white/30 uppercase tracking-[1.5px]">Date Range</span>
          <span className="text-[0.6rem] text-white/40">
            {byDay.length > 0 ? `${byDay[0].date} → ${byDay[byDay.length - 1].date}` : 'No data'}
          </span>
        </div>
      </div>

      {!hasEnoughData ? (
        <div className="relative rounded-xl p-8 overflow-hidden card-premium text-center">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}20, transparent)` }} />
          <div className="relative z-10">
            <p className="text-2xl mb-2">📉</p>
            <p className="text-sm font-semibold text-white/50 mb-1">Not Enough Data</p>
            <p className="text-[0.6rem] text-white/25">Need at least 3 blocked attempts to show patterns.</p>
            <p className="text-[0.6rem] text-white/15 mt-2">Current: {sampleSize} event{sampleSize !== 1 ? 's' : ''}</p>
          </div>
        </div>
      ) : (
        <>
          {/* ─── KEY INSIGHTS ────────────────────────────────────────────── */}
          <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5">
            <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)` }} />
            <div className="relative z-10">
              <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-4" style={{ color: `${colors.primary}80` }}>Key Insights</p>
              <div className="space-y-3">
                {mostCommonTemptation && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40">Most common temptation</span>
                    <span className="text-xs font-bold" style={{ color: colors.primary }}>{mostCommonTemptation.label}</span>
                  </div>
                )}
                {mostExpensiveType && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40">Most expensive temptation</span>
                    <span className="text-xs font-bold" style={{ color: '#fbbf24' }}>{mostExpensiveType.label} (≈${mostExpensiveType.risk.toLocaleString()})</span>
                  </div>
                )}
                {mostCommonHour && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40">Most common hour</span>
                    <span className="text-xs font-bold" style={{ color: colors.secondary }}>{mostCommonHour.label} ({mostCommonHour.count}x)</span>
                  </div>
                )}
                {peakWeekday && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40">Most common day</span>
                    <span className="text-xs font-bold text-white/60">{peakWeekday.label} ({peakWeekday.count}x)</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                  <span className="text-xs text-white/40">Total estimated risk prevented</span>
                  <span className="text-sm font-black font-mono" style={{ color: colors.primary }}>≈${totalEstimatedRisk.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── BY VIOLATION TYPE ──────────────────────────────────────── */}
          <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5">
            <div className="relative z-10">
              <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-4" style={{ color: `${colors.secondary}80` }}>By Violation Type</p>
              <div className="space-y-2.5">
                {byType.map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[0.65rem] text-white/50">{item.label}</span>
                      <span className="text-[0.6rem] font-bold font-mono text-white/40">{item.count} ({Math.round(item.percentage)}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.percentage}%`, background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── BY HOUR ───────────────────────────────────────────────── */}
          <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5">
            <div className="relative z-10">
              <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-4" style={{ color: `${colors.secondary}80` }}>By Hour</p>
              <div className="space-y-2">
                {byHour.slice(0, 8).map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-[0.6rem] font-mono text-white/30 w-10 shrink-0">{item.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${item.percentage}%`, background: `linear-gradient(90deg, ${colors.primary}80, ${colors.secondary}60)` }} />
                    </div>
                    <span className="text-[0.55rem] font-mono text-white/30 w-6 text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── BY WEEKDAY ────────────────────────────────────────────── */}
          <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5">
            <div className="relative z-10">
              <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-4" style={{ color: `${colors.secondary}80` }}>By Weekday</p>
              <div className="flex items-end gap-2 h-20">
                {WEEKDAYS.map((day, idx) => {
                  const entry = byWeekday.find(d => d.label === day);
                  const count = entry?.count || 0;
                  const maxCount = byWeekday[0]?.count || 1;
                  const height = count > 0 ? Math.max(10, (count / maxCount) * 100) : 4;
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[0.5rem] font-mono text-white/25">{count || ''}</span>
                      <div className="w-full rounded-t-sm" style={{ height: `${height}%`, background: count > 0 ? `linear-gradient(180deg, ${colors.primary}, ${colors.primary}40)` : 'rgba(255,255,255,0.03)' }} />
                      <span className="text-[0.5rem] text-white/20">{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ─── BY SYMBOL ─────────────────────────────────────────────── */}
          {bySymbol.length > 0 && bySymbol[0].label !== 'Unknown' && (
            <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5">
              <div className="relative z-10">
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-4" style={{ color: `${colors.secondary}80` }}>By Symbol</p>
                <div className="space-y-2.5">
                  {bySymbol.filter(s => s.label !== 'Unknown').slice(0, 6).map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-white/50">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${item.percentage}%`, background: colors.primary }} />
                        </div>
                        <span className="text-[0.55rem] font-mono text-white/30">{item.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── FREQUENCY OVER TIME ───────────────────────────────────── */}
          {byDay.length > 1 && (
            <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5">
              <div className="relative z-10">
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-4" style={{ color: `${colors.secondary}80` }}>Frequency Over Time</p>
                <div className="flex items-end gap-[2px] h-16">
                  {byDay.slice(-30).map((day, i) => {
                    const height = Math.max(4, (day.count / maxDayCount) * 100);
                    return (
                      <div
                        key={day.date}
                        className="flex-1 rounded-t-sm min-w-[3px] transition-all group relative"
                        style={{ height: `${height}%`, background: `linear-gradient(180deg, ${colors.primary}, ${colors.primary}30)` }}
                        title={`${day.date}: ${day.count} blocked`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[0.5rem] text-white/15">{byDay.slice(-30)[0]?.date || ''}</span>
                  <span className="text-[0.5rem] text-white/15">{byDay[byDay.length - 1]?.date || ''}</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── EXPLANATION FOOTNOTE ──────────────────────────────────── */}
          <p className="text-[0.5rem] text-white/15 text-center mt-4 italic">
            Risk estimates based on blocked order sizes and average $50/tick per contract.
            {sampleSize < 20 && ' Low sample size — patterns may not be reliable.'}
          </p>
        </>
      )}
    </div>
  );
};
