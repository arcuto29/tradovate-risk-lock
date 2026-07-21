import React, { useState } from 'react';

interface LockStatusProps { lockState: any; onRefresh: () => void; }

export const LockStatus: React.FC<LockStatusProps> = ({ lockState, onRefresh }) => {
  const [showUnlockForm, setShowUnlockForm] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const formatTime = (seconds: number | null): string => {
    if (!seconds || seconds <= 0) return '00:00:00';
    const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

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
      <div className="lock-banner">
        <div className="lock-icon">&#128274;</div>
        <h2>Risk Settings: LOCKED</h2>
        <p className="motivation-message">Your Tradovate risk settings are locked for today.<br /><strong>You made this decision while calm. Do not let temporary emotions change the plan.</strong></p>
      </div>
      <div className="lock-details">
        <div className="countdown"><span className="countdown-label">Time remaining until reset:</span><span className="countdown-value">{formatTime(lockState.timeRemaining)}</span></div>
        <div className="settings-display">
          <div className="setting-row"><span className="setting-label">Daily Loss Limit:</span><span className="setting-value">{lockState.settings?.dailyLossLimit > 0 ? formatCurrency(lockState.settings.dailyLossLimit) : 'Not set'}</span></div>
          <div className="setting-row"><span className="setting-label">Daily Profit Target:</span><span className="setting-value">{lockState.settings?.dailyProfitTarget > 0 ? formatCurrency(lockState.settings.dailyProfitTarget) : 'Not set'}</span></div>
          <div className="setting-row"><span className="setting-label">Maximum Contracts:</span><span className="setting-value">{lockState.settings?.maxContracts > 0 ? lockState.settings.maxContracts : 'Not set'}</span></div>
          <div className="setting-row"><span className="setting-label">Bypass Attempts:</span><span className="setting-value bypass-count">{lockState.bypassAttempts}</span></div>
        </div>
      </div>
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
