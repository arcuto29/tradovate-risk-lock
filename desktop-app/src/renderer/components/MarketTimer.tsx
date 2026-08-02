import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

interface SessionInfo {
  active: string[];
  label: string;
  nextSession: string;
  timeLeft: number;
  color: string;
}

function getSessionInfo(): SessionInfo {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const seconds = et.getSeconds();
  const totalMin = hours * 60 + minutes;
  const totalSec = totalMin * 60 + seconds;

  if (day === 6 || (day === 0 && totalMin < 17 * 60) || (day === 5 && totalMin >= 17 * 60)) {
    return { active: [], label: 'Markets Closed', nextSession: 'Sun 6pm ET', timeLeft: 0, color: '#6b7280' };
  }

  if (totalMin >= 17 * 60 && totalMin < 18 * 60) {
    const left = (18 * 60 * 60) - totalSec;
    return { active: [], label: 'Daily Break', nextSession: 'Asian Open', timeLeft: Math.max(0, left), color: '#6b7280' };
  }

  const active: string[] = [];
  const isAsian = totalMin >= 19 * 60 || totalMin < 4 * 60;
  const isLondon = totalMin >= 3 * 60 && totalMin < 12 * 60;
  const isNY = totalMin >= 9 * 60 + 30 && totalMin < 16 * 60;

  if (isAsian) active.push('Asian');
  if (isLondon) active.push('London');
  if (isNY) active.push('New York');

  let label = '';
  let nextSession = '';
  let timeLeft = 0;

  if (isNY && isLondon) {
    label = 'NY + London';
    timeLeft = (12 * 60 * 60) - totalSec;
    nextSession = 'London Close';
  } else if (isNY) {
    label = 'New York';
    timeLeft = (16 * 60 * 60) - totalSec;
    nextSession = 'NY Close';
  } else if (isLondon && isAsian) {
    label = 'London + Asian';
    timeLeft = (4 * 60 * 60) - totalSec;
    nextSession = 'Asian Close';
  } else if (isLondon) {
    if (totalMin < 9 * 60 + 30) {
      label = 'London';
      timeLeft = ((9 * 60 + 30) * 60) - totalSec;
      nextSession = 'NY Open';
    } else {
      label = 'London';
      timeLeft = (12 * 60 * 60) - totalSec;
      nextSession = 'London Close';
    }
  } else if (isAsian) {
    label = 'Asian';
    if (totalMin >= 19 * 60) {
      timeLeft = ((24 * 60 + 3 * 60) * 60) - totalSec;
      nextSession = 'London Open';
    } else {
      timeLeft = (4 * 60 * 60) - totalSec;
      nextSession = 'Asian Close';
    }
  } else if (totalMin >= 16 * 60 && totalMin < 17 * 60) {
    label = 'After Hours';
    timeLeft = (17 * 60 * 60) - totalSec;
    nextSession = 'Daily Break';
  } else if (totalMin >= 18 * 60 && totalMin < 19 * 60) {
    label = 'Pre-Asian';
    timeLeft = (19 * 60 * 60) - totalSec;
    nextSession = 'Asian Open';
  } else {
    label = 'Open';
    nextSession = '';
    timeLeft = 0;
  }

  let color = '#6b7280';
  if (isNY) color = '#10b981';
  else if (isLondon) color = '#3b82f6';
  else if (isAsian) color = '#f59e0b';

  return { active, label, nextSession, timeLeft: Math.max(0, timeLeft), color };
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const MarketTimer: React.FC = () => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [session, setSession] = useState(getSessionInfo());

  useEffect(() => {
    const interval = setInterval(() => setSession(getSessionInfo()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isActive = session.active.length > 0;

  // Use theme colors for display
  let displayColor = session.color;
  const isDarkTheme = ['midnight', 'void', 'hologram', 'gold', 'nebula', 'aurora'].includes(theme);
  if (isDarkTheme) {
    if (session.color === '#10b981') displayColor = '#4ade80';
    else if (session.color === '#3b82f6') displayColor = '#60a5fa';
    else if (session.color === '#f59e0b') displayColor = '#fbbf24';
    else if (session.color === '#6b7280') displayColor = '#9ca3af';
  }

  return (
    <div className="flex items-center gap-3">
      {/* Session dot + label */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{
        background: `${displayColor}10`,
        border: `1px solid ${displayColor}20`,
      }}>
        <span className="w-2 h-2 rounded-full" style={{
          background: displayColor,
          boxShadow: isActive ? `0 0 6px ${displayColor}90, 0 0 12px ${displayColor}40` : 'none',
          animation: isActive ? 'pulseGlow 2s ease-in-out infinite' : 'none',
        }} />
        <span className="text-[0.55rem] font-bold tracking-[1.5px] uppercase" style={{ color: displayColor }}>
          {session.label}
        </span>
      </div>

      {/* Countdown with seconds */}
      {session.timeLeft > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[0.5rem] font-medium" style={{color: `${displayColor}80`}}>
            {session.nextSession}
          </span>
          <span className="text-[0.55rem] font-mono font-bold" style={{color: displayColor, opacity: 0.8}}>
            {formatCountdown(session.timeLeft)}
          </span>
        </div>
      )}
    </div>
  );
};
