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
    if (level === 'red') return { bar: 'from-red-500 to-pink-500', dot: 'bg-red-500', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.5)]', text: 'text-red-400', label: 'TILTING', borderGlow: 'border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]' };
    if (level === 'yellow') return { bar: 'from-amber-400 to-orange-400', dot: 'bg-amber-400', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.4)]', text: 'text-amber-400', label: 'CAUTION', borderGlow: 'border-amber-400/20 shadow-[0_0_15px_rgba(251,191,36,0.05)]' };
    return { bar: `from-[${themeColors.primary}] to-[${themeColors.secondary}]`, dot: themeColors.dot, glow: themeColors.dotGlow, text: themeColors.text, label: score === 0 ? 'INACTIVE' : 'CALM', borderGlow: `${themeColors.border} ${themeColors.glow}` };
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
        <div className="w-full h-4 bg-white/[0.08] rounded-full overflow-hidden border border-white/[0.06]">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${colors.bar} transition-all duration-700`}
            style={{
              width: `${score}%`,
              boxShadow: level === 'red' ? '0 0 16px rgba(239,68,68,0.7), 0 0 30px rgba(239,68,68,0.3)' : level === 'yellow' ? '0 0 12px rgba(251,191,36,0.6), 0 0 25px rgba(251,191,36,0.2)' : '0 0 10px rgba(52,211,153,0.4)'
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
