import React, { useState, useEffect } from 'react';

export const PsychologyCoach: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const [enabled, setEnabled] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState(120);
  const [escalatingCooldown, setEscalatingCooldown] = useState(true);
  const [lossStreakEnabled, setLossStreakEnabled] = useState(true);
  const [profitLockEnabled, setProfitLockEnabled] = useState(true);
  const [profitLockThreshold, setProfitLockThreshold] = useState(500);
  const [drawdownFromHigh, setDrawdownFromHigh] = useState(200);
  const [scalingLockEnabled, setScalingLockEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await window.electronAPI.getCoachConfig();
        if (c) {
          setEnabled(c.enabled !== false);
          setCooldownSeconds(c.cooldownSeconds || 120);
          setEscalatingCooldown(c.escalatingCooldown !== false); setLossStreakEnabled(c.lossStreakEnabled !== false);
          setProfitLockEnabled(c.profitLockEnabled !== false); setProfitLockThreshold(c.profitLockThreshold || 500);
          setDrawdownFromHigh(c.drawdownFromHigh || 200); setScalingLockEnabled(c.scalingLockEnabled !== false);
        }
      } catch {}
    })();
  }, []);

  const handleSave = async () => {
    await window.electronAPI.updateCoachConfig({ enabled, cooldownSeconds, escalatingCooldown, lossStreakEnabled, profitLockEnabled, profitLockThreshold, drawdownFromHigh, scalingLockEnabled });
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const numInput = "w-20 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white font-mono text-sm font-semibold text-center focus:border-cyan-400/50 focus:outline-none transition-all";
  const check = "flex items-start gap-3 cursor-pointer mb-3";

  return (
    <div className="max-w-lg">
      <h2 className="text-4xl font-black tracking-tighter mb-3 text-glow-white">Psychology Coach</h2>
      <p className="text-white/35 text-sm mb-8 leading-relaxed">Behavioral guardrails. Each independent.</p>

      <div className="glass rounded-xl p-6 mb-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4 accent-cyan-400" />
          <span className="text-sm text-white/60 font-medium">Enable coach</span>
        </label>
      </div>

      {enabled && (
        <>
          <div className="glass rounded-xl p-6 mb-4">
            <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-4">Cooldown After Loss</p>
            <p className="text-xs text-white/25 mb-3">Seconds before you can trade again</p>
            <input type="number" min="30" max="600" step="30" value={cooldownSeconds} onChange={(e) => setCooldownSeconds(parseInt(e.target.value) || 120)} className={numInput} />
            <p className="text-[0.65rem] text-white/15 mt-2 font-mono">{Math.floor(cooldownSeconds / 60)}m {cooldownSeconds % 60}s</p>
            <div className="mt-4">
              <label className={check}>
                <input type="checkbox" checked={escalatingCooldown} onChange={(e) => setEscalatingCooldown(e.target.checked)} className="w-4 h-4 accent-cyan-400 mt-0.5" />
                <span className="text-sm text-white/35">Escalating (doubles each consecutive loss)</span>
              </label>
            </div>
          </div>

          <div className="glass rounded-xl p-6 mb-4">
            <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-4">Loss Streak</p>
            <label className={check}>
              <input type="checkbox" checked={lossStreakEnabled} onChange={(e) => setLossStreakEnabled(e.target.checked)} className="w-4 h-4 accent-cyan-400 mt-0.5" />
              <span className="text-sm text-white/35">Reduce size on consecutive losses</span>
            </label>
            <label className={check}>
              <input type="checkbox" checked={scalingLockEnabled} onChange={(e) => setScalingLockEnabled(e.target.checked)} className="w-4 h-4 accent-cyan-400 mt-0.5" />
              <span className="text-sm text-white/35">One-way ratchet (never goes back up)</span>
            </label>
          </div>

          <div className="glass rounded-xl p-6 mb-4">
            <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-4">Profit Protection</p>
            <label className={check}>
              <input type="checkbox" checked={profitLockEnabled} onChange={(e) => setProfitLockEnabled(e.target.checked)} className="w-4 h-4 accent-cyan-400 mt-0.5" />
              <span className="text-sm text-white/35">Lock after target or drawdown</span>
            </label>
            {profitLockEnabled && (
              <div className="space-y-3 mt-4">
                <div>
                  <p className="text-xs text-white/25 mb-2">Profit target — lock out after ($)</p>
                  <input type="number" min="0" max="10000" step="50" value={profitLockThreshold} onChange={(e) => setProfitLockThreshold(parseInt(e.target.value) || 0)} className={numInput} />
                </div>
                <div>
                  <p className="text-xs text-white/25 mb-2">Drawdown from high — lock out after giving back ($)</p>
                  <input type="number" min="50" max="5000" step="50" value={drawdownFromHigh} onChange={(e) => setDrawdownFromHigh(parseInt(e.target.value) || 200)} className={numInput} />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {saved && <div className="mt-4 px-5 py-3.5 glass rounded-lg border border-emerald-400/20 text-glow-green text-xs font-medium">Saved</div>}
      <button onClick={handleSave} className="mt-5 px-6 py-3 bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-xs font-semibold uppercase tracking-[2px] rounded-lg hover:bg-cyan-400/20 hover:border-cyan-400/40 hover:shadow-[0_0_15px_rgba(56,189,248,0.15)] transition-all btn-glow">Save Coach</button>
    </div>
  );
};
