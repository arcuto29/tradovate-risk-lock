import React, { useState, useEffect } from 'react';
import { Zap, Trophy, BarChart3 } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

interface AdvancedConfig {
  // Rage Quit Detection
  rageQuitEnabled: boolean;
  rageQuitThreshold: number; // close attempts in 30 sec
  rageQuitAction: 'tighten' | 'killswitch';
  // Win Streak Protection
  winStreakEnabled: boolean;
  winStreakThreshold: number; // wins in a row
  // Loss Streak Circuit Breaker
  circuitBreakerEnabled: boolean;
  circuitBreakerLosses: number; // losses to trigger
  circuitBreakerDuration: number; // minutes to block
  // Rule Commitment Contract
  commitmentEnabled: boolean;
  commitmentText: string;
  // Time of Day Tracker (always on, just shows data)
  timeTrackerEnabled: boolean;
  // FOMO / Late Entry Protection
  fomoEnabled: boolean;
  fomoMode: 'observe' | 'warn' | 'confirm' | 'reduce' | 'block';
  fomoMaxEntriesPerWindow: number; // max entries allowed in window
  fomoWindowMinutes: number; // time window size in minutes
  fomoMinSecondsBetween: number; // minimum seconds between entries
  fomoBlockFirstMinutes: number; // block entries for first N minutes of session (0 = disabled)
}

const DEFAULT_CONFIG: AdvancedConfig = {
  rageQuitEnabled: false,
  rageQuitThreshold: 3,
  rageQuitAction: 'tighten',
  winStreakEnabled: false,
  winStreakThreshold: 4,
  circuitBreakerEnabled: false,
  circuitBreakerLosses: 3,
  circuitBreakerDuration: 60,
  commitmentEnabled: false,
  commitmentText: '',
  timeTrackerEnabled: true,
  fomoEnabled: false,
  fomoMode: 'warn',
  fomoMaxEntriesPerWindow: 3,
  fomoWindowMinutes: 5,
  fomoMinSecondsBetween: 30,
  fomoBlockFirstMinutes: 0,
};

export const AdvancedProtection: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [config, setConfig] = useState<AdvancedConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await (window as any).electronAPI?.getAdvancedConfig?.();
        if (data) setConfig({ ...DEFAULT_CONFIG, ...data });
      } catch {}
    })();
  }, []);

  const handleSave = async () => {
    await (window as any).electronAPI?.updateAdvancedConfig?.(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const update = (field: keyof AdvancedConfig, value: any) => {
    setConfig({ ...config, [field]: value });
  };

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2 animate-reveal">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`, border: `1px solid ${colors.primary}20`}}>
          <Zap size={18} style={{color: colors.primary, filter: `drop-shadow(0 0 4px ${colors.primary}50)`}} />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-gradient">Advanced</h2>
      </div>
      <p className="text-white/30 text-sm mb-6 leading-relaxed ml-14 animate-reveal">
        Extra layers of protection. All optional. You decide what you need.
      </p>

      <div className="space-y-4">
        {/* 1. Loss Streak Circuit Breaker */}
        <div className="relative rounded-xl p-6 overflow-hidden card-premium animate-reveal stagger-1">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)`}} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap size={14} style={{color: colors.primary}} />
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase" style={{color: `${colors.primary}80`}}>Circuit Breaker</p>
              </div>
              <div
                className={`toggle-premium ${config.circuitBreakerEnabled ? 'active' : ''}`}
                onClick={() => !isLocked && update('circuitBreakerEnabled', !config.circuitBreakerEnabled)}
                style={{ opacity: isLocked ? 0.3 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
              />
            </div>
            <p className="text-xs text-white/25 mb-4">Full block after X losses in one session. Not a cooldown, a forced break.</p>
            {config.circuitBreakerEnabled && (
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/[0.04]">
                <div>
                  <label className="block text-[0.6rem] font-semibold tracking-[1px] uppercase text-white/25 mb-2">Losses to trigger</label>
                  <div className="flex gap-1.5">
                    {[2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => !isLocked && update('circuitBreakerLosses', n)}
                        className={`w-9 h-9 rounded-lg text-xs font-bold transition-all press-scale ${config.circuitBreakerLosses === n ? 'btn-premium' : 'bg-white/[0.03] border border-white/[0.08] text-white/30'}`}
                      >{n}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[0.6rem] font-semibold tracking-[1px] uppercase text-white/25 mb-2">Block duration</label>
                  <div className="flex gap-1.5">
                    {[30, 60, 120].map(m => (
                      <button key={m} onClick={() => !isLocked && update('circuitBreakerDuration', m)}
                        className={`px-2.5 h-9 rounded-lg text-[0.6rem] font-bold transition-all press-scale ${config.circuitBreakerDuration === m ? 'btn-premium' : 'bg-white/[0.03] border border-white/[0.08] text-white/30'}`}
                      >{m < 60 ? m + 'm' : (m/60) + 'h'}</button>
                    ))}
                    <button onClick={() => !isLocked && update('circuitBreakerDuration', 999)}
                      className={`px-2.5 h-9 rounded-lg text-[0.6rem] font-bold transition-all press-scale ${config.circuitBreakerDuration === 999 ? 'btn-premium' : 'bg-white/[0.03] border border-white/[0.08] text-white/30'}`}
                    >Day</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Win Streak Protection */}
        <div className="relative rounded-xl p-6 overflow-hidden card-premium animate-reveal stagger-2">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.secondary}30, transparent)`}} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy size={14} style={{color: colors.primary}} />
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase" style={{color: `${colors.secondary}80`}}>Win Streak Protection</p>
              </div>
              <div
                className={`toggle-premium ${config.winStreakEnabled ? 'active' : ''}`}
                onClick={() => !isLocked && update('winStreakEnabled', !config.winStreakEnabled)}
                style={{ opacity: isLocked ? 0.3 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
              />
            </div>
            <p className="text-xs text-white/25 mb-4">Auto-halves max lots and loss limit after a winning streak. Prevents overconfidence blowups.</p>
            {config.winStreakEnabled && (
              <div className="pt-3 border-t border-white/[0.04]">
                <label className="block text-[0.6rem] font-semibold tracking-[1px] uppercase text-white/25 mb-2">Wins in a row to trigger</label>
                <div className="flex gap-1.5">
                  {[3, 4, 5, 6].map(n => (
                    <button key={n} onClick={() => !isLocked && update('winStreakThreshold', n)}
                      className={`w-9 h-9 rounded-lg text-xs font-bold transition-all press-scale ${config.winStreakThreshold === n ? 'btn-premium' : 'bg-white/[0.03] border border-white/[0.08] text-white/30'}`}
                    >{n}</button>
                  ))}
                </div>
                <p className="text-[0.55rem] text-white/15 mt-2">After {config.winStreakThreshold} wins: max lots halved, loss limit halved</p>
              </div>
            )}
          </div>
        </div>

        {/* 3. Rage Quit Detection */}
        <div className="relative rounded-xl p-6 overflow-hidden card-premium animate-reveal stagger-3">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, #f8717130, transparent)`}} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-red-400/60" />
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-red-400/60">Rage Quit Detection</p>
              </div>
              <div
                className={`toggle-premium ${config.rageQuitEnabled ? 'active' : ''}`}
                onClick={() => !isLocked && update('rageQuitEnabled', !config.rageQuitEnabled)}
                style={{ opacity: isLocked ? 0.3 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
              />
            </div>
            <p className="text-xs text-white/25 mb-4">If you try to close the app {config.rageQuitThreshold}+ times in 30 seconds while locked, it escalates.</p>
            {config.rageQuitEnabled && (
              <div className="pt-3 border-t border-white/[0.04] space-y-3">
                <div>
                  <label className="block text-[0.6rem] font-semibold tracking-[1px] uppercase text-white/25 mb-2">Action on rage quit</label>
                  <div className="flex gap-2">
                    <button onClick={() => !isLocked && update('rageQuitAction', 'tighten')}
                      className={`flex-1 py-2.5 rounded-lg text-[0.6rem] font-bold uppercase tracking-[1px] transition-all press-scale ${config.rageQuitAction === 'tighten' ? 'btn-premium' : 'bg-white/[0.03] border border-white/[0.08] text-white/30'}`}
                    >Tighten limits</button>
                    <button onClick={() => !isLocked && update('rageQuitAction', 'killswitch')}
                      className={`flex-1 py-2.5 rounded-lg text-[0.6rem] font-bold uppercase tracking-[1px] transition-all press-scale ${config.rageQuitAction === 'killswitch' ? 'btn-premium' : 'bg-white/[0.03] border border-white/[0.08] text-white/30'}`}
                    >Kill switch (24hr)</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Rule Commitment Contract */}
        <div className="relative rounded-xl p-6 overflow-hidden card-premium animate-reveal stagger-4">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)`}} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} style={{color: `${colors.primary}80`}} />
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase" style={{color: `${colors.primary}80`}}>Commitment Contract</p>
              </div>
              <div
                className={`toggle-premium ${config.commitmentEnabled ? 'active' : ''}`}
                onClick={() => !isLocked && update('commitmentEnabled', !config.commitmentEnabled)}
                style={{ opacity: isLocked ? 0.3 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
              />
            </div>
            <p className="text-xs text-white/25 mb-4">Type your trading rules before locking. Shown back to you when you try to break them.</p>
            {config.commitmentEnabled && (
              <div className="pt-3 border-t border-white/[0.04]">
                <label className="block text-[0.6rem] font-semibold tracking-[1px] uppercase text-white/25 mb-2">Your rules (shown when blocked)</label>
                <textarea
                  value={config.commitmentText}
                  onChange={(e) => update('commitmentText', e.target.value)}
                  disabled={isLocked}
                  placeholder="e.g. I will not trade more than 1 lot. I will stop after 3 losses. I will not trade during news."
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all placeholder:text-white/15 input-premium resize-none h-24 disabled:opacity-30"
                />
              </div>
            )}
          </div>
        </div>

        {/* 5. Time of Day Tracker */}
        <div className="relative rounded-xl p-6 overflow-hidden card-premium animate-reveal stagger-5">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.secondary}30, transparent)`}} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} style={{color: colors.primary}} />
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase" style={{color: `${colors.secondary}80`}}>Time of Day Tracker</p>
              </div>
              <div
                className={`toggle-premium ${config.timeTrackerEnabled ? 'active' : ''}`}
                onClick={() => !isLocked && update('timeTrackerEnabled', !config.timeTrackerEnabled)}
                style={{ opacity: isLocked ? 0.3 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
              />
            </div>
            <p className="text-xs text-white/25">Tracks which hours you break rules most. After enough data, shows patterns like "You break rules 73% more after 2pm."</p>
            <p className="text-[0.55rem] text-white/10 mt-3">Data collected automatically. Insights appear after 2 weeks of use.</p>
          </div>
        </div>

        {/* 6. FOMO / Late Entry Protection */}
        <div className="relative rounded-xl p-6 overflow-hidden card-premium animate-reveal stagger-6">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, #fb923c30, transparent)`}} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-orange-400/60" />
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-orange-400/60">FOMO / Late Entry</p>
              </div>
              <div
                className={`toggle-premium ${config.fomoEnabled ? 'active' : ''}`}
                onClick={() => !isLocked && update('fomoEnabled', !config.fomoEnabled)}
                style={{ opacity: isLocked ? 0.3 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
              />
            </div>
            <p className="text-xs text-white/25 mb-4">Detects rapid-fire entries and chasing. You define when you are entering too fast.</p>
            {config.fomoEnabled && (
              <div className="pt-3 border-t border-white/[0.04] space-y-4">
                <div>
                  <label className="block text-[0.6rem] font-semibold tracking-[1px] uppercase text-white/25 mb-2">Protection mode</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['observe', 'warn', 'reduce', 'block'] as const).map(mode => (
                      <button key={mode} onClick={() => !isLocked && update('fomoMode', mode)}
                        className={`px-3 py-2 rounded-lg text-[0.55rem] font-bold uppercase tracking-[1px] transition-all press-scale ${config.fomoMode === mode ? 'btn-premium' : 'bg-white/[0.03] border border-white/[0.08] text-white/30'}`}
                      >{mode}</button>
                    ))}
                  </div>
                  <p className="text-[0.5rem] text-white/15 mt-1.5">
                    {config.fomoMode === 'observe' && 'Log only — no interference'}
                    {config.fomoMode === 'warn' && 'Small toast notification — order still goes through'}
                    {config.fomoMode === 'reduce' && 'Halves your max position size during FOMO'}
                    {config.fomoMode === 'block' && 'Blocks new entries when FOMO detected'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[0.6rem] font-semibold tracking-[1px] uppercase text-white/25 mb-2">Max entries per window</label>
                    <div className="flex gap-1.5">
                      {[2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => !isLocked && update('fomoMaxEntriesPerWindow', n)}
                          className={`w-9 h-9 rounded-lg text-xs font-bold transition-all press-scale ${config.fomoMaxEntriesPerWindow === n ? 'btn-premium' : 'bg-white/[0.03] border border-white/[0.08] text-white/30'}`}
                        >{n}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[0.6rem] font-semibold tracking-[1px] uppercase text-white/25 mb-2">Window size</label>
                    <div className="flex gap-1.5">
                      {[3, 5, 10, 15].map(m => (
                        <button key={m} onClick={() => !isLocked && update('fomoWindowMinutes', m)}
                          className={`px-2.5 h-9 rounded-lg text-[0.55rem] font-bold transition-all press-scale ${config.fomoWindowMinutes === m ? 'btn-premium' : 'bg-white/[0.03] border border-white/[0.08] text-white/30'}`}
                        >{m}m</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[0.6rem] font-semibold tracking-[1px] uppercase text-white/25 mb-2">Min seconds between entries</label>
                    <div className="flex gap-1.5">
                      {[15, 30, 60, 120].map(s => (
                        <button key={s} onClick={() => !isLocked && update('fomoMinSecondsBetween', s)}
                          className={`px-2.5 h-9 rounded-lg text-[0.55rem] font-bold transition-all press-scale ${config.fomoMinSecondsBetween === s ? 'btn-premium' : 'bg-white/[0.03] border border-white/[0.08] text-white/30'}`}
                        >{s < 60 ? s + 's' : (s/60) + 'm'}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[0.6rem] font-semibold tracking-[1px] uppercase text-white/25 mb-2">No entry first N min</label>
                    <div className="flex gap-1.5">
                      {[0, 5, 10, 15].map(m => (
                        <button key={m} onClick={() => !isLocked && update('fomoBlockFirstMinutes', m)}
                          className={`px-2.5 h-9 rounded-lg text-[0.55rem] font-bold transition-all press-scale ${config.fomoBlockFirstMinutes === m ? 'btn-premium' : 'bg-white/[0.03] border border-white/[0.08] text-white/30'}`}
                        >{m === 0 ? 'Off' : m + 'm'}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save */}
      {saved && (
        <div className="mt-6 px-5 py-3.5 rounded-xl border text-xs font-medium animate-reveal flex items-center gap-2" style={{borderColor: `${colors.primary}25`, background: `${colors.primary}06`, color: `${colors.primary}cc`}}>
          <span className="w-1.5 h-1.5 rounded-full" style={{background: colors.primary, boxShadow: `0 0 6px ${colors.primary}60`}} />
          Advanced settings saved
        </div>
      )}
      <button onClick={handleSave} disabled={isLocked} className="mt-6 px-8 py-3.5 btn-premium text-xs uppercase tracking-[2px] rounded-xl press-scale animate-reveal disabled:opacity-30">
        Save
      </button>
    </div>
  );
};
