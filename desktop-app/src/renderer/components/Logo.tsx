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
      className={animated ? 'animate-float' : ''}
      style={animated ? { animation: 'float 6s ease-in-out infinite' } : undefined}
    >
      {/* Outer glow */}
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primary} />
          <stop offset="50%" stopColor={colors.secondary} />
          <stop offset="100%" stopColor={colors.primary} />
        </linearGradient>
        <linearGradient id="logoGradLight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primary} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colors.secondary} stopOpacity="0.1" />
        </linearGradient>
        <filter id="logoGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background shield shape - subtle fill */}
      <path
        d="M32 4L52 14v16c0 14-8.5 25-20 28C20.5 55 12 44 12 30V14L32 4z"
        fill="url(#logoGradLight)"
      />

      {/* Shield outline */}
      <path
        d="M32 6L50 15v15c0 13-7.8 23-18 26C21.8 53 14 43 14 30V15L32 6z"
        stroke="url(#logoGrad)"
        strokeWidth="2.5"
        fill="none"
        filter="url(#logoGlow)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Inner shield detail line */}
      <path
        d="M32 12L46 19v11c0 10-6 18-14 20.5C24 48 18 40 18 30V19L32 12z"
        stroke={colors.primary}
        strokeWidth="0.5"
        strokeOpacity="0.3"
        fill="none"
      />

      {/* Lock body */}
      <rect
        x="26" y="30" width="12" height="10" rx="2"
        fill="url(#logoGrad)"
        opacity="0.9"
      />

      {/* Lock shackle (arc) */}
      <path
        d="M28 30V26a4 4 0 0 1 8 0v4"
        stroke="url(#logoGrad)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Keyhole */}
      <circle cx="32" cy="34" r="1.5" fill="white" opacity="0.9" />
      <rect x="31.25" y="35" width="1.5" height="3" rx="0.75" fill="white" opacity="0.9" />
    </svg>
  );
};
