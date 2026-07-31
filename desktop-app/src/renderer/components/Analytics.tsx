import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

interface TradeStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  grossProfit: number;
  grossLoss: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  avgDurationSeconds: number;
  maxConsecWins: number;
  maxConsecLosses: number;
  bestDay: { date: string; pnl: number };
  worstDay: { date: string; pnl: number };
  byWeekday: Record<number, { pnl: number; count: number }>;
  byHour: Record<number, { pnl: number; count: number; wins: number }>;
  dailyPnLs: { date: string; pnl: number }[];
  equityCurve: { date: string; pnl: number }[];
  tradesPerDay: number;
}

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


interface Insight {
  text: string;
  confidence: 'high' | 'medium' | 'low';
  category: 'performance' | 'discipline' | 'timing' | 'behavior' | 'risk';
  icon: string;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatCurrency(v: number): string {
  const prefix = v >= 0 ? '+$' : '-$';
  return prefix + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


function generateInsights(stats: TradeStats, trades: Trade[], violations: any[]): Insight[] {
  const insights: Insight[] = [];
  if (!stats || stats.totalTrades < 5) return insights;

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Best/worst hour
  const hourEntries = Object.entries(stats.byHour).map(([h, d]) => ({ hour: Number(h), ...d, winRate: d.count > 0 ? (d.wins / d.count) * 100 : 0 }));
  const profitableHours = hourEntries.filter(h => h.pnl > 0 && h.count >= 3).sort((a, b) => b.pnl - a.pnl);
  const unprofitableHours = hourEntries.filter(h => h.pnl < 0 && h.count >= 3).sort((a, b) => a.pnl - b.pnl);

  if (profitableHours.length > 0) {
    const best = profitableHours[0];
    const hStr = best.hour === 0 ? '12 AM' : best.hour < 12 ? `${best.hour} AM` : best.hour === 12 ? '12 PM' : `${best.hour - 12} PM`;
    insights.push({ text: `Your most profitable hour is ${hStr} (${formatCurrency(best.pnl)} across ${best.count} trades, ${Math.round(best.winRate)}% win rate).`, confidence: best.count >= 10 ? 'high' : 'medium', category: 'timing', icon: '⏰' });
  }
  if (unprofitableHours.length > 0) {
    const worst = unprofitableHours[0];
    const hStr = worst.hour === 0 ? '12 AM' : worst.hour < 12 ? `${worst.hour} AM` : worst.hour === 12 ? '12 PM' : `${worst.hour - 12} PM`;
    insights.push({ text: `Avoid trading around ${hStr}. You've lost ${formatCurrency(Math.abs(worst.pnl))} in ${worst.count} trades at this time (${Math.round(worst.winRate)}% win rate).`, confidence: worst.count >= 10 ? 'high' : 'medium', category: 'timing', icon: '⚠' });
  }

  // Best/worst weekday
  const dayEntries = Object.entries(stats.byWeekday).map(([d, data]) => ({ day: Number(d), ...data })).filter(d => d.count >= 3);
  const bestDay = dayEntries.sort((a, b) => b.pnl - a.pnl)[0];
  const worstDay = dayEntries.sort((a, b) => a.pnl - b.pnl)[0];
  if (bestDay && bestDay.pnl > 0) {
    insights.push({ text: `${dayNames[bestDay.day]} is your best day (${formatCurrency(bestDay.pnl)} total, ${bestDay.count} trades). Focus your best setups here.`, confidence: bestDay.count >= 8 ? 'high' : 'medium', category: 'timing', icon: '📅' });
  }
  if (worstDay && worstDay.pnl < 0) {
    insights.push({ text: `${dayNames[worstDay.day]} is costing you money (${formatCurrency(worstDay.pnl)} total, ${worstDay.count} trades). Consider reducing size or skipping this day.`, confidence: worstDay.count >= 8 ? 'high' : 'medium', category: 'timing', icon: '📅' });
  }

  // Trade frequency insight
  if (stats.tradesPerDay > 8) {
    insights.push({ text: `You average ${stats.tradesPerDay} trades per day. High frequency often leads to overtrading. Your best days likely have fewer trades.`, confidence: 'high', category: 'behavior', icon: '📊' });
  }


  // Duration insight
  const shortTrades = trades.filter(t => t.durationSeconds > 0 && t.durationSeconds < 60);
  const longTrades = trades.filter(t => t.durationSeconds >= 300);
  if (shortTrades.length >= 5) {
    const shortWinRate = (shortTrades.filter(t => t.result === 'win').length / shortTrades.length) * 100;
    const longWinRate = longTrades.length >= 5 ? (longTrades.filter(t => t.result === 'win').length / longTrades.length) * 100 : 0;
    if (longWinRate > shortWinRate + 15 && longTrades.length >= 5) {
      insights.push({ text: `Trades held longer than 5 minutes have a ${Math.round(longWinRate)}% win rate vs ${Math.round(shortWinRate)}% for scalps under 1 minute. Patience pays.`, confidence: 'high', category: 'performance', icon: '⏱' });
    }
  }

  // Avg win vs avg loss (risk/reward)
  if (stats.avgWin > 0 && stats.avgLoss > 0) {
    const rr = stats.avgWin / stats.avgLoss;
    if (rr < 1) {
      insights.push({ text: `Your average win ($${stats.avgWin.toFixed(0)}) is smaller than your average loss ($${stats.avgLoss.toFixed(0)}). Risk/reward ratio: ${rr.toFixed(2)}. You need a higher win rate to stay profitable.`, confidence: 'high', category: 'risk', icon: '⚖' });
    } else if (rr > 2) {
      insights.push({ text: `Strong risk/reward: ${rr.toFixed(2)}R. Your winners are ${rr.toFixed(1)}x your losers. Even with a lower win rate you stay profitable.`, confidence: 'high', category: 'risk', icon: '💪' });
    }
  }

  // Consecutive losses pattern
  if (stats.maxConsecLosses >= 3) {
    // Check if trades after 2+ losses tend to be worse
    let afterStreakTrades = 0;
    let afterStreakLosses = 0;
    let streak = 0;
    const sortedTrades = [...trades].sort((a, b) => a.entryTime.localeCompare(b.entryTime));
    for (const t of sortedTrades) {
      if (streak >= 2) { afterStreakTrades++; if (t.result === 'loss') afterStreakLosses++; }
      if (t.result === 'loss') streak++;
      else streak = 0;
    }
    if (afterStreakTrades >= 5) {
      const afterLossRate = Math.round((afterStreakLosses / afterStreakTrades) * 100);
      if (afterLossRate > 60) {
        insights.push({ text: `After 2+ consecutive losses, ${afterLossRate}% of your next trades are also losses (${afterStreakTrades} samples). Walking away after 2 losses would save you money.`, confidence: 'high', category: 'behavior', icon: '🔥' });
      }
    }
  }

  // Profit factor insight
  if (stats.profitFactor > 0 && stats.profitFactor < 1) {
    insights.push({ text: `Profit factor is ${stats.profitFactor.toFixed(2)} (below 1.0 = losing money). For every $1 you lose, you only make $${stats.profitFactor.toFixed(2)} back. Tighten stops or improve entries.`, confidence: 'high', category: 'performance', icon: '📉' });
  } else if (stats.profitFactor >= 2) {
    insights.push({ text: `Profit factor of ${stats.profitFactor.toFixed(2)} is excellent. You make $${stats.profitFactor.toFixed(2)} for every $1 lost. Keep doing what you're doing.`, confidence: 'high', category: 'performance', icon: '🏆' });
  }

  // Size-based insight
  const smallTrades = trades.filter(t => t.size === 1);
  const bigTrades = trades.filter(t => t.size > 1);
  if (smallTrades.length >= 5 && bigTrades.length >= 5) {
    const smallPnl = smallTrades.reduce((s, t) => s + t.pnl, 0);
    const bigPnl = bigTrades.reduce((s, t) => s + t.pnl, 0);
    if (smallPnl > 0 && bigPnl < 0) {
      insights.push({ text: `You're profitable on 1-contract trades (${formatCurrency(smallPnl)}) but losing on larger sizes (${formatCurrency(bigPnl)}). Sizing up might be hurting your edge.`, confidence: 'high', category: 'risk', icon: '📐' });
    }
  }

  // Violation correlation
  if (violations.length >= 5) {
    const violationDates = new Set(violations.map((v: any) => {
      const ts = v.timestamp || '';
      return ts.includes('T') ? ts.split('T')[0] : ts.split(' ')[0];
    }));
    const tradingDates = new Set(trades.map(t => t.entryTime?.split('T')[0]));
    let violationDayPnl = 0, cleanDayPnl = 0, vDays = 0, cDays = 0;
    stats.dailyPnLs.forEach(d => {
      if (violationDates.has(d.date)) { violationDayPnl += d.pnl; vDays++; }
      else if (tradingDates.has(d.date)) { cleanDayPnl += d.pnl; cDays++; }
    });
    if (vDays >= 3 && cDays >= 3) {
      const avgVDay = violationDayPnl / vDays;
      const avgCDay = cleanDayPnl / cDays;
      if (avgCDay > avgVDay + 50) {
        insights.push({ text: `Days without rule violations average ${formatCurrency(avgCDay)} vs ${formatCurrency(avgVDay)} on violation days. Following your rules literally makes you more money.`, confidence: 'high', category: 'discipline', icon: '✅' });
      }
    }
  }

  return insights;
}


export const Analytics: React.FC = () => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'trades' | 'insights'>('overview');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [s, t, log] = await Promise.all([
        window.electronAPI.getTradeStats(),
        window.electronAPI.getTrades(500),
        window.electronAPI.getActivityLog(2000),
      ]);
      setStats(s);
      setTrades(t || []);
      const violationTypes = ['size_blocked', 'session_blocked', 'symbol_blocked', 'coach_blocked', 'stacking_blocked', 'bypass_attempt', 'extension_disconnected', 'kill_switch'];
      setViolations((log || []).filter((e: any) => violationTypes.includes(e.type)));
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <span className="text-white/20 text-sm animate-pulse">Loading analytics...</span>;

  const insights = stats ? generateInsights(stats, trades, violations) : [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2 animate-reveal">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`, border: `1px solid ${colors.primary}20`}}>
          <span className="text-lg" style={{filter: `drop-shadow(0 0 4px ${colors.primary}50)`}}>📈</span>
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gradient">Analytics</h2>
          <p className="text-[0.6rem] text-white/30">Performance, patterns, and AI insights</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mt-4 mb-6 animate-reveal">
        {(['overview', 'trades', 'insights'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-[1px] transition-all press-scale ${tab === t ? 'btn-premium' : 'bg-white/[0.03] border border-white/[0.06] text-white/30'}`}
          >{t}</button>
        ))}
      </div>


      {/* No data state */}
      {(!stats || stats.totalTrades === 0) && tab !== 'insights' && (
        <div className="relative rounded-xl p-8 overflow-hidden card-premium text-center animate-reveal">
          <p className="text-lg font-bold text-white/40 mb-2">No trade data yet</p>
          <p className="text-xs text-white/20 max-w-sm mx-auto">Trade with the extension active and locked. Every trade fill gets recorded here automatically. Use the Simulator (Ctrl+Shift+D) to test with fake data.</p>
        </div>
      )}

      {/* OVERVIEW TAB */}
      {tab === 'overview' && stats && stats.totalTrades > 0 && (
        <div className="space-y-4 animate-reveal">
          {/* Top Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="relative rounded-xl p-4 overflow-hidden card-premium text-center">
              <p className="text-[0.55rem] text-white/25 uppercase tracking-[1px] mb-1">Net P&L</p>
              <p className={`text-xl font-black font-mono ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(stats.totalPnl)}</p>
            </div>
            <div className="relative rounded-xl p-4 overflow-hidden card-premium text-center">
              <p className="text-[0.55rem] text-white/25 uppercase tracking-[1px] mb-1">Win Rate</p>
              <p className="text-xl font-black font-mono" style={{color: stats.winRate >= 50 ? colors.primary : '#ef4444'}}>{stats.winRate}%</p>
              <p className="text-[0.5rem] text-white/15">{stats.wins}W / {stats.losses}L</p>
            </div>
            <div className="relative rounded-xl p-4 overflow-hidden card-premium text-center">
              <p className="text-[0.55rem] text-white/25 uppercase tracking-[1px] mb-1">Profit Factor</p>
              <p className="text-xl font-black font-mono" style={{color: stats.profitFactor >= 1 ? colors.primary : '#ef4444'}}>{stats.profitFactor}</p>
            </div>
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Avg Win', value: `$${stats.avgWin.toFixed(0)}`, color: 'text-emerald-400' },
              { label: 'Avg Loss', value: `-$${stats.avgLoss.toFixed(0)}`, color: 'text-red-400' },
              { label: 'Largest Win', value: `$${stats.largestWin.toFixed(0)}`, color: 'text-emerald-400' },
              { label: 'Largest Loss', value: `-$${Math.abs(stats.largestLoss).toFixed(0)}`, color: 'text-red-400' },
            ].map((s, i) => (
              <div key={i} className="relative rounded-lg p-3 overflow-hidden card-premium text-center">
                <p className="text-[0.5rem] text-white/20 uppercase tracking-[0.5px] mb-0.5">{s.label}</p>
                <p className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Total Trades', value: String(stats.totalTrades) },
              { label: 'Trades/Day', value: String(stats.tradesPerDay) },
              { label: 'Avg Duration', value: formatDuration(stats.avgDurationSeconds) },
              { label: 'Max Consec Loss', value: String(stats.maxConsecLosses) },
            ].map((s, i) => (
              <div key={i} className="relative rounded-lg p-3 overflow-hidden card-premium text-center">
                <p className="text-[0.5rem] text-white/20 uppercase tracking-[0.5px] mb-0.5">{s.label}</p>
                <p className="text-sm font-bold font-mono text-white/60">{s.value}</p>
              </div>
            ))}
          </div>


          {/* Equity Curve */}
          {stats.equityCurve.length > 1 && (
            <div className="relative rounded-xl p-5 overflow-hidden card-premium">
              <p className="text-[0.6rem] font-bold tracking-[2px] uppercase mb-4" style={{color: `${colors.primary}80`}}>Equity Curve</p>
              <div className="h-32 flex items-end gap-px">
                {(() => {
                  const data = stats.equityCurve;
                  const maxVal = Math.max(...data.map(d => d.pnl), 0);
                  const minVal = Math.min(...data.map(d => d.pnl), 0);
                  const range = maxVal - minVal || 1;
                  const zeroY = ((maxVal) / range) * 100;
                  return data.slice(-60).map((point, i) => {
                    const height = ((point.pnl - minVal) / range) * 100;
                    return (
                      <div key={i} className="flex-1 relative" style={{height: '100%'}}>
                        <div className="absolute bottom-0 w-full rounded-t-sm transition-all" style={{
                          height: `${Math.max(height, 1)}%`,
                          background: point.pnl >= 0 ? `${colors.primary}80` : 'rgba(239,68,68,0.6)',
                        }} />
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="flex justify-between mt-2 text-[0.5rem] text-white/15">
                <span>{stats.equityCurve[0]?.date}</span>
                <span>{stats.equityCurve[stats.equityCurve.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {/* Daily P&L Calendar */}
          {stats.dailyPnLs.length > 0 && (
            <div className="relative rounded-xl p-5 overflow-hidden card-premium">
              <p className="text-[0.6rem] font-bold tracking-[2px] uppercase mb-4" style={{color: `${colors.secondary}80`}}>Daily P&L</p>
              <div className="grid grid-cols-7 gap-1.5">
                {stats.dailyPnLs.slice(-28).map((day, i) => (
                  <div key={i} className="rounded-md p-1.5 text-center" style={{
                    background: day.pnl > 0 ? `rgba(16,185,129,${Math.min(0.4, Math.abs(day.pnl) / 1000)})` : day.pnl < 0 ? `rgba(239,68,68,${Math.min(0.4, Math.abs(day.pnl) / 1000)})` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${day.pnl > 0 ? 'rgba(16,185,129,0.2)' : day.pnl < 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)'}`,
                  }} title={`${day.date}: ${formatCurrency(day.pnl)}`}>
                    <span className="text-[0.45rem] text-white/20 block">{parseInt(day.date.split('-')[2])}</span>
                    <span className={`text-[0.5rem] font-bold font-mono ${day.pnl > 0 ? 'text-emerald-400' : day.pnl < 0 ? 'text-red-400' : 'text-white/10'}`}>
                      {day.pnl !== 0 ? (day.pnl > 0 ? '+' : '') + Math.round(day.pnl) : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* P&L by Hour */}
          <div className="relative rounded-xl p-5 overflow-hidden card-premium">
            <p className="text-[0.6rem] font-bold tracking-[2px] uppercase mb-4 text-white/30">P&L by Hour</p>
            <div className="flex items-end gap-0.5 h-20">
              {Array.from({length: 14}, (_, i) => i + 6).map(hour => {
                const data = stats.byHour[hour] || { pnl: 0, count: 0, wins: 0 };
                const allPnls = Object.values(stats.byHour).map(d => Math.abs(d.pnl));
                const maxPnl = Math.max(...allPnls, 1);
                const height = (Math.abs(data.pnl) / maxPnl) * 100;
                return (
                  <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-sm" style={{height: `${Math.max(height, 3)}%`, background: data.pnl >= 0 ? `${colors.primary}70` : 'rgba(239,68,68,0.6)'}} />
                    <span className="text-[0.45rem] text-white/15">{hour}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* P&L by Weekday */}
          <div className="relative rounded-xl p-5 overflow-hidden card-premium">
            <p className="text-[0.6rem] font-bold tracking-[2px] uppercase mb-4 text-white/30">P&L by Weekday</p>
            <div className="flex items-end gap-3 h-16">
              {[1,2,3,4,5].map(day => {
                const data = stats.byWeekday[day] || { pnl: 0, count: 0 };
                const allPnls = [1,2,3,4,5].map(d => Math.abs((stats.byWeekday[d] || {pnl:0}).pnl));
                const maxPnl = Math.max(...allPnls, 1);
                const height = (Math.abs(data.pnl) / maxPnl) * 100;
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-sm" style={{height: `${Math.max(height, 5)}%`, background: data.pnl >= 0 ? `${colors.primary}70` : 'rgba(239,68,68,0.6)'}} />
                    <span className="text-[0.55rem] text-white/25 font-medium">{dayNames[day]}</span>
                    <span className={`text-[0.5rem] font-mono ${data.pnl >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>{data.count > 0 ? (data.pnl > 0 ? '+' : '') + Math.round(data.pnl) : '-'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Best/Worst Day */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative rounded-lg p-4 overflow-hidden card-premium">
              <p className="text-[0.5rem] text-white/20 uppercase tracking-[0.5px] mb-1">Best Day</p>
              <p className="text-sm font-bold font-mono text-emerald-400">{formatCurrency(stats.bestDay.pnl)}</p>
              <p className="text-[0.5rem] text-white/15">{stats.bestDay.date}</p>
            </div>
            <div className="relative rounded-lg p-4 overflow-hidden card-premium">
              <p className="text-[0.5rem] text-white/20 uppercase tracking-[0.5px] mb-1">Worst Day</p>
              <p className="text-sm font-bold font-mono text-red-400">{formatCurrency(stats.worstDay.pnl)}</p>
              <p className="text-[0.5rem] text-white/15">{stats.worstDay.date}</p>
            </div>
          </div>
        </div>
      )}


      {/* TRADES TAB */}
      {tab === 'trades' && trades.length > 0 && (
        <div className="animate-reveal">
          <div className="relative rounded-xl overflow-hidden card-premium">
            <div className="overflow-x-auto">
              <table className="w-full text-[0.6rem]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-3 py-2.5 text-white/25 font-bold uppercase tracking-[1px]">Symbol</th>
                    <th className="text-left px-3 py-2.5 text-white/25 font-bold uppercase tracking-[1px]">Size</th>
                    <th className="text-left px-3 py-2.5 text-white/25 font-bold uppercase tracking-[1px]">Dir</th>
                    <th className="text-left px-3 py-2.5 text-white/25 font-bold uppercase tracking-[1px]">Entry</th>
                    <th className="text-left px-3 py-2.5 text-white/25 font-bold uppercase tracking-[1px]">Duration</th>
                    <th className="text-right px-3 py-2.5 text-white/25 font-bold uppercase tracking-[1px]">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.slice(0, 50).map((trade) => (
                    <tr key={trade.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5 font-mono text-white/60 font-medium">{trade.symbol}</td>
                      <td className="px-3 py-2.5 font-mono text-white/40">{trade.size}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${trade.direction === 'Long' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'}`}>
                          {trade.direction}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-white/30">{new Date(trade.entryTime).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-white/30 font-mono">{formatDuration(trade.durationSeconds)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(trade.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {trades.length > 50 && (
              <p className="text-center text-[0.5rem] text-white/15 py-2 border-t border-white/[0.04]">Showing 50 of {trades.length} trades</p>
            )}
          </div>
        </div>
      )}

      {tab === 'trades' && trades.length === 0 && (
        <div className="relative rounded-xl p-8 overflow-hidden card-premium text-center animate-reveal">
          <p className="text-lg font-bold text-white/40 mb-2">No trades recorded</p>
          <p className="text-xs text-white/20">Trade with the app locked and extension connected. Every fill gets logged here.</p>
        </div>
      )}


      {/* INSIGHTS TAB */}
      {tab === 'insights' && (
        <div className="space-y-4 animate-reveal">
          {/* AI Insights from trade data */}
          {insights.length > 0 && (
            <div className="relative rounded-xl p-6 overflow-hidden card-premium">
              <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.primary}30, ${colors.secondary}20, transparent)`}} />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-base">🧠</span>
                  <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase" style={{color: `${colors.primary}80`}}>AI Trading Insights</p>
                  <span className="text-[0.5rem] text-white/15 ml-auto">{stats?.totalTrades || 0} trades analyzed</span>
                </div>
                <div className="space-y-3">
                  {insights.map((insight, i) => (
                    <div key={i} className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-all">
                      <div className="flex items-start gap-3">
                        <span className="text-base mt-0.5">{insight.icon}</span>
                        <div className="flex-1">
                          <p className="text-xs text-white/65 leading-relaxed">{insight.text}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className={`text-[0.5rem] px-1.5 py-0.5 rounded font-bold uppercase tracking-[0.5px] ${
                              insight.confidence === 'high' ? 'bg-emerald-400/10 text-emerald-400/70 border border-emerald-400/20' :
                              insight.confidence === 'medium' ? 'bg-amber-400/10 text-amber-400/70 border border-amber-400/20' :
                              'bg-white/5 text-white/30 border border-white/10'
                            }`}>{insight.confidence}</span>
                            <span className={`text-[0.5rem] px-1.5 py-0.5 rounded border border-white/[0.06] text-white/25`}>{insight.category}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Discipline insights from violation data */}
          {violations.length > 0 && (
            <div className="relative rounded-xl p-6 overflow-hidden card-premium">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-base">🛡</span>
                  <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase" style={{color: `${colors.secondary}80`}}>Discipline Insights</p>
                </div>
                <div className="space-y-3">
                  {(() => {
                    const dInsights: { text: string; icon: string }[] = [];
                    const vByHour: number[] = new Array(24).fill(0);
                    const vByDay: number[] = new Array(7).fill(0);
                    violations.forEach((v: any) => {
                      const ts = v.timestamp || '';
                      const h = parseInt((ts.includes('T') ? ts.split('T')[1] : ts.split(' ')[1] || '').split(':')[0] || '0');
                      if (!isNaN(h)) vByHour[h]++;
                      const date = ts.includes('T') ? ts.split('T')[0] : ts.split(' ')[0];
                      if (date) { const d = new Date(date); if (!isNaN(d.getTime())) vByDay[d.getDay()]++; }
                    });
                    const maxH = Math.max(...vByHour);
                    if (maxH >= 3) {
                      const worstH = vByHour.indexOf(maxH);
                      const hStr = worstH < 12 ? `${worstH || 12} AM` : `${worstH === 12 ? 12 : worstH - 12} PM`;
                      dInsights.push({ text: `Most rule violations happen around ${hStr} (${maxH} violations). This is when your discipline breaks down.`, icon: '⏰' });
                    }
                    const maxD = Math.max(...vByDay.slice(1, 6));
                    if (maxD >= 3) {
                      const worstD = vByDay.indexOf(maxD);
                      dInsights.push({ text: `${dayNames[worstD]} has the most violations (${maxD}). Consider adding tighter rules for this day.`, icon: '📅' });
                    }
                    if (violations.length >= 10) {
                      const types: Record<string, number> = {};
                      violations.forEach((v: any) => { types[v.type] = (types[v.type] || 0) + 1; });
                      const top = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
                      const labels: Record<string, string> = { size_blocked: 'exceeding position limits', session_blocked: 'trading outside hours', coach_blocked: 'ignoring cooldowns', stacking_blocked: 'stacking positions', bypass_attempt: 'bypass attempts' };
                      dInsights.push({ text: `Your #1 weakness is ${labels[top[0]] || top[0]} (${top[1]} times). Focus on fixing this one thing first.`, icon: '🎯' });
                    }
                    return dInsights.map((d, i) => (
                      <div key={i} className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-start gap-3">
                        <span className="text-base">{d.icon}</span>
                        <p className="text-xs text-white/60 leading-relaxed">{d.text}</p>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {insights.length === 0 && violations.length === 0 && (
            <div className="relative rounded-xl p-8 overflow-hidden card-premium text-center">
              <p className="text-lg font-bold text-white/40 mb-2">Not enough data for insights</p>
              <p className="text-xs text-white/20 max-w-sm mx-auto">Trade for a few more sessions. AI insights appear once you have at least 5 trades or 5 violations recorded.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
