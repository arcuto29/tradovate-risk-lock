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

  // Use gold/amber for the shield+sword like the actual icon
  const goldPrimary = '#ffd700';
  const goldDark = '#b8860b';
  const goldLight = '#ffed4a';
  const shieldFill = '#0a0a0f';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shield-icon ${animated ? 'animate-float' : ''}`}
      style={animated ? { animation: 'float 6s ease-in-out infinite' } : undefined}
    >
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={goldLight} />
          <stop offset="50%" stopColor={goldPrimary} />
          <stop offset="100%" stopColor={goldDark} />
        </linearGradient>
        <linearGradient id="swordBlade" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={goldLight} />
          <stop offset="40%" stopColor={goldPrimary} />
          <stop offset="100%" stopColor={goldDark} />
        </linearGradient>
        <filter id="goldGlow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="outerGlow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feFlood floodColor={goldPrimary} floodOpacity="0.4" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Shield body - dark fill with gold border */}
      <path
        d="M32 5L53 15v17c0 14-9 25-21 28C20 57 11 46 11 32V15L32 5z"
        fill={shieldFill}
        stroke="url(#goldGrad)"
        strokeWidth="3"
        strokeLinejoin="round"
        filter="url(#outerGlow)"
      />

      {/* Inner shield bevel */}
      <path
        d="M32 10L48 18v14c0 11-7 20-16 22C25 52 18 43 18 32V18L32 10z"
        fill="none"
        stroke={goldDark}
        strokeWidth="0.8"
        strokeOpacity="0.5"
      />

      {/* Sword blade - thick and bold */}
      <rect x="30.5" y="12" width="3" height="32" rx="1.5" fill="url(#swordBlade)" filter="url(#goldGlow)" />

      {/* Sword crossguard */}
      <rect x="24" y="29" width="16" height="3" rx="1.5" fill="url(#goldGrad)" />

      {/* Sword pommel diamond */}
      <path d="M32 8L34.5 11.5L32 15L29.5 11.5Z" fill={goldPrimary} filter="url(#goldGlow)" />

      {/* Sword tip point */}
      <path d="M30.5 44L32 48L33.5 44Z" fill={goldPrimary} />

      {/* Highlight slash on blade */}
      <rect x="31.5" y="14" width="1" height="28" rx="0.5" fill="white" opacity="0.25" />
    </svg>
  );
};
