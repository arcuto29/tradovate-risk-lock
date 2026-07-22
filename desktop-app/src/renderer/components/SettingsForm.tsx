import React, { useState, useEffect } from 'react';

interface SettingsFormProps {
  onLocked: () => void;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'UTC', label: 'UTC' },
];

export const SettingsForm: React.FC<SettingsFormProps> = ({ onLocked }) => {
  const [dailyLossLimit, setDailyLossLimit] = useState('');
  const [dailyProfitTarget, setDailyProfitTarget] = useState('');
  const [maxContracts, setMaxContracts] = useState('');
  const [resetTime, setResetTime] = useState('17:00');
  const [resetTimezone, setResetTimezone] = useState('America/New_York');
  const [platform, setPlatform] = useState<'web' | 'desktop' | 'pwa'>('web');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [locking, setLocking] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (window.electronAPI.onTradovateSettingsSynced) {
      window.electronAPI.onTradovateSettingsSynced((settings: any) => {
        if (settings) {
          if (settings.maxLossPerTrade) setDailyLossLimit(String(settings.maxLossPerTrade));
          if (settings.maxProfitPerTrade) setDailyProfitTarget(String(settings.maxProfitPerTrade));
          if (settings.maxLimitInTrade) setMaxContracts(String(settings.maxLimitInTrade));
          if (settings.dailyLossLimit) setDailyLossLimit(String(settings.dailyLossLimit));
          if (settings.dailyProfitTrigger) setDailyProfitTarget(String(settings.dailyProfitTrigger));
          if (settings.maxPositionSize) setMaxContracts(String(settings.maxPositionSize));
          setSynced(true);
          setTimeout(() => setSynced(false), 5000);
        }
      });
    }
  }, []);

  const handleLock = async () => {
    if (!confirmed) {
      setError('Please confirm to lock your settings');
      return;
    }

    const settings = {
      dailyLossLimit: parseFloat(dailyLossLimit) || 0,
      dailyProfitTarget: parseFloat(dailyProfitTarget) || 0,
      maxContracts: parseInt(maxContracts) || 0,
      resetTime,
      resetTimezone,
      platform,
    };

    if (settings.dailyLossLimit <= 0 && settings.dailyProfitTarget <= 0 && settings.maxContracts <= 0) {
      setError('At least one risk limit must be greater than zero');
      return;
    }

    setLocking(true);
    setError('');

    try {
      const result = await window.electronAPI.lockSettings(settings);
      if (result.success) {
        onLocked();
      } else {
        setError(result.error || 'Failed to lock');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLocking(false);
    }
  };

  return (
    <div className="settings-form">
      <div className="form-intro">
        <h2>Configure Risk Settings Lock</h2>
        <p>Open your Tradovate risk settings page — the values will auto-fill here. Then hit Lock for Today.</p>
      </div>

      {synced && (
        <div className="success-message mb-lg">
          Settings synced from Tradovate automatically.
        </div>
      )}

      <div className="form-section">
        <h3>Risk Limits</h3>
        <div className="form-group">
          <label>Daily Loss Limit ($)</label>
          <input
            type="number"
            min="0"
            step="50"
            value={dailyLossLimit}
            onChange={(e) => setDailyLossLimit(e.target.value)}
            placeholder="Auto-fills from Tradovate"
          />
        </div>
        <div className="form-group">
          <label>Daily Profit Target ($)</label>
          <input
            type="number"
            min="0"
            step="50"
            value={dailyProfitTarget}
            onChange={(e) => setDailyProfitTarget(e.target.value)}
            placeholder="Auto-fills from Tradovate"
          />
        </div>
        <div className="form-group">
          <label>Maximum Contracts</label>
          <input
            type="number"
            min="0"
            step="1"
            value={maxContracts}
            onChange={(e) => setMaxContracts(e.target.value)}
            placeholder="Auto-fills from Tradovate"
          />
        </div>
      </div>

      <div className="form-section">
        <h3>Session Reset</h3>
        <div className="form-group">
          <label>Reset Time</label>
          <input
            type="time"
            value={resetTime}
            onChange={(e) => setResetTime(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Timezone</label>
          <select value={resetTimezone} onChange={(e) => setResetTimezone(e.target.value)}>
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-section">
        <h3>Platform</h3>
        <div className="form-group">
          <label>Tradovate Platform</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value as any)}>
            <option value="web">Web Browser (Chrome/Edge)</option>
            <option value="pwa">Progressive Web App</option>
            <option value="desktop">Tradovate Desktop</option>
          </select>
        </div>
      </div>

      <div className="form-section confirmation">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>I confirm these are my risk settings and I want to lock them for this trading session.</span>
        </label>
      </div>

      {error && <div className="error-message">{error}</div>}

      <button
        className="lock-button"
        onClick={handleLock}
        disabled={locking || !confirmed}
      >
        {locking ? 'Locking...' : 'Lock for Today'}
      </button>
    </div>
  );
};
