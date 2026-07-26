import React, { useState } from 'react';

export const KillSwitch: React.FC<{ onActivated: () => void }> = ({ onActivated }) => {
  const [confirming, setConfirming] = useState(false);
  const [activated, setActivated] = useState(false);

  const handleActivate = async () => {
    await (window as any).electronAPI?.killSwitch?.();
    setActivated(true);
    onActivated();
  };

  if (activated) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <div className="w-4 h-4 rounded-full bg-red-500 mx-auto mb-6 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.6)]" />
        <h3 className="text-2xl font-black text-white mb-3">Killed</h3>
        <p className="text-white/40 text-sm">Trading blocked for 24 hours. Go do something else.</p>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <h3 className="text-lg font-bold text-white mb-3">Are you sure?</h3>
        <p className="text-white/40 text-sm mb-6">This blocks ALL trading for 24 hours. No undo.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => setConfirming(false)}
            className="px-6 py-3 border border-white/[0.08] text-white/30 text-xs font-semibold uppercase tracking-[1.5px] rounded-lg hover:border-white/20 hover:text-white/50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleActivate}
            className="px-6 py-3 bg-red-500 text-white text-xs font-bold uppercase tracking-[1.5px] rounded-lg hover:bg-red-400 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
          >
            Kill Everything
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full glass rounded-xl p-5 text-center border border-red-500/10 hover:border-red-500/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all group hover-lift press-scale"
    >
      <div className="flex items-center justify-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50 group-hover:bg-red-500 transition-all" />
        <span className="text-sm font-semibold text-red-400/60 group-hover:text-red-400 transition-all uppercase tracking-[1.5px]">Kill Switch</span>
      </div>
      <p className="text-[0.65rem] text-white/20 mt-2">Block all trading for 24 hours</p>
    </button>
  );
};
