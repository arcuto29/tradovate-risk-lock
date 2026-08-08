import React, { useState, useEffect } from 'react';
import { Palette, Rocket, Handshake, Plug } from 'lucide-react';
import { useTheme, Theme, THEMES } from '../ThemeContext';

export const AppSettingsPanel: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState({ cooldownHours: 12, startWithWindows: true, minimizeToTray: true, trustedPersonEnabled: false, killBrowserOnBypass: false, soundOnBlock: false });
  const [saved, setSaved] = useState(false);
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
        killBrowserOnBypass: s.killBrowserOnBypass || false,
        soundOnBlock: s.soundOnBlock || false,
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

  const inputClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white text-sm font-medium focus:outline-none transition-all placeholder:text-white/15 input-premium";

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2 animate-reveal">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center">
          <span className="text-lg" style={{filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.3))'}}>⚙</span>
        </div>
        <h2 className="text-3xl font-black tracking-tight text-gradient">Settings</h2>
      </div>
      <p className="text-white/30 text-sm mb-8 leading-relaxed ml-14 animate-reveal">App configuration.</p>

      {isLocked && (
        <div className="mb-6 px-5 py-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] animate-reveal flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
          <span className="text-amber-300/80 text-xs font-medium">Some settings locked during active session</span>
        </div>
      )}

      {/* Appearance */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-4 animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-5">
            <Palette size={14} className="text-indigo-400/60" />
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-indigo-400/60">Appearance</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-[1px] transition-all press-scale text-left ${
                  theme === t.id
                    ? t.id === 'nebula' ? 'bg-gradient-to-r from-cyan-400/10 to-purple-400/5 border border-cyan-400/20 text-cyan-300'
                    : t.id === 'aurora' ? 'bg-gradient-to-r from-emerald-400/10 to-teal-400/5 border border-emerald-400/20 text-emerald-300'
                    : t.id === 'sakura' ? 'bg-gradient-to-r from-pink-400/10 to-rose-400/5 border border-pink-400/20 text-pink-300'
                    : 'bg-gradient-to-r from-amber-400/10 to-orange-400/5 border border-amber-400/20 text-amber-300'
                    : 'bg-white/[0.03] border border-white/[0.06] text-white/30'
                }`}
              >
                <span className="block">{t.name}</span>
                <span className="block text-[0.5rem] font-normal mt-0.5 opacity-60">{t.type === 'dark' ? '● Dark' : '○ Light'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>


      {/* Cooldown */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-4 animate-reveal stagger-1">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-cyan-400/60 text-sm">⏳</span>
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-cyan-400/60">Cooldown</p>
          </div>
          <label className="block text-xs text-white/30 mb-3">Hours before early unlock available</label>
          <input type="number" min="1" max="48" value={settings.cooldownHours} onChange={(e) => setSettings({ ...settings, cooldownHours: parseInt(e.target.value) || 12 })} disabled={isLocked} className="w-24 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-3 text-white font-mono text-sm font-bold text-center focus:border-cyan-400/50 focus:outline-none transition-all disabled:opacity-20 input-premium" />
        </div>
      </div>

      {/* Startup */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-4 animate-reveal stagger-2">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-5">
            <Rocket size={14} className="text-purple-400/60" />
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-purple-400/60">Startup</p>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm text-white/40 group-hover:text-white/60 transition-colors">Start with Windows</span>
              <div className={`toggle-premium ${settings.startWithWindows ? 'active' : ''}`} onClick={() => setSettings({ ...settings, startWithWindows: !settings.startWithWindows })} />
            </label>
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm text-white/40 group-hover:text-white/60 transition-colors">Minimize to tray on close</span>
              <div className={`toggle-premium ${settings.minimizeToTray ? 'active' : ''}`} onClick={() => setSettings({ ...settings, minimizeToTray: !settings.minimizeToTray })} />
            </label>
            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <span className="text-sm text-white/40 group-hover:text-white/60 transition-colors">Kill browser on bypass</span>
                <p className="text-[0.55rem] text-white/15 mt-0.5">Closes all browsers if extension is removed while locked</p>
              </div>
              <div className={`toggle-premium ${settings.killBrowserOnBypass ? 'active' : ''}`} onClick={() => setSettings({ ...settings, killBrowserOnBypass: !settings.killBrowserOnBypass })} />
            </label>
            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <span className="text-sm text-white/40 group-hover:text-white/60 transition-colors">Sound on block</span>
                <p className="text-[0.55rem] text-white/15 mt-0.5">Play an audible beep when an order is blocked</p>
              </div>
              <div className={`toggle-premium ${settings.soundOnBlock ? 'active' : ''}`} onClick={() => setSettings({ ...settings, soundOnBlock: !settings.soundOnBlock })} />
            </label>
          </div>
        </div>
      </div>

      {/* Trusted Person */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-4 animate-reveal stagger-3">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Handshake size={14} className="text-emerald-400/60" />
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-emerald-400/60">Trusted Person</p>
          </div>
          <p className="text-xs text-white/20 mb-5">Someone else holds the unlock password.</p>

          {isLocked && (
            <p className="text-xs text-amber-400/60">Cannot change while locked</p>
          )}

          {!isLocked && !settings.trustedPersonEnabled && (
            <div className="space-y-3">
              <div>
                <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/25 mb-2">Password (min 6)</label>
                <input type="password" value={tpPassword} onChange={(e) => setTpPassword(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/25 mb-2">Confirm</label>
                <input type="password" value={tpConfirm} onChange={(e) => setTpConfirm(e.target.value)} className={inputClass} />
              </div>
              <button onClick={handleSetTrusted} className="px-6 py-3 btn-premium text-[0.6rem] uppercase tracking-[2px] rounded-xl press-scale">Set Password</button>
            </div>
          )}

          {!isLocked && settings.trustedPersonEnabled && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                <p className="text-xs text-emerald-400/70">Active</p>
              </div>
              <div>
                <label className="block text-[0.65rem] font-semibold tracking-[1.5px] uppercase text-white/25 mb-2">Enter password to remove</label>
                <input type="password" value={tpRemovePassword} onChange={(e) => setTpRemovePassword(e.target.value)} className={inputClass} />
              </div>
              <button onClick={handleRemoveTrusted} className="px-6 py-3 border border-red-400/20 text-red-300 text-[0.6rem] font-bold uppercase tracking-[2px] rounded-xl hover:bg-red-400/10 transition-all press-scale">Remove</button>
            </div>
          )}

          {tpError && <p className="mt-3 text-xs text-red-400 animate-reveal">{tpError}</p>}
          {tpSuccess && <p className="mt-3 text-xs text-emerald-400 animate-reveal">{tpSuccess}</p>}
        </div>
      </div>

      {/* Extension */}
      <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-4 animate-reveal stagger-4">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Plug size={14} className="text-white/30" />
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-white/30">Extension</p>
          </div>
          <p className="text-xs text-white/20">WebSocket port <span className="font-mono text-cyan-400/50">47392</span></p>
        </div>
      </div>

      {/* Save */}
      {saved && (
        <div className="mt-5 px-5 py-3.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] text-emerald-300 text-xs font-medium animate-reveal flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          Settings saved
        </div>
      )}
      <button onClick={handleSave} className="mt-6 px-8 py-3.5 btn-premium text-xs uppercase tracking-[2px] rounded-xl press-scale animate-reveal">
        Save
      </button>
    </div>
  );
};
