import React, { useState, useEffect } from 'react';

interface LockStatusProps { lockState: any; onRefresh: () => void; }

export const LockStatus: React.FC<LockStatusProps> = ({ lockState, onRefresh }) => {
  const [showUnlockForm, setShowUnlockForm] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [particles] = useState(() => Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 10,
  })));

  const formatTime = (seconds: number | null): string => {
    if (!seconds || seconds <= 0) return '00:00:00';
    const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

  // Calculate progress for ring (percentage of time elapsed)
  const getProgress = (): number => {
    if (!lockState.timeRemaining) return 100;
    // Assume max ~24 hours = 86400 seconds
    const maxTime = 86400;
    const elapsed = maxTime - lockState.timeRemaining;
    return Math.min(100, (elapsed / maxTime) * 100);
  };

  const handleEarlyUnlock = async () => {
    if (!unlockReason.trim() || unlockReason.length < 10) { setError('Please provide a detailed reason (at least 10 characters)'); return; }
    setSubmitting(true); setError('');
    const result = await window.electronAPI.requestEarlyUnlock(unlockReason);
    if (result.success) { setShowUnlockForm(false); setUnlockReason(''); onRefresh(); } else setError(result.error || 'Failed');
    setSubmitting(false);
  };

  const handleTrustedUnlock = async () => {
    if (!password) { setError('Password required'); return; }
    setSubmitting(true); setError('');
    const result = await window.electronAPI.unlockSettings(password);
    if (result.success) { setPassword(''); onRefresh(); } else setError(result.error || 'Failed');
    setSubmitting(false);
  };

  return (
    <div className="lock-status">
      {/* Animated particle background */}
      <div className="particles-container">
        {particles.map(p => (
          <div key={p.id} className="particle" style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: `${p.size}px`, height: `${p.size}px`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }} />
        ))}
      </div>

      {/* Status Badge */}
      <div className="status-badge-container">
        <div className="status-badge locked">
          <span className="status-dot"></span>
          PROTECTED
        </div>
      </div>

      {/* Main Lock Card */}
      <div className="lock-card">
        <div className="lock-card-border"></div>
        <div className="scan-line"></div>

        {/* Shield Icon */}
        <div className="shield-container">
          <svg className="shield-icon" viewBox="0 0 24 24" width="64" height="64">
            <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="shield-glow"></div>
          <div className="shield-ring"></div>
        </div>

        <h2 className="lock-title">SESSION LOCKED</h2>
        <p className="lock-subtitle">Your risk limits are protected until reset</p>

        {/* Countdown Ring */}
        <div className="countdown-ring-container">
          <svg className="countdown-ring" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4"/>
            <circle cx="60" cy="60" r="54" fill="none" stroke="url(#ring-gradient)" strokeWidth="4"
              strokeDasharray={`${339.3}`}
              strokeDashoffset={`${339.3 * (1 - getProgress() / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
            <defs>
              <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff3b3b"/>
                <stop offset="100%" stopColor="#ff9500"/>
              </linearGradient>
            </defs>
          </svg>
          <div className="countdown-inner">
            <span className="countdown-label">UNLOCKS IN</span>
            <span className="countdown-value">{formatTime(lockState.timeRemaining)}</span>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="settings-grid">
        <div className="stat-card">
          <span className="stat-label">Daily Loss Limit</span>
          <span className="stat-value danger">{lockState.settings?.dailyLossLimit > 0 ? formatCurrency(lockState.settings.dailyLossLimit) : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Profit Target</span>
          <span className="stat-value success">{lockState.settings?.dailyProfitTarget > 0 ? formatCurrency(lockState.settings.dailyProfitTarget) : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Max Contracts</span>
          <span className="stat-value">{lockState.settings?.maxContracts > 0 ? lockState.settings.maxContracts : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Bypass Attempts</span>
          <span className="stat-value bypass">{lockState.bypassAttempts}</span>
        </div>
      </div>

      {/* Motivational Message */}
      <div className="motivation-card">
        <p>"You made this decision while calm. Trust your process."</p>
      </div>

      {/* Unlock Section */}
      <div className="unlock-section">
        {lockState.trustedPersonEnabled ? (
          <div className="trusted-unlock"><h3>Trusted Person Unlock</h3><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Trusted person password" /><button className="unlock-button" onClick={handleTrustedUnlock} disabled={submitting}>Unlock</button></div>
        ) : !showUnlockForm ? (
          <button className="request-unlock-button" onClick={() => setShowUnlockForm(true)}>Request Early Unlock</button>
        ) : (
          <div className="early-unlock-form"><h3>Request Early Unlock</h3><p className="warning-text">The lock will NOT be removed immediately. A cooldown period applies.</p><textarea value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} placeholder="I am breaking my trading plan because..." rows={4} /><div className="button-group"><button className="cancel-button" onClick={() => setShowUnlockForm(false)}>Cancel</button><button className="submit-unlock-button" onClick={handleEarlyUnlock} disabled={submitting}>Submit Request</button></div></div>
        )}
      </div>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};
