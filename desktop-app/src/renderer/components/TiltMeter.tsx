import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

export const TiltMeter: React.FC = () => {
  const { theme } = useTheme();
  const themeColors = getThemeColors(theme);
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
    if (level === 'red') return { bar: 'from-red-500 to-rose-400', dot: 'bg-red-500', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.5)]', text: 'text-red-400', label: 'TILTING', borderGlow: 'border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]' };
    if (level === 'yellow') return { bar: 'from-yellow-400 to-amber-400', dot: 'bg-yellow-400', glow: 'shadow-[0_0_15px_rgba(250,204,21,0.5)]', text: 'text-yellow-400', label: 'CAUTION', borderGlow: 'border-yellow-400/20 shadow-[0_0_15px_rgba(250,204,21,0.08)]' };
    return { bar: 'from-emerald-400 to-green-400', dot: 'bg-emerald-400', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.5)]', text: 'text-emerald-400', label: score === 0 ? 'INACTIVE' : 'CALM', borderGlow: 'border-emerald-400/20 shadow-[0_0_15px_rgba(52,211,153,0.05)]' };
  };

  const colors = getColor();

  return (
    <div className={`relative rounded-xl p-5 overflow-hidden card-premium mb-6 transition-all ${colors.borderGlow}`}>
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${colors.dot} ${colors.glow} animate-pulse`} />
            <span className="text-[0.7rem] font-bold tracking-[2px] uppercase text-white/60">Tilt Meter</span>
          </div>
          <span className={`text-[0.7rem] font-bold uppercase tracking-[2px] ${colors.text}`}>
            {colors.label}
          </span>
        </div>

        {/* Gradient Progress Bar */}
        <div className="w-full h-4 rounded-full overflow-hidden" style={{background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.06)'}}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${score}%`,
              background: level === 'red' ? 'linear-gradient(90deg, #ef4444, #f43f5e)' : level === 'yellow' ? 'linear-gradient(90deg, #facc15, #f59e0b)' : 'linear-gradient(90deg, #34d399, #4ade80)',
              boxShadow: level === 'red' ? '0 0 16px rgba(239,68,68,0.7), 0 0 30px rgba(239,68,68,0.3)' : level === 'yellow' ? '0 0 12px rgba(250,204,21,0.7), 0 0 25px rgba(250,204,21,0.3)' : '0 0 10px rgba(52,211,153,0.5), 0 0 20px rgba(74,222,128,0.2)'
            }}
          />
        </div>

        <div className="flex justify-between mt-3">
          <span className="text-[0.6rem] text-white/35 font-medium">0</span>
          <span className={`text-sm font-mono font-black ${colors.text}`}>{score}/100</span>
          <span className="text-[0.6rem] text-white/35 font-medium">100</span>
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
