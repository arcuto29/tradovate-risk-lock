import React, { useState, useEffect } from 'react';
import { Newspaper, Calendar } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';
import { getEventInfo, renderStars } from '../data/news-event-info';
import type { NewsEventInfo } from '../data/news-event-info';

interface NewsEvent {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm ET
  impact: 'high' | 'medium';
  builtIn: boolean;
}

// 2026 Major Economic Events (High Impact)
const BUILT_IN_EVENTS_2026: NewsEvent[] = [
  // FOMC Meetings (2026 - 8 meetings)
  { id: 'fomc-1', name: 'FOMC Rate Decision', date: '2026-01-28', time: '14:00', impact: 'high', builtIn: true },
  { id: 'fomc-2', name: 'FOMC Rate Decision', date: '2026-03-18', time: '14:00', impact: 'high', builtIn: true },
  { id: 'fomc-3', name: 'FOMC Rate Decision', date: '2026-05-06', time: '14:00', impact: 'high', builtIn: true },
  { id: 'fomc-4', name: 'FOMC Rate Decision', date: '2026-06-17', time: '14:00', impact: 'high', builtIn: true },
  { id: 'fomc-5', name: 'FOMC Rate Decision', date: '2026-07-29', time: '14:00', impact: 'high', builtIn: true },
  { id: 'fomc-6', name: 'FOMC Rate Decision', date: '2026-09-16', time: '14:00', impact: 'high', builtIn: true },
  { id: 'fomc-7', name: 'FOMC Rate Decision', date: '2026-11-04', time: '14:00', impact: 'high', builtIn: true },
  { id: 'fomc-8', name: 'FOMC Rate Decision', date: '2026-12-16', time: '14:00', impact: 'high', builtIn: true },
  // NFP (First Friday of each month)
  { id: 'nfp-1', name: 'Non-Farm Payrolls', date: '2026-01-02', time: '08:30', impact: 'high', builtIn: true },
  { id: 'nfp-2', name: 'Non-Farm Payrolls', date: '2026-02-06', time: '08:30', impact: 'high', builtIn: true },
  { id: 'nfp-3', name: 'Non-Farm Payrolls', date: '2026-03-06', time: '08:30', impact: 'high', builtIn: true },
  { id: 'nfp-4', name: 'Non-Farm Payrolls', date: '2026-04-03', time: '08:30', impact: 'high', builtIn: true },
  { id: 'nfp-5', name: 'Non-Farm Payrolls', date: '2026-05-01', time: '08:30', impact: 'high', builtIn: true },
  { id: 'nfp-6', name: 'Non-Farm Payrolls', date: '2026-06-05', time: '08:30', impact: 'high', builtIn: true },
  { id: 'nfp-7', name: 'Non-Farm Payrolls', date: '2026-07-02', time: '08:30', impact: 'high', builtIn: true },
  { id: 'nfp-8', name: 'Non-Farm Payrolls', date: '2026-08-07', time: '08:30', impact: 'high', builtIn: true },
  { id: 'nfp-9', name: 'Non-Farm Payrolls', date: '2026-09-04', time: '08:30', impact: 'high', builtIn: true },
  { id: 'nfp-10', name: 'Non-Farm Payrolls', date: '2026-10-02', time: '08:30', impact: 'high', builtIn: true },
  { id: 'nfp-11', name: 'Non-Farm Payrolls', date: '2026-11-06', time: '08:30', impact: 'high', builtIn: true },
  { id: 'nfp-12', name: 'Non-Farm Payrolls', date: '2026-12-04', time: '08:30', impact: 'high', builtIn: true },
  // CPI (Monthly, usually mid-month)
  { id: 'cpi-1', name: 'CPI (Inflation)', date: '2026-01-14', time: '08:30', impact: 'high', builtIn: true },
  { id: 'cpi-2', name: 'CPI (Inflation)', date: '2026-02-11', time: '08:30', impact: 'high', builtIn: true },
  { id: 'cpi-3', name: 'CPI (Inflation)', date: '2026-03-11', time: '08:30', impact: 'high', builtIn: true },
  { id: 'cpi-4', name: 'CPI (Inflation)', date: '2026-04-14', time: '08:30', impact: 'high', builtIn: true },
  { id: 'cpi-5', name: 'CPI (Inflation)', date: '2026-05-12', time: '08:30', impact: 'high', builtIn: true },
  { id: 'cpi-6', name: 'CPI (Inflation)', date: '2026-06-10', time: '08:30', impact: 'high', builtIn: true },
  { id: 'cpi-7', name: 'CPI (Inflation)', date: '2026-07-14', time: '08:30', impact: 'high', builtIn: true },
  { id: 'cpi-8', name: 'CPI (Inflation)', date: '2026-08-12', time: '08:30', impact: 'high', builtIn: true },
  { id: 'cpi-9', name: 'CPI (Inflation)', date: '2026-09-15', time: '08:30', impact: 'high', builtIn: true },
  { id: 'cpi-10', name: 'CPI (Inflation)', date: '2026-10-13', time: '08:30', impact: 'high', builtIn: true },
  { id: 'cpi-11', name: 'CPI (Inflation)', date: '2026-11-10', time: '08:30', impact: 'high', builtIn: true },
  { id: 'cpi-12', name: 'CPI (Inflation)', date: '2026-12-10', time: '08:30', impact: 'high', builtIn: true },
  // PPI (Monthly)
  { id: 'ppi-1', name: 'PPI (Producer Prices)', date: '2026-01-15', time: '08:30', impact: 'medium', builtIn: true },
  { id: 'ppi-2', name: 'PPI (Producer Prices)', date: '2026-02-13', time: '08:30', impact: 'medium', builtIn: true },
  { id: 'ppi-3', name: 'PPI (Producer Prices)', date: '2026-03-12', time: '08:30', impact: 'medium', builtIn: true },
  { id: 'ppi-4', name: 'PPI (Producer Prices)', date: '2026-04-09', time: '08:30', impact: 'medium', builtIn: true },
  { id: 'ppi-5', name: 'PPI (Producer Prices)', date: '2026-05-14', time: '08:30', impact: 'medium', builtIn: true },
  { id: 'ppi-6', name: 'PPI (Producer Prices)', date: '2026-06-11', time: '08:30', impact: 'medium', builtIn: true },
  { id: 'ppi-7', name: 'PPI (Producer Prices)', date: '2026-07-16', time: '08:30', impact: 'medium', builtIn: true },
  { id: 'ppi-8', name: 'PPI (Producer Prices)', date: '2026-08-13', time: '08:30', impact: 'medium', builtIn: true },
  { id: 'ppi-9', name: 'PPI (Producer Prices)', date: '2026-09-11', time: '08:30', impact: 'medium', builtIn: true },
  { id: 'ppi-10', name: 'PPI (Producer Prices)', date: '2026-10-15', time: '08:30', impact: 'medium', builtIn: true },
  { id: 'ppi-11', name: 'PPI (Producer Prices)', date: '2026-11-12', time: '08:30', impact: 'medium', builtIn: true },
  { id: 'ppi-12', name: 'PPI (Producer Prices)', date: '2026-12-11', time: '08:30', impact: 'medium', builtIn: true },
];

export const NewsBlocker: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [enabled, setEnabled] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [notifyMinutesBefore, setNotifyMinutesBefore] = useState(15);
  const [blockMinutesBefore, setBlockMinutesBefore] = useState(30);
  const [blockMinutesAfter, setBlockMinutesAfter] = useState(15);
  const [customEvents, setCustomEvents] = useState<NewsEvent[]>([]);
  const [ffEvents, setFfEvents] = useState<NewsEvent[]>([]);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('08:30');
  const [saved, setSaved] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await (window as any).electronAPI?.getNewsBlockerConfig?.();
        if (data) {
          setEnabled(data.enabled || false);
          setNotifyEnabled(data.notifyEnabled !== false);
          setNotifyMinutesBefore(data.notifyMinutesBefore || 15);
          setBlockMinutesBefore(data.blockMinutesBefore || 30);
          setBlockMinutesAfter(data.blockMinutesAfter || 15);
          setCustomEvents(data.customEvents || []);
          setFfEvents(data.ffEvents || []);
        }
      } catch {}
    })();
  }, []);

  const handleSave = async () => {
    const allEventsForExtension = [...BUILT_IN_EVENTS_2026, ...customEvents, ...ffEvents].map(e => ({ date: e.date, time: e.time, name: e.name }));
    await (window as any).electronAPI?.updateNewsBlockerConfig?.({
      enabled, notifyEnabled, notifyMinutesBefore, blockMinutesBefore, blockMinutesAfter, customEvents, ffEvents, events: allEventsForExtension,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSyncFF = async () => {
    // FF blocks automated requests with Cloudflare (403)
    // Keeping function stub in case a free API becomes available
    setSyncing(true);
    setSyncStatus('Forex Factory blocks automated requests. Use the built-in events below or add custom dates.');
    setSyncing(false);
    setTimeout(() => setSyncStatus(''), 8000);
  };

  const addCustomEvent = () => {
    if (!newEventName.trim() || !newEventDate) return;
    const event: NewsEvent = {
      id: 'custom_' + Date.now(),
      name: newEventName.trim(),
      date: newEventDate,
      time: newEventTime || '08:30',
      impact: 'high',
      builtIn: false,
    };
    setCustomEvents([...customEvents, event]);
    setNewEventName('');
    setNewEventDate('');
    setNewEventTime('08:30');
    setShowAddForm(false);
  };

  const removeCustomEvent = (id: string) => {
    setCustomEvents(customEvents.filter(e => e.id !== id));
  };

  // Get upcoming events (next 7 days)
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const allEvents = [...BUILT_IN_EVENTS_2026, ...customEvents, ...ffEvents];
  const upcoming = allEvents
    .filter(e => e.date >= today && e.date <= nextWeek)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2 animate-reveal">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`, border: `1px solid ${colors.primary}20`}}>
          <Newspaper size={18} style={{color: colors.primary, filter: `drop-shadow(0 0 4px ${colors.primary}50)`}} />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-gradient">News Blocker</h2>
      </div>
      <p className="text-white/30 text-sm mb-6 leading-relaxed ml-14 animate-reveal">
        Auto-block trading before major economic events. No gambling the numbers.
      </p>

      {/* Enable toggle */}
      <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5 animate-reveal">
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full transition-all" style={{background: enabled ? colors.primary : 'rgba(255,255,255,0.15)', boxShadow: enabled ? `0 0 8px ${colors.primary}60` : 'none'}} />
            <span className="text-sm text-white/70 font-medium">Block trading around news events</span>
          </div>
          <div
            className={`toggle-premium ${enabled ? 'active' : ''}`}
            onClick={() => !isLocked && setEnabled(!enabled)}
            style={{ opacity: isLocked ? 0.3 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
          />
        </div>
      </div>

      {/* Notification toggle - works even if blocker is OFF */}
      <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5 animate-reveal">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full transition-all" style={{background: notifyEnabled ? colors.secondary : 'rgba(255,255,255,0.15)', boxShadow: notifyEnabled ? `0 0 8px ${colors.secondary}60` : 'none'}} />
              <span className="text-sm text-white/70 font-medium">Notify before high-impact news</span>
            </div>
            <p className="text-[0.6rem] text-white/25 mt-1 ml-5">Get a notification alert even if blocking is off</p>
          </div>
          <div
            className={`toggle-premium ${notifyEnabled ? 'active' : ''}`}
            onClick={() => setNotifyEnabled(!notifyEnabled)}
          />
        </div>
        {notifyEnabled && (
          <div className="relative z-10 mt-3 pt-3 border-t border-white/[0.04] flex items-center gap-3">
            <label className="text-[0.6rem] font-semibold tracking-[1px] uppercase text-white/25">Alert</label>
            <input
              type="number" min="5" max="60" step="5"
              value={notifyMinutesBefore}
              onChange={(e) => setNotifyMinutesBefore(Number(e.target.value) || 15)}
              className="w-16 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white font-mono text-xs font-bold text-center focus:outline-none transition-all input-premium"
            />
            <span className="text-[0.6rem] text-white/25">min before event</span>
          </div>
        )}
      </div>

      {/* Built-in Events Info */}
      <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5 animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)`}} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Calendar size={14} className="inline" />
            <p className="text-[0.6rem] font-bold tracking-[2px] uppercase" style={{color: `${colors.primary}80`}}>Auto-Included Events</p>
          </div>
          <p className="text-[0.6rem] text-white/35 leading-relaxed">
            FOMC Rate Decisions, Non-Farm Payrolls (NFP), CPI Inflation, and PPI Producer Prices are built-in for all of 2026. Add any other events below using custom dates.
          </p>
        </div>
      </div>

      {/* Upcoming Events - ALWAYS shown regardless of blocker on/off */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-5 animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.secondary}30, transparent)`}} />
        <div className="relative z-10">
          <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-4" style={{color: `${colors.secondary}80`}}>Upcoming (Next 7 Days)</p>
          {upcoming.length === 0 ? (
            <p className="text-xs text-white/20 text-center py-3">No events this week</p>
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 10).map((event) => {
                const isExpanded = expandedEventId === event.id;
                const info = getEventInfo(event.name);
                return (
                  <div key={event.id}>
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full" style={{background: event.impact === 'high' ? '#ef4444' : '#f59e0b'}} />
                        <div>
                          <span className="text-xs text-white/60 font-medium">{event.name}</span>
                          <p className="text-[0.55rem] text-white/20">{event.date} at {event.time} ET{(event as any).source === 'forex_factory' ? ' (FF)' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[0.6rem] font-bold transition-all hover:scale-110"
                          style={{
                            background: isExpanded ? `${colors.primary}20` : 'rgba(255,255,255,0.04)',
                            color: isExpanded ? colors.primary : 'rgba(255,255,255,0.3)',
                            border: `1px solid ${isExpanded ? colors.primary + '30' : 'rgba(255,255,255,0.06)'}`,
                          }}
                          title="Event info"
                        >
                          ⓘ
                        </button>
                        {!event.builtIn && !isLocked && !(event as any).source && (
                          <button onClick={() => removeCustomEvent(event.id)} className="text-white/20 hover:text-red-400 transition-colors text-sm press-scale">✕</button>
                        )}
                      </div>
                    </div>
                    {/* Info Panel - only shown when ⓘ is clicked */}
                    {isExpanded && (
                      <EventInfoPanel info={info} colors={colors} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {enabled && (
        <div className="space-y-4">
          {/* Block window */}
          <div className="relative rounded-xl p-6 overflow-hidden card-premium animate-reveal stagger-1">
            <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)`}} />
            <div className="relative z-10">
              <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-5" style={{color: `${colors.primary}80`}}>Block Window</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/25 mb-2">Minutes BEFORE event</label>
                  <input
                    type="number" min="5" max="120" step="5"
                    value={blockMinutesBefore}
                    onChange={(e) => setBlockMinutesBefore(Number(e.target.value) || 30)}
                    disabled={isLocked}
                    className="w-20 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-3 text-white font-mono text-sm font-bold text-center focus:outline-none transition-all disabled:opacity-30 input-premium"
                  />
                </div>
                <div>
                  <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/25 mb-2">Minutes AFTER event</label>
                  <input
                    type="number" min="0" max="60" step="5"
                    value={blockMinutesAfter}
                    onChange={(e) => setBlockMinutesAfter(Number(e.target.value) || 15)}
                    disabled={isLocked}
                    className="w-20 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-3 text-white font-mono text-sm font-bold text-center focus:outline-none transition-all disabled:opacity-30 input-premium"
                  />
                </div>
              </div>
              <p className="text-[0.6rem] text-white/15 mt-3">
                Trading blocked from {blockMinutesBefore}min before until {blockMinutesAfter}min after each event
              </p>
            </div>
          </div>

          {/* Block window config ends here */}
        </div>
      )}

      {/* Custom Events - ALWAYS visible regardless of blocker toggle */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium mt-4 animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)`}} />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase" style={{color: `${colors.primary}80`}}>Custom Events</p>
            {!isLocked && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-3 py-1.5 text-[0.6rem] font-bold rounded-lg press-scale transition-all"
                style={{background: `${colors.primary}15`, border: `1px solid ${colors.primary}25`, color: `${colors.primary}cc`}}
              >
                {showAddForm ? 'Cancel' : '+ Add Event'}
              </button>
            )}
          </div>

          {showAddForm && (
            <div className="mb-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3 animate-reveal">
              <input
                type="text" value={newEventName} onChange={(e) => setNewEventName(e.target.value)}
                placeholder="Event name (e.g. Fed Chair Speech)"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all placeholder:text-white/15 input-premium"
              />
              <div className="flex gap-3">
                <input
                  type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)}
                  className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all input-premium"
                />
                <input
                  type="time" value={newEventTime} onChange={(e) => setNewEventTime(e.target.value)}
                  className="w-28 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-3 text-white text-sm focus:outline-none transition-all input-premium"
                />
              </div>
              <button
                onClick={addCustomEvent}
                disabled={!newEventName.trim() || !newEventDate}
                className="w-full py-3 btn-premium text-xs uppercase tracking-[2px] rounded-xl press-scale disabled:opacity-30"
              >
                Add Event
              </button>
            </div>
          )}

          {customEvents.length === 0 && !showAddForm && (
            <p className="text-xs text-white/15 text-center py-3">No custom events. Add dates you want to avoid trading.</p>
          )}

          {customEvents.map((event) => (
            <div key={event.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] mb-2">
              <div>
                <span className="text-xs text-white/60 font-medium">{event.name}</span>
                <p className="text-[0.55rem] text-white/20">{event.date} at {event.time} ET</p>
              </div>
              {!isLocked && (
                <button onClick={() => removeCustomEvent(event.id)} className="text-white/20 hover:text-red-400 transition-colors text-sm press-scale">✕</button>
              )}
            </div>
          ))}
        </div>
      </div>
      {saved && (
        <div className="mt-6 px-5 py-3.5 rounded-xl border text-xs font-medium animate-reveal flex items-center gap-2" style={{borderColor: `${colors.primary}25`, background: `${colors.primary}06`, color: `${colors.primary}cc`}}>
          <span className="w-1.5 h-1.5 rounded-full" style={{background: colors.primary, boxShadow: `0 0 6px ${colors.primary}60`}} />
          News blocker saved
        </div>
      )}
      <button onClick={handleSave} disabled={isLocked} className="mt-6 px-8 py-3.5 btn-premium text-xs uppercase tracking-[2px] rounded-xl press-scale animate-reveal disabled:opacity-30">
        Save
      </button>
    </div>
  );
};

// ─── Event Info Panel (shown on ⓘ click) ────────────────────────────────────

const EventInfoPanel: React.FC<{ info: NewsEventInfo; colors: any }> = ({ info, colors }) => {
  return (
    <div className="mt-1 mb-2 ml-5 p-4 rounded-xl border animate-reveal" style={{ background: `${colors.primary}04`, borderColor: `${colors.primary}15` }}>
      {/* What it is */}
      <p className="text-[0.6rem] font-bold tracking-[1.5px] uppercase mb-2" style={{ color: `${colors.primary}70` }}>What This Is</p>
      <p className="text-xs text-white/50 leading-relaxed mb-3">{info.what}</p>

      {/* Why it matters */}
      <p className="text-[0.6rem] font-bold tracking-[1.5px] uppercase mb-2" style={{ color: `${colors.primary}70` }}>Why It Matters</p>
      <p className="text-xs text-white/50 leading-relaxed mb-3">{info.why}</p>

      {/* Affected Markets */}
      {info.markets.length > 0 && (
        <>
          <p className="text-[0.6rem] font-bold tracking-[1.5px] uppercase mb-2" style={{ color: `${colors.primary}70` }}>Affected Markets</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
            {info.markets.map((m) => (
              <div key={m.symbol} className="flex items-center justify-between">
                <span className="text-[0.6rem] font-mono font-bold text-white/40">{m.symbol}</span>
                <span className="text-[0.55rem] tracking-[1px]" style={{ color: m.rating >= 4 ? colors.primary : m.rating >= 3 ? '#fbbf24' : 'rgba(255,255,255,0.25)' }}>
                  {renderStars(m.rating)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sentinel Recommendation */}
      <div className="pt-3 border-t" style={{ borderColor: `${colors.primary}10` }}>
        <p className="text-[0.6rem] font-bold tracking-[1.5px] uppercase mb-1.5" style={{ color: `${colors.secondary}70` }}>Sentinel</p>
        <p className="text-[0.6rem] text-white/35 leading-relaxed">{info.sentinelReason}</p>
        <p className="text-[0.55rem] text-white/20 mt-2 leading-relaxed">
          Existing positions can always be reduced, closed, or cancelled. Sentinel never traps traders inside positions.
        </p>
      </div>
    </div>
  );
};