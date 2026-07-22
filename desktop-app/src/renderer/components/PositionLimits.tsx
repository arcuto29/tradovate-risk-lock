import React, { useState, useEffect } from 'react';

interface PositionLimit { symbol: string; maxSize: number; label: string; }

const DEFAULT_LIMITS: PositionLimit[] = [
  { symbol: 'NQ', maxSize: 1, label: 'NQ (Nasdaq Futures)' },
  { symbol: 'MNQ', maxSize: 5, label: 'MNQ (Micro Nasdaq)' },
  { symbol: 'ES', maxSize: 1, label: 'ES (S&P Futures)' },
  { symbol: 'MES', maxSize: 5, label: 'MES (Micro S&P)' },
];

export const PositionLimits: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const [limits, setLimits] = useState<PositionLimit[]>(DEFAULT_LIMITS);
  const [defaultMax, setDefaultMax] = useState(2);
  const [saved, setSaved] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newMax, setNewMax] = useState('1');

  useEffect(() => {
    (async () => {
      try {
        const data = await window.electronAPI.getPositionLimits();
        if (data?.limits) setLimits(data.limits);
        if (data?.defaultMax) setDefaultMax(data.defaultMax);
      } catch {}
    })();
  }, []);

  const handleSave = async () => {
    await window.electronAPI.updatePositionLimits({ limits, defaultMax });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateLimit = (i: number, v: number) => {
    const u = [...limits]; u[i].maxSize = v; setLimits(u);
  };

  const addLimit = () => {
    if (!newSymbol.trim()) return;
    setLimits([...limits, { symbol: newSymbol.toUpperCase().trim(), maxSize: parseInt(newMax) || 1, label: newSymbol.toUpperCase() }]);
    setNewSymbol(''); setNewMax('1');
  };

  return (
    <div className="max-w-lg">
      <h2 className="text-4xl font-black tracking-tighter mb-3">Position Limits</h2>
      <p className="text-neutral-500 text-sm mb-10 leading-relaxed">
        Max contracts per symbol. Enforced across all platforms.
      </p>

      {/* Limits list */}
      <div className="border-t border-white/[0.07]">
        {limits.map((limit, i) => (
          <div key={i} className="flex items-center gap-4 py-4 border-b border-white/[0.07]">
            <span className="flex-1 text-sm font-medium">{limit.label}</span>
            <input
              type="number" min="1" max="100" value={limit.maxSize}
              onChange={(e) => updateLimit(i, parseInt(e.target.value) || 1)}
              className="w-14 bg-transparent border-b border-white/[0.07] py-1 text-center font-mono text-sm font-semibold text-white focus:border-white focus:outline-none transition-colors"
            />
            <span className="text-[0.6rem] font-semibold tracking-[1.5px] uppercase text-neutral-600">max</span>
            <button onClick={() => setLimits(limits.filter((_, j) => j !== i))} className="text-neutral-700 hover:text-red-500 transition-colors text-lg">&times;</button>
          </div>
        ))}
      </div>

      {/* Add */}
      <div className="flex items-end gap-4 pt-5 border-t border-white/[0.07] mt-0">
        <div className="flex-1">
          <label className="block text-[0.58rem] font-semibold tracking-[1.5px] uppercase text-neutral-600 mb-2">Symbol</label>
          <input type="text" value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="CL" className="w-full bg-transparent border-b border-white/[0.07] py-3 text-white text-sm focus:border-white focus:outline-none transition-colors placeholder:text-neutral-700" />
        </div>
        <div className="w-14">
          <label className="block text-[0.58rem] font-semibold tracking-[1.5px] uppercase text-neutral-600 mb-2">Max</label>
          <input type="number" min="1" value={newMax} onChange={(e) => setNewMax(e.target.value)} className="w-full bg-transparent border-b border-white/[0.07] py-3 text-white text-sm font-mono text-center focus:border-white focus:outline-none transition-colors" />
        </div>
        <button onClick={addLimit} className="px-5 py-3 border border-white/[0.14] text-neutral-400 text-xs font-semibold uppercase tracking-[1.5px] hover:border-white hover:text-white transition-all">Add</button>
      </div>

      {/* Default */}
      <div className="border-t border-white/[0.07] py-7 mt-7">
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-neutral-600 mb-4">Default limit</p>
        <p className="text-xs text-neutral-600 mb-3">For unlisted contracts</p>
        <input type="number" min="1" max="100" value={defaultMax} onChange={(e) => setDefaultMax(parseInt(e.target.value) || 2)} className="w-20 bg-transparent border-b border-white/[0.07] py-3 text-white font-mono text-base font-semibold text-center focus:border-white focus:outline-none transition-colors" />
      </div>

      {saved && <div className="mt-4 px-5 py-3.5 bg-emerald-500/10 border-l-2 border-emerald-400 text-emerald-400 text-xs font-medium">Saved</div>}

      <button onClick={handleSave} className="mt-6 px-7 py-3.5 border border-white/[0.14] text-neutral-400 text-xs font-semibold uppercase tracking-[2px] hover:border-white hover:text-white transition-all">
        Save Limits
      </button>
    </div>
  );
};
