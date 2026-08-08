import React, { useState } from 'react';
import { LogOut } from 'lucide-react';

export const EndSession: React.FC<{ onEnded: () => void }> = ({ onEnded }) => {
  const [confirming, setConfirming] = useState(false);
  const [ended, setEnded] = useState(false);

  const handleEnd = async () => {
    const result = await (window as any).electronAPI?.endSession?.();
    if (result?.success) {
      setEnded(true);
      onEnded();
    }
  };

  if (ended) {
    return (
      <div className="relative rounded-xl p-5 overflow-hidden card-premium animate-reveal">
        <div className="relative z-10 text-center py-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <LogOut size={16} className="text-emerald-400" />
            <h3 className="text-lg font-bold text-emerald-300">Session Ended</h3>
          </div>
          <p className="text-white/30 text-xs">New entries blocked. Exits still allowed. Lock expires at scheduled time.</p>
        </div>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="relative rounded-xl p-5 overflow-hidden card-premium animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
        <div className="relative z-10">
          <p className="text-sm text-white/50 mb-4 text-center">End your trading session?</p>
          <p className="text-[0.6rem] text-white/25 mb-4 text-center leading-relaxed">New entries will be blocked for the rest of this lock period. You can still close, reduce, and cancel existing positions. This cannot be undone.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 py-3 rounded-xl text-[0.6rem] font-bold uppercase tracking-[1.5px] bg-white/[0.03] border border-white/[0.08] text-white/40 press-scale"
            >
              Cancel
            </button>
            <button
              onClick={handleEnd}
              className="flex-1 py-3 rounded-xl text-[0.6rem] font-bold uppercase tracking-[1.5px] btn-premium press-scale"
            >
              End Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full group relative rounded-xl p-4 overflow-hidden card-premium transition-all hover:border-white/[0.12] press-scale"
    >
      <div className="relative z-10 flex items-center justify-center gap-3">
        <LogOut size={14} className="text-white/30 group-hover:text-white/50 transition-all" />
        <span className="text-sm font-bold text-white/30 group-hover:text-white/50 transition-all uppercase tracking-[2px]">End My Session</span>
      </div>
      <p className="text-[0.6rem] text-white/15 mt-2 group-hover:text-white/25 transition-all text-center">Done for the day? Block new entries, keep exits open.</p>
    </button>
  );
};
