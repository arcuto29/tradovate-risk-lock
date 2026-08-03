import React, { useState, useEffect } from 'react';
import { Clock, Lock } from 'lucide-react';

export const SessionHours: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const [enabled, setEnabled] = useState(false);
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('16:00');
  const [timezone, setTimezone] = useState('America/New_York');
  const [saved, setSaved] = useState(false);
  const [currentlyBlocked, setCurrentlyBlocked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await window.electronAPI.getSessionHours();
        if (s) { setEnabled(s.enabled); setStartTime(s.startTime || '08:30'); setEndTime(s.endTime || '16:00'); setTimezone(s.timezone || 'America/New_York'); setCurrentlyBlocked(s.currentlyBlocked || false); }
      } catch {}
    })();
    const i = setInterval(async () => { try { const s = await window.electronAPI.getSessionHours(); if (s) setCurrentlyBlocked(s.currentlyBlocked || false); } catch {} }, 5000);
    return () => clearInterval(i);
  }, []);

  const handleSave = async () => {
    await window.electronAPI.updateSessionHours({ enabled, startTime, endTime, timezone });
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const inputClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white text-sm font-medium focus:outline-none transition-all input-premium";
  const selectClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white text-sm font-medium focus:outline-none transition-all appearance-none cursor-pointer input-premium";

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2 animate-reveal">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Clock size={18} style={{color: 'rgb(99,102,241)', filter: 'drop-shadow(0 0 4px rgba(99,102,241,0.5))'}} />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-gradient">Session Hours</h2>
      </div>
      <p className="text-white/30 text-sm mb-8 leading-relaxed ml-14 animate-reveal">Block orders outside your trading window.</p>

      {/* Status Badge */}
      {enabled && (
        <div className={`mb-6 px-5 py-4 rounded-xl border animate-reveal flex items-center gap-3 ${
          currentlyBlocked
            ? 'border-red-400/20 bg-red-400/[0.04]'
            : 'border-emerald-400/20 bg-emerald-400/[0.04]'
        }`}>
          <span className={`w-2 h-2 rounded-full animate-pulse ${
            currentlyBlocked
              ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]'
              : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
          }`} />
          <span className={`text-xs font-semibold ${currentlyBlocked ? 'text-red-300' : 'text-emerald-300'}`}>
            {currentlyBlocked ? 'Orders blocked — outside trading hours' : 'Trading allowed — inside window'}
          </span>
        </div>
      )}

      {/* Enable Toggle */}
      <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5 animate-reveal">
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full transition-all ${enabled ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-white/15'}`} />
            <span className="text-sm text-white/70 font-medium">Block orders outside allowed hours</span>
          </div>
          <div
            className={`toggle-premium ${enabled ? 'active' : ''}`}
            onClick={() => setEnabled(!enabled)}
          />
        </div>
      </div>

      {enabled && (
        <div className="space-y-4">
          {/* Time Window */}
          <div className="relative rounded-xl p-6 overflow-hidden card-premium animate-reveal stagger-1">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-indigo-400/60 text-sm"><Clock size={14} className="inline" /></span>
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-indigo-400/60">Trading Window</p>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/30 mb-2">Start</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/30 mb-2">End</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/30 mb-2">Timezone</label>
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={selectClass}>
                  <option value="America/New_York">Eastern (ET)</option>
                  <option value="America/Chicago">Central (CT)</option>
                  <option value="America/Denver">Mountain (MT)</option>
                  <option value="America/Los_Angeles">Pacific (PT)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Protected Platforms */}
          <div className="relative rounded-xl p-6 overflow-hidden card-premium animate-reveal stagger-2">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Lock size={14} className="text-purple-400/60" />
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-purple-400/60">Protected Platforms</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Tradovate', 'Tradesea', 'TopstepX'].map((p) => (
                  <span key={p} className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-white/40 font-medium">{p}</span>
                ))}
              </div>
              <p className="text-[0.65rem] text-white/15 mt-3">Desktop apps auto-closed outside hours</p>
            </div>
          </div>
        </div>
      )}

      {/* Save */}
      {saved && (
        <div className="mt-6 px-5 py-3.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] text-emerald-300 text-xs font-medium animate-reveal flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          Session hours saved
        </div>
      )}
      <button onClick={handleSave} className="mt-6 px-8 py-3.5 btn-premium text-xs uppercase tracking-[2px] rounded-xl press-scale animate-reveal">
        Save
      </button>
    </div>
  );
};
