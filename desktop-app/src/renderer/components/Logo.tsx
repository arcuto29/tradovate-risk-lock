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
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primary} />
          <stop offset="50%" stopColor={colors.secondary} />
          <stop offset="100%" stopColor={colors.primary} />
        </linearGradient>
        <linearGradient id="swordGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#b8860b" />
        </linearGradient>
        <linearGradient id="shieldFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primary} stopOpacity="0.15" />
          <stop offset="100%" stopColor={colors.secondary} stopOpacity="0.05" />
        </linearGradient>
        <filter id="logoGlow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Shield body fill */}
      <path
        d="M32 6L50 15v15c0 13-7.8 23-18 26C21.8 53 14 43 14 30V15L32 6z"
        fill="url(#shieldFill)"
      />

      {/* Shield outline - gradient */}
      <path
        d="M32 6L50 15v15c0 13-7.8 23-18 26C21.8 53 14 43 14 30V15L32 6z"
        stroke="url(#logoGrad)"
        strokeWidth="2"
        fill="none"
        filter="url(#logoGlow)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Inner shield detail */}
      <path
        d="M32 11L46 18v12c0 10-6 18-14 20C24 48 18 40 18 30V18L32 11z"
        stroke={colors.primary}
        strokeWidth="0.5"
        strokeOpacity="0.25"
        fill="none"
      />

      {/* Sword blade */}
      <path
        d="M32 8L32 42"
        stroke="url(#swordGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        filter="url(#logoGlow)"
      />

      {/* Sword crossguard */}
      <path
        d="M26 28L38 28"
        stroke="url(#swordGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Sword pommel (diamond) */}
      <path
        d="M32 5L34 8L32 11L30 8Z"
        fill="#ffd700"
        opacity="0.9"
      />

      {/* Sword tip */}
      <path
        d="M30.5 42L32 46L33.5 42"
        fill="url(#swordGrad)"
        opacity="0.8"
      />
    </svg>
  );
};
