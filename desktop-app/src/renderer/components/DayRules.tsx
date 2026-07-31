import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

interface DayConfig {
  enabled: boolean;
  blocked: boolean;
  blockedUntil: string; // HH:mm - block until this time (empty = all day)
  maxTrades: number;
  lossLimit: number;
  sessionEnd: string;
  tighten: boolean;
}

const DEFAULT_CONFIG: DayConfig = {
  enabled: false,
  blocked: false,
  blockedUntil: '',
  maxTrades: 0,
  lossLimit: 0,
  sessionEnd: '',
  tighten: false,
};

// Friday comes pre-configured with tighter defaults
const FRIDAY_DEFAULT: DayConfig = {
  enabled: true,
  blocked: false,
  blockedUntil: '',
  maxTrades: 2,
  lossLimit: 0,
  sessionEnd: '',
  tighten: true,
};

export const DayRules: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const { theme } = useTheme();
  const [dayConfigs, setDayConfigs] = useState<Record<string, DayConfig>>({
    Monday: { ...DEFAULT_CONFIG },
    Tuesday: { ...DEFAULT_CONFIG },
    Wednesday: { ...DEFAULT_CONFIG },
    Thursday: { ...DEFAULT_CONFIG },
    Friday: { ...FRIDAY_DEFAULT },
  });
  const [selectedDay, setSelectedDay] = useState('Friday');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await (window as any).electronAPI?.getDayRules?.();
        if (data) setDayConfigs(data);
      } catch {}
    })();
  }, []);

  const handleSave = async () => {
    await (window as any).electronAPI?.updateDayRules?.(dayConfigs);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateDay = (day: string, field: keyof DayConfig, value: any) => {
    setDayConfigs({
      ...dayConfigs,
      [day]: { ...dayConfigs[day], [field]: value },
    });
  };

  const today = DAYS[new Date().getDay() - 1] || 'Monday';
  const config = dayConfigs[selectedDay] || DEFAULT_CONFIG;
  const devMode = localStorage.getItem('tg-dev-mode') === 'true';

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2 animate-reveal">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/20 flex items-center justify-center">
          <span className="text-lg" style={{filter: 'drop-shadow(0 0 4px rgba(249,115,22,0.5))'}}>📅</span>
        </div>
        <h2 className="text-3xl font-black tracking-tight text-gradient">Day Rules</h2>
      </div>
      <p className="text-white/30 text-sm mb-6 leading-relaxed ml-14 animate-reveal">
        Different rules for different days. Auto-applies when that day arrives.
      </p>

      {/* Today indicator */}
      <div className="mb-6 px-4 py-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.03] flex items-center gap-3 animate-reveal">
        <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
        <span className="text-xs text-cyan-300/70 font-medium">Today is {today}</span>
        {dayConfigs[today]?.enabled && (
          <span className="ml-auto text-[0.6rem] px-2 py-0.5 rounded-full bg-orange-400/10 border border-orange-400/20 text-orange-300 font-bold">RULES ACTIVE</span>
        )}
      </div>

      {/* Day Selector */}
      <div className="flex gap-2 mb-6 animate-reveal">
        {DAYS.map((day, i) => {
          const isSelected = selectedDay === day;
          const isEnabled = dayConfigs[day].enabled;
          const isMidnight = theme === 'midnight';

          return (
            <div key={day} className={`flex-1 relative ${isSelected ? `${theme}-day-tab-selected` : ''}`}>
              {/* Gradient border wrapper for midnight selected */}
              {isMidnight && isSelected && (
                <div className="absolute inset-0 rounded-xl overflow-hidden">
                  <div className="absolute inset-0 midnight-gradient-border-spin" />
                </div>
              )}
              <button
                onClick={() => setSelectedDay(day)}
                className={`relative w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[1px] transition-all press-scale z-10 ${
                  isSelected
                    ? isMidnight
                      ? 'bg-black/90 border border-transparent text-white midnight-day-active'
                      : 'border border-transparent text-white day-tab-active'
                    : isEnabled
                      ? 'bg-white/[0.03] border border-orange-400/15 text-orange-300/60'
                      : 'bg-white/[0.02] border border-white/[0.04] text-white/25'
                }`}
              >
                {SHORT_DAYS[i]}
                {isEnabled && (
                  <div className={`w-1 h-1 rounded-full mx-auto mt-1.5 ${
                    isMidnight
                      ? 'bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]'
                      : 'bg-orange-400 shadow-[0_0_4px_rgba(249,115,22,0.6)]'
                  }`} />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Day Config */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-orange-400/30 to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-orange-400/60 text-sm">📅</span>
              <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-orange-400/60">{selectedDay}</p>
            </div>
            <div
              className={`toggle-premium ${config.enabled ? 'active' : ''}`}
              onClick={() => {
                // Can't disable day rules on current day if blocked
                if (selectedDay === today && config.enabled && config.blocked && !devMode) return;
                if (!isLocked) updateDay(selectedDay, 'enabled', !config.enabled);
              }}
              style={{
                opacity: isLocked || (selectedDay === today && config.enabled && config.blocked && !devMode) ? 0.3 : 1,
                cursor: isLocked || (selectedDay === today && config.enabled && config.blocked && !devMode) ? 'not-allowed' : 'pointer'
              }}
            />
          </div>

          {config.enabled && (
            <div className="space-y-5">
              {/* Block all trading */}
              <div className="p-4 rounded-xl bg-red-400/[0.03] border border-red-400/10">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <span className="text-sm text-white/50 group-hover:text-white/70 transition-colors font-medium">Block all trading</span>
                    <p className="text-[0.6rem] text-white/20 mt-0.5">
                      {selectedDay === today && config.blocked
                        ? "Locked for today. You set this rule - can't undo until tomorrow."
                        : "No trades allowed this day. Complete day off."}
                    </p>
                  </div>
                  <div
                    className={`toggle-premium ${config.blocked ? 'active' : ''}`}
                    onClick={() => {
                      // Can't unblock on the current day (unless dev mode)
                      if (selectedDay === today && config.blocked && !devMode) return;
                      if (!isLocked) updateDay(selectedDay, 'blocked', !config.blocked);
                    }}
                    style={{
                      opacity: isLocked || (selectedDay === today && config.blocked && !devMode) ? 0.3 : 1,
                      cursor: isLocked || (selectedDay === today && config.blocked && !devMode) ? 'not-allowed' : 'pointer'
                    }}
                  />
                </label>
                {selectedDay === today && config.blocked && (
                  <p className="text-[0.55rem] text-red-400/60 mt-2 font-medium">This cannot be changed until tomorrow.</p>
                )}
                {config.blocked && (
                  <div className="mt-3 pt-3 border-t border-white/[0.04]">
                    <label className="block text-[0.6rem] font-semibold tracking-[1px] uppercase text-white/25 mb-2">Unblock at (empty = all day blocked)</label>
                    <input
                      type="time"
                      value={config.blockedUntil}
                      onChange={(e) => updateDay(selectedDay, 'blockedUntil', e.target.value)}
                      disabled={isLocked || (selectedDay === today && !devMode)}
                      placeholder="e.g. 11:00"
                      className="w-32 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-3 text-white text-sm font-medium focus:outline-none transition-all disabled:opacity-30 input-premium"
                    />
                    <p className="text-[0.55rem] text-white/15 mt-1.5">
                      {config.blockedUntil ? `Trading blocked until ${config.blockedUntil} ET, then allowed.` : 'Blocked for the entire day.'}
                    </p>
                  </div>
                )}
              </div>

              {!config.blocked && (
                <>
                  {/* Auto-tighten */}
                  <div className="p-4 rounded-xl bg-orange-400/[0.03] border border-orange-400/10">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <div>
                        <span className="text-sm text-white/50 group-hover:text-white/70 transition-colors font-medium">Auto-tighten</span>
                        <p className="text-[0.6rem] text-white/20 mt-0.5">Halves all contract limits and loss limit for this day</p>
                      </div>
                      <div
                        className={`toggle-premium ${config.tighten ? 'active' : ''}`}
                        onClick={() => !isLocked && updateDay(selectedDay, 'tighten', !config.tighten)}
                        style={{ opacity: isLocked ? 0.3 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
                      />
                    </label>
                  </div>

                  {/* Max trades */}
                  <div>
                    <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/25 mb-2">Max trades for this day (0 = use default)</label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={config.maxTrades}
                      onChange={(e) => updateDay(selectedDay, 'maxTrades', Number(e.target.value) || 0)}
                      disabled={isLocked}
                      className="w-24 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-3 text-white font-mono text-sm font-bold text-center focus:border-cyan-400/50 focus:outline-none transition-all disabled:opacity-30 input-premium"
                    />
                  </div>

                  {/* Loss limit override */}
                  <div>
                    <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/25 mb-2">Loss limit override $ (0 = use default)</label>
                    <input
                      type="number"
                      min="0"
                      max="50000"
                      value={config.lossLimit}
                      onChange={(e) => updateDay(selectedDay, 'lossLimit', Number(e.target.value) || 0)}
                      disabled={isLocked}
                      className="w-28 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-3 text-white font-mono text-sm font-bold text-center focus:border-cyan-400/50 focus:outline-none transition-all disabled:opacity-30 input-premium"
                    />
                  </div>

                  <div>
                    <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/25 mb-2">Session ends at (empty = use default)</label>
                    <input
                      type="time"
                      value={config.sessionEnd}
                      onChange={(e) => updateDay(selectedDay, 'sessionEnd', e.target.value)}
                      disabled={isLocked}
                      className="w-32 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-3 text-white text-sm font-medium focus:border-cyan-400/50 focus:outline-none transition-all disabled:opacity-30 input-premium"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {!config.enabled && (
            <p className="text-xs text-white/15 text-center py-4">No special rules for {selectedDay}. Default settings apply.</p>
          )}
        </div>
      </div>

      {/* Friday warning */}
      {selectedDay === 'Friday' && config.enabled && (
        <div className="mt-4 relative rounded-xl p-5 overflow-hidden card-premium animate-reveal">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-400/30 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-red-400/70 text-sm">⚠</span>
              <p className="text-[0.6rem] font-bold tracking-[2px] uppercase text-red-400/60">Why Friday protection?</p>
            </div>
            <p className="text-xs text-white/25 leading-relaxed">
              Most accounts blow on Fridays. Traders try to "finish the week green," overtrade to make up losses, and force trades in low volume. This protection keeps you from becoming a statistic.
            </p>
          </div>
        </div>
      )}

      {/* Save */}
      {saved && (
        <div className="mt-6 px-5 py-3.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] text-emerald-300 text-xs font-medium animate-reveal flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          Day rules saved
        </div>
      )}
      <button onClick={handleSave} disabled={isLocked} className="mt-6 px-8 py-3.5 btn-premium text-xs uppercase tracking-[2px] rounded-xl press-scale animate-reveal disabled:opacity-30">
        Save Day Rules
      </button>
    </div>
  );
};
