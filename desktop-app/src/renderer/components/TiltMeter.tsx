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
    if (level === 'red') return { bar: 'from-red-500 to-pink-500', dot: 'bg-red-500', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.5)]', text: 'text-red-400', label: 'TILTING', borderGlow: 'border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]' };
    if (level === 'yellow') return { bar: 'from-amber-400 to-orange-400', dot: 'bg-amber-400', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.4)]', text: 'text-amber-400', label: 'CAUTION', borderGlow: 'border-amber-400/20 shadow-[0_0_15px_rgba(251,191,36,0.05)]' };
    return { bar: 'from-emerald-400 to-cyan-400', dot: 'bg-emerald-400', glow: 'shadow-[0_0_12px_rgba(52,211,153,0.4)]', text: 'text-emerald-400', label: 'CALM', borderGlow: 'border-emerald-400/20 shadow-[0_0_15px_rgba(52,211,153,0.05)]' };
  };

  const colors = getColor();

  return (
    <div className={`relative rounded-xl p-5 overflow-hidden card-premium mb-6 transition-all ${colors.borderGlow}`}>
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} ${colors.glow} animate-pulse`} />
            <span className="text-[0.6rem] font-bold tracking-[2px] uppercase text-white/40">Tilt Meter</span>
          </div>
          <span className={`text-[0.6rem] font-bold uppercase tracking-[2px] ${colors.text}`}>
            {colors.label}
          </span>
        </div>

        {/* Gradient Progress Bar */}
        <div className="w-full h-2.5 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${colors.bar} transition-all duration-700`}
            style={{
              width: `${score}%`,
              boxShadow: level === 'red' ? '0 0 12px rgba(239,68,68,0.5)' : level === 'yellow' ? '0 0 8px rgba(251,191,36,0.4)' : '0 0 8px rgba(52,211,153,0.3)'
            }}
          />
        </div>

        <div className="flex justify-between mt-2.5">
          <span className="text-[0.55rem] text-white/15 font-medium">0</span>
          <span className={`text-[0.65rem] font-mono font-bold ${colors.text}`}>{score}</span>
          <span className="text-[0.55rem] text-white/15 font-medium">100</span>
        </div>

        {level === 'red' && (
          <div className="mt-4 px-4 py-3 bg-red-500/[0.06] border border-red-500/15 rounded-xl animate-reveal">
            <p className="text-[0.7rem] text-red-300 font-medium">
              Orders are blocked. You are making emotional decisions. Step away.
            </p>
          </div>
        )}

        {level === 'yellow' && (
          <div className="mt-4 px-4 py-3 bg-amber-500/[0.06] border border-amber-500/15 rounded-xl animate-reveal">
            <p className="text-[0.7rem] text-amber-300/70 font-medium">
              Slow down. Check if your next trade is in your plan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
