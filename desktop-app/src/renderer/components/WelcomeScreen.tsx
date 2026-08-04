import React from 'react';
import { Logo } from './Logo';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

interface Props {
  onComplete: () => void;
}

export const WelcomeScreen: React.FC<Props> = ({ onComplete }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  return (
    <div className="h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="nebula-bg" />
      <div className="stars" />
      <div className="sakura-petals" />

      {/* Radial glow behind logo */}
      <div className="absolute" style={{
        width: '300px',
        height: '300px',
        background: `radial-gradient(circle, ${colors.primary}15 0%, ${colors.primary}05 30%, transparent 70%)`,
        borderRadius: '50%',
      }} />

      {/* Content */}
      <div className="relative z-10 text-center animate-reveal">
        {/* Logo */}
        <div className="mb-8 flex justify-center" style={{ animation: 'float 6s ease-in-out infinite' }}>
          <Logo size={100} />
        </div>

        {/* Brand name */}
        <h1 className="text-3xl font-black tracking-tight mb-3 text-gradient">
          Sentinel
        </h1>

        {/* Tagline */}
        <p className="text-white/40 text-sm mb-2 leading-relaxed max-w-xs mx-auto">
          Set your rules. Lock them. Trade with discipline.
        </p>
        <p className="text-white/20 text-xs mb-10">
          By Priisma
        </p>

        {/* Get Started button */}
        <button
          onClick={onComplete}
          className="px-10 py-4 btn-premium text-sm font-bold uppercase tracking-[2.5px] rounded-xl press-scale"
        >
          Get Started
        </button>

        {/* Version */}
        <p className="mt-8 text-[0.5rem] text-white/10 tracking-[2px] uppercase">
          v2.2.0
        </p>
      </div>
    </div>
  );
};
