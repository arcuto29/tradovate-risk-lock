import React from 'react';

interface LogoProps {
  size?: number;
  animated?: boolean;
}

/**
 * Sentinel Logo — Shield + Sword
 * 
 * Sword orientation: blade points UP, tip near top of shield.
 * Crossguard sits below the blade, grip and pommel at bottom.
 * Optimized for readability at all sizes (16px tray → 128px onboarding).
 * Minimal decorative details. Bold, clean shapes.
 * Communicates: protection, discipline, security.
 */
export const Logo: React.FC<LogoProps> = ({ size = 48, animated = false }) => {
  const goldPrimary = '#ffd700';
  const goldDark = '#b8860b';
  const goldLight = '#ffe566';
  const shieldFill = '#0a0a12';

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
        <linearGradient id={`shieldBorder-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={goldLight} />
          <stop offset="50%" stopColor={goldPrimary} />
          <stop offset="100%" stopColor={goldDark} />
        </linearGradient>
        <linearGradient id={`blade-${size}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="20%" stopColor={goldLight} />
          <stop offset="60%" stopColor={goldPrimary} />
          <stop offset="100%" stopColor={goldDark} />
        </linearGradient>
        <linearGradient id={`guard-${size}`} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor={goldDark} />
          <stop offset="50%" stopColor={goldPrimary} />
          <stop offset="100%" stopColor={goldDark} />
        </linearGradient>
        <linearGradient id={`grip-${size}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={goldDark} />
          <stop offset="100%" stopColor="#8b6508" />
        </linearGradient>
        <filter id={`glow-${size}`}>
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feFlood floodColor={goldPrimary} floodOpacity="0.4" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Shield — bold, simple shape */}
      <path
        d="M50 6L82 21v28c0 21-13 36-32 41C31 85 18 70 18 49V21L50 6z"
        fill={shieldFill}
        stroke={`url(#shieldBorder-${size})`}
        strokeWidth="3.5"
        strokeLinejoin="round"
        filter={`url(#glow-${size})`}
      />

      {/* Blade — slim, tapers to sharp tip at TOP */}
      {/* Wide base (5px) near crossguard, narrows to sharp point at top */}
      <path
        d="M50 14 L47.5 55 L50 56.5 L52.5 55 Z"
        fill={`url(#blade-${size})`}
      />

      {/* Blade center highlight */}
      <line x1="50" y1="16" x2="50" y2="54" stroke="white" strokeWidth="0.7" opacity="0.3" />

      {/* Blade edge highlights */}
      <line x1="48.8" y1="52" x2="50" y2="15" stroke="white" strokeWidth="0.3" opacity="0.15" />
      <line x1="51.2" y1="52" x2="50" y2="15" stroke="white" strokeWidth="0.3" opacity="0.15" />

      {/* Crossguard — wide, clearly below blade */}
      <rect x="36" y="56" width="28" height="4.5" rx="2.25" fill={`url(#guard-${size})`} />

      {/* Crossguard end details */}
      <circle cx="36.5" cy="58.25" r="1.5" fill={goldPrimary} opacity="0.6" />
      <circle cx="63.5" cy="58.25" r="1.5" fill={goldPrimary} opacity="0.6" />

      {/* Grip — narrow, below crossguard */}
      <rect x="48" y="61" width="4" height="13" rx="1.5" fill={`url(#grip-${size})`} />

      {/* Grip wrap texture */}
      <line x1="48.3" y1="64" x2="51.7" y2="63" stroke={goldPrimary} strokeWidth="0.4" opacity="0.25" />
      <line x1="48.3" y1="67" x2="51.7" y2="66" stroke={goldPrimary} strokeWidth="0.4" opacity="0.25" />
      <line x1="48.3" y1="70" x2="51.7" y2="69" stroke={goldPrimary} strokeWidth="0.4" opacity="0.25" />

      {/* Pommel — small circle at bottom */}
      <circle cx="50" cy="76" r="3" fill={goldPrimary} />
      <circle cx="50" cy="76" r="1.5" fill={goldLight} opacity="0.5" />
    </svg>
  );
};
