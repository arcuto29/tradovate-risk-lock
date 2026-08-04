import React from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

interface LogoProps {
  size?: number;
  animated?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 48, animated = false }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  // Gold palette for shield + sword
  const goldPrimary = '#ffd700';
  const goldDark = '#b8860b';
  const goldLight = '#ffe066';
  const goldBright = '#fff4b0';
  const shieldFill = '#080810';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shield-icon ${animated ? 'animate-float' : ''}`}
      style={animated ? { animation: 'float 6s ease-in-out infinite' } : undefined}
    >
      <defs>
        <linearGradient id="shieldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={goldBright} />
          <stop offset="30%" stopColor={goldPrimary} />
          <stop offset="70%" stopColor={goldDark} />
          <stop offset="100%" stopColor={goldPrimary} />
        </linearGradient>
        <linearGradient id="swordBlade" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={goldBright} />
          <stop offset="20%" stopColor={goldLight} />
          <stop offset="60%" stopColor={goldPrimary} />
          <stop offset="100%" stopColor={goldDark} />
        </linearGradient>
        <linearGradient id="crossGuard" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor={goldDark} />
          <stop offset="50%" stopColor={goldPrimary} />
          <stop offset="100%" stopColor={goldDark} />
        </linearGradient>
        <linearGradient id="handleGrad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={goldDark} />
          <stop offset="50%" stopColor="#8B6914" />
          <stop offset="100%" stopColor={goldDark} />
        </linearGradient>
        <filter id="outerGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor={goldPrimary} floodOpacity="0.5" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="swordGlow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feFlood floodColor={goldLight} floodOpacity="0.6" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Shield body */}
      <path
        d="M50 8L80 22v26c0 20-12 35-30 40C32 83 20 68 20 48V22L50 8z"
        fill={shieldFill}
        stroke="url(#shieldBorder)"
        strokeWidth="4"
        strokeLinejoin="round"
        filter="url(#outerGlow)"
      />

      {/* Inner shield bevel line */}
      <path
        d="M50 16L72 27v21c0 16-9 28-22 32C39 76 30 64 30 48V27L50 16z"
        fill="none"
        stroke={goldDark}
        strokeWidth="1"
        strokeOpacity="0.4"
      />

      {/* Sword blade - wide and bold, clearly a sword */}
      <path
        d="M47 18L50 14L53 18V56L50 60L47 56V18Z"
        fill="url(#swordBlade)"
        filter="url(#swordGlow)"
      />

      {/* Blade center line (fuller) */}
      <line x1="50" y1="18" x2="50" y2="54" stroke={goldBright} strokeWidth="1" opacity="0.4" />

      {/* Crossguard - wide and curved */}
      <path
        d="M36 44C36 42 38 40 40 40H60C62 40 64 42 64 44C64 46 62 48 60 48H40C38 48 36 46 36 44Z"
        fill="url(#crossGuard)"
      />

      {/* Crossguard end caps */}
      <circle cx="36" cy="44" r="3" fill={goldPrimary} />
      <circle cx="64" cy="44" r="3" fill={goldPrimary} />

      {/* Handle (grip) */}
      <rect x="47" y="48" width="6" height="14" rx="2" fill="url(#handleGrad)" />

      {/* Handle wrap lines */}
      <line x1="47.5" y1="51" x2="52.5" y2="51" stroke={goldPrimary} strokeWidth="0.8" opacity="0.5" />
      <line x1="47.5" y1="54" x2="52.5" y2="54" stroke={goldPrimary} strokeWidth="0.8" opacity="0.5" />
      <line x1="47.5" y1="57" x2="52.5" y2="57" stroke={goldPrimary} strokeWidth="0.8" opacity="0.5" />

      {/* Pommel */}
      <ellipse cx="50" cy="64" rx="5" ry="4" fill={goldPrimary} />
      <ellipse cx="50" cy="63.5" rx="3" ry="2.5" fill={goldBright} opacity="0.4" />

      {/* Blade tip highlight */}
      <path d="M49 16L50 14L51 16" fill={goldBright} opacity="0.7" />

      {/* Shield corner rivets */}
      <circle cx="30" cy="30" r="1.5" fill={goldPrimary} opacity="0.6" />
      <circle cx="70" cy="30" r="1.5" fill={goldPrimary} opacity="0.6" />
      <circle cx="50" cy="75" r="1.5" fill={goldPrimary} opacity="0.4" />
    </svg>
  );
};
