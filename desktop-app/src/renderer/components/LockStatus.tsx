import React, { useState } from 'react';

interface LockStatusProps {
  lockState: any;
  onRefresh: () => void;
}

export const LockStatus: React.FC<LockStatusProps> = ({ lockState, onRefresh }) => {
  const [showUnlockForm, setShowUnlockForm] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const formatTime = (seconds: number | null): string => {
    if (!seconds || seconds <= 0) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v);

  const handleEarlyUnlock = async () => {
    if (!unlockReason.trim() || unlockReason.length < 10) {
      setError('Provide a detailed reason (min 10 chars)');
      return;
    }
    setSubmitting(true); setError('');
    const result = await window.electronAPI.requestEarlyUnlock(unlockReason);
    if (result.success) { setShowUnlockForm(false); setUnlockReason(''); onRefresh(); }
    else setError(result.error || 'Failed');
    setSubmitting(false);
  };

  const handleTrustedUnlock = async () => {
    if (!password) { setError('Password required'); return; }
    setSubmitting(true); setError('');
    const result = await window.electronAPI.unlockSettings(password);
    if (result.success) { setPassword(''); onRefresh(); }
    else setError(result.error || 'Failed');
    setSubmitting(false);
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Hero */}
      <div className="text-center mb-10 animate-reveal">
        <div className="w-3 h-3 rounded-full bg-cyan-400 mx-auto mb-6 animate-pulse-glow shadow-[0_0_15px_rgba(56,189,248,0.8),0_0_30px_rgba(56,189,248,0.4)]" />
        <h2 className="text-6xl font-black tracking-tighter leading-none mb-4 text-glow-white">
          Locked
        </h2>
        <p className="text-white/35 text-sm leading-relaxed max-w-xs mx-auto">
          You made this decision while calm.<br />
          Don't let temporary emotions change the plan.
        </p>
      </div>

      {/* Countdown — Hero Treatment */}
      <div className="glass rounded-2xl p-10 mb-8 text-center border-glow-cyan animate-reveal animate-glow-pulse">
        <p className="text-[0.55rem] font-semibold tracking-[4px] uppercase text-cyan-400/50 mb-4">
          Unlocks in
        </p>
        <p className="font-mono text-6xl font-bold tracking-tight text-glow-cyan">
          {formatTime(lockState.timeRemaining)}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-8 animate-reveal">
        <div className="glass rounded-xl p-5 border-l-2 border-cyan-400/30 hover-lift">
          <p className="text-[0.55rem] font-semibold tracking-[1.5px] uppercase text-cyan-400/40 mb-2">
            Loss Limit
          </p>
          <p className="font-mono text-xl font-bold text-white">
            {lockState.settings?.dailyLossLimit > 0 ? formatCurrency(lockState.settings.dailyLossLimit) : '—'}
          </p>
        </div>
        <div className="glass rounded-xl p-5 border-l-2 border-emerald-400/30 hover-lift">
          <p className="text-[0.55rem] font-semibold tracking-[1.5px] uppercase text-emerald-400/40 mb-2">
            Profit Target
          </p>
          <p className="font-mono text-xl font-bold text-white">
            {lockState.settings?.dailyProfitTarget > 0 ? formatCurrency(lockState.settings.dailyProfitTarget) : '—'}
          </p>
        </div>
        <div className="glass rounded-xl p-5 border-l-2 border-purple-400/30 hover-lift">
          <p className="text-[0.55rem] font-semibold tracking-[1.5px] uppercase text-purple-400/40 mb-2">
            Max Contracts
          </p>
          <p className="font-mono text-xl font-bold text-white">
            {lockState.settings?.maxContracts > 0 ? lockState.settings.maxContracts : '—'}
          </p>
        </div>
        <div className="glass rounded-xl p-5 border-l-2 border-red-400/30 hover-lift">
          <p className="text-[0.55rem] font-semibold tracking-[1.5px] uppercase text-red-400/40 mb-2">
            Bypass Attempts
          </p>
          <p className="font-mono text-xl font-bold text-glow-red">
            {lockState.bypassAttempts}
          </p>
        </div>
      </div>

      {/* Unlock Section */}
      <div className="pt-6 border-t border-white/[0.04] animate-reveal">
        {lockState.trustedPersonEnabled ? (
          <div className="glass rounded-xl p-6 max-w-xs">
            <h3 className="text-sm font-semibold text-white/80 mb-4">Trusted Person Unlock</h3>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:border-cyan-400/50 focus:outline-none transition-all placeholder:text-white/20 mb-4"
            />
            <button
              onClick={handleTrustedUnlock}
              disabled={submitting}
              className="px-6 py-3 bg-cyan-400 text-black text-xs font-bold uppercase tracking-[2px] rounded-lg hover:bg-cyan-300 hover:shadow-[0_0_20px_rgba(56,189,248,0.4)] transition-all disabled:opacity-20 btn-glow press-scale"
            >
              Unlock
            </button>
          </div>
        ) : !showUnlockForm ? (
          <button
            onClick={() => setShowUnlockForm(true)}
            className="px-6 py-3 border border-white/[0.1] text-white/40 text-xs font-semibold uppercase tracking-[2px] rounded-lg hover:border-cyan-400/30 hover:text-cyan-300/80 hover:shadow-[0_0_15px_rgba(56,189,248,0.1)] transition-all press-scale"
          >
            Request Early Unlock
          </button>
        ) : (
          <div className="glass rounded-xl p-6 max-w-sm animate-scale-in">
            <h3 className="text-sm font-semibold text-white/80 mb-3">Early Unlock</h3>
            <p className="text-amber-400/80 text-xs font-medium mb-4">
              Cooldown applies. Not removed immediately.
            </p>
            <textarea
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="Why are you breaking your plan?"
              rows={3}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:border-cyan-400/50 focus:outline-none transition-all resize-none placeholder:text-white/20 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowUnlockForm(false)}
                className="px-5 py-2.5 border border-white/[0.08] text-white/30 text-xs font-semibold uppercase tracking-[1.5px] rounded-lg hover:border-white/20 hover:text-white/50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleEarlyUnlock}
                disabled={submitting}
                className="px-5 py-2.5 bg-cyan-400 text-black text-xs font-bold uppercase tracking-[1.5px] rounded-lg hover:bg-cyan-300 transition-all disabled:opacity-20 btn-glow press-scale"
              >
                Submit
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-5 px-5 py-4 glass rounded-lg border border-red-400/20 text-red-300 text-xs font-medium">
          {error}
        </div>
      )}
    </div>
  );
};
