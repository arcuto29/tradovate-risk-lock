import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

// Major trading sessions (all times in ET)
// Asian/Tokyo: 7:00 PM - 4:00 AM ET
// London: 3:00 AM - 12:00 PM ET
// New York: 9:30 AM - 4:00 PM ET
// Overlap (London+NY): 9:30 AM - 12:00 PM ET

interface SessionInfo {
  active: string[];      // currently active sessions
  label: string;         // primary display label
  nextSession: string;   // what's coming next
  timeLeft: number;      // seconds until next change
  color: string;         // dot color
}

function getSessionInfo(): SessionInfo {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const totalMin = hours * 60 + minutes;

  // Weekend check
  if (day === 6 || (day === 0 && totalMin < 17 * 60) || (day === 5 && totalMin >= 17 * 60)) {
    return { active: [], label: 'Markets Closed', nextSession: 'Sun 6pm ET', timeLeft: 0, color: '#6b7280' };
  }

  // Daily maintenance break: 5:00 PM - 6:00 PM ET
  if (totalMin >= 17 * 60 && totalMin < 18 * 60) {
    const left = (18 * 60 - totalMin) * 60;
    return { active: [], label: 'Daily Break', nextSession: 'Asian Open', timeLeft: left, color: '#6b7280' };
  }

  const active: string[] = [];

  // Asian: 7:00 PM - 4:00 AM ET (evening + overnight)
  const isAsian = totalMin >= 19 * 60 || totalMin < 4 * 60;
  if (isAsian) active.push('Asian');

  // London: 3:00 AM - 12:00 PM ET
  const isLondon = totalMin >= 3 * 60 && totalMin < 12 * 60;
  if (isLondon) active.push('London');

  // New York: 9:30 AM - 4:00 PM ET
  const isNY = totalMin >= 9 * 60 + 30 && totalMin < 16 * 60;
  if (isNY) active.push('New York');

  // Determine primary label and next event
  let label = '';
  let nextSession = '';
  let timeLeft = 0;

  if (isNY && isLondon) {
    label = 'NY + London';
    const londonClose = 12 * 60;
    timeLeft = (londonClose - totalMin) * 60;
    nextSession = 'London Close';
  } else if (isNY) {
    label = 'New York';
    const nyClose = 16 * 60;
    timeLeft = (nyClose - totalMin) * 60;
    nextSession = 'NY Close';
  } else if (isLondon && isAsian) {
    label = 'London + Asian';
    const asianClose = 4 * 60;
    if (totalMin < asianClose) {
      timeLeft = (asianClose - totalMin) * 60;
      nextSession = 'Asian Close';
    } else {
      timeLeft = (12 * 60 - totalMin) * 60;
      nextSession = 'London Close';
    }
  } else if (isLondon) {
    label = 'London';
    if (totalMin < 9 * 60 + 30) {
      timeLeft = (9 * 60 + 30 - totalMin) * 60;
      nextSession = 'NY Open';
    } else {
      timeLeft = (12 * 60 - totalMin) * 60;
      nextSession = 'London Close';
    }
  } else if (isAsian) {
    label = 'Asian';
    if (totalMin >= 19 * 60) {
      // Evening - next is London open at 3am
      timeLeft = ((24 * 60 - totalMin) + 3 * 60) * 60;
      nextSession = 'London Open';
    } else {
      // Early morning - Asian closes at 4am
      timeLeft = (4 * 60 - totalMin) * 60;
      nextSession = 'Asian Close';
    }
  } else if (totalMin >= 16 * 60 && totalMin < 17 * 60) {
    // After NY close, before daily break
    label = 'After Hours';
    timeLeft = (17 * 60 - totalMin) * 60;
    nextSession = 'Daily Break';
  } else if (totalMin >= 18 * 60 && totalMin < 19 * 60) {
    // After break, before Asian
    label = 'Pre-Asian';
    timeLeft = (19 * 60 - totalMin) * 60;
    nextSession = 'Asian Open';
  } else if (totalMin >= 4 * 60 && totalMin < 3 * 60) {
    // Gap between Asian close and London
    label = 'Quiet';
    timeLeft = (3 * 60 - totalMin) * 60;
    nextSession = 'London Open';
  } else {
    label = 'Open';
    nextSession = '';
    timeLeft = 0;
  }

  // Color based on primary session
  let color = '#6b7280';
  if (isNY) color = '#10b981';       // green for NY
  else if (isLondon) color = '#3b82f6'; // blue for London
  else if (isAsian) color = '#f59e0b';  // amber for Asian

  return { active, label, nextSession, timeLeft, color };
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const MarketTimer: React.FC = () => {
  const [session, setSession] = useState(getSessionInfo());

  useEffect(() => {
    const interval = setInterval(() => setSession(getSessionInfo()), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full" style={{
        background: session.color,
        boxShadow: session.active.length > 0 ? `0 0 4px ${session.color}80` : 'none',
        animation: session.active.length > 0 ? 'pulseGlow 2s ease-in-out infinite' : 'none',
      }} />
      <span className="text-[0.55rem] font-bold tracking-[1px] uppercase" style={{ color: `${session.color}dd` }}>
        {session.label}
      </span>
      {session.timeLeft > 0 && (
        <>
          <span className="text-[0.45rem] text-white/15">|</span>
          <span className="text-[0.5rem] text-white/25 font-medium">
            {session.nextSession}
          </span>
          <span className="text-[0.5rem] font-mono text-white/30">
            {formatCountdown(session.timeLeft)}
          </span>
        </>
      )}
    </div>
  );
};
