import React, { useState, useEffect } from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

interface DayConfig {
  enabled: boolean;
  maxLots: number;
  lossLimit: number;
  sessionEnd: string;
  tighten: boolean; // auto-tighten (half lots, lower loss)
}

const DEFAULT_CONFIG: DayConfig = {
  enabled: false,
  maxLots: 0,
  lossLimit: 0,
  sessionEnd: '',
  tighten: false,
};

// Friday comes pre-configured with tighter defaults
const FRIDAY_DEFAULT: DayConfig = {
  enabled: true,
  maxLots: 0,
  lossLimit: 0,
  sessionEnd: '14:00',
  tighten: true,
};

export const DayRules: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
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
        {DAYS.map((day, i) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-[1px] transition-all press-scale ${
              selectedDay === day
                ? 'bg-gradient-to-b from-cyan-400/10 to-purple-400/5 border border-cyan-400/20 text-white'
                : dayConfigs[day].enabled
                  ? 'bg-white/[0.03] border border-orange-400/15 text-orange-300/60'
                  : 'bg-white/[0.02] border border-white/[0.04] text-white/25'
            }`}
          >
            {SHORT_DAYS[i]}
            {dayConfigs[day].enabled && (
              <div className="w-1 h-1 rounded-full bg-orange-400 mx-auto mt-1.5 shadow-[0_0_4px_rgba(249,115,22,0.6)]" />
            )}
          </button>
        ))}
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
              onClick={() => !isLocked && updateDay(selectedDay, 'enabled', !config.enabled)}
              style={{ opacity: isLocked ? 0.3 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
            />
          </div>

          {config.enabled && (
            <div className="space-y-5">
              {/* Auto-tighten */}
              <div className="p-4 rounded-xl bg-red-400/[0.03] border border-red-400/10">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <span className="text-sm text-white/50 group-hover:text-white/70 transition-colors font-medium">Auto-tighten</span>
                    <p className="text-[0.6rem] text-white/20 mt-0.5">Halves your max lots and reduces loss limit by 50%</p>
                  </div>
                  <div
                    className={`toggle-premium ${config.tighten ? 'active' : ''}`}
                    onClick={() => !isLocked && updateDay(selectedDay, 'tighten', !config.tighten)}
                    style={{ opacity: isLocked ? 0.3 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
                  />
                </label>
              </div>

              {/* Custom overrides */}
              <div>
                <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/25 mb-2">Max lots override (0 = use default)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={config.maxLots}
                  onChange={(e) => updateDay(selectedDay, 'maxLots', Number(e.target.value) || 0)}
                  disabled={isLocked}
                  className="w-24 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-3 text-white font-mono text-sm font-bold text-center focus:border-cyan-400/50 focus:outline-none transition-all disabled:opacity-30 input-premium"
                />
              </div>

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
