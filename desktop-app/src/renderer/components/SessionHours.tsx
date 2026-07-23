import React, { useState, useEffect } from 'react';

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

  const inputClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3.5 text-white text-sm font-medium focus:border-cyan-400/50 focus:shadow-[0_0_12px_rgba(56,189,248,0.12)] focus:outline-none transition-all";
  const selectClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3.5 text-white text-sm font-medium focus:border-cyan-400/50 focus:shadow-[0_0_12px_rgba(56,189,248,0.12)] focus:outline-none transition-all appearance-none cursor-pointer [&>option]:bg-[#0a0a1a] [&>option]:text-white";

  return (
    <div className="max-w-lg">
      <h2 className="text-4xl font-black tracking-tighter mb-3 text-glow-white">Session Hours</h2>
      <p className="text-white/35 text-sm mb-8 leading-relaxed">Block orders outside your trading window.</p>

      {currentlyBlocked && enabled && (
        <div className="mb-6 px-5 py-3.5 glass rounded-lg border border-red-400/20 text-glow-red text-xs font-medium">Orders blocked — outside hours</div>
      )}
      {!currentlyBlocked && enabled && (
        <div className="mb-6 px-5 py-3.5 glass rounded-lg border border-emerald-400/20 text-glow-green text-xs font-medium">Trading allowed — inside window</div>
      )}

      <div className="glass rounded-xl p-6 mb-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4 accent-cyan-400" />
          <span className="text-sm text-white/50">Block orders outside allowed hours</span>
        </label>
      </div>

      {enabled && (
        <>
          <div className="glass rounded-xl p-6 mb-4">
            <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-5">Window</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/35 mb-2">Start</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/35 mb-2">End</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/35 mb-2">Timezone</label>
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={selectClass}>
                  <option value="America/New_York">Eastern (ET)</option>
                  <option value="America/Chicago">Central (CT)</option>
                  <option value="America/Denver">Mountain (MT)</option>
                  <option value="America/Los_Angeles">Pacific (PT)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-6 mb-4">
            <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-3">Protected Platforms</p>
            <p className="text-xs text-white/30 leading-relaxed">Tradovate · Tradesea · TopstepX</p>
            <p className="text-xs text-white/20 mt-1">Desktop apps auto-closed outside hours</p>
          </div>
        </>
      )}

      {saved && <div className="mt-4 px-5 py-3.5 glass rounded-lg border border-emerald-400/20 text-glow-green text-xs font-medium">Saved</div>}
      <button onClick={handleSave} className="mt-5 px-6 py-3 bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-xs font-semibold uppercase tracking-[2px] rounded-lg hover:bg-cyan-400/20 hover:border-cyan-400/40 hover:shadow-[0_0_15px_rgba(56,189,248,0.15)] transition-all btn-glow">Save</button>
    </div>
  );
};
