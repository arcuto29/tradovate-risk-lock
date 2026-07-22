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
        const state = await window.electronAPI.getSessionHours();
        if (state) {
          setEnabled(state.enabled);
          setStartTime(state.startTime || '08:30');
          setEndTime(state.endTime || '16:00');
          setTimezone(state.timezone || 'America/New_York');
          setCurrentlyBlocked(state.currentlyBlocked || false);
        }
      } catch {}
    })();
    const interval = setInterval(async () => {
      try {
        const state = await window.electronAPI.getSessionHours();
        if (state) setCurrentlyBlocked(state.currentlyBlocked || false);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async () => {
    await window.electronAPI.updateSessionHours({ enabled, startTime, endTime, timezone });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const inputClass = "w-full bg-transparent border-b border-white/[0.07] py-4 text-white text-base font-medium focus:border-white focus:outline-none transition-colors";

  return (
    <div className="max-w-lg">
      <h2 className="text-4xl font-black tracking-tighter mb-3">Session Hours</h2>
      <p className="text-neutral-500 text-sm mb-10 leading-relaxed">
        Block orders outside your trading window. Charts stay visible.
      </p>

      {currentlyBlocked && enabled && (
        <div className="mb-6 px-5 py-3.5 bg-red-500/10 border-l-2 border-red-500 text-red-400 text-xs font-medium">
          Orders blocked — outside allowed hours
        </div>
      )}
      {!currentlyBlocked && enabled && (
        <div className="mb-6 px-5 py-3.5 bg-emerald-500/10 border-l-2 border-emerald-400 text-emerald-400 text-xs font-medium">
          Trading allowed — inside session window
        </div>
      )}

      <div className="border-t border-white/[0.07] py-7">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4 accent-white" />
          <span className="text-sm text-neutral-400">Block orders outside allowed hours</span>
        </label>
      </div>

      {enabled && (
        <>
          <div className="border-t border-white/[0.07] py-7 space-y-5">
            <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-neutral-600 mb-4">Window</p>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-2.5">Start Time</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-2.5">End Time</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-2.5">Timezone</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputClass + " appearance-none cursor-pointer"}>
                <option value="America/New_York">Eastern (ET)</option>
                <option value="America/Chicago">Central (CT)</option>
                <option value="America/Denver">Mountain (MT)</option>
                <option value="America/Los_Angeles">Pacific (PT)</option>
              </select>
            </div>
          </div>

          <div className="border-t border-white/[0.07] py-7">
            <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-neutral-600 mb-4">Protected</p>
            <div className="space-y-1 text-xs text-neutral-500 leading-relaxed">
              <p>trader.tradovate.com · app.tradesea.ai · topstepx.com</p>
              <p className="text-neutral-600">Desktop apps auto-closed if launched outside hours</p>
            </div>
          </div>
        </>
      )}

      {saved && (
        <div className="mt-4 px-5 py-3.5 bg-emerald-500/10 border-l-2 border-emerald-400 text-emerald-400 text-xs font-medium">Saved</div>
      )}

      <button onClick={handleSave} className="mt-6 px-7 py-3.5 border border-white/[0.14] text-neutral-400 text-xs font-semibold uppercase tracking-[2px] hover:border-white hover:text-white transition-all">
        Save
      </button>
    </div>
  );
};
