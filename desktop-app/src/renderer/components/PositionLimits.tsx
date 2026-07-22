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
    (async () => { try { const d = await window.electronAPI.getPositionLimits(); if (d?.limits) setLimits(d.limits); if (d?.defaultMax) setDefaultMax(d.defaultMax); } catch {} })();
  }, []);

  const handleSave = async () => {
    await window.electronAPI.updatePositionLimits({ limits, defaultMax });
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const addLimit = () => {
    if (!newSymbol.trim()) return;
    setLimits([...limits, { symbol: newSymbol.toUpperCase().trim(), maxSize: parseInt(newMax) || 1, label: newSymbol.toUpperCase() }]);
    setNewSymbol(''); setNewMax('1');
  };

  const inputClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:border-cyan-400/50 focus:outline-none transition-all placeholder:text-white/15";

  return (
    <div className="max-w-lg">
      <h2 className="text-4xl font-black tracking-tighter mb-3 text-glow-white">Position Limits</h2>
      <p className="text-white/35 text-sm mb-8 leading-relaxed">Max contracts per symbol. Enforced everywhere.</p>

      <div className="glass rounded-xl p-6 mb-4">
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-4">Limits</p>
        {limits.map((limit, i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-white/[0.04] last:border-0">
            <span className="flex-1 text-sm text-white/70">{limit.label}</span>
            <input
              type="number" min="1" max="100" value={limit.maxSize}
              onChange={(e) => { const u = [...limits]; u[i].maxSize = parseInt(e.target.value) || 1; setLimits(u); }}
              className="w-14 bg-white/[0.03] border border-white/[0.08] rounded px-2 py-1.5 text-center font-mono text-sm text-white focus:border-cyan-400/50 focus:outline-none transition-all"
            />
            <button onClick={() => setLimits(limits.filter((_, j) => j !== i))} className="text-white/20 hover:text-red-400 transition-colors text-lg px-1">&times;</button>
          </div>
        ))}
      </div>

      <div className="glass rounded-xl p-6 mb-4">
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-4">Add Symbol</p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-white/25 mb-1.5">Symbol</label>
            <input type="text" value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="CL" className={inputClass} />
          </div>
          <div className="w-16">
            <label className="block text-xs text-white/25 mb-1.5">Max</label>
            <input type="number" min="1" value={newMax} onChange={(e) => setNewMax(e.target.value)} className={inputClass + " text-center font-mono"} />
          </div>
          <button onClick={addLimit} className="px-4 py-3 bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-xs font-semibold rounded-lg hover:bg-cyan-400/20 transition-all">Add</button>
        </div>
      </div>

      <div className="glass rounded-xl p-6 mb-4">
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-3">Default</p>
        <p className="text-xs text-white/25 mb-3">For unlisted contracts</p>
        <input type="number" min="1" max="100" value={defaultMax} onChange={(e) => setDefaultMax(parseInt(e.target.value) || 2)} className="w-16 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white font-mono text-sm font-semibold text-center focus:border-cyan-400/50 focus:outline-none transition-all" />
      </div>

      {saved && <div className="mt-4 px-5 py-3.5 glass rounded-lg border border-emerald-400/20 text-glow-green text-xs font-medium">Saved</div>}
      <button onClick={handleSave} className="mt-5 px-6 py-3 bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-xs font-semibold uppercase tracking-[2px] rounded-lg hover:bg-cyan-400/20 hover:border-cyan-400/40 hover:shadow-[0_0_15px_rgba(56,189,248,0.15)] transition-all btn-glow">Save Limits</button>
    </div>
  );
};
