import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

interface LockStatusProps {
  lockState: any;
  onRefresh: () => void;
}

export const LockStatus: React.FC<LockStatusProps> = ({ lockState, onRefresh }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
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

  // Calculate ring progress (0 to 1)
  const totalSeconds = lockState.settings?.resetTime ? 86400 : 28800; // Assume 8hr session if no data
  const remaining = lockState.timeRemaining || 0;
  const progress = Math.max(0, Math.min(1, 1 - (remaining / totalSeconds)));
  const circumference = 2 * Math.PI * 90;
  const strokeOffset = circumference * (1 - progress);

  const handleEarlyUnlock = async () => {
    if (!unlockReason.trim() || unlockReason.length < 10) { setError('Provide a detailed reason (min 10 chars)'); return; }
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
      {/* Hero with shield + particles */}
      <div className="text-center mb-8 animate-reveal relative">
        {/* Floating particles - only on dark themes */}
        {(theme === 'nebula' || theme === 'aurora') && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-1.5 h-1.5 rounded-full top-[20%] left-[15%]" style={{background: colors.primary + '40', animation: 'float 6s ease-in-out infinite', animationDelay: '0s'}} />
          <div className="absolute w-1 h-1 rounded-full top-[40%] right-[20%]" style={{background: colors.secondary + '30', animation: 'float 6s ease-in-out infinite', animationDelay: '1s'}} />
          <div className="absolute w-1 h-1 rounded-full top-[60%] left-[25%]" style={{background: colors.primary + '25', animation: 'float 6s ease-in-out infinite', animationDelay: '2s'}} />
          <div className="absolute w-1.5 h-1.5 rounded-full top-[30%] right-[30%]" style={{background: colors.primary + '20', animation: 'float 6s ease-in-out infinite', animationDelay: '3s'}} />
          <div className="absolute w-1 h-1 rounded-full bottom-[20%] left-[40%]" style={{background: colors.secondary + '20', animation: 'float 6s ease-in-out infinite', animationDelay: '1.5s'}} />
          <div className="absolute w-0.5 h-0.5 rounded-full top-[50%] right-[40%]" style={{background: colors.primary + '30', animation: 'float 6s ease-in-out infinite', animationDelay: '2.5s'}} />
        </div>
        )}

        {/* Shield icon - solid with gradient fill, matches current theme */}
        <div className="mb-4 flex justify-center" style={{animation: 'float 6s ease-in-out infinite'}}>
          <svg width="52" height="52" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="shield-icon">
            <defs>
              <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={theme === 'nebula' ? '#22d3ee' : theme === 'aurora' ? '#10b981' : theme === 'sakura' ? '#f472b6' : '#fbbf24'} />
                <stop offset="50%" stopColor={theme === 'nebula' ? '#a78bfa' : theme === 'aurora' ? '#06b6d4' : theme === 'sakura' ? '#ec4899' : '#f59e0b'} />
                <stop offset="100%" stopColor={theme === 'nebula' ? '#22d3ee' : theme === 'aurora' ? '#10b981' : theme === 'sakura' ? '#f472b6' : '#fbbf24'} />
              </linearGradient>
            </defs>
            <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z" fill="url(#shieldGrad)" stroke="none" />
            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" />
          </svg>
        </div>
        <h2 className="text-5xl font-black tracking-tighter leading-none mb-4 text-gradient">
          Locked
        </h2>
        <p className="text-white/30 text-sm leading-relaxed max-w-xs mx-auto">
          You made this decision while calm.<br />
          Don't let temporary emotions change the plan.
        </p>
      </div>

      {/* Circular Countdown Ring */}
      <div className="flex justify-center mb-10 animate-reveal">
        <div className="relative">
          {/* Outer glow */}
          <div className="absolute inset-[-12px] rounded-full" style={{background: `radial-gradient(circle, ${colors.primary}08 0%, transparent 70%)`}} />
          
          {/* Rotating outer track */}
          <svg width="240" height="240" className="absolute top-[-10px] left-[-10px]" style={{animation: 'spin 20s linear infinite'}}>
            <circle cx="120" cy="120" r="108" fill="none" stroke={`${colors.primary}10`} strokeWidth="1" strokeDasharray="8 12" />
          </svg>

          {/* SVG Ring */}
          <svg width="220" height="220" className="transform -rotate-90">
            {/* Background ring */}
            <circle cx="110" cy="110" r="90" fill="none" stroke={`${colors.primary}08`} strokeWidth="6" />
            {/* Secondary faint ring */}
            <circle cx="110" cy="110" r="82" fill="none" stroke={`${colors.primary}05`} strokeWidth="1" />
            {/* Progress ring */}
            <circle
              cx="110" cy="110" r="90" fill="none"
              stroke="url(#gradient)" strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              strokeLinecap="round"
              className="transition-all duration-1000"
              style={{filter: `drop-shadow(0 0 10px ${colors.primary}60)`}}
            />
            {/* Gradient definition */}
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={theme === 'nebula' ? '#22d3ee' : theme === 'aurora' ? '#10b981' : theme === 'sakura' ? '#f472b6' : '#fbbf24'} />
                <stop offset="50%" stopColor={theme === 'nebula' ? '#a78bfa' : theme === 'aurora' ? '#06b6d4' : theme === 'sakura' ? '#ec4899' : '#f59e0b'} />
                <stop offset="100%" stopColor={theme === 'nebula' ? '#22d3ee' : theme === 'aurora' ? '#10b981' : theme === 'sakura' ? '#f472b6' : '#fbbf24'} />
              </linearGradient>
            </defs>
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[0.5rem] font-bold tracking-[3px] uppercase mb-2" style={{color: `${colors.primary}70`}}>Unlocks in</p>
            <p className="font-mono text-3xl font-bold tracking-tight" style={{color: colors.primary, textShadow: `0 0 20px ${colors.primary}40`}}>
              {formatTime(lockState.timeRemaining)}
            </p>
          </div>

          {/* Dot indicator at progress end */}
          <div className="absolute w-2.5 h-2.5 rounded-full" style={{
            background: colors.primary,
            boxShadow: `0 0 8px ${colors.primary}80`,
            top: `${110 - 90 * Math.cos((1 - progress) * 2 * Math.PI - Math.PI/2)}px`,
            left: `${110 + 90 * Math.sin((1 - progress) * 2 * Math.PI - Math.PI/2) - 5}px`,
          }} />
        </div>
      </div>

      {/* Stats Grid with gradient borders */}
      <div className="grid grid-cols-2 gap-3 mb-8 animate-reveal">
        <div className="relative rounded-xl p-5 overflow-hidden hover-lift group" style={{background: 'rgba(10,5,30,0.5)', backdropFilter: 'blur(16px)'}}>
          <div className="absolute inset-0 rounded-xl border border-cyan-400/20 group-hover:border-cyan-400/40 transition-colors" />
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
          <p className="text-[0.55rem] font-semibold tracking-[1.5px] uppercase text-cyan-400/50 mb-2 relative">Loss Limit</p>
          <p className="font-mono text-xl font-bold text-white relative">
            {lockState.settings?.dailyLossLimit > 0 ? formatCurrency(lockState.settings.dailyLossLimit) : '—'}
          </p>
        </div>

        <div className="relative rounded-xl p-5 overflow-hidden hover-lift group" style={{background: 'rgba(10,5,30,0.5)', backdropFilter: 'blur(16px)'}}>
          <div className="absolute inset-0 rounded-xl border border-emerald-400/20 group-hover:border-emerald-400/40 transition-colors" />
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
          <p className="text-[0.55rem] font-semibold tracking-[1.5px] uppercase text-emerald-400/50 mb-2 relative">Profit Target</p>
          <p className="font-mono text-xl font-bold text-white relative">
            {lockState.settings?.dailyProfitTarget > 0 ? formatCurrency(lockState.settings.dailyProfitTarget) : '—'}
          </p>
        </div>

        <div className="relative rounded-xl p-5 overflow-hidden hover-lift group" style={{background: 'rgba(10,5,30,0.5)', backdropFilter: 'blur(16px)'}}>
          <div className="absolute inset-0 rounded-xl border border-purple-400/20 group-hover:border-purple-400/40 transition-colors" />
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />
          <p className="text-[0.55rem] font-semibold tracking-[1.5px] uppercase text-purple-400/50 mb-2 relative">Max Contracts</p>
          <p className="font-mono text-xl font-bold text-white relative">
            {lockState.settings?.maxContracts > 0 ? lockState.settings.maxContracts : '—'}
          </p>
        </div>

        <div className="relative rounded-xl p-5 overflow-hidden hover-lift group" style={{background: 'rgba(10,5,30,0.5)', backdropFilter: 'blur(16px)'}}>
          <div className="absolute inset-0 rounded-xl border border-red-400/20 group-hover:border-red-400/40 transition-colors" />
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-400/30 to-transparent" />
          <p className="text-[0.55rem] font-semibold tracking-[1.5px] uppercase text-red-400/50 mb-2 relative">Bypass Attempts</p>
          <p className="font-mono text-xl font-bold text-glow-red relative">{lockState.bypassAttempts}</p>
        </div>
      </div>

      {/* Unlock Section */}
      <div className="pt-6 border-t border-white/[0.04] animate-reveal">
        {lockState.trustedPersonEnabled ? (
          <div className="glass rounded-xl p-6 max-w-xs mx-auto">
            <h3 className="text-sm font-semibold text-white/80 mb-4">Trusted Person Unlock</h3>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:border-cyan-400/50 focus:outline-none transition-all placeholder:text-white/20 mb-4" />
            <button onClick={handleTrustedUnlock} disabled={submitting}
              className="px-6 py-3 text-white text-xs font-bold uppercase tracking-[2px] rounded-lg transition-all disabled:opacity-20 press-scale"
              style={{background: colors.primary, boxShadow: `0 0 15px ${colors.primary}30`}}>
              Unlock
            </button>
          </div>
        ) : !showUnlockForm ? (
          <div className="text-center">
            <button onClick={() => setShowUnlockForm(true)}
              className="px-6 py-3 border text-xs font-semibold uppercase tracking-[2px] rounded-lg transition-all press-scale"
              style={{borderColor: `${colors.primary}25`, color: `${colors.primary}90`}}>
              Request Early Unlock
            </button>
          </div>
        ) : (
          <div className="glass rounded-xl p-6 max-w-sm mx-auto animate-scale-in">
            <h3 className="text-sm font-semibold text-white/80 mb-3">Early Unlock</h3>
            <p className="text-amber-400/80 text-xs font-medium mb-4">Cooldown applies. Not removed immediately.</p>
            <textarea value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} placeholder="Why are you breaking your plan?" rows={3}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:border-cyan-400/50 focus:outline-none transition-all resize-none placeholder:text-white/20 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowUnlockForm(false)}
                className="px-5 py-2.5 border border-white/[0.08] text-white/30 text-xs font-semibold uppercase tracking-[1.5px] rounded-lg hover:border-white/20 hover:text-white/50 transition-all">Cancel</button>
              <button onClick={handleEarlyUnlock} disabled={submitting}
                className="px-5 py-2.5 text-white text-xs font-bold uppercase tracking-[1.5px] rounded-lg transition-all disabled:opacity-20 press-scale"
                style={{background: colors.primary, boxShadow: `0 0 12px ${colors.primary}30`}}>Submit</button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-5 px-5 py-4 glass rounded-lg border border-red-400/20 text-red-300 text-xs font-medium text-center">{error}</div>
      )}
    </div>
  );
};
