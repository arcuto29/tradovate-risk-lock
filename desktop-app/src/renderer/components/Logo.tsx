import React from 'react';

interface LogoProps {
  size?: number;
  animated?: boolean;
}

/**
 * Sentinel Logo — Shield + Sword
 * 
 * Design priorities (in order):
 * 1. Instantly recognizable at 24px (tray) through 128px (onboarding)
 * 2. Strong defensive silhouette (shield dominant, sword complementing)
 * 3. Clean, minimal, professional
 * 4. Premium feel without being decorative
 * 
 * Sword: long slim blade pointing UP, wide crossguard, thin grip, minimal pommel.
 * Shield: bold outline, simple pointed shape, dark fill.
 */
export const Logo: React.FC<LogoProps> = ({ size = 48, animated = false }) => {
  const gold = '#ffd700';
  const goldDark = '#b8860b';
  const goldLight = '#ffe566';

  // Use unique IDs per instance to avoid SVG gradient conflicts
  const uid = `s${size}`;

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
        <linearGradient id={`sb-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={goldLight} />
          <stop offset="50%" stopColor={gold} />
          <stop offset="100%" stopColor={goldDark} />
        </linearGradient>
        <linearGradient id={`bl-${uid}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="25%" stopColor={goldLight} />
          <stop offset="70%" stopColor={gold} />
          <stop offset="100%" stopColor={goldDark} />
        </linearGradient>
        <filter id={`gl-${uid}`}>
          <feGaussianBlur stdDeviation="2" result="b" />
          <feFlood floodColor={gold} floodOpacity="0.35" result="c" />
          <feComposite in="c" in2="b" operator="in" result="g" />
          <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Shield */}
      <path
        d="M50 7L81 21v27c0 20-12 35-31 40C31 83 19 68 19 48V21L50 7z"
        fill="#080810"
        stroke={`url(#sb-${uid})`}
        strokeWidth="3.5"
        strokeLinejoin="round"
        filter={`url(#gl-${uid})`}
      />

      {/* Blade — long, slim, sharp tip at top */}
      <path
        d="M50 13L47.8 53H52.2L50 13Z"
        fill={`url(#bl-${uid})`}
      />

      {/* Blade center line */}
      <line x1="50" y1="15" x2="50" y2="52" stroke="#fff" strokeWidth="0.5" opacity="0.25" />

      {/* Crossguard — wide, clean */}
      <rect x="35" y="53" width="30" height="3.5" rx="1.75" fill={gold} />

      {/* Grip — narrow */}
      <rect x="48.5" y="57" width="3" height="11" rx="1.5" fill={goldDark} />

      {/* Pommel — minimal */}
      <circle cx="50" cy="70" r="2.5" fill={gold} />
    </svg>
  );
};
