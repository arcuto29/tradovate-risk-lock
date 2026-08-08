import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

/**
 * NFP Indicator — Subtle status card for Home dashboard
 * 
 * Shows only when relevant (NFP week or NFP day).
 * Does NOT interrupt traders. Passive information only.
 */
export const NfpIndicator: React.FC = () => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const s = await (window as any).electronAPI?.nfpGetStatus?.();
      setStatus(s);
    } catch {}
  };

  // Don't render if NFP is not relevant
  if (!status || (!status.isNfpWeek && !status.isNfpDay)) return null;

  const formatCountdown = (minutes: number | null): string => {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const formatTime = (iso: string | null): string => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    } catch { return ''; }
  };

  const formatDate = (iso: string | null): string => {
    if (!iso) return '';
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  // NFP Day — blocking active
  if (status.isNfpDay && status.isNfpBlocking) {
    return (
      <div className="relative rounded-xl p-4 overflow-hidden mb-4 border" style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" style={{ boxShadow: '0 0 8px rgba(239,68,68,0.6)' }} />
          <div className="flex-1">
            <p className="text-xs font-bold text-red-300/80">NFP — New entries blocked</p>
            <p className="text-[0.55rem] text-red-300/40 mt-0.5">
              Block window: {formatTime(status.blockWindowStart)} – {formatTime(status.blockWindowEnd)}
            </p>
          </div>
          <AlertTriangle size={14} className="text-red-400/60" />
        </div>
      </div>
    );
  }

  // NFP Day — countdown
  if (status.isNfpDay && status.minutesUntilNfp) {
    return (
      <div className="relative rounded-xl p-4 overflow-hidden mb-4 border" style={{ borderColor: 'rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.03)' }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-amber-400" style={{ boxShadow: '0 0 6px rgba(251,191,36,0.5)' }} />
          <div className="flex-1">
            <p className="text-xs font-bold text-amber-300/80">NFP in {formatCountdown(status.minutesUntilNfp)}</p>
            <p className="text-[0.55rem] text-amber-300/40 mt-0.5">
              New entries blocked {formatTime(status.blockWindowStart)} – {formatTime(status.blockWindowEnd)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // NFP Week — subtle caution
  if (status.isNfpWeek && !status.isNfpDay) {
    return (
      <div className="relative rounded-xl p-3.5 overflow-hidden mb-4 border" style={{ borderColor: `${colors.primary}12`, background: `${colors.primary}03` }}>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: colors.primary, opacity: 0.5 }} />
          <div className="flex-1">
            <p className="text-[0.65rem] font-semibold text-white/40">NFP Week</p>
            <p className="text-[0.55rem] text-white/20 mt-0.5">
              {formatDate(status.nextNfpDate)} · 8:30 AM ET
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
