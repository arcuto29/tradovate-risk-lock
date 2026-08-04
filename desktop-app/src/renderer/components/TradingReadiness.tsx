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
  onComplete: (result: {
    passed: boolean;
    tightened: boolean;
    protectionLevel: string;
    activePlan: ActivePlan;
    readinessScore: number;
    readinessStatus: 'completed' | 'skipped';
  }) => void;
}

type RestLevel = 'good' | 'ok' | 'low' | 'poor' | null;
type GoalLevel = 'plan' | 'discipline' | 'recover' | null;
type FocusLevel = 'sharp' | 'normal' | 'distracted' | null;

interface TradingPlan {
  max_contracts: number;
  daily_loss: number;
  max_trades: number;
  profit_target: number;
  lock_duration_hours: number;
  lock_mode: string;
  reset_time: string;
  reset_timezone: string;
}

/**
 * Trading Readiness — Professional pre-session ritual
 * 
 * Flow:
 * 1. Checklist (Rest/Goal/Focus) → ~15 seconds
 * 2. Recommendation Card (Your Plan → Today's Recommendation) → Apply or Keep
 * 3. Returns to Home with active plan set
 * 
 * Never punishes honesty. Never auto-blocks on answers alone.
 */
export const TradingReadiness: React.FC<Props> = ({ onComplete }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const [rest, setRest] = useState<RestLevel>(null);
  const [goal, setGoal] = useState<GoalLevel>(null);
  const [focus, setFocus] = useState<FocusLevel>(null);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [showAnalyzing, setShowAnalyzing] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState('');
  const [plan, setPlan] = useState<TradingPlan | null>(null);
  const [recommended, setRecommended] = useState<ActivePlan | null>(null);
  const [loading, setLoading] = useState(true);

  // Load trading plan on mount
  useEffect(() => {
    (async () => {
      try {
        const p = await (window as any).electronAPI?.getTradingPlan?.();
        if (p) setPlan(p);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const allAnswered = rest !== null && goal !== null && focus !== null;

  const handleConfirm = () => {
    if (!plan) return;

    // Show analyzing state briefly
    setShowAnalyzing(true);

    setTimeout(() => {
      // Calculate readiness score (0-100)
      let s = 0;
      if (rest === 'good') s += 35;
      else if (rest === 'ok') s += 25;
      else if (rest === 'low') s += 12;
      else if (rest === 'poor') s += 0;

      if (goal === 'plan') s += 35;
      else if (goal === 'discipline') s += 25;
      else if (goal === 'recover') s += 5;

      if (focus === 'sharp') s += 30;
      else if (focus === 'normal') s += 20;
      else if (focus === 'distracted') s += 5;

      setScore(s);

      // Determine protection level + calculate active plan
      const activePlan = calculateActivePlan(s, plan);
      setLevel(activePlan.protectionLevel);
      setRecommended(activePlan.plan);
      setShowAnalyzing(false);
      setShowRecommendation(true);
    }, 700);
  };

  const handleApply = () => {
    if (!recommended || !plan) return;
    const today = new Date().toISOString().split('T')[0];

    // Save daily session plan
    (window as any).electronAPI?.saveDailySessionPlan?.({
      tradingDate: today,
      readinessStatus: 'completed',
      readinessScore: score,
      protectionLevel: level,
      baselinePlanSnapshot: plan,
      activePlanSnapshot: recommended,
      recommendationApplied: true,
      readinessCompletedAt: new Date().toISOString(),
    });

    onComplete({
      passed: true,
      tightened: level !== 'ready',
      protectionLevel: level,
      activePlan: recommended,
      readinessScore: score,
      readinessStatus: 'completed',
    });
  };

  const handleKeepPlan = () => {
    if (!plan) return;
    const today = new Date().toISOString().split('T')[0];
    const baseline = buildBaselineActivePlan(plan);

    (window as any).electronAPI?.saveDailySessionPlan?.({
      tradingDate: today,
      readinessStatus: 'completed',
      readinessScore: score,
      protectionLevel: level,
      baselinePlanSnapshot: plan,
      activePlanSnapshot: baseline,
      recommendationApplied: false,
      readinessCompletedAt: new Date().toISOString(),
    });

    onComplete({
      passed: true,
      tightened: false,
      protectionLevel: level,
      activePlan: baseline,
      readinessScore: score,
      readinessStatus: 'completed',
    });
  };

  const handleSkip = () => {
    if (!plan) {
      onComplete({ passed: true, tightened: false, protectionLevel: 'skipped', activePlan: { maxContracts: 2, dailyLoss: 400, maxTrades: 3, profitTarget: 600, cooldownMinutes: 0, lockDurationHours: 4, lockMode: 'duration', resetTime: '17:00', resetTimezone: 'America/New_York' }, readinessScore: 0, readinessStatus: 'skipped' });
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const baseline = buildBaselineActivePlan(plan);

    (window as any).electronAPI?.saveDailySessionPlan?.({
      tradingDate: today,
      readinessStatus: 'skipped',
      readinessScore: null,
      protectionLevel: null,
      baselinePlanSnapshot: plan,
      activePlanSnapshot: baseline,
      recommendationApplied: false,
    });

    onComplete({
      passed: true,
      tightened: false,
      protectionLevel: 'skipped',
      activePlan: baseline,
      readinessScore: 0,
      readinessStatus: 'skipped',
    });
  };

  const getLevelConfig = (l: string) => {
    switch (l) {
      case 'ready': return { label: 'Ready', color: colors.primary, description: 'You\'re prepared. Full trading plan active.' };
      case 'recommended': return { label: 'Recommended', color: '#fbbf24', description: 'Slightly tighter limits to match today\'s readiness.' };
      case 'protected': return { label: 'Protected', color: '#f97316', description: 'Reduced exposure to protect your account today.' };
      case 'maximum_protection': return { label: 'Maximum Protection', color: '#ef4444', description: 'Minimum settings to limit risk during elevated conditions.' };
      default: return { label: '', color: '', description: '' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: `${colors.primary}30`, borderTopColor: colors.primary }} />
      </div>
    );
  }

  // ─── RECOMMENDATION SCREEN ─────────────────────────────────────────────
  if (showRecommendation && recommended && plan) {
    const cfg = getLevelConfig(level);
    const baseline = buildBaselineActivePlan(plan);
    const hasChanges = level !== 'ready';

    return (
      <div className="max-w-md mx-auto py-6 animate-reveal">
        {/* Score + Level */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}25` }}>
            <span className="text-2xl font-black font-mono" style={{ color: cfg.color }}>{score}</span>
          </div>
          <h2 className="text-xl font-black tracking-tight mb-1" style={{ color: cfg.color }}>{cfg.label}</h2>
          <p className="text-[0.6rem] text-white/30">{cfg.description}</p>
        </div>

        {/* Recommendation Card */}
        {hasChanges ? (
          <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5">
            <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}30, transparent)` }} />
            <div className="relative z-10">
              <p className="text-[0.6rem] font-bold tracking-[2px] uppercase mb-4" style={{ color: `${cfg.color}80` }}>Recommended Changes</p>

              {/* Comparison rows */}
              <div className="space-y-3">
                <ComparisonRow label="Contracts" before={baseline.maxContracts} after={recommended.maxContracts} unit="" colors={colors} changed={baseline.maxContracts !== recommended.maxContracts} />
                <ComparisonRow label="Daily Loss" before={baseline.dailyLoss} after={recommended.dailyLoss} unit="$" colors={colors} changed={baseline.dailyLoss !== recommended.dailyLoss} />
                <ComparisonRow label="Max Trades" before={baseline.maxTrades} after={recommended.maxTrades} unit="" colors={colors} changed={baseline.maxTrades !== recommended.maxTrades} />
                <ComparisonRow label="Cooldown" before={baseline.cooldownMinutes} after={recommended.cooldownMinutes} unit=" min" colors={colors} changed={baseline.cooldownMinutes !== recommended.cooldownMinutes} />
              </div>

              {/* Profit target note */}
              <div className="mt-4 pt-3 border-t border-white/[0.04]">
                <div className="flex items-center justify-between">
                  <span className="text-[0.6rem] text-white/25">Profit Target</span>
                  <span className="text-[0.6rem] text-white/40 font-mono">${plan.profit_target} (unchanged)</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5">
            <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}30, transparent)` }} />
            <div className="relative z-10">
              <p className="text-[0.6rem] font-bold tracking-[2px] uppercase mb-4" style={{ color: `${cfg.color}80` }}>Today's Plan</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[0.6rem] text-white/30">Contracts</span>
                  <span className="text-[0.6rem] font-mono font-bold" style={{ color: colors.primary }}>{recommended.maxContracts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[0.6rem] text-white/30">Daily Loss</span>
                  <span className="text-[0.6rem] font-mono font-bold" style={{ color: colors.primary }}>${recommended.dailyLoss}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[0.6rem] text-white/30">Max Trades</span>
                  <span className="text-[0.6rem] font-mono font-bold" style={{ color: colors.primary }}>{recommended.maxTrades}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[0.6rem] text-white/30">Profit Target</span>
                  <span className="text-[0.6rem] font-mono font-bold" style={{ color: colors.primary }}>${plan.profit_target}</span>
                </div>
              </div>
              <p className="text-[0.5rem] text-white/15 mt-4 text-center italic">No changes — your full Trading Plan is active today.</p>
            </div>
          </div>
        )}

        {/* Maximum Protection message */}
        {level === 'maximum_protection' && (
          <div className="px-4 py-3 rounded-xl border border-red-400/15 bg-red-400/[0.03] mb-5">
            <p className="text-[0.6rem] text-red-300/60 leading-relaxed">
              Today's readiness signals suggest elevated decision risk. Consider taking the session off if you do not feel prepared to follow this plan.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {hasChanges && (
            <button
              onClick={handleApply}
              className="w-full py-3.5 btn-premium text-xs font-bold uppercase tracking-[2.5px] rounded-xl press-scale"
            >
              Apply Recommendation
            </button>
          )}
          <button
            onClick={hasChanges ? handleKeepPlan : handleApply}
            className={`w-full py-3.5 text-xs font-bold uppercase tracking-[2px] rounded-xl transition-all press-scale ${hasChanges ? 'text-white/30 border border-white/[0.06] hover:text-white/50 hover:border-white/[0.1]' : 'btn-premium'}`}
          >
            {hasChanges ? 'Keep My Plan' : 'Continue'}
          </button>
          {level === 'maximum_protection' && (
            <button
              onClick={() => {
                (window as any).electronAPI?.fullDayBlock?.();
                const today = new Date().toISOString().split('T')[0];
                (window as any).electronAPI?.saveDailySessionPlan?.({
                  tradingDate: today, readinessStatus: 'completed', readinessScore: score,
                  protectionLevel: 'maximum_protection', baselinePlanSnapshot: plan,
                  activePlanSnapshot: null, recommendationApplied: false,
                  readinessCompletedAt: new Date().toISOString(),
                });
                onComplete({ passed: false, tightened: true, protectionLevel: 'maximum_protection', activePlan: recommended, readinessScore: score, readinessStatus: 'completed' });
              }}
              className="w-full py-3 text-[0.6rem] text-red-400/50 hover:text-red-400/70 transition-all"
            >
              Take Today Off
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── ANALYZING STATE ────────────────────────────────────────────────────
  if (showAnalyzing) {
    return (
      <div className="max-w-md mx-auto py-20 text-center animate-reveal">
        <div className="w-10 h-10 rounded-full border-2 animate-spin mx-auto mb-5" style={{ borderColor: `${colors.primary}20`, borderTopColor: colors.primary }} />
        <p className="text-sm font-medium text-white/40 tracking-wide">Analyzing today's readiness...</p>
      </div>
    );
  }

  // ─── CHECKLIST SCREEN ──────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto py-6">
      {/* Header */}
      <div className="text-center mb-8 animate-reveal">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`, border: `1px solid ${colors.primary}20` }}>
          <span className="text-lg" style={{ filter: `drop-shadow(0 0 4px ${colors.primary}50)` }}>✓</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight text-gradient mb-1">Trading Readiness</h2>
        <p className="text-[0.65rem] text-white/20 mt-2 max-w-xs mx-auto leading-relaxed">Complete your pre-session check before locking today's trading plan.</p>
      </div>

      {/* Checklist */}
      <div className="space-y-5 animate-reveal">
        {/* REST */}
        <div className="relative rounded-xl p-5 overflow-hidden card-premium">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.5rem] font-bold transition-all duration-200 ${rest ? 'bg-emerald-400/20 text-emerald-400' : 'bg-white/5 text-white/20'}`}>
                {rest ? '✓' : '1'}
              </span>
              <span className="text-xs font-bold text-white/60 uppercase tracking-[1.5px]">Rest</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {([['good', '8+ hrs'], ['ok', '6-8 hrs'], ['low', '5-6 hrs'], ['poor', '<5 hrs']] as const).map(([value, label]) => (
                <button key={value} onClick={() => setRest(value)} className="py-3 rounded-lg text-[0.6rem] font-bold transition-all duration-200 press-scale" style={{ background: rest === value ? `${colors.primary}20` : 'rgba(255,255,255,0.02)', border: `${rest === value ? '2px' : '1px'} solid ${rest === value ? colors.primary + '40' : 'rgba(255,255,255,0.06)'}`, color: rest === value ? colors.primary : 'rgba(255,255,255,0.4)', transform: rest === value ? 'scale(1.02)' : 'scale(1)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* GOAL */}
        <div className="relative rounded-xl p-5 overflow-hidden card-premium">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.5rem] font-bold transition-all duration-200 ${goal ? 'bg-emerald-400/20 text-emerald-400' : 'bg-white/5 text-white/20'}`}>
                {goal ? '✓' : '2'}
              </span>
              <span className="text-xs font-bold text-white/60 uppercase tracking-[1.5px]">Today's Goal</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([['plan', 'Follow plan'], ['discipline', 'Stay disciplined'], ['recover', 'Recover losses']] as const).map(([value, label]) => (
                <button key={value} onClick={() => setGoal(value)} className="py-3 rounded-lg text-[0.6rem] font-bold transition-all duration-200 press-scale" style={{ background: goal === value ? (value === 'recover' ? 'rgba(239,68,68,0.1)' : `${colors.primary}20`) : 'rgba(255,255,255,0.02)', border: `${goal === value ? '2px' : '1px'} solid ${goal === value ? (value === 'recover' ? 'rgba(239,68,68,0.3)' : colors.primary + '40') : 'rgba(255,255,255,0.06)'}`, color: goal === value ? (value === 'recover' ? '#ef4444' : colors.primary) : 'rgba(255,255,255,0.4)', transform: goal === value ? 'scale(1.02)' : 'scale(1)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* FOCUS */}
        <div className="relative rounded-xl p-5 overflow-hidden card-premium">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.5rem] font-bold transition-all duration-200 ${focus ? 'bg-emerald-400/20 text-emerald-400' : 'bg-white/5 text-white/20'}`}>
                {focus ? '✓' : '3'}
              </span>
              <span className="text-xs font-bold text-white/60 uppercase tracking-[1.5px]">Focus</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([['sharp', 'Locked In'], ['normal', 'Normal'], ['distracted', 'Distracted']] as const).map(([value, label]) => (
                <button key={value} onClick={() => setFocus(value)} className="py-3 rounded-lg text-[0.6rem] font-bold transition-all duration-200 press-scale" style={{ background: focus === value ? `${colors.primary}20` : 'rgba(255,255,255,0.02)', border: `${focus === value ? '2px' : '1px'} solid ${focus === value ? colors.primary + '40' : 'rgba(255,255,255,0.06)'}`, color: focus === value ? colors.primary : 'rgba(255,255,255,0.4)', transform: focus === value ? 'scale(1.02)' : 'scale(1)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm */}
      <div className="mt-7 animate-reveal">
        <button
          onClick={handleConfirm}
          disabled={!allAnswered}
          className="w-full py-4 text-sm font-bold uppercase tracking-[3px] rounded-xl press-scale disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-[1px]"
          style={{
            background: allAnswered ? `linear-gradient(135deg, ${colors.primary}dd, ${colors.secondary}cc)` : 'rgba(255,255,255,0.04)',
            color: allAnswered ? '#ffffff' : 'rgba(255,255,255,0.25)',
            boxShadow: allAnswered ? `0 0 20px ${colors.primary}25` : 'none',
          }}
        >
          {allAnswered ? 'Check Readiness' : 'Complete checklist'}
        </button>
        {!allAnswered && <p className="text-[0.5rem] text-white/15 text-center mt-2">Select one option in each section</p>}
      </div>

      {/* Skip */}
      <button onClick={handleSkip} className="w-full mt-3 py-2 text-[0.55rem] text-white/15 hover:text-white/30 transition-all duration-200">
        Skip for today
      </button>
    </div>
  );
};

// ─── Comparison Row ─────────────────────────────────────────────────────────

const ComparisonRow: React.FC<{ label: string; before: number; after: number; unit: string; colors: any; changed: boolean }> = ({ label, before, after, unit, colors, changed }) => (
  <div className="flex items-center justify-between">
    <span className="text-[0.6rem] text-white/30">{label}</span>
    <div className="flex items-center gap-2">
      <span className="text-[0.6rem] font-mono text-white/25">{unit === '$' ? '$' : ''}{before}{unit !== '$' ? unit : ''}</span>
      {changed && (
        <>
          <span className="text-[0.5rem] text-white/15">→</span>
          <span className="text-[0.6rem] font-mono font-bold" style={{ color: colors.primary }}>{unit === '$' ? '$' : ''}{after}{unit !== '$' ? unit : ''}</span>
        </>
      )}
      {!changed && <span className="text-[0.5rem] text-white/15 italic">unchanged</span>}
    </div>
  </div>
);

// ─── Protection Level Calculation ───────────────────────────────────────────

function calculateActivePlan(score: number, plan: TradingPlan): { protectionLevel: string; plan: ActivePlan } {
  const baseline = buildBaselineActivePlan(plan);

  if (score >= 75) {
    return { protectionLevel: 'ready', plan: baseline };
  }

  if (score >= 50) {
    // Recommended: loss × 0.85, 2-min cooldown
    return {
      protectionLevel: 'recommended',
      plan: {
        ...baseline,
        dailyLoss: roundTo25(plan.daily_loss * 0.85),
        cooldownMinutes: 2,
      },
    };
  }

  if (score >= 30) {
    // Protected: contracts halved (ceil/2, min 1), loss × 0.6, trades × 0.67, 5-min cooldown
    return {
      protectionLevel: 'protected',
      plan: {
        ...baseline,
        maxContracts: protectedContracts(plan.max_contracts),
        dailyLoss: roundTo25(plan.daily_loss * 0.6),
        maxTrades: Math.max(1, Math.floor(plan.max_trades * 0.67)),
        cooldownMinutes: 5,
      },
    };
  }

  // Maximum Protection: 1 contract, loss × 0.4, 1 trade, 10-min cooldown
  return {
    protectionLevel: 'maximum_protection',
    plan: {
      ...baseline,
      maxContracts: 1,
      dailyLoss: roundTo25(plan.daily_loss * 0.4),
      maxTrades: 1,
      cooldownMinutes: 10,
    },
  };
}

function buildBaselineActivePlan(plan: TradingPlan): ActivePlan {
  return {
    maxContracts: plan.max_contracts,
    dailyLoss: plan.daily_loss,
    maxTrades: plan.max_trades,
    profitTarget: plan.profit_target,
    cooldownMinutes: 0,
    lockDurationHours: plan.lock_duration_hours,
    lockMode: plan.lock_mode,
    resetTime: plan.reset_time,
    resetTimezone: plan.reset_timezone,
  };
}

function protectedContracts(baseline: number): number {
  // 1→1, 2→1, 3→2, 4→2, 5→3, 6→3
  return Math.max(1, Math.ceil(baseline / 2));
}

function roundTo25(value: number): number {
  return Math.max(25, Math.floor(value / 25) * 25);
}
