import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

interface ActivePlan {
  maxContracts: number;
  dailyLoss: number;
  maxTrades: number;
  profitTarget: number;
  cooldownMinutes: number;
  lockDurationHours: number;
  lockMode: string;
  resetTime: string;
  resetTimezone: string;
}

interface Props {
  onLocked: () => void;
  limitsTightened: boolean;
}

/**
 * Home Dashboard (unlocked) — Shows Today's Active Plan + Lock Session
 * 
 * The trader should be able to lock within 3 seconds of seeing this screen.
 * No configuration needed daily — just confirm and lock.
 */
export const HomeDashboard: React.FC<Props> = ({ onLocked, limitsTightened }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [activePlan, setActivePlan] = useState<ActivePlan | null>(null);
  const [protectionLevel, setProtectionLevel] = useState<string | null>(null);
  const [readinessStatus, setReadinessStatus] = useState<string>('not_started');
  const [locking, setLocking] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadActivePlan(); }, []);

  const loadActivePlan = async () => {
    const today = new Date().toISOString().split('T')[0];

    // Try to load today's session plan first
    const session = await (window as any).electronAPI?.getDailySessionPlan?.(today);
    if (session && session.active_plan_snapshot) {
      const snap = typeof session.active_plan_snapshot === 'string'
        ? JSON.parse(session.active_plan_snapshot)
        : session.active_plan_snapshot;
      setActivePlan(snap);
      setProtectionLevel(session.protection_level);
      setReadinessStatus(session.readiness_status);
      return;
    }

    // Fallback to trading plan baseline
    const plan = await (window as any).electronAPI?.getTradingPlan?.();
    if (plan) {
      setActivePlan({
        maxContracts: plan.max_contracts,
        dailyLoss: plan.daily_loss,
        maxTrades: plan.max_trades,
        profitTarget: plan.profit_target,
        cooldownMinutes: 0,
        lockDurationHours: plan.lock_duration_hours,
        lockMode: plan.lock_mode,
        resetTime: plan.reset_time,
        resetTimezone: plan.reset_timezone,
      });
      setReadinessStatus('not_started');
    }
  };

  const handleLock = async () => {
    if (!activePlan) return;
    setLocking(true);
    setError('');

    try {
      // Build lock settings from active plan
      const lockExpiresAt = new Date(Date.now() + activePlan.lockDurationHours * 60 * 60 * 1000).toISOString();

      const lockSettings = {
        dailyLossLimit: activePlan.dailyLoss,
        dailyProfitTarget: activePlan.profitTarget,
        maxContracts: activePlan.maxContracts,
        resetTime: '',
        resetTimezone: activePlan.resetTimezone,
        lockExpiresAt,
        lockMode: 'duration',
        platform: 'web',
      };

      // Also update position limits for the extension
      await (window as any).electronAPI?.updatePositionLimits?.({
        lossLimitEnabled: true,
        lossLimitAmount: activePlan.dailyLoss,
        profitTargetEnabled: activePlan.profitTarget > 0,
        profitTargetAmount: activePlan.profitTarget,
        maxTradesEnabled: true,
        maxTradesPerDay: activePlan.maxTrades,
        maxContractsEnabled: true,
        defaultMax: activePlan.maxContracts,
        contractLimits: [],
        blockedSymbolsEnabled: false,
        blockedSymbols: [],
        pyramidingEnabled: false,
        pyramidMaxContracts: 0,
        pyramidMaxAddOns: 0,
        lockoutEnabled: false,
        resetTime: activePlan.resetTime,
        resetTimezone: activePlan.resetTimezone,
      });

      const result = await (window as any).electronAPI?.lockSettings?.(lockSettings);
      if (result?.success) {
        onLocked();
      } else {
        setError(result?.error || 'Failed to lock');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to lock');
    } finally {
      setLocking(false);
      setShowConfirm(false);
    }
  };

  const getLevelColor = (level: string | null) => {
    switch (level) {
      case 'ready': return colors.primary;
      case 'recommended': return '#fbbf24';
      case 'protected': return '#f97316';
      case 'maximum_protection': return '#ef4444';
      default: return colors.primary;
    }
  };

  const getLevelLabel = (level: string | null) => {
    switch (level) {
      case 'ready': return 'Ready';
      case 'recommended': return 'Recommended';
      case 'protected': return 'Protected';
      case 'maximum_protection': return 'Maximum Protection';
      case 'skipped': return 'Readiness not assessed';
      default: return '';
    }
  };

  if (!activePlan) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: `${colors.primary}30`, borderTopColor: colors.primary }} />
      </div>
    );
  }

  const levelColor = getLevelColor(protectionLevel);

  return (
    <div className="max-w-lg mx-auto animate-reveal">
      {/* Tightened banner */}
      {limitsTightened && (
        <div className="mb-5 px-5 py-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] text-amber-300/80 text-xs font-medium flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
          Limits tightened based on today's readiness.
        </div>
      )}

      {/* Protection Level badge */}
      {protectionLevel && protectionLevel !== 'skipped' && (
        <div className="flex items-center justify-center mb-5">
          <span className="px-3 py-1.5 rounded-full text-[0.55rem] font-bold uppercase tracking-[1.5px] border" style={{ background: `${levelColor}10`, borderColor: `${levelColor}25`, color: levelColor }}>
            {getLevelLabel(protectionLevel)}
          </span>
        </div>
      )}
      {readinessStatus === 'skipped' && (
        <div className="flex items-center justify-center mb-5">
          <span className="text-[0.55rem] text-white/20 italic">Readiness not assessed</span>
        </div>
      )}

      {/* Today's Active Plan */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-5">
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)` }} />
        <div className="relative z-10">
          <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-5" style={{ color: `${colors.primary}80` }}>Today's Active Plan</p>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-black font-mono" style={{ color: colors.primary }}>{activePlan.maxContracts}</p>
              <p className="text-[0.5rem] text-white/25 uppercase tracking-[1px] mt-1">Contracts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black font-mono" style={{ color: colors.primary }}>${activePlan.dailyLoss}</p>
              <p className="text-[0.5rem] text-white/25 uppercase tracking-[1px] mt-1">Max Loss</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black font-mono" style={{ color: colors.primary }}>{activePlan.maxTrades}</p>
              <p className="text-[0.5rem] text-white/25 uppercase tracking-[1px] mt-1">Trades</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-3 border-t border-white/[0.04]">
            <div className="text-center">
              <p className="text-sm font-bold font-mono text-white/40">${activePlan.profitTarget}</p>
              <p className="text-[0.45rem] text-white/15 uppercase tracking-[1px] mt-0.5">Target</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold font-mono text-white/40">{activePlan.lockDurationHours}h</p>
              <p className="text-[0.45rem] text-white/15 uppercase tracking-[1px] mt-0.5">Lock</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold font-mono text-white/40">{activePlan.cooldownMinutes > 0 ? `${activePlan.cooldownMinutes}m` : '—'}</p>
              <p className="text-[0.45rem] text-white/15 uppercase tracking-[1px] mt-0.5">Cooldown</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lock Session Button */}
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full py-4 btn-premium text-sm font-bold uppercase tracking-[3px] rounded-xl press-scale"
        >
          Lock Session
        </button>
      ) : (
        <div className="relative rounded-xl p-5 overflow-hidden card-premium">
          <div className="relative z-10">
            <p className="text-xs font-bold text-white/50 mb-3">Lock today's plan for {activePlan.lockDurationHours} hours?</p>
            <div className="flex items-center gap-2 mb-3 text-[0.6rem] text-white/30">
              <span>{activePlan.maxContracts} contracts</span>
              <span>•</span>
              <span>${activePlan.dailyLoss} loss</span>
              <span>•</span>
              <span>{activePlan.maxTrades} trades</span>
              {activePlan.cooldownMinutes > 0 && <><span>•</span><span>{activePlan.cooldownMinutes}m cooldown</span></>}
            </div>
            <p className="text-[0.5rem] text-white/15 mb-4">
              Unlocks at: {new Date(Date.now() + activePlan.lockDurationHours * 60 * 60 * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleLock}
                disabled={locking}
                className="flex-1 py-3 btn-premium text-xs font-bold uppercase tracking-[2px] rounded-xl press-scale disabled:opacity-50"
              >
                {locking ? 'Locking...' : 'Lock Session'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-3 text-xs text-white/30 hover:text-white/50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Trading Plan link */}
      <button
        onClick={() => {/* Will navigate to Protection page — handled by parent */}}
        className="w-full mt-4 py-2 text-[0.55rem] text-white/15 hover:text-white/30 transition-all"
      >
        Edit Trading Plan
      </button>
    </div>
  );
};
