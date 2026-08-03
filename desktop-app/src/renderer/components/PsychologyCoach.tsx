import React, { useState, useEffect } from 'react';

export const PsychologyCoach: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const [enabled, setEnabled] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(120);
  const [escalatingCooldown, setEscalatingCooldown] = useState(false);
  const [lossStreakEnabled, setLossStreakEnabled] = useState(false);
  const [profitLockEnabled, setProfitLockEnabled] = useState(false);
  const [profitLockThreshold, setProfitLockThreshold] = useState(500);
  const [drawdownFromHigh, setDrawdownFromHigh] = useState(200);
  const [scalingLockEnabled, setScalingLockEnabled] = useState(false);
  const [winStreakEnabled, setWinStreakEnabled] = useState(false);
  const [winStreakThreshold, setWinStreakThreshold] = useState(3);
  const [winStreakReminder, setWinStreakReminder] = useState(true);
  const [winStreakReduceSize, setWinStreakReduceSize] = useState(false);
  const [winStreakCooldown, setWinStreakCooldown] = useState(false);
  const [winStreakCooldownSeconds, setWinStreakCooldownSeconds] = useState(120);
  const [winStreakSuggestStop, setWinStreakSuggestStop] = useState(true);
  const [winStreakAutoLock, setWinStreakAutoLock] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await window.electronAPI.getCoachConfig();
        if (c) {
          setEnabled(c.enabled === true);
          setCooldownSeconds(c.cooldownSeconds || 120);
          setEscalatingCooldown(c.escalatingCooldown === true);
          setLossStreakEnabled(c.lossStreakEnabled === true);
          setProfitLockEnabled(c.profitLockEnabled === true);
          setProfitLockThreshold(c.profitLockThreshold || 500);
          setDrawdownFromHigh(c.drawdownFromHigh || 200);
          setScalingLockEnabled(c.scalingLockEnabled === true);
          setWinStreakEnabled(c.winStreakEnabled === true);
          setWinStreakThreshold(c.winStreakThreshold || 3);
          setWinStreakReminder(c.winStreakReminder !== false);
          setWinStreakReduceSize(c.winStreakReduceSize === true);
          setWinStreakCooldown(c.winStreakCooldown === true);
          setWinStreakCooldownSeconds(c.winStreakCooldownSeconds || 120);
          setWinStreakSuggestStop(c.winStreakSuggestStop !== false);
          setWinStreakAutoLock(c.winStreakAutoLock === true);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const handleSave = async () => {
    await window.electronAPI.updateCoachConfig({
      enabled, cooldownSeconds, escalatingCooldown, lossStreakEnabled,
      profitLockEnabled, profitLockThreshold, drawdownFromHigh, scalingLockEnabled,
      winStreakEnabled, winStreakThreshold, winStreakReminder, winStreakReduceSize,
      winStreakCooldown, winStreakCooldownSeconds, winStreakSuggestStop, winStreakAutoLock,
    });
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const numInput = "w-24 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-3 text-white font-mono text-sm font-bold text-center focus:border-cyan-400/50 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.08),0_0_15px_rgba(56,189,248,0.1)] focus:outline-none transition-all input-premium";

  if (!loaded) return <span className="text-white/20 text-sm animate-pulse">Loading...</span>;

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2 animate-reveal">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/10 border border-purple-500/20 flex items-center justify-center">
          <span className="text-lg" style={{filter: 'drop-shadow(0 0 4px rgba(168,85,247,0.5))'}}>🧠</span>
        </div>
        <h2 className="text-3xl font-black tracking-tight text-gradient">Psychology Coach</h2>
      </div>
      <p className="text-white/30 text-sm mb-8 leading-relaxed ml-14 animate-reveal">Behavioral guardrails. Each fires independently.</p>

      {/* Master Toggle */}
      <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5 animate-reveal">
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full transition-all ${enabled ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-white/15'}`} />
            <span className="text-sm text-white/70 font-medium">Enable Coach</span>
          </div>
          <div
            className={`toggle-premium ${enabled ? 'active' : ''}`}
            onClick={() => setEnabled(!enabled)}
          />
        </div>
      </div>

      {enabled && (
        <div className="space-y-4">
          {/* Cooldown After Loss */}
          <div className="relative rounded-xl p-6 overflow-hidden card-premium animate-reveal stagger-1">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-cyan-400/60 text-sm">⏸</span>
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-cyan-400/60">Cooldown After Loss</p>
              </div>
              <p className="text-xs text-white/25 mb-4">Seconds before you can trade again after a losing trade</p>
              <div className="flex items-center gap-4">
                <input type="number" min="30" max="600" step="30" value={cooldownSeconds} onChange={(e) => setCooldownSeconds(parseInt(e.target.value) || 120)} className={numInput} />
                <span className="text-[0.7rem] text-white/20 font-mono">{Math.floor(cooldownSeconds / 60)}m {cooldownSeconds % 60}s</span>
              </div>
              <div className="mt-5 pt-4 border-t border-white/[0.04]">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={escalatingCooldown} onChange={(e) => setEscalatingCooldown(e.target.checked)} className="w-4 h-4 accent-cyan-400 rounded" />
                  <span className="text-sm text-white/35 group-hover:text-white/50 transition-colors">Escalating (doubles each consecutive loss)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Loss Streak */}
          <div className="relative rounded-xl p-6 overflow-hidden card-premium animate-reveal stagger-2">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-400/40 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-red-400/60 text-sm">📉</span>
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-red-400/60">Loss Streak</p>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={lossStreakEnabled} onChange={(e) => setLossStreakEnabled(e.target.checked)} className="w-4 h-4 accent-cyan-400 rounded" />
                  <span className="text-sm text-white/35 group-hover:text-white/50 transition-colors">Reduce size on consecutive losses</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={scalingLockEnabled} onChange={(e) => setScalingLockEnabled(e.target.checked)} className="w-4 h-4 accent-cyan-400 rounded" />
                  <span className="text-sm text-white/35 group-hover:text-white/50 transition-colors">One-way ratchet (never goes back up)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Win Streak Protection */}
          <div className="relative rounded-xl p-6 overflow-hidden card-premium animate-reveal stagger-2">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-amber-400/60 text-sm">🔥</span>
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-amber-400/60">Win Streak Protection</p>
              </div>
              <p className="text-xs text-white/25 mb-4">Protect profits after consecutive wins. Overconfidence after a streak leads to giving back gains.</p>
              <label className="flex items-center gap-3 cursor-pointer group mb-4">
                <input type="checkbox" checked={winStreakEnabled} onChange={(e) => setWinStreakEnabled(e.target.checked)} className="w-4 h-4 accent-amber-400 rounded" />
                <span className="text-sm text-white/35 group-hover:text-white/50 transition-colors">Enable win streak protection</span>
              </label>
              {winStreakEnabled && (
                <div className="space-y-4 pt-4 border-t border-white/[0.04]">
                  <div>
                    <p className="text-xs text-white/25 mb-2">Trigger after consecutive wins</p>
                    <input type="number" min="2" max="10" value={winStreakThreshold} onChange={(e) => setWinStreakThreshold(parseInt(e.target.value) || 3)} className={numInput} />
                  </div>
                  <div className="space-y-3">
                    <p className="text-[0.6rem] font-bold text-white/25 uppercase tracking-[1.5px]">Actions when triggered</p>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={winStreakReminder} onChange={(e) => setWinStreakReminder(e.target.checked)} className="w-4 h-4 accent-amber-400 rounded" />
                      <span className="text-sm text-white/35 group-hover:text-white/50 transition-colors">Show reminder to protect profits</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={winStreakReduceSize} onChange={(e) => setWinStreakReduceSize(e.target.checked)} className="w-4 h-4 accent-amber-400 rounded" />
                      <span className="text-sm text-white/35 group-hover:text-white/50 transition-colors">Reduce max contracts by half</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={winStreakCooldown} onChange={(e) => setWinStreakCooldown(e.target.checked)} className="w-4 h-4 accent-amber-400 rounded" />
                      <span className="text-sm text-white/35 group-hover:text-white/50 transition-colors">Force cooldown before next trade</span>
                    </label>
                    {winStreakCooldown && (
                      <div className="ml-7">
                        <p className="text-xs text-white/20 mb-1">Cooldown duration (seconds)</p>
                        <input type="number" min="30" max="600" step="30" value={winStreakCooldownSeconds} onChange={(e) => setWinStreakCooldownSeconds(parseInt(e.target.value) || 120)} className={numInput} />
                      </div>
                    )}
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={winStreakSuggestStop} onChange={(e) => setWinStreakSuggestStop(e.target.checked)} className="w-4 h-4 accent-amber-400 rounded" />
                      <span className="text-sm text-white/35 group-hover:text-white/50 transition-colors">Suggest ending session (take the win)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={winStreakAutoLock} onChange={(e) => setWinStreakAutoLock(e.target.checked)} className="w-4 h-4 accent-amber-400 rounded" />
                      <span className="text-sm text-white/35 group-hover:text-white/50 transition-colors">Auto-lock after streak (end session)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Profit Protection */}
          <div className="relative rounded-xl p-6 overflow-hidden card-premium animate-reveal stagger-3">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-emerald-400/60 text-sm">🛡</span>
                <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-emerald-400/60">Profit Protection</p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer group mb-4">
                <input type="checkbox" checked={profitLockEnabled} onChange={(e) => setProfitLockEnabled(e.target.checked)} className="w-4 h-4 accent-cyan-400 rounded" />
                <span className="text-sm text-white/35 group-hover:text-white/50 transition-colors">Lock after target or drawdown</span>
              </label>
              {profitLockEnabled && (
                <div className="space-y-4 pt-4 border-t border-white/[0.04]">
                  <div>
                    <p className="text-xs text-white/25 mb-2">Profit target lock ($)</p>
                    <input type="number" min="0" max="10000" step="50" value={profitLockThreshold} onChange={(e) => setProfitLockThreshold(parseInt(e.target.value) || 0)} className={numInput} />
                  </div>
                  <div>
                    <p className="text-xs text-white/25 mb-2">Drawdown from high lock ($)</p>
                    <input type="number" min="50" max="5000" step="50" value={drawdownFromHigh} onChange={(e) => setDrawdownFromHigh(parseInt(e.target.value) || 200)} className={numInput} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save */}
      {saved && (
        <div className="mt-6 px-5 py-3.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] text-emerald-300 text-xs font-medium animate-reveal flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          Coach settings saved
        </div>
      )}
      <button onClick={handleSave} className="mt-6 px-8 py-3.5 btn-premium text-xs uppercase tracking-[2px] rounded-xl press-scale animate-reveal">
        Save Coach
      </button>
    </div>
  );
};
