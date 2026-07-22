import React, { useState, useEffect } from 'react';

export const AppSettingsPanel: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const [settings, setSettings] = useState({ cooldownHours: 12, startWithWindows: true, minimizeToTray: true });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await window.electronAPI.getSettings();
      setSettings({ cooldownHours: s.cooldownHours, startWithWindows: s.startWithWindows, minimizeToTray: s.minimizeToTray });
    })();
  }, []);

  const handleSave = async () => {
    await window.electronAPI.updateSettings(settings);
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-lg">
      <h2 className="text-4xl font-black tracking-tighter mb-3">Settings</h2>
      <p className="text-neutral-500 text-sm mb-10 leading-relaxed">Application configuration.</p>

      {isLocked && (
        <div className="mb-6 px-5 py-3.5 bg-amber-500/8 border-l-2 border-amber-500 text-amber-400 text-xs font-medium">
          Some settings locked during active session
        </div>
      )}

      <div className="border-t border-white/[0.07] py-7">
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-neutral-600 mb-5">Early Unlock</p>
        <label className="block text-xs font-medium text-neutral-500 mb-2.5">Cooldown (hours)</label>
        <input
          type="number" min="1" max="48" value={settings.cooldownHours}
          onChange={(e) => setSettings({ ...settings, cooldownHours: parseInt(e.target.value) || 12 })}
          disabled={isLocked}
          className="w-20 bg-transparent border-b border-white/[0.07] py-3 text-white font-mono text-base font-semibold text-center focus:border-white focus:outline-none transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
        />
      </div>

      <div className="border-t border-white/[0.07] py-7 space-y-4">
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-neutral-600 mb-3">Startup</p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={settings.startWithWindows} onChange={(e) => setSettings({ ...settings, startWithWindows: e.target.checked })} className="w-4 h-4 accent-white" />
          <span className="text-sm text-neutral-400">Start with Windows</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={settings.minimizeToTray} onChange={(e) => setSettings({ ...settings, minimizeToTray: e.target.checked })} className="w-4 h-4 accent-white" />
          <span className="text-sm text-neutral-400">Minimize to tray on close</span>
        </label>
      </div>

      <div className="border-t border-white/[0.07] py-7">
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-neutral-600 mb-3">Extension</p>
        <p className="text-xs text-neutral-600 leading-relaxed">WebSocket port 47392 · Install from browser-extension/</p>
      </div>

      {saved && <div className="mt-4 px-5 py-3.5 bg-emerald-500/10 border-l-2 border-emerald-400 text-emerald-400 text-xs font-medium">Saved</div>}

      <button onClick={handleSave} className="mt-4 px-7 py-3.5 border border-white/[0.14] text-neutral-400 text-xs font-semibold uppercase tracking-[2px] hover:border-white hover:text-white transition-all">
        Save
      </button>
    </div>
  );
};
