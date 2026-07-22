import React, { useState, useEffect } from 'react';

export const PsychologyCoach: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const [enabled, setEnabled] = useState(true);
  const [maxTradesPerDay, setMaxTradesPerDay] = useState(10);
  const [cooldownSeconds, setCooldownSeconds] = useState(120);
  const [maxDailyLoss, setMaxDailyLoss] = useState(500);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const config = await window.electronAPI.getCoachConfig();
        if (config) {
          setEnabled(config.enabled !== false);
          setMaxTradesPerDay(config.maxTradesPerDay || 10);
          setCooldownSeconds(config.cooldownSeconds || 120);
          setMaxDailyLoss(config.maxDailyLoss || 500);
        }
      } catch {}
    })();
  }, []);

  const handleSave = async () => {
    await window.electronAPI.updateCoachConfig({ enabled, maxTradesPerDay, cooldownSeconds, maxDailyLoss });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="app-settings">
      <h2>Psychology Coach</h2>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
        Detects emotional trading patterns. Warns you first — if you ignore the warning, it blocks the next order.
      </p>

      <div className="form-section">
        <h3>Enable Coach</h3>
        <label className="checkbox-label">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>Enable psychology coach (warn then block)</span>
        </label>
      </div>

      {enabled && (
        <>
          <div className="form-section">
            <h3>Daily Trade Limit</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '10px' }}>
              After this many trades, you get warned. 2 more trades after that and you're blocked.
            </p>
            <div className="form-group">
              <label>Max trades per day</label>
              <input type="number" min="1" max="50" value={maxTradesPerDay} onChange={(e) => setMaxTradesPerDay(parseInt(e.target.value) || 10)} />
            </div>
          </div>

          <div className="form-section">
            <h3>Cooldown After Loss</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '10px' }}>
              After a losing trade, forces you to wait before placing another. First attempt = warning. Second attempt = blocked.
            </p>
            <div className="form-group">
              <label>Cooldown (seconds)</label>
              <input type="number" min="30" max="600" step="30" value={cooldownSeconds} onChange={(e) => setCooldownSeconds(parseInt(e.target.value) || 120)} />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              {Math.floor(cooldownSeconds / 60)}m {cooldownSeconds % 60}s wait after every loss
            </p>
          </div>

          <div className="form-section">
            <h3>Daily Loss Cutoff</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '10px' }}>
              When your total losses for the day hit this amount, all trading is blocked until the next session.
            </p>
            <div className="form-group">
              <label>Max daily loss ($)</label>
              <input type="number" min="50" max="10000" step="50" value={maxDailyLoss} onChange={(e) => setMaxDailyLoss(parseInt(e.target.value) || 500)} />
            </div>
          </div>

          <div className="form-section">
            <h3>What It Detects</h3>
            <div className="info-box" style={{ marginBottom: 0 }}>
              <p><strong>Warns you:</strong></p>
              <p>• Revenge trading — trading within 30s of a loss</p>
              <p>• Overtrading — exceeding your max trades</p>
              <p>• Rapid-fire — 3+ orders in 10 seconds</p>
              <p style={{ marginTop: '10px' }}><strong>Blocks you:</strong></p>
              <p>• Ignoring a cooldown warning</p>
              <p>• Continuing to overtrade after warning</p>
              <p>• Hitting your daily loss limit</p>
            </div>
          </div>
        </>
      )}

      {saved && <div className="success-message">Coach settings saved!</div>}
      <button className="primary-button" onClick={handleSave} style={{ marginTop: '16px' }}>Save Coach Settings</button>
    </div>
  );
};
