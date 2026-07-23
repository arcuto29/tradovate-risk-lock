import React, { useState, useEffect } from 'react';

export const TiltMeter: React.FC = () => {
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState<'green' | 'yellow' | 'red'>('green');

  useEffect(() => {
    if ((window as any).electronAPI?.onTiltUpdate) {
      (window as any).electronAPI.onTiltUpdate((data: any) => {
        if (data) {
          setScore(data.score || 0);
          setLevel(data.level || 'green');
        }
      });
    }
  }, []);

  const getColor = () => {
    if (level === 'red') return { bar: 'bg-red-500', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.5)]', text: 'text-red-400', label: 'TILTING' };
    if (level === 'yellow') return { bar: 'bg-amber-400', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.4)]', text: 'text-amber-400', label: 'CAUTION' };
    return { bar: 'bg-emerald-400', glow: 'shadow-[0_0_12px_rgba(52,211,153,0.4)]', text: 'text-emerald-400', label: 'CALM' };
  };

  const colors = getColor();

  return (
    <div className="glass rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${colors.bar} ${colors.glow} animate-pulse-glow`} />
          <span className="text-xs font-semibold text-white/50 uppercase tracking-[1.5px]">Tilt Meter</span>
        </div>
        <span className={`text-xs font-bold uppercase tracking-[2px] ${colors.text}`}>
          {colors.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-white/[0.04] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors.bar} ${colors.glow}`}
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="flex justify-between mt-2">
        <span className="text-[0.55rem] text-white/20">0</span>
        <span className={`text-[0.6rem] font-mono font-bold ${colors.text}`}>{score}</span>
        <span className="text-[0.55rem] text-white/20">100</span>
      </div>

      {level === 'red' && (
        <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-[0.7rem] text-red-300 font-medium">
            Orders are blocked. You are making emotional decisions. Step away.
          </p>
        </div>
      )}

      {level === 'yellow' && (
        <div className="mt-3 px-3 py-2 bg-amber-500/10 border border-amber-500/15 rounded-lg">
          <p className="text-[0.7rem] text-amber-300/70 font-medium">
            Slow down. Check if your next trade is in your plan.
          </p>
        </div>
      )}
    </div>
  );
};
