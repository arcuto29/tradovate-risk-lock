import React, { useState, useEffect } from 'react';
import { Ban } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

interface Platform {
  id: string;
  name: string;
  processes: string[];
  domains: string[];
  builtIn: boolean;
  enabled: boolean;
}

export const Blocklist: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newProcesses, setNewProcesses] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadPlatforms(); }, []);

  const loadPlatforms = async () => {
    try {
      const data = await (window as any).electronAPI?.getPlatforms?.();
      if (data) setPlatforms(data);
    } catch {} finally { setLoading(false); }
  };

  const togglePlatform = async (id: string, enabled: boolean) => {
    await (window as any).electronAPI?.updatePlatformEnabled?.(id, enabled);
    setPlatforms(platforms.map(p => p.id === id ? { ...p, enabled } : p));
  };

  const addPlatform = async () => {
    if (!newName.trim()) return;
    await (window as any).electronAPI?.addCustomPlatform?.({
      name: newName.trim(),
      processes: newProcesses.trim(),
      domain: newDomain.trim(),
    });
    setNewName(''); setNewProcesses(''); setNewDomain('');
    setShowAddForm(false);
    loadPlatforms();
  };

  const removePlatform = async (id: string) => {
    await (window as any).electronAPI?.removeCustomPlatform?.(id);
    loadPlatforms();
  };

  if (loading) return <span className="text-white/20 text-sm animate-pulse">Loading...</span>;

  const builtIn = platforms.filter(p => p.builtIn);
  const custom = platforms.filter(p => !p.builtIn);
  const enabledCount = platforms.filter(p => p.enabled).length;

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2 animate-reveal">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/20 flex items-center justify-center">
          <Ban size={18} style={{color: 'rgb(239,68,68)', filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.5))'}} />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-gradient">Blocklist</h2>
      </div>
      <p className="text-white/30 text-sm mb-6 leading-relaxed ml-14 animate-reveal">
        Blocked when locked. Apps killed + websites blocked system-wide.
      </p>

      {/* Stats */}
      <div className="flex gap-3 mb-6 animate-reveal">
        <span className="px-3 py-1.5 rounded-lg text-[0.65rem] font-bold" style={{background: `${colors.primary}15`, border: `1px solid ${colors.primary}30`, color: colors.primary}}>
          {builtIn.length} built-in
        </span>
        <span className="px-3 py-1.5 rounded-lg bg-purple-400/10 border border-purple-400/20 text-purple-300 text-[0.65rem] font-bold">
          {custom.length} custom
        </span>
        <span className="px-3 py-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-emerald-300 text-[0.65rem] font-bold">
          {enabledCount} active
        </span>
      </div>

      {/* Built-in Platforms */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-5 animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)`}} />
        <div className="relative z-10">
          <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-5" style={{color: `${colors.primary}90`}}>Platforms</p>
          <div className="grid grid-cols-2 gap-2">
            {builtIn.map((platform) => (
              <div key={platform.id} className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.04] transition-all group" style={{'--hover-border': `${colors.primary}25`} as any}>
                <div>
                  <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors font-medium">{platform.name}</span>
                  <div className="flex gap-2 mt-1">
                    {platform.processes.length > 0 && (
                      <span className="text-[0.55rem] px-1.5 py-0.5 rounded" style={{color: `${colors.primary}70`, background: `${colors.primary}08`}}>app</span>
                    )}
                    {platform.domains.length > 0 && (
                      <span className="text-[0.55rem] text-purple-400/40 px-1.5 py-0.5 rounded bg-purple-400/5">web</span>
                    )}
                  </div>
                </div>
                <div
                  className={`toggle-premium ${platform.enabled ? 'active' : ''}`}
                  onClick={() => !isLocked && togglePlatform(platform.id, !platform.enabled)}
                  style={{ opacity: isLocked ? 0.3 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Platforms */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-5 animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase text-purple-400/60">Custom Platforms</p>
            {!isLocked && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-3 py-1.5 bg-purple-400/10 border border-purple-400/20 text-purple-300 text-[0.6rem] font-bold rounded-lg hover:bg-purple-400/20 transition-all press-scale"
              >
                {showAddForm ? 'Cancel' : '+ Add'}
              </button>
            )}
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="mb-5 p-4 rounded-xl bg-white/[0.02] border border-purple-400/15 space-y-3 animate-reveal">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Platform name (e.g. My Broker)"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:border-purple-400/50 focus:outline-none transition-all placeholder:text-white/15 input-premium"
              />
              <input
                type="text"
                value={newProcesses}
                onChange={(e) => setNewProcesses(e.target.value)}
                placeholder="App process name(s), comma-separated (optional)"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:border-purple-400/50 focus:outline-none transition-all placeholder:text-white/15 input-premium"
              />
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="Website domain, e.g. mybroker.com (optional)"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:border-purple-400/50 focus:outline-none transition-all placeholder:text-white/15 input-premium"
              />
              <button
                onClick={addPlatform}
                disabled={!newName.trim()}
                className="w-full py-3 btn-premium text-xs uppercase tracking-[2px] rounded-xl press-scale disabled:opacity-30"
              >
                Add Platform
              </button>
            </div>
          )}

          {/* Custom List */}
          {custom.length === 0 && !showAddForm && (
            <p className="text-xs text-white/15 text-center py-4">No custom platforms added yet</p>
          )}
          {custom.map((platform) => (
            <div key={platform.id} className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-purple-400/15 transition-all mb-2 group">
              <div>
                <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors font-medium">{platform.name}</span>
                <div className="flex gap-2 mt-1">
                  {platform.processes.length > 0 && (
                    <span className="text-[0.55rem] text-white/20">{platform.processes.join(', ')}</span>
                  )}
                  {platform.domains.length > 0 && (
                    <span className="text-[0.55rem] text-white/20">{platform.domains.join(', ')}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={`toggle-premium ${platform.enabled ? 'active' : ''}`}
                  onClick={() => !isLocked && togglePlatform(platform.id, !platform.enabled)}
                  style={{ opacity: isLocked ? 0.3 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
                />
                {!isLocked && (
                  <button
                    onClick={() => removePlatform(platform.id)}
                    className="text-white/20 hover:text-red-400 transition-colors text-sm press-scale"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="relative rounded-xl p-5 overflow-hidden card-premium animate-reveal">
        <div className="relative z-10 space-y-3">
          <div>
            <p className="text-[0.6rem] font-bold text-amber-400/60 uppercase tracking-[1.5px] mb-1">When are blocks active?</p>
            <p className="text-xs text-white/25">Only while a lockout runs. Blocked apps are closed and websites are blocked system-wide. Outside a lockout, nothing is blocked.</p>
          </div>
          <div>
            <p className="text-[0.6rem] font-bold text-amber-400/60 uppercase tracking-[1.5px] mb-1">How detection works</p>
            <p className="text-xs text-white/25">Desktop apps are matched by process name. Websites are blocked via the system hosts file (works in every browser).</p>
          </div>
          <div>
            <p className="text-[0.6rem] font-bold text-amber-400/60 uppercase tracking-[1.5px] mb-1">Requires admin</p>
            <p className="text-xs text-white/25">Editing the hosts file requires running the app as administrator. If not admin, only process killing works.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
