import React, { useState, useEffect } from 'react';

export const SessionHours: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const [enabled, setEnabled] = useState(false);
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('16:00');
  const [timezone, setTimezone] = useState('America/New_York');
  const [saved, setSaved] = useState(false);
  const [currentlyBlocked, setCurrentlyBlocked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const state = await window.electronAPI.getSessionHours();
        if (state) {
          setEnabled(state.enabled);
          setStartTime(state.startTime || '08:30');
          setEndTime(state.endTime || '16:00');
          setTimezone(state.timezone || 'America/New_York');
          setCurrentlyBlocked(state.currentlyBlocked || false);
        }
      } catch {}
    })();

    const interval = setInterval(async () => {
      try {
        const state = await window.electronAPI.getSessionHours();
        if (state) setCurrentlyBlocked(state.currentlyBlocked || false);
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSave = async () => {
    await window.electronAPI.updateSessionHours({ enabled, startTime, endTime, timezone });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="app-settings">
      <h2>Session Hours</h2>
      <p className="section-description">
        Block order placement outside your allowed trading window.
        You can still view charts — just can't place trades.
      </p>

      {currentlyBlocked && enabled && (
        <div className="error-message status-message-top">
          Orders are currently BLOCKED — outside your allowed hours.
        </div>
      )}

      {!currentlyBlocked && enabled && (
        <div className="success-message status-message-top">
          Trading is currently ALLOWED — inside your session window.
        </div>
      )}

      <div className="form-section">
        <h3>Enable Session Lock</h3>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>Block orders outside allowed hours</span>
        </label>
      </div>

      {enabled && (
        <>
          <div className="form-section">
            <h3>Allowed Trading Window</h3>
            <div className="form-group">
              <label>Start Time (orders allowed from)</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>End Time (orders blocked after)</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Timezone</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
              </select>
            </div>
          </div>

          <div className="form-section">
            <h3>Platforms Protected</h3>
            <div className="info-box">
              <p><strong>Browser (Chrome extension):</strong></p>
              <p>• trader.tradovate.com — orders blocked</p>
              <p>• app.tradesea.ai — orders blocked</p>
              <p>• topstepx.com — orders blocked</p>
              <p className="mt-sm"><strong>Desktop apps (auto-closed):</strong></p>
              <p>• Tradesea — closed if launched outside hours</p>
              <p>• TopstepX — closed if launched outside hours</p>
            </div>
          </div>
        </>
      )}

      {saved && <div className="success-message">Saved!</div>}
      <button className="primary-button" onClick={handleSave}>Save Session Hours</button>
    </div>
  );
};
