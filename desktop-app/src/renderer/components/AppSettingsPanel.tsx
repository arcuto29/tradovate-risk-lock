import React, { useState, useEffect } from 'react';

export const AppSettingsPanel: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const [settings, setSettings] = useState({ cooldownHours: 12, startWithWindows: true, minimizeToTray: true, trustedPersonEnabled: false });
  const [saved, setSaved] = useState(false);

  // Trusted person
  const [tpPassword, setTpPassword] = useState('');
  const [tpConfirm, setTpConfirm] = useState('');
  const [tpRemovePassword, setTpRemovePassword] = useState('');
  const [tpError, setTpError] = useState('');
  const [tpSuccess, setTpSuccess] = useState('');

  useEffect(() => {
    (async () => {
      const s = await window.electronAPI.getSettings();
      setSettings({
        cooldownHours: s.cooldownHours,
        startWithWindows: s.startWithWindows,
        minimizeToTray: s.minimizeToTray,
        trustedPersonEnabled: s.trustedPersonEnabled || false,
      });
    })();
  }, []);

  const handleSave = async () => {
    await window.electronAPI.updateSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSetTrusted = async () => {
    setTpError('');
    if (tpPassword.length < 6) { setTpError('Min 6 characters'); return; }
    if (tpPassword !== tpConfirm) { setTpError("Passwords don't match"); return; }
    const r = await window.electronAPI.setTrustedPassword(tpPassword);
    if (r.success) {
      setTpSuccess('Trusted person set');
      setTpPassword(''); setTpConfirm('');
      setSettings({ ...settings, trustedPersonEnabled: true });
      setTimeout(() => setTpSuccess(''), 3000);
    } else { setTpError(r.error || 'Failed'); }
  };

  const handleRemoveTrusted = async () => {
    setTpError('');
    const r = await window.electronAPI.removeTrustedPassword(tpRemovePassword);
    if (r.success) {
      setTpSuccess('Removed');
      setTpRemovePassword('');
      setSettings({ ...settings, trustedPersonEnabled: false });
      setTimeout(() => setTpSuccess(''), 3000);
    } else { setTpError(r.error || 'Failed'); }
  };

  const inputClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm font-medium focus:border-cyan-400/50 focus:shadow-[0_0_12px_rgba(56,189,248,0.12)] focus:outline-none transition-all placeholder:text-white/15";

  return (
    <div className="max-w-lg">
      <h2 className="text-4xl font-black tracking-tighter mb-3 text-glow-white">Settings</h2>
      <p className="text-white/35 text-sm mb-8 leading-relaxed">App configuration.</p>

      {isLocked && (
        <div className="mb-6 px-5 py-3.5 glass rounded-lg border border-amber-400/20 text-amber-300/80 text-xs font-medium">Some settings locked during session</div>
      )}

      <div className="glass rounded-xl p-6 mb-4">
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-4">Cooldown</p>
        <label className="block text-xs text-white/35 mb-2">Hours before early unlock</label>
        <input type="number" min="1" max="48" value={settings.cooldownHours} onChange={(e) => setSettings({ ...settings, cooldownHours: parseInt(e.target.value) || 12 })} disabled={isLocked} className="w-20 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white font-mono text-sm font-semibold text-center focus:border-cyan-400/50 focus:outline-none transition-all disabled:opacity-20" />
      </div>

      <div className="glass rounded-xl p-6 mb-4">
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-4">Startup</p>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={settings.startWithWindows} onChange={(e) => setSettings({ ...settings, startWithWindows: e.target.checked })} className="w-4 h-4 accent-cyan-400" />
            <span className="text-sm text-white/40">Start with Windows</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={settings.minimizeToTray} onChange={(e) => setSettings({ ...settings, minimizeToTray: e.target.checked })} className="w-4 h-4 accent-cyan-400" />
            <span className="text-sm text-white/40">Minimize to tray on close</span>
          </label>
        </div>
      </div>

      {/* Trusted Person */}
      <div className="glass rounded-xl p-6 mb-4">
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-2">Trusted Person</p>
        <p className="text-xs text-white/25 mb-4">Someone else holds the unlock password. You can't early-unlock without them.</p>

        {isLocked && (
          <p className="text-xs text-amber-400/70">Cannot change while locked</p>
        )}

        {!isLocked && !settings.trustedPersonEnabled && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-white/35 mb-1.5">Password (min 6)</label>
              <input type="password" value={tpPassword} onChange={(e) => setTpPassword(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-white/35 mb-1.5">Confirm</label>
              <input type="password" value={tpConfirm} onChange={(e) => setTpConfirm(e.target.value)} className={inputClass} />
            </div>
            <button onClick={handleSetTrusted} className="px-5 py-2.5 bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-[0.62rem] font-semibold uppercase tracking-[1.5px] rounded-lg hover:bg-cyan-400/20 transition-all">Set Password</button>
          </div>
        )}

        {!isLocked && settings.trustedPersonEnabled && (
          <div className="space-y-3">
            <p className="text-xs text-emerald-400/70 mb-2">Active — early unlock requires this password</p>
            <div>
              <label className="block text-xs text-white/35 mb-1.5">Enter password to remove</label>
              <input type="password" value={tpRemovePassword} onChange={(e) => setTpRemovePassword(e.target.value)} className={inputClass} />
            </div>
            <button onClick={handleRemoveTrusted} className="px-5 py-2.5 border border-red-400/30 text-red-300 text-[0.62rem] font-semibold uppercase tracking-[1.5px] rounded-lg hover:bg-red-400/10 transition-all">Remove</button>
          </div>
        )}

        {tpError && <p className="mt-3 text-xs text-red-400">{tpError}</p>}
        {tpSuccess && <p className="mt-3 text-xs text-emerald-400">{tpSuccess}</p>}
      </div>

      <div className="glass rounded-xl p-6 mb-4">
        <p className="text-[0.58rem] font-semibold tracking-[2.5px] uppercase text-cyan-400/50 mb-3">Extension</p>
        <p className="text-xs text-white/25">WebSocket port 47392</p>
      </div>

      {saved && <div className="mt-4 px-5 py-3.5 glass rounded-lg border border-emerald-400/20 text-glow-green text-xs font-medium">Saved</div>}
      <button onClick={handleSave} className="mt-5 px-6 py-3 bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-xs font-semibold uppercase tracking-[2px] rounded-lg hover:bg-cyan-400/20 hover:border-cyan-400/40 hover:shadow-[0_0_15px_rgba(56,189,248,0.15)] transition-all btn-glow">Save</button>
    </div>
  );
};
