import React, { useState, useEffect } from 'react';

interface PositionLimit {
  symbol: string;
  maxSize: number;
  label: string;
}

const DEFAULT_LIMITS: PositionLimit[] = [
  { symbol: 'NQ', maxSize: 1, label: 'NQ (Nasdaq Futures)' },
  { symbol: 'MNQ', maxSize: 5, label: 'MNQ (Micro Nasdaq)' },
  { symbol: 'ES', maxSize: 1, label: 'ES (S&P Futures)' },
  { symbol: 'MES', maxSize: 5, label: 'MES (Micro S&P)' },
];

export const PositionLimits: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const [limits, setLimits] = useState<PositionLimit[]>(DEFAULT_LIMITS);
  const [defaultMax, setDefaultMax] = useState(2);
  const [saved, setSaved] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newMax, setNewMax] = useState('1');
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await window.electronAPI.getPositionLimits();
        if (data?.limits) setLimits(data.limits);
        if (data?.defaultMax) setDefaultMax(data.defaultMax);
      } catch {}
    })();
  }, []);

  const handleSave = async () => {
    await window.electronAPI.updatePositionLimits({ limits, defaultMax });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateLimit = (index: number, maxSize: number) => {
    const updated = [...limits];
    updated[index].maxSize = maxSize;
    setLimits(updated);
  };

  const removeLimit = (index: number) => {
    setLimits(limits.filter((_, i) => i !== index));
  };

  const addLimit = () => {
    if (!newSymbol.trim()) return;
    setLimits([
      ...limits,
      {
        symbol: newSymbol.toUpperCase().trim(),
        maxSize: parseInt(newMax) || 1,
        label: newLabel || newSymbol.toUpperCase(),
      },
    ]);
    setNewSymbol('');
    setNewMax('1');
    setNewLabel('');
  };

  return (
    <div className="app-settings">
      <h2>Position Limits</h2>
      <p className="section-description">
        Set maximum contracts per symbol. Orders exceeding these limits will be blocked
        on all platforms (TopstepX, TradingView, Tradovate, Tradesea).
      </p>

      <div className="form-section">
        <h3>Contract Limits</h3>
        {limits.map((limit, index) => (
          <div key={index} className="limit-row">
            <span className="limit-row-label">{limit.label}</span>
            <input
              className="limit-row-input"
              type="number"
              min="1"
              max="100"
              value={limit.maxSize}
              onChange={(e) => updateLimit(index, parseInt(e.target.value) || 1)}
            />
            <span className="limit-row-suffix">max</span>
            <button className="limit-row-remove" onClick={() => removeLimit(index)}>
              &times;
            </button>
          </div>
        ))}
      </div>

      <div className="form-section">
        <h3>Add Custom Symbol</h3>
        <div className="add-symbol-row">
          <div className="add-symbol-field">
            <label>Symbol</label>
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              placeholder="e.g. CL"
            />
          </div>
          <div className="add-symbol-field-small">
            <label>Max</label>
            <input
              type="number"
              min="1"
              value={newMax}
              onChange={(e) => setNewMax(e.target.value)}
            />
          </div>
          <button onClick={addLimit} className="primary-button">Add</button>
        </div>
      </div>

      <div className="form-section">
        <h3>Default Limit</h3>
        <p className="section-note">For any contract not listed above:</p>
        <div className="form-group">
          <label>Max contracts (default)</label>
          <input
            type="number"
            min="1"
            max="100"
            value={defaultMax}
            onChange={(e) => setDefaultMax(parseInt(e.target.value) || 2)}
          />
        </div>
      </div>

      <div className="form-section">
        <h3>Platforms Protected</h3>
        <div className="info-box mb-0">
          <p><strong>Position limits active on:</strong></p>
          <p>• TopstepX (topstepx.com)</p>
          <p>• TradingView — all connected brokers</p>
          <p>• Tradovate (trader.tradovate.com)</p>
          <p>• Tradesea (app.tradesea.ai)</p>
        </div>
      </div>

      {saved && <div className="success-message">Position limits saved!</div>}
      <button className="primary-button mt-lg" onClick={handleSave}>Save Position Limits</button>
    </div>
  );
};
