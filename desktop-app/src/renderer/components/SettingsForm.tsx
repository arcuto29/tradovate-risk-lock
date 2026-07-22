import React, { useState, useEffect } from 'react';

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'UTC', label: 'UTC' },
];

export const SettingsForm: React.FC<{ onLocked: () => void }> = ({ onLocked }) => {
  const [dailyLossLimit, setDailyLossLimit] = useState('');
  const [dailyProfitTarget, setDailyProfitTarget] = useState('');
  const [maxContracts, setMaxContracts] = useState('');
  const [resetTime, setResetTime] = useState('17:00');
  const [resetTimezone, setResetTimezone] = useState('America/New_York');
  const [platform, setPlatform] = useState<'web' | 'desktop' | 'pwa'>('web');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [locking, setLocking] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (window.electronAPI.onTradovateSettingsSynced) {
      window.electronAPI.onTradovateSettingsSynced((settings: any) => {
        if (settings) {
          if (settings.maxLossPerTrade) setDailyLossLimit(String(settings.maxLossPerTrade));
          if (settings.maxProfitPerTrade) setDailyProfitTarget(String(settings.maxProfitPerTrade));
          if (settings.maxLimitInTrade) setMaxContracts(String(settings.maxLimitInTrade));
          if (settings.dailyLossLimit) setDailyLossLimit(String(settings.dailyLossLimit));
          if (settings.dailyProfitTrigger) setDailyProfitTarget(String(settings.dailyProfitTrigger));
          if (settings.maxPositionSize) setMaxContracts(String(settings.maxPositionSize));
          setSynced(true);
          setTimeout(() => setSynced(false), 5000);
        }
      });
    }
  }, []);

  const handleLock = async () => {
    if (!confirmed) { setError('Confirm to lock'); return; }
    const settings = {
      dailyLossLimit: parseFloat(dailyLossLimit) || 0,
      dailyProfitTarget: parseFloat(dailyProfitTarget) || 0,
      maxContracts: parseInt(maxContracts) || 0,
      resetTime, resetTimezone, platform,
    };
    if (settings.dailyLossLimit <= 0 && settings.dailyProfitTarget <= 0 && settings.maxContracts <= 0) {
      setError('Set at least one limit'); return;
    }
    setLocking(true); setError('');
    try {
      const result = await window.electronAPI.lockSettings(settings);
      if (result.success) onLocked();
      else setError(result.error || 'Failed');
    } catch (e: any) { setError(e.message); }
    finally { setLocking(false); }
  };

  const inputClass = "w-full bg-transparent border-b border-white/[0.07] py-4 text-white text-base font-medium focus:border-white focus:outline-none transition-colors placeholder:text-neutral-700";
  const labelClass = "block text-xs font-medium text-neutral-500 mb-2.5";
  const sectionClass = "border-t border-white/[0.07] py-7";

  return (
    <div className="max-w-lg">
      {/* Hero */}
      <div className="mb-12">
        <h2 className="text-4xl font-black tracking-tighter leading-tight mb-3">
          Lock your risk<br />settings
        </h2>
        <p className="text-neutral-500 text-sm leading-relaxed">
          Values auto-fill from Tradovate. Set limits, confirm, lock.
        </p>
      </div>

      {synced && (
        <div className="mb-6 px-5 py-3.5 bg-emerald-500/10 border-l-2 border-emerald-400 text-emerald-400 text-xs font-medium">
          Synced from Tradovate
        </div>
      )}

      {/* Risk Limits */}
      <div className={sectionClass}>
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-neutral-600 mb-6">Risk Limits</p>
        <div className="space-y-5">
          <div>
            <label className={labelClass}>Daily Loss Limit ($)</label>
            <input type="number" min="0" step="50" value={dailyLossLimit} onChange={(e) => setDailyLossLimit(e.target.value)} placeholder="0" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Daily Profit Target ($)</label>
            <input type="number" min="0" step="50" value={dailyProfitTarget} onChange={(e) => setDailyProfitTarget(e.target.value)} placeholder="0" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Max Contracts</label>
            <input type="number" min="0" step="1" value={maxContracts} onChange={(e) => setMaxContracts(e.target.value)} placeholder="0" className={inputClass} />
          </div>
        </div>
      </div>

      {/* Session Reset */}
      <div className={sectionClass}>
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-neutral-600 mb-6">Session Reset</p>
        <div className="space-y-5">
          <div>
            <label className={labelClass}>Reset Time</label>
            <input type="time" value={resetTime} onChange={(e) => setResetTime(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Timezone</label>
            <select value={resetTimezone} onChange={(e) => setResetTimezone(e.target.value)} className={inputClass + " appearance-none cursor-pointer"}>
              {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Platform */}
      <div className={sectionClass}>
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-neutral-600 mb-6">Platform</p>
        <select value={platform} onChange={(e) => setPlatform(e.target.value as any)} className={inputClass + " appearance-none cursor-pointer"}>
          <option value="web">Web Browser</option>
          <option value="pwa">Progressive Web App</option>
          <option value="desktop">Desktop</option>
        </select>
      </div>

      {/* Confirm */}
      <div className="border-t border-b border-white/[0.07] py-7">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-white"
          />
          <span className="text-sm text-neutral-400 leading-relaxed">
            I confirm these settings and want to lock them for this session.
          </span>
        </label>
      </div>

      {error && (
        <div className="mt-4 px-5 py-3.5 bg-red-500/10 border-l-2 border-red-500 text-red-400 text-xs font-medium">
          {error}
        </div>
      )}

      <button
        onClick={handleLock}
        disabled={locking || !confirmed}
        className="w-full mt-8 py-5 bg-white text-black text-xs font-bold uppercase tracking-[3px] border border-white hover:bg-transparent hover:text-white transition-all disabled:opacity-10 disabled:cursor-not-allowed"
      >
        {locking ? 'Locking...' : 'Lock for Today'}
      </button>
    </div>
  );
};
