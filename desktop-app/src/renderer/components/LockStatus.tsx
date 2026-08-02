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

        {/* Lock icon - gradient filled, distinct from shield logo */}
        <div className="mb-4 flex justify-center" style={{animation: 'float 6s ease-in-out infinite'}}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="shield-icon">
            <defs>
              <linearGradient id="lockIconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={colors.primary} />
                <stop offset="100%" stopColor={colors.secondary} />
              </linearGradient>
            </defs>
            {/* Lock body */}
            <rect x="5" y="11" width="14" height="10" rx="2.5" fill="url(#lockIconGrad)" />
            {/* Lock shackle */}
            <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="url(#lockIconGrad)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* Keyhole */}
            <circle cx="12" cy="15.5" r="1.5" fill="white" opacity="0.9" />
            <rect x="11.4" y="16.5" width="1.2" height="2.5" rx="0.6" fill="white" opacity="0.9" />
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

      {/* Circular Countdown Ring - THE CENTERPIECE */}
      <div className="flex justify-center mb-10 animate-reveal">
        <div className="relative" style={{width: '280px', height: '280px'}}>
          {/* Outer pulsing ambient glow */}
          <div className="absolute inset-[-40px] rounded-full" style={{background: `radial-gradient(circle, ${colors.primary}18 0%, ${colors.primary}08 30%, transparent 65%)`, animation: 'breathe 4s ease-in-out infinite'}} />

          {/* Particle orbit ring 1 - fast, small dots */}
          <svg width="280" height="280" className="absolute inset-0" style={{animation: 'spin 12s linear infinite'}}>
            <circle cx="140" cy="25" r="2" fill={colors.primary} opacity="0.6" />
            <circle cx="255" cy="140" r="1.5" fill={colors.primary} opacity="0.4" />
            <circle cx="140" cy="255" r="2" fill={colors.secondary} opacity="0.5" />
            <circle cx="25" cy="140" r="1.5" fill={colors.primary} opacity="0.3" />
          </svg>

          {/* Particle orbit ring 2 - slow, counter-rotate */}
          <svg width="280" height="280" className="absolute inset-0" style={{animation: 'spin 25s linear infinite reverse'}}>
            <circle cx="140" cy="15" r="1" fill={colors.secondary} opacity="0.4" />
            <circle cx="265" cy="140" r="1.5" fill={colors.primary} opacity="0.3" />
            <circle cx="140" cy="265" r="1" fill={colors.primary} opacity="0.5" />
            <circle cx="15" cy="140" r="1.5" fill={colors.secondary} opacity="0.3" />
          </svg>

          {/* Outer dashed orbit track */}
          <svg width="280" height="280" className="absolute inset-0" style={{animation: 'spin 40s linear infinite'}}>
            <circle cx="140" cy="140" r="135" fill="none" stroke={`${colors.primary}08`} strokeWidth="0.5" strokeDasharray="3 10" />
          </svg>

          {/* Middle orbit track - counter */}
          <svg width="280" height="280" className="absolute inset-0" style={{animation: 'spin 30s linear infinite reverse'}}>
            <circle cx="140" cy="140" r="125" fill="none" stroke={`${colors.secondary}06`} strokeWidth="0.5" strokeDasharray="2 15" />
          </svg>

          {/* Main ring container */}
          <svg width="280" height="280" className="absolute inset-0 transform -rotate-90">
            {/* Outer background track */}
            <circle cx="140" cy="140" r="110" fill="none" stroke={`${colors.primary}06`} strokeWidth="1" />
            {/* Main background track */}
            <circle cx="140" cy="140" r="100" fill="none" stroke={`${colors.primary}12`} strokeWidth="5" strokeLinecap="round" />
            {/* Inner background track */}
            <circle cx="140" cy="140" r="88" fill="none" stroke={`${colors.primary}06`} strokeWidth="1" />

            {/* MAIN PROGRESS ARC - thick, glowing */}
            <circle
              cx="140" cy="140" r="100" fill="none"
              stroke="url(#timerGradient)" strokeWidth="6"
              strokeDasharray={2 * Math.PI * 100}
              strokeDashoffset={2 * Math.PI * 100 * (1 - progress)}
              strokeLinecap="round"
              className="transition-all duration-1000"
              style={{filter: `drop-shadow(0 0 12px ${colors.primary}80) drop-shadow(0 0 30px ${colors.primary}30)`}}
            />

            {/* Secondary thin progress arc - slightly ahead */}
            <circle
              cx="140" cy="140" r="108" fill="none"
              stroke={`${colors.secondary}40`} strokeWidth="1.5"
              strokeDasharray={2 * Math.PI * 108}
              strokeDashoffset={2 * Math.PI * 108 * (1 - progress * 0.98)}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />

            <defs>
              <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={theme === 'nebula' ? '#22d3ee' : theme === 'aurora' ? '#10b981' : theme === 'sakura' ? '#f472b6' : theme === 'midnight' ? '#ef4444' : theme === 'hologram' ? '#00d4ff' : theme === 'void' ? '#00ff88' : theme === 'gold' ? '#ffd700' : '#fbbf24'} />
                <stop offset="50%" stopColor={theme === 'nebula' ? '#a78bfa' : theme === 'aurora' ? '#06b6d4' : theme === 'sakura' ? '#ec4899' : theme === 'midnight' ? '#ffffff' : theme === 'hologram' ? '#0066ff' : theme === 'void' ? '#00ff88' : theme === 'gold' ? '#ffffff' : '#f59e0b'} />
                <stop offset="100%" stopColor={theme === 'nebula' ? '#818cf8' : theme === 'aurora' ? '#34d399' : theme === 'sakura' ? '#fb7185' : theme === 'midnight' ? '#3b82f6' : theme === 'hologram' ? '#00d4ff' : theme === 'void' ? '#00cc6a' : theme === 'gold' ? '#b8860b' : '#ef4444'} />
              </linearGradient>
            </defs>
          </svg>

          {/* Inner glass circle */}
          <div className="absolute inset-[32px] rounded-full" style={{
            background: `radial-gradient(circle at 50% 40%, ${colors.primary}08 0%, transparent 60%)`,
            border: `1px solid ${colors.primary}08`,
          }} />

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[0.45rem] font-bold tracking-[5px] uppercase mb-3" style={{color: `${colors.primary}90`, animation: 'breathe 4s ease-in-out infinite'}}>Unlocks in</p>
            <p className="font-mono text-[2.5rem] font-black tracking-tight leading-none" style={{
              color: colors.primary,
              textShadow: `0 0 20px ${colors.primary}50, 0 0 40px ${colors.primary}20, 0 0 80px ${colors.primary}08`,
              animation: 'timerPulse 2s ease-in-out infinite',
            }}>
              {formatTime(lockState.timeRemaining)}
            </p>
            <p className="text-[0.45rem] font-medium tracking-[2px] uppercase mt-3" style={{color: `${colors.primary}70`}}>
              {progress > 0.5 ? 'Almost there' : 'Stay disciplined'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-8 animate-reveal">
        <div className="relative rounded-xl p-5 overflow-hidden hover-lift group card-premium">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)`}} />
          <p className="text-[0.55rem] font-semibold tracking-[1.5px] uppercase mb-2 relative" style={{color: `${colors.primary}`}}>Loss Limit</p>
          <p className="font-mono text-xl font-bold text-white relative">
            {lockState.settings?.dailyLossLimit > 0 ? formatCurrency(lockState.settings.dailyLossLimit) : '—'}
          </p>
        </div>

        <div className="relative rounded-xl p-5 overflow-hidden hover-lift group card-premium">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.secondary}30, transparent)`}} />
          <p className="text-[0.55rem] font-semibold tracking-[1.5px] uppercase mb-2 relative" style={{color: `${colors.secondary}`}}>Profit Target</p>
          <p className="font-mono text-xl font-bold text-white relative">
            {lockState.settings?.dailyProfitTarget > 0 ? formatCurrency(lockState.settings.dailyProfitTarget) : '—'}
          </p>
        </div>

        <div className="relative rounded-xl p-5 overflow-hidden hover-lift group card-premium">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)`}} />
          <p className="text-[0.55rem] font-semibold tracking-[1.5px] uppercase mb-2 relative" style={{color: `${colors.primary}`}}>Max Contracts</p>
          <p className="font-mono text-xl font-bold text-white relative">
            {lockState.settings?.maxContracts > 0 ? lockState.settings.maxContracts : '—'}
          </p>
        </div>

        <div className="relative rounded-xl p-5 overflow-hidden hover-lift group card-premium">
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${lockState.bypassAttempts > 0 ? '#f8717130' : colors.primary + '30'}, transparent)`}} />
          <p className="text-[0.55rem] font-semibold tracking-[1.5px] uppercase mb-2 relative" style={{color: lockState.bypassAttempts > 0 ? '#f87171' : colors.primary}}>Bypass Attempts</p>
          <p className={`font-mono text-xl font-bold relative ${lockState.bypassAttempts > 0 ? 'text-glow-red' : 'text-white'}`}>{lockState.bypassAttempts}</p>
        </div>
      </div>

      {/* Unlock Section */}
      <div className="pt-6 border-t border-white/[0.04] animate-reveal">
        {lockState.trustedPersonEnabled ? (
          <div className="glass rounded-xl p-6 max-w-xs mx-auto">
            <h3 className="text-sm font-semibold text-white/80 mb-4">Trusted Person Unlock</h3>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
              className="w-full bg-white/[0.03] border rounded-lg px-4 py-3 text-white text-sm focus:outline-none transition-all placeholder:text-white/20 mb-4"
              style={{borderColor: `${colors.primary}20`}} />
            <button onClick={handleTrustedUnlock} disabled={submitting}
              className="px-6 py-3 text-xs font-bold uppercase tracking-[2px] rounded-lg transition-all disabled:opacity-20 press-scale"
              style={{background: colors.primary, color: theme === 'midnight' ? '#000000' : '#ffffff', boxShadow: `0 0 15px ${colors.primary}30`}}>
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
            <p className="text-xs font-medium mb-4" style={{color: `${colors.primary}cc`}}>Cooldown applies. Not removed immediately.</p>
            <textarea value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} placeholder="Why are you breaking your plan?" rows={3}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:outline-none transition-all resize-none placeholder:text-white/20 mb-4"
              style={{borderColor: `${colors.primary}20`}} />
            <div className="flex gap-3">
              <button onClick={() => setShowUnlockForm(false)}
                className="px-5 py-2.5 border border-white/[0.08] text-white/30 text-xs font-semibold uppercase tracking-[1.5px] rounded-lg hover:border-white/20 hover:text-white/50 transition-all">Cancel</button>
              <button onClick={handleEarlyUnlock} disabled={submitting}
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-[1.5px] rounded-lg transition-all disabled:opacity-20 press-scale"
                style={{background: colors.primary, color: theme === 'midnight' ? '#000000' : '#ffffff', boxShadow: `0 0 12px ${colors.primary}30`}}>Submit</button>
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
