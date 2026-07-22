import React, { useState, useEffect } from 'react';

export const PsychologyCoach: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const [enabled, setEnabled] = useState(true);
  const [maxTradesPerDay, setMaxTradesPerDay] = useState(10);
  const [cooldownSeconds, setCooldownSeconds] = useState(120);
  const [maxDailyLoss, setMaxDailyLoss] = useState(500);
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
          setEnabled(c.enabled !== false); setMaxTradesPerDay(c.maxTradesPerDay || 10);
          setCooldownSeconds(c.cooldownSeconds || 120); setMaxDailyLoss(c.maxDailyLoss || 500);
          setEscalatingCooldown(c.escalatingCooldown !== false); setLossStreakEnabled(c.lossStreakEnabled !== false);
          setProfitLockEnabled(c.profitLockEnabled !== false); setProfitLockThreshold(c.profitLockThreshold || 500);
          setDrawdownFromHigh(c.drawdownFromHigh || 200); setScalingLockEnabled(c.scalingLockEnabled !== false);
        }
      } catch {}
    })();
  }, []);

  const handleSave = async () => {
    await window.electronAPI.updateCoachConfig({
      enabled, maxTradesPerDay, cooldownSeconds, maxDailyLoss,
      escalatingCooldown, lossStreakEnabled, profitLockEnabled,
      profitLockThreshold, drawdownFromHigh, scalingLockEnabled,
    });
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const inputClass = "w-20 bg-transparent border-b border-white/[0.07] py-3 text-white font-mono text-base font-semibold text-center focus:border-white focus:outline-none transition-colors";
  const sectionClass = "border-t border-white/[0.07] py-7";
  const checkClass = "flex items-start gap-3 cursor-pointer mb-4";

  return (
    <div className="max-w-lg">
      <h2 className="text-4xl font-black tracking-tighter mb-3">Psychology Coach</h2>
      <p className="text-neutral-500 text-sm mb-10 leading-relaxed">
        Behavioral guardrails. Each one independent.
      </p>

      {/* Master */}
      <div className={sectionClass}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4 accent-white" />
          <span className="text-sm text-neutral-300 font-medium">Enable coach</span>
        </label>
      </div>

      {enabled && (
        <>
          {/* Trade limit */}
          <div className={sectionClass}>
            <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-neutral-600 mb-4">Daily Trade Limit</p>
            <p className="text-xs text-neutral-600 mb-3">Warns approaching max, blocks after</p>
            <input type="number" min="1" max="50" value={maxTradesPerDay} onChange={(e) => setMaxTradesPerDay(parseInt(e.target.value) || 10)} className={inputClass} />
          </div>

          {/* Cooldown */}
          <div className={sectionClass}>
            <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-neutral-600 mb-4">Cooldown After Loss</p>
            <div className="mb-4">
              <p className="text-xs text-neutral-600 mb-3">Base cooldown (seconds)</p>
              <input type="number" min="30" max="600" step="30" value={cooldownSeconds} onChange={(e) => setCooldownSeconds(parseInt(e.target.value) || 120)} className={inputClass} />
              <p className="text-[0.7rem] text-neutral-700 mt-2 font-mono">{Math.floor(cooldownSeconds / 60)}m {cooldownSeconds % 60}s</p>
            </div>
            <label className={checkClass}>
              <input type="checkbox" checked={escalatingCooldown} onChange={(e) => setEscalatingCooldown(e.target.checked)} className="w-4 h-4 accent-white mt-0.5" />
              <span className="text-sm text-neutral-400">Escalating — doubles each consecutive loss</span>
            </label>
          </div>

          {/* Daily loss */}
          <div className={sectionClass}>
            <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-neutral-600 mb-4">Daily Loss Cutoff</p>
            <p className="text-xs text-neutral-600 mb-3">Block all trading at ($)</p>
            <input type="number" min="50" max="10000" step="50" value={maxDailyLoss} onChange={(e) => setMaxDailyLoss(parseInt(e.target.value) || 500)} className={inputClass} />
          </div>

          {/* Streak */}
          <div className={sectionClass}>
            <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-neutral-600 mb-4">Loss Streak</p>
            <label className={checkClass}>
              <input type="checkbox" checked={lossStreakEnabled} onChange={(e) => setLossStreakEnabled(e.target.checked)} className="w-4 h-4 accent-white mt-0.5" />
              <span className="text-sm text-neutral-400">Auto-reduce size on consecutive losses</span>
            </label>
            {lossStreakEnabled && (
              <div className="ml-7 text-xs text-neutral-600 space-y-0.5">
                <p>2 losses → half size</p>
                <p>3+ losses → 1 contract</p>
                <p className="text-neutral-700">Resets on win</p>
              </div>
            )}
          </div>

          {/* Scaling */}
          <div className={sectionClass}>
            <label className={checkClass}>
              <input type="checkbox" checked={scalingLockEnabled} onChange={(e) => setScalingLockEnabled(e.target.checked)} className="w-4 h-4 accent-white mt-0.5" />
              <span className="text-sm text-neutral-400">One-way ratchet — size never goes back up this session</span>
            </label>
          </div>

          {/* Profit */}
          <div className={sectionClass}>
            <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-neutral-600 mb-4">Profit Protection</p>
            <label className={checkClass}>
              <input type="checkbox" checked={profitLockEnabled} onChange={(e) => setProfitLockEnabled(e.target.checked)} className="w-4 h-4 accent-white mt-0.5" />
              <span className="text-sm text-neutral-400">Lock after hitting target or giving back too much</span>
            </label>
            {profitLockEnabled && (
              <div className="space-y-4 mt-4">
                <div>
                  <p className="text-xs text-neutral-600 mb-2">Profit target ($) — 0 to disable</p>
                  <input type="number" min="0" max="10000" step="50" value={profitLockThreshold} onChange={(e) => setProfitLockThreshold(parseInt(e.target.value) || 0)} className={inputClass} />
                </div>
                <div>
                  <p className="text-xs text-neutral-600 mb-2">Drawdown from high ($)</p>
                  <input type="number" min="50" max="5000" step="50" value={drawdownFromHigh} onChange={(e) => setDrawdownFromHigh(parseInt(e.target.value) || 200)} className={inputClass} />
                </div>
                <p className="text-[0.7rem] text-neutral-700">
                  Up ${profitLockThreshold || '___'}, give back ${drawdownFromHigh} → done for the day
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {saved && <div className="mt-4 px-5 py-3.5 bg-emerald-500/10 border-l-2 border-emerald-400 text-emerald-400 text-xs font-medium">Saved</div>}

      <button onClick={handleSave} className="mt-6 px-7 py-3.5 border border-white/[0.14] text-neutral-400 text-xs font-semibold uppercase tracking-[2px] hover:border-white hover:text-white transition-all">
        Save Coach
      </button>
    </div>
  );
};
