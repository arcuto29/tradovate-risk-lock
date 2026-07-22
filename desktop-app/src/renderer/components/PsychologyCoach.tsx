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
        const config = await window.electronAPI.getCoachConfig();
        if (config) {
          setEnabled(config.enabled !== false);
          setMaxTradesPerDay(config.maxTradesPerDay || 10);
          setCooldownSeconds(config.cooldownSeconds || 120);
          setMaxDailyLoss(config.maxDailyLoss || 500);
          setEscalatingCooldown(config.escalatingCooldown !== false);
          setLossStreakEnabled(config.lossStreakEnabled !== false);
          setProfitLockEnabled(config.profitLockEnabled !== false);
          setProfitLockThreshold(config.profitLockThreshold || 500);
          setDrawdownFromHigh(config.drawdownFromHigh || 200);
          setScalingLockEnabled(config.scalingLockEnabled !== false);
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
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="app-settings">
      <h2>Psychology Coach</h2>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
        Choose which protections you want active. Each one can be turned on or off independently.
      </p>

      <div className="form-section">
        <h3>Master Switch</h3>
        <label className="checkbox-label">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>Enable psychology coach</span>
        </label>
      </div>

      {enabled && (
        <>
          <div className="form-section">
            <h3>Daily Trade Limit</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '10px' }}>
              Warns you when approaching your max, blocks you after.
            </p>
            <div className="form-group">
              <label>Max trades per day</label>
              <input type="number" min="1" max="50" value={maxTradesPerDay} onChange={(e) => setMaxTradesPerDay(parseInt(e.target.value) || 10)} />
            </div>
          </div>

          <div className="form-section">
            <h3>Cooldown After Loss</h3>
            <label className="checkbox-label">
              <input type="checkbox" checked={true} disabled />
              <span>Enable cooldown after loss (always on when coach is on)</span>
            </label>
            <div className="form-group">
              <label>Base cooldown (seconds)</label>
              <input type="number" min="30" max="600" step="30" value={cooldownSeconds} onChange={(e) => setCooldownSeconds(parseInt(e.target.value) || 120)} />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '12px' }}>
              {Math.floor(cooldownSeconds / 60)}m {cooldownSeconds % 60}s wait after a loss
            </p>
            <label className="checkbox-label">
              <input type="checkbox" checked={escalatingCooldown} onChange={(e) => setEscalatingCooldown(e.target.checked)} />
              <span>Escalating cooldown (doubles after each consecutive loss: 2min → 4min → 8min → 16min)</span>
            </label>
          </div>

          <div className="form-section">
            <h3>Daily Loss Cutoff</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '10px' }}>
              Blocks all trading when you hit this loss for the day.
            </p>
            <div className="form-group">
              <label>Max daily loss ($)</label>
              <input type="number" min="50" max="10000" step="50" value={maxDailyLoss} onChange={(e) => setMaxDailyLoss(parseInt(e.target.value) || 500)} />
            </div>
          </div>

          <div className="form-section">
            <h3>Loss Streak Auto-Tighten</h3>
            <label className="checkbox-label">
              <input type="checkbox" checked={lossStreakEnabled} onChange={(e) => setLossStreakEnabled(e.target.checked)} />
              <span>Automatically reduce max position size after consecutive losses</span>
            </label>
            {lossStreakEnabled && (
              <div className="info-box" style={{ marginTop: '10px', marginBottom: 0 }}>
                <p>2 consecutive losses → max size cut in half</p>
                <p>3+ consecutive losses → forced to 1 contract</p>
                <p>Resets on a winning trade</p>
              </div>
            )}
          </div>

          <div className="form-section">
            <h3>Scaling Lock (One-Way Ratchet)</h3>
            <label className="checkbox-label">
              <input type="checkbox" checked={scalingLockEnabled} onChange={(e) => setScalingLockEnabled(e.target.checked)} />
              <span>Once size is reduced, it stays reduced until next session (can never go back up)</span>
            </label>
          </div>

          <div className="form-section">
            <h3>Profit Protection</h3>
            <label className="checkbox-label">
              <input type="checkbox" checked={profitLockEnabled} onChange={(e) => setProfitLockEnabled(e.target.checked)} />
              <span>Lock out after hitting profit target or giving back too much</span>
            </label>
            {profitLockEnabled && (
              <>
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label>Profit target — lock out after reaching ($)</label>
                  <input type="number" min="0" max="10000" step="50" value={profitLockThreshold} onChange={(e) => setProfitLockThreshold(parseInt(e.target.value) || 0)} />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '12px' }}>
                  Set to 0 to disable profit target lock (only use drawdown from high)
                </p>
                <div className="form-group">
                  <label>Drawdown from high — lock out after giving back ($)</label>
                  <input type="number" min="50" max="5000" step="50" value={drawdownFromHigh} onChange={(e) => setDrawdownFromHigh(parseInt(e.target.value) || 200)} />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  If you're up ${profitLockThreshold > 0 ? profitLockThreshold : '___'} and give back ${drawdownFromHigh}, you're done for the day.
                </p>
              </>
            )}
          </div>
        </>
      )}

      {saved && <div className="success-message">Coach settings saved!</div>}
      <button className="primary-button" onClick={handleSave} style={{ marginTop: '16px' }}>Save Coach Settings</button>
    </div>
  );
};
