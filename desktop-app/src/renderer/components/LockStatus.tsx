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
    setSubmitting(true);
    setError('');
    const result = await window.electronAPI.requestEarlyUnlock(unlockReason);
    if (result.success) {
      setShowUnlockForm(false);
      setUnlockReason('');
      onRefresh();
    } else {
      setError(result.error || 'Failed');
    }
    setSubmitting(false);
  };

  const handleTrustedUnlock = async () => {
    if (!password) { setError('Password required'); return; }
    setSubmitting(true);
    setError('');
    const result = await window.electronAPI.unlockSettings(password);
    if (result.success) { setPassword(''); onRefresh(); }
    else { setError(result.error || 'Failed'); }
    setSubmitting(false);
  };

  return (
    <div className="max-w-lg">
      {/* Hero */}
      <div className="mb-12">
        <div className="w-2 h-2 rounded-full bg-white mb-6 animate-pulse-slow" />
        <h2 className="text-5xl font-black tracking-tighter leading-none mb-4">
          Locked
        </h2>
        <p className="text-neutral-500 text-sm leading-relaxed max-w-sm">
          You made this decision while calm.<br />
          Don't let temporary emotions change the plan.
        </p>
      </div>

      {/* Countdown */}
      <div className="border-t border-white/[0.07] pt-10 mb-10">
        <p className="text-[0.55rem] font-semibold tracking-[3px] uppercase text-neutral-600 mb-3">
          Unlocks in
        </p>
        <p className="font-mono text-5xl font-bold tracking-tight animate-pulse-slow">
          {formatTime(lockState.timeRemaining)}
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-2 border-t border-white/[0.07]">
        <div className="py-5 pr-6 border-b border-white/[0.07]">
          <p className="text-[0.58rem] font-medium tracking-[1.5px] uppercase text-neutral-600 mb-1.5">
            Loss Limit
          </p>
          <p className="font-mono text-lg font-semibold">
            {lockState.settings?.dailyLossLimit > 0 ? formatCurrency(lockState.settings.dailyLossLimit) : '—'}
          </p>
        </div>
        <div className="py-5 pl-6 border-b border-l border-white/[0.07]">
          <p className="text-[0.58rem] font-medium tracking-[1.5px] uppercase text-neutral-600 mb-1.5">
            Profit Target
          </p>
          <p className="font-mono text-lg font-semibold">
            {lockState.settings?.dailyProfitTarget > 0 ? formatCurrency(lockState.settings.dailyProfitTarget) : '—'}
          </p>
        </div>
        <div className="py-5 pr-6 border-b border-white/[0.07]">
          <p className="text-[0.58rem] font-medium tracking-[1.5px] uppercase text-neutral-600 mb-1.5">
            Max Contracts
          </p>
          <p className="font-mono text-lg font-semibold">
            {lockState.settings?.maxContracts > 0 ? lockState.settings.maxContracts : '—'}
          </p>
        </div>
        <div className="py-5 pl-6 border-b border-l border-white/[0.07]">
          <p className="text-[0.58rem] font-medium tracking-[1.5px] uppercase text-neutral-600 mb-1.5">
            Bypass Attempts
          </p>
          <p className="font-mono text-lg font-semibold text-red-500">
            {lockState.bypassAttempts}
          </p>
        </div>
      </div>

      {/* Unlock Section */}
      <div className="mt-10 pt-10 border-t border-white/[0.07]">
        {lockState.trustedPersonEnabled ? (
          <div className="max-w-xs">
            <h3 className="text-sm font-semibold mb-4">Trusted Person Unlock</h3>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-transparent border-b border-white/[0.07] py-3 text-white text-base focus:border-white focus:outline-none transition-colors mb-4"
            />
            <button
              onClick={handleTrustedUnlock}
              disabled={submitting}
              className="px-7 py-3.5 border border-white bg-white text-black text-xs font-bold uppercase tracking-[2px] hover:bg-transparent hover:text-white transition-all disabled:opacity-20"
            >
              Unlock
            </button>
          </div>
        ) : !showUnlockForm ? (
          <button
            onClick={() => setShowUnlockForm(true)}
            className="px-7 py-3.5 border border-white/[0.14] text-neutral-500 text-xs font-semibold uppercase tracking-[2px] hover:border-white hover:text-white transition-all"
          >
            Request Early Unlock
          </button>
        ) : (
          <div className="max-w-sm">
            <h3 className="text-sm font-semibold mb-3">Early Unlock</h3>
            <p className="text-amber-500 text-xs font-medium mb-4">
              Cooldown applies. Not removed immediately.
            </p>
            <textarea
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="Why are you breaking your plan?"
              rows={3}
              className="w-full bg-transparent border-b border-white/[0.07] py-3 text-white text-base focus:border-white focus:outline-none transition-colors resize-none mb-5"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowUnlockForm(false)}
                className="px-6 py-3 border border-white/[0.07] text-neutral-600 text-xs font-semibold uppercase tracking-[2px] hover:border-white/20 hover:text-neutral-400 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleEarlyUnlock}
                disabled={submitting}
                className="px-6 py-3 border border-white bg-white text-black text-xs font-bold uppercase tracking-[2px] hover:bg-transparent hover:text-white transition-all disabled:opacity-20"
              >
                Submit
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 px-5 py-4 bg-red-500/10 border-l-2 border-red-500 text-red-400 text-xs font-medium">
          {error}
        </div>
      )}
    </div>
  );
};
