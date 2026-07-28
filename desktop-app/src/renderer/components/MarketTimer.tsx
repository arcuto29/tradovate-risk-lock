import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

// CME Futures market hours (Eastern Time)
// Sunday 6:00 PM - Friday 5:00 PM (with daily break 5:00 PM - 6:00 PM ET)
// Regular trading: 9:30 AM - 4:00 PM ET
// Pre-market: 6:00 PM (prev day) - 9:30 AM
// After-hours: 4:00 PM - 5:00 PM

type Session = 'pre-market' | 'regular' | 'after-hours' | 'closed';

function getMarketSession(): { session: Session; label: string; nextEvent: string; timeLeft: number } {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay(); // 0=Sun, 6=Sat
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const totalMin = hours * 60 + minutes;

  // Saturday: closed all day
  if (day === 6) {
    return { session: 'closed', label: 'Closed', nextEvent: 'Opens Sun 6pm ET', timeLeft: 0 };
  }

  // Sunday before 6pm: closed
  if (day === 0 && totalMin < 18 * 60) {
    const minsUntilOpen = (18 * 60) - totalMin;
    return { session: 'closed', label: 'Closed', nextEvent: 'Opens 6:00 PM', timeLeft: minsUntilOpen * 60 };
  }

  // Friday after 5pm: closed
  if (day === 5 && totalMin >= 17 * 60) {
    return { session: 'closed', label: 'Closed', nextEvent: 'Opens Sun 6pm ET', timeLeft: 0 };
  }

  // Daily break: 5:00 PM - 6:00 PM (Mon-Thu)
  if (totalMin >= 17 * 60 && totalMin < 18 * 60 && day >= 1 && day <= 4) {
    const minsUntilOpen = (18 * 60) - totalMin;
    return { session: 'closed', label: 'Daily Break', nextEvent: 'Reopens 6:00 PM', timeLeft: minsUntilOpen * 60 };
  }

  // Regular hours: 9:30 AM - 4:00 PM
  if (totalMin >= 9 * 60 + 30 && totalMin < 16 * 60) {
    const minsUntilClose = (16 * 60) - totalMin;
    return { session: 'regular', label: 'Regular', nextEvent: 'Closes 4:00 PM', timeLeft: minsUntilClose * 60 };
  }

  // After-hours: 4:00 PM - 5:00 PM
  if (totalMin >= 16 * 60 && totalMin < 17 * 60) {
    const minsUntilClose = (17 * 60) - totalMin;
    return { session: 'after-hours', label: 'After Hours', nextEvent: 'Break 5:00 PM', timeLeft: minsUntilClose * 60 };
  }

  // Pre-market: 6:00 PM (prev day) - 9:30 AM
  if (totalMin >= 18 * 60 || totalMin < 9 * 60 + 30) {
    let minsUntilReg: number;
    if (totalMin >= 18 * 60) {
      minsUntilReg = (24 * 60 - totalMin) + (9 * 60 + 30);
    } else {
      minsUntilReg = (9 * 60 + 30) - totalMin;
    }
    return { session: 'pre-market', label: 'Pre-Market', nextEvent: 'Regular 9:30 AM', timeLeft: minsUntilReg * 60 };
  }

  return { session: 'closed', label: 'Closed', nextEvent: '', timeLeft: 0 };
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const MarketTimer: React.FC = () => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [market, setMarket] = useState(getMarketSession());

  useEffect(() => {
    const interval = setInterval(() => setMarket(getMarketSession()), 30000);
    return () => clearInterval(interval);
  }, []);

  const dotColor = market.session === 'regular' ? '#10b981'
    : market.session === 'pre-market' ? colors.primary
    : market.session === 'after-hours' ? '#f59e0b'
    : '#6b7280';

  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: dotColor, boxShadow: `0 0 4px ${dotColor}80` }} />
      <span className="text-[0.55rem] font-semibold tracking-[1px] uppercase" style={{ color: `${dotColor}cc` }}>
        {market.label}
      </span>
      {market.timeLeft > 0 && (
        <span className="text-[0.5rem] text-white/20 font-mono">
          {formatCountdown(market.timeLeft)}
        </span>
      )}
    </div>
  );
};
