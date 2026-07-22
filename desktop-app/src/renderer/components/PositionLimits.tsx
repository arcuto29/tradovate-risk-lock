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
    // Load saved limits from app
    (async () => {
      try {
        const saved = await window.electronAPI.getPositionLimits();
        if (saved && saved.limits) setLimits(saved.limits);
        if (saved && saved.defaultMax) setDefaultMax(saved.defaultMax);
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
    setLimits([...limits, { symbol: newSymbol.toUpperCase().trim(), maxSize: parseInt(newMax) || 1, label: newLabel || newSymbol.toUpperCase() }]);
    setNewSymbol('');
    setNewMax('1');
    setNewLabel('');
  };

  return (
    <div className="app-settings">
      <h2>Position Limits</h2>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
        Set maximum contracts per symbol. Orders exceeding these limits will be blocked on all platforms (TopstepX, TradingView, Tradovate, Tradesea).
      </p>

      <div className="form-section">
        <h3>Contract Limits</h3>
        {limits.map((limit, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text)' }}>{limit.label}</span>
            <input
              type="number"
              min="1"
              max="100"
              value={limit.maxSize}
              onChange={(e) => updateLimit(index, parseInt(e.target.value) || 1)}
              style={{ width: '70px', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem', textAlign: 'center' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>max</span>
            <button
              onClick={() => removeLimit(index)}
              style={{ padding: '4px 8px', border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '1rem' }}
            >&times;</button>
          </div>
        ))}
      </div>

      <div className="form-section">
        <h3>Add Custom Symbol</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px' }}>Symbol</label>
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              placeholder="e.g. CL"
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem' }}
            />
          </div>
          <div style={{ width: '70px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px' }}>Max</label>
            <input
              type="number"
              min="1"
              value={newMax}
              onChange={(e) => setNewMax(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem', textAlign: 'center' }}
            />
          </div>
          <button onClick={addLimit} className="primary-button" style={{ padding: '8px 14px' }}>Add</button>
        </div>
      </div>

      <div className="form-section">
        <h3>Default Limit</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '10px' }}>For any contract not listed above:</p>
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
        <div className="info-box" style={{ marginBottom: 0 }}>
          <p><strong>Position limits active on:</strong></p>
          <p>• TopstepX (topstepx.com)</p>
          <p>• TradingView — all connected brokers</p>
          <p>• Tradovate (trader.tradovate.com)</p>
          <p>• Tradesea (app.tradesea.ai)</p>
        </div>
      </div>

      {saved && <div className="success-message">Position limits saved!</div>}
      <button className="primary-button" onClick={handleSave} style={{ marginTop: '16px' }}>Save Position Limits</button>
    </div>
  );
};
