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
      <div className="relative rounded-xl p-10 overflow-hidden card-premium text-center" style={{animation: 'nuclearPulse 3s ease-in-out infinite'}}>
        <div className="absolute inset-0 bg-gradient-to-b from-red-500/[0.03] to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-400/50 to-transparent" />
        <div className="relative z-10">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
            <div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse" />
          </div>
          <h3 className="text-2xl font-black text-white mb-3">Killed</h3>
          <p className="text-white/35 text-sm">Trading blocked for 24 hours. Go do something else.</p>
        </div>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="relative rounded-xl p-8 overflow-hidden card-premium text-center animate-scale-in">
        <div className="absolute inset-0 bg-gradient-to-b from-red-500/[0.03] to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-400/40 to-transparent" />
        <div className="relative z-10">
          <h3 className="text-lg font-bold text-white mb-3">Are you sure?</h3>
          <p className="text-white/35 text-sm mb-8">This blocks ALL trading for 24 hours. No undo.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setConfirming(false)}
              className="px-6 py-3 border border-white/[0.08] text-white/30 text-xs font-semibold uppercase tracking-[1.5px] rounded-xl hover:border-white/20 hover:text-white/50 transition-all press-scale"
            >
              Cancel
            </button>
            <button
              onClick={handleActivate}
              className="px-6 py-3 bg-red-500 text-white text-xs font-bold uppercase tracking-[1.5px] rounded-xl hover:bg-red-400 transition-all press-scale"
              style={{boxShadow: '0 0 25px rgba(239,68,68,0.3), 0 0 50px rgba(239,68,68,0.1)'}}
            >
              Kill Everything
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full relative rounded-xl p-5 overflow-hidden card-premium text-center border border-red-500/10 hover:border-red-500/25 transition-all group hover-lift press-scale"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/[0.02] via-transparent to-red-500/[0.02] group-hover:from-red-500/[0.04] group-hover:to-red-500/[0.04] transition-all" />
      <div className="relative z-10">
        <div className="flex items-center justify-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-500/30 group-hover:bg-red-500/60 transition-all border border-red-500/30 group-hover:shadow-[0_0_12px_rgba(239,68,68,0.4)]" />
          <span className="text-sm font-bold text-red-400/50 group-hover:text-red-400/80 transition-all uppercase tracking-[2px]">Kill Switch</span>
        </div>
        <p className="text-[0.6rem] text-white/15 mt-2 group-hover:text-white/25 transition-all">Block all trading for 24 hours</p>
      </div>
    </button>
  );
};
