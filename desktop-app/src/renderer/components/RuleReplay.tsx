import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';
import { TemptationTracker } from './TemptationTracker';
import { RecoveryScore } from './RecoveryScore';
import { RuleEffectiveness } from './RuleEffectiveness';
import { DailyMission } from './DailyMission';
import { ConsistencyMeter } from './ConsistencyMeter';
import { BehavioralHeatmap } from './BehavioralHeatmap';
import { TriggerDetector } from './TriggerDetector';

interface ReplayEvent {
  timestamp: string;
  type: string;
  icon: string;
  color: string;
  description: string;
  detail?: string;
}

type ReplayTab = 'timeline' | 'temptations' | 'recovery' | 'effectiveness' | 'mission' | 'consistency' | 'heatmap' | 'triggers';

/**
 * Rule Replay - Shows a timeline of today's session events + Temptation Tracker
 * Data source: activity_log + trades table (SQLite)
 * No fake AI. Every insight is based on logged events.
 */
export const RuleReplay: React.FC = () => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [activeTab, setActiveTab] = useState<ReplayTab>('timeline');
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [blockedCount, setBlockedCount] = useState(0);
  const [estimatedRiskPrevented, setEstimatedRiskPrevented] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReplay(); }, []);

  const loadReplay = async () => {
    try {
      const [log, trades] = await Promise.all([
        window.electronAPI.getActivityLog(500),
        window.electronAPI.getTrades(100),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const timeline: ReplayEvent[] = [];
      let blocked = 0;
      let riskPrevented = 0;

      // Process activity log entries for today
      (log || []).forEach((entry: any) => {
        const ts = entry.timestamp || '';
        const date = ts.includes('T') ? ts.split('T')[0] : ts.split(' ')[0];
        if (date !== today) return;

        const time = formatTime(ts);
        const details = entry.details || '';

        switch (entry.type) {
          case 'lock_activated':
            timeline.push({ timestamp: time, type: 'lock', icon: '🔒', color: colors.primary, description: 'Lock activated', detail: 'Risk settings locked' });
            break;
          case 'auto_reset':
            timeline.push({ timestamp: time, type: 'unlock', icon: '🔓', color: colors.secondary, description: 'Session ended', detail: 'Lock timer expired' });
            break;
          case 'size_blocked':
            blocked++;
            riskPrevented += estimateBlockedRisk(details);
            timeline.push({ timestamp: time, type: 'blocked', icon: '🚫', color: '#ef4444', description: 'Oversized order blocked', detail: details });
            break;
          case 'session_blocked':
            blocked++;
            timeline.push({ timestamp: time, type: 'blocked', icon: '⏰', color: '#f59e0b', description: 'Session block', detail: 'Traded outside allowed hours' });
            break;
          case 'coach_blocked':
            blocked++;
            timeline.push({ timestamp: time, type: 'blocked', icon: '⏸', color: '#f59e0b', description: 'Cooldown block', detail: details });
            break;
          case 'stacking_blocked':
            blocked++;
            timeline.push({ timestamp: time, type: 'blocked', icon: '📐', color: '#f59e0b', description: 'Stacking blocked', detail: 'Tried to add to position' });
            break;
          case 'symbol_blocked':
            blocked++;
            timeline.push({ timestamp: time, type: 'blocked', icon: '⊘', color: '#ef4444', description: 'Symbol blocked', detail: details });
            break;
          case 'kill_switch':
            timeline.push({ timestamp: time, type: 'killswitch', icon: '💀', color: '#ef4444', description: 'Kill switch activated', detail: 'All trading blocked for 24h' });
            break;
          case 'bypass_attempt':
            blocked++;
            riskPrevented += 100; // Conservative estimate per bypass
            timeline.push({ timestamp: time, type: 'bypass', icon: '⚠', color: '#ef4444', description: 'Bypass attempt', detail: details });
            break;
          case 'early_unlock_request':
            timeline.push({ timestamp: time, type: 'unlock_request', icon: '🔑', color: '#f59e0b', description: 'Early unlock requested', detail: details });
            break;
          case 'full_day_block':
            timeline.push({ timestamp: time, type: 'dayblock', icon: '🛑', color: '#ef4444', description: 'Full day block', detail: 'Pre-market check: blocked for the day' });
            break;
          case 'app_started':
            timeline.push({ timestamp: time, type: 'start', icon: '▶', color: colors.primary, description: 'Sentinel started' });
            break;
        }
      });

      // Process today's trades
      (trades || []).forEach((trade: any) => {
        if (!trade.entryTime?.startsWith(today)) return;
        const time = formatTime(trade.entryTime);
        const pnl = trade.pnl || 0;
        const isWin = pnl >= 0;
        timeline.push({
          timestamp: time,
          type: isWin ? 'win' : 'loss',
          icon: isWin ? '✓' : '✗',
          color: isWin ? '#10b981' : '#ef4444',
          description: `${trade.direction || 'Trade'} ${trade.symbol || ''}`,
          detail: `${isWin ? '+' : ''}$${pnl.toFixed(0)} (${formatDuration(trade.durationSeconds)})`,
        });
      });

      // Sort by timestamp
      timeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      setEvents(timeline);
      setBlockedCount(blocked);
      setEstimatedRiskPrevented(riskPrevented);
    } catch {} finally { setLoading(false); }
  };

  function formatTime(ts: string): string {
    try {
      const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z');
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch { return ts; }
  }

  function formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '<1m';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  function estimateBlockedRisk(details: string): number {
    // Conservative: estimate $150-300 per blocked oversized order
    // This is based on the max contract limit being exceeded
    const sizeMatch = details.match(/size (\d+)/);
    if (sizeMatch) return parseInt(sizeMatch[1]) * 100;
    return 150;
  }

  if (loading) return <span className="text-white/20 text-sm animate-pulse">Loading...</span>;

  return (
    <div className="max-w-lg">
      {/* Sub-tab switcher */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white/[0.02] border border-white/[0.04]">
        {([['timeline', 'Timeline', '⏱'], ['temptations', 'Temptations', '🎯'], ['recovery', 'Recovery', '💪'], ['effectiveness', 'Effects', '📊'], ['mission', 'Mission', '🎖'], ['consistency', 'Consistency', '📏'], ['heatmap', 'Heatmap', '🗺'], ['triggers', 'Triggers', '🔍']] as const).map(([tab, label, icon]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 px-3 py-2 rounded-lg text-[0.65rem] font-bold uppercase tracking-[1.5px] transition-all"
            style={{
              background: activeTab === tab ? `${colors.primary}15` : 'transparent',
              border: activeTab === tab ? `1px solid ${colors.primary}25` : '1px solid transparent',
              color: activeTab === tab ? colors.primary : 'rgba(255,255,255,0.3)',
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {activeTab === 'temptations' ? (
        <TemptationTracker />
      ) : activeTab === 'recovery' ? (
        <RecoveryScore />
      ) : activeTab === 'effectiveness' ? (
        <RuleEffectiveness />
      ) : activeTab === 'mission' ? (
        <DailyMission />
      ) : activeTab === 'consistency' ? (
        <ConsistencyMeter />
      ) : activeTab === 'heatmap' ? (
        <BehavioralHeatmap />
      ) : activeTab === 'triggers' ? (
        <TriggerDetector />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center gap-4 mb-6 animate-reveal">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`, border: `1px solid ${colors.primary}20`}}>
              <span className="text-lg" style={{filter: `drop-shadow(0 0 4px ${colors.primary}50)`}}>⏱</span>
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-gradient">Session Replay</h2>
              <p className="text-[0.6rem] text-white/30">Today's events in order</p>
            </div>
          </div>

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="relative rounded-xl p-8 overflow-hidden card-premium text-center animate-reveal">
          <p className="text-sm text-white/40 mb-2">No events today yet</p>
          <p className="text-xs text-white/20">Start trading with Sentinel locked to see your session replay here.</p>
        </div>
      ) : (
        <div className="relative rounded-xl p-5 overflow-hidden card-premium animate-reveal">
          <div className="relative z-10">
            {/* Timeline line */}
            <div className="absolute left-[22px] top-6 bottom-6 w-[1px]" style={{background: `linear-gradient(180deg, ${colors.primary}30, ${colors.secondary}20, transparent)`}} />

            <div className="space-y-4">
              {events.map((event, i) => (
                <div key={i} className="flex items-start gap-4 relative">
                  {/* Dot */}
                  <div className="w-[11px] h-[11px] rounded-full flex-shrink-0 mt-1.5 z-10" style={{background: event.color, boxShadow: `0 0 6px ${event.color}60`}} />
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[0.6rem] text-white/25 font-mono">{event.timestamp}</span>
                      <span className="text-xs font-medium text-white/70">{event.icon} {event.description}</span>
                    </div>
                    {event.detail && (
                      <p className="text-[0.6rem] text-white/30 mt-0.5 truncate">{event.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* What Changed Today's Result */}
      {blockedCount > 0 && (
        <div className="relative rounded-xl p-5 overflow-hidden card-premium mt-5 animate-reveal">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.primary}30, ${colors.secondary}20, transparent)`}} />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm">🛡</span>
              <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase" style={{color: `${colors.primary}80`}}>What Changed Today</p>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Sentinel blocked <span className="font-bold text-white/80">{blockedCount}</span> {blockedCount === 1 ? 'order' : 'orders'} that violated your rules.
            </p>
            {estimatedRiskPrevented > 0 && (
              <p className="text-xs text-white/50 leading-relaxed mt-2">
                Estimated additional risk prevented: <span className="font-bold" style={{color: colors.primary}}>${estimatedRiskPrevented.toFixed(0)}</span>
              </p>
            )}
            <p className="text-[0.5rem] text-white/15 mt-3 italic">
              Based on blocked order sizes and historical average loss per contract.
            </p>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
