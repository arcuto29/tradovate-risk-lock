import React, { useState, useEffect } from 'react';

export const AppSettingsPanel: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const [settings, setSettings] = useState({ cooldownHours: 12, startWithWindows: true, minimizeToTray: true });
  const [saved, setSaved] = useState(false);

  useEffect(() => { (async () => { const s = await window.electronAPI.getSettings(); setSettings({ cooldownHours: s.cooldownHours, startWithWindows: s.startWithWindows, minimizeToTray: s.minimizeToTray }); })(); }, []);

  const handleSave = async () => { await window.electronAPI.updateSettings(settings); setSaved(true); setTimeout(() => setSaved(false), 3000); };

  return (
    <div className="app-settings">
      <h2>Application Settings</h2>
      {isLocked && <div className="warning-box">Some settings cannot be changed while locked.</div>}
      <div className="form-section"><h3>Early Unlock</h3><div className="form-group"><label>Cooldown Period (hours)</label><input type="number" min="1" max="48" value={settings.cooldownHours} onChange={(e) => setSettings({...settings, cooldownHours: parseInt(e.target.value) || 12})} disabled={isLocked} /></div></div>
      <div className="form-section"><h3>Startup</h3>
        <label className="checkbox-label"><input type="checkbox" checked={settings.startWithWindows} onChange={(e) => setSettings({...settings, startWithWindows: e.target.checked})} /><span>Start with Windows</span></label>
        <label className="checkbox-label"><input type="checkbox" checked={settings.minimizeToTray} onChange={(e) => setSettings({...settings, minimizeToTray: e.target.checked})} /><span>Minimize to tray when closed</span></label>
      </div>
      <div className="form-section"><h3>Browser Extension</h3><div className="info-box"><p>Extension communicates via WebSocket on port 47392. Install the extension from the browser-extension/ folder.</p></div></div>
      {saved && <div className="success-message">Saved!</div>}
      <button className="primary-button" onClick={handleSave}>Save Settings</button>
    </div>
  );
};
