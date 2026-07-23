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
          setSynced(true); setTimeout(() => setSynced(false), 5000);
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
      if (result.success) onLocked(); else setError(result.error || 'Failed');
    } catch (e: any) { setError(e.message); }
    finally { setLocking(false); }
  };

  const inputClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3.5 text-white text-sm font-medium focus:border-cyan-400/50 focus:shadow-[0_0_12px_rgba(56,189,248,0.12)] focus:outline-none transition-all placeholder:text-white/15";
  const selectClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3.5 text-white text-sm font-medium focus:border-cyan-400/50 focus:shadow-[0_0_12px_rgba(56,189,248,0.12)] focus:outline-none transition-all appearance-none cursor-pointer [&>option]:bg-[#0a0a1a] [&>option]:text-white";

  return (
    <div className="max-w-lg">
      <div className="mb-12">
        <h2 className="text-4xl font-black tracking-tighter leading-tight mb-3 text-glow-white">
          Lock your risk<br />settings
        </h2>
        <p className="text-white/35 text-sm leading-relaxed">
          Values auto-fill from Tradovate. Set limits, confirm, lock.
        </p>
      </div>

      {synced && (
        <div className="mb-6 px-5 py-3.5 glass rounded-lg border border-emerald-400/20 text-glow-green text-xs font-medium">
          Synced from Tradovate
        </div>
      )}

      {/* Risk Limits */}
      <div className="glass rounded-xl p-6 mb-4">
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-5">Risk Limits</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/35 mb-2">Daily Loss Limit ($)</label>
            <input type="number" min="0" step="50" value={dailyLossLimit} onChange={(e) => setDailyLossLimit(e.target.value)} placeholder="0" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/35 mb-2">Daily Profit Target ($)</label>
            <input type="number" min="0" step="50" value={dailyProfitTarget} onChange={(e) => setDailyProfitTarget(e.target.value)} placeholder="0" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/35 mb-2">Max Contracts</label>
            <input type="number" min="0" step="1" value={maxContracts} onChange={(e) => setMaxContracts(e.target.value)} placeholder="0" className={inputClass} />
          </div>
        </div>
      </div>

      {/* Session Reset */}
      <div className="glass rounded-xl p-6 mb-4">
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-5">Session Reset</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/35 mb-2">Reset Time</label>
            <input type="time" value={resetTime} onChange={(e) => setResetTime(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/35 mb-2">Timezone</label>
            <select value={resetTimezone} onChange={(e) => setResetTimezone(e.target.value)} className={selectClass}>
              {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Platform */}
      <div className="glass rounded-xl p-6 mb-4">
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-5">Platform</p>
        <select value={platform} onChange={(e) => setPlatform(e.target.value as any)} className={selectClass}>
          <option value="web">Web Browser</option>
          <option value="pwa">Progressive Web App</option>
          <option value="desktop">Desktop</option>
        </select>
      </div>

      {/* Confirm */}
      <div className="glass rounded-xl p-6 mb-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-cyan-400" />
          <span className="text-sm text-white/40 leading-relaxed">
            I confirm these settings and want to lock them for this session.
          </span>
        </label>
      </div>

      {error && (
        <div className="mt-4 px-5 py-3.5 glass rounded-lg border border-red-400/20 text-red-300 text-xs font-medium">
          {error}
        </div>
      )}

      <button
        onClick={handleLock}
        disabled={locking || !confirmed}
        className="w-full mt-6 py-4.5 bg-cyan-400 text-black text-xs font-bold uppercase tracking-[3px] rounded-lg hover:bg-cyan-300 hover:shadow-[0_0_30px_rgba(56,189,248,0.4)] transition-all disabled:opacity-10 disabled:cursor-not-allowed btn-glow"
      >
        {locking ? 'Locking...' : 'Lock for Today'}
      </button>
    </div>
  );
};
