import React, { useState, useEffect, useMemo } from 'react';
import { Gauge } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

interface Trade {
  id: number;
  symbol: string;
  size: number;
  direction: string;
  entryTime: string;
  exitTime: string;
  pnl: number;
  result: string;
  durationSeconds: number;
}

interface LogEntry {
  id: number;
  timestamp: string;
  type: string;
  details: string;
}

type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

interface RiskFactor {
  label: string;
  description: string;
  value: number; // 0-100 contribution
  weight: number;
  icon: string;
  active: boolean;
}

const VIOLATION_TYPES = ['size_blocked', 'session_blocked', 'symbol_blocked', 'coach_blocked', 'stacking_blocked', 'bypass_attempt'];

/**
 * Discipline Risk - Current session risk assessment
 * 
 * Does NOT predict the future. Calculates CURRENT session risk
 * based on what has already happened TODAY.
 * 
 * Factors:
 * 1. Consecutive losses (0-30 points)
 * 2. Trade speed / frequency (0-20 points)
 * 3. Violation count today (0-25 points)
 * 4. Position size increases (0-15 points)
 * 5. Cooldown bypasses (0-10 points)
 * 
 * Total: 0-100
 * 0-25 = Low, 26-50 = Moderate, 51-75 = High, 76-100 = Critical
 */
export const DisciplineRisk: React.FC = () => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  // Auto-refresh every 30 seconds for real-time feel
  useEffect(() => {
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [t, l] = await Promise.all([
        window.electronAPI.getTrades(200),
        window.electronAPI.getActivityLog(500),
      ]);
      setTrades(t || []);
      setLog(l || []);
    } catch (e) {
      console.error('DisciplineRisk: failed to load', e);
    } finally {
      setLoading(false);
    }
  };

  // Filter to today only
  const today = new Date().toISOString().split('T')[0];

  const todayTrades = useMemo(() => {
    return trades
      .filter(t => (t.entryTime || '').startsWith(today))
      .sort((a, b) => (a.entryTime || '').localeCompare(b.entryTime || ''));
  }, [trades, today]);

  const todayLog = useMemo(() => {
    return log.filter(e => {
      const ts = e.timestamp || '';
      const date = ts.includes('T') ? ts.split('T')[0] : ts.split(' ')[0];
      return date === today;
    });
  }, [log, today]);

  // Calculate risk factors
  const riskFactors = useMemo((): RiskFactor[] => {
    const factors: RiskFactor[] = [];

    // ─── Factor 1: Consecutive losses (0-30 points) ─────────────────────
    let consecutiveLosses = 0;
    for (let i = todayTrades.length - 1; i >= 0; i--) {
      if (todayTrades[i].result === 'loss') consecutiveLosses++;
      else break;
    }
    const lossPoints = Math.min(30, consecutiveLosses * 10);
    factors.push({
      label: 'Consecutive losses',
      description: consecutiveLosses === 0 ? 'No current losing streak' : `${consecutiveLosses} loss${consecutiveLosses > 1 ? 'es' : ''} in a row`,
      value: lossPoints,
      weight: 30,
      icon: '▼',
      active: consecutiveLosses > 0,
    });

    // ─── Factor 2: Trade speed (0-20 points) ────────────────────────────
    let rapidEntries = 0;
    for (let i = 1; i < todayTrades.length; i++) {
      const prevExit = new Date(todayTrades[i - 1].exitTime || todayTrades[i - 1].entryTime).getTime();
      const currEntry = new Date(todayTrades[i].entryTime).getTime();
      if (currEntry - prevExit < 60000) rapidEntries++; // < 1 min
    }
    const speedPoints = Math.min(20, rapidEntries * 7);
    factors.push({
      label: 'Trade speed',
      description: rapidEntries === 0 ? 'Normal pace between trades' : `${rapidEntries} rapid re-entry (< 1 min gap)`,
      value: speedPoints,
      weight: 20,
      icon: '⚡',
      active: rapidEntries > 0,
    });

    // ─── Factor 3: Violation count (0-25 points) ────────────────────────
    const todayViolations = todayLog.filter(e => VIOLATION_TYPES.includes(e.type)).length;
    const violationPoints = Math.min(25, todayViolations * 8);
    factors.push({
      label: 'Violations today',
      description: todayViolations === 0 ? 'No rule violations' : `${todayViolations} blocked attempt${todayViolations > 1 ? 's' : ''}`,
      value: violationPoints,
      weight: 25,
      icon: '⊘',
      active: todayViolations > 0,
    });

    // ─── Factor 4: Position size increases (0-15 points) ────────────────
    let sizeIncreases = 0;
    for (let i = 1; i < todayTrades.length; i++) {
      if (todayTrades[i].size > todayTrades[i - 1].size) {
        sizeIncreases++;
      }
    }
    const sizePoints = Math.min(15, sizeIncreases * 8);
    factors.push({
      label: 'Size increases',
      description: sizeIncreases === 0 ? 'Consistent position sizing' : `Increased size ${sizeIncreases} time${sizeIncreases > 1 ? 's' : ''}`,
      value: sizePoints,
      weight: 15,
      icon: '▱',
      active: sizeIncreases > 0,
    });

    // ─── Factor 5: Bypass attempts (0-10 points) ────────────────────────
    const bypassAttempts = todayLog.filter(e => e.type === 'bypass_attempt').length;
    const bypassPoints = Math.min(10, bypassAttempts * 10);
    factors.push({
      label: 'Bypass attempts',
      description: bypassAttempts === 0 ? 'No bypass attempts' : `${bypassAttempts} attempt${bypassAttempts > 1 ? 's' : ''} to override rules`,
      value: bypassPoints,
      weight: 10,
      icon: '⚠',
      active: bypassAttempts > 0,
    });

    return factors;
  }, [todayTrades, todayLog]);

  // Total risk score
  const totalRisk = useMemo(() => {
    return Math.min(100, riskFactors.reduce((sum, f) => sum + f.value, 0));
  }, [riskFactors]);

  // Risk level
  const riskLevel = useMemo((): RiskLevel => {
    if (totalRisk >= 76) return 'critical';
    if (totalRisk >= 51) return 'high';
    if (totalRisk >= 26) return 'moderate';
    return 'low';
  }, [totalRisk]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: `${colors.primary}30`, borderTopColor: colors.primary }} />
      </div>
    );
  }

  const levelColor = getRiskColor(riskLevel, colors);
  const activeFactors = riskFactors.filter(f => f.active);

  return (
    <div className="max-w-lg animate-reveal">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`, border: `1px solid ${colors.primary}20` }}>
          <Gauge size={18} style={{ color: colors.primary, filter: `drop-shadow(0 0 4px ${colors.primary}50)` }} />
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gradient">Discipline Risk</h2>
          <p className="text-[0.6rem] text-white/30">Current session risk level</p>
        </div>
      </div>

      {/* Current Risk Level - Hero Card */}
      <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-5">
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${levelColor}40, transparent)` }} />
        {/* Glow effect for high/critical */}
        {(riskLevel === 'high' || riskLevel === 'critical') && (
          <div className="absolute inset-0 rounded-xl" style={{ boxShadow: `inset 0 0 40px ${levelColor}10` }} />
        )}
        <div className="relative z-10">
          {/* Level badge + score */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full animate-pulse" style={{ background: levelColor, boxShadow: `0 0 12px ${levelColor}80` }} />
              <span className="text-lg font-black uppercase tracking-[3px]" style={{ color: levelColor }}>
                {riskLevel}
              </span>
            </div>
            <span className="text-3xl font-black font-mono" style={{ color: levelColor }}>
              {totalRisk}<span className="text-sm text-white/20">/100</span>
            </span>
          </div>

          {/* Risk bar */}
          <div className="h-3 rounded-full bg-white/[0.04] overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${totalRisk}%`,
                background: `linear-gradient(90deg, ${colors.primary}, ${levelColor})`,
                boxShadow: totalRisk > 50 ? `0 0 10px ${levelColor}40` : 'none',
              }}
            />
          </div>

          {/* Level scale */}
          <div className="flex justify-between text-[0.45rem] text-white/15 uppercase tracking-[1px]">
            <span>Low</span>
            <span>Moderate</span>
            <span>High</span>
            <span>Critical</span>
          </div>
        </div>
      </div>

      {/* Why this level */}
      {activeFactors.length > 0 ? (
        <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5">
          <div className="relative z-10">
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-4" style={{ color: `${levelColor}80` }}>Why This Level</p>
            <div className="space-y-3">
              {riskFactors.map((factor, idx) => (
                <div key={idx} className={`${factor.active ? '' : 'opacity-30'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{factor.icon}</span>
                      <span className="text-[0.65rem] text-white/50">{factor.label}</span>
                    </div>
                    <span className="text-[0.6rem] font-bold font-mono" style={{ color: factor.value > 0 ? levelColor : 'rgba(255,255,255,0.2)' }}>
                      +{factor.value}<span className="text-white/15">/{factor.weight}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(factor.value / factor.weight) * 100}%`, background: factor.value > 0 ? levelColor : 'transparent' }}
                      />
                    </div>
                    <span className="text-[0.5rem] text-white/25 w-32 text-right truncate">{factor.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5">
          <div className="relative z-10 text-center py-4">
            <p className="text-xl mb-2">✓</p>
            <p className="text-sm font-semibold text-white/50">Clean session so far</p>
            <p className="text-[0.6rem] text-white/25 mt-1">No risk factors detected today.</p>
          </div>
        </div>
      )}

      {/* Today's Summary */}
      <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-5">
        <div className="relative z-10">
          <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase mb-3" style={{ color: `${colors.primary}60` }}>Today's Session</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-lg font-black font-mono text-white/60">{todayTrades.length}</p>
              <p className="text-[0.45rem] text-white/20 uppercase">Trades</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black font-mono" style={{ color: todayPnl(todayTrades) >= 0 ? '#10b981' : '#ef4444' }}>
                {todayPnl(todayTrades) >= 0 ? '+' : ''}{todayPnl(todayTrades).toFixed(0)}
              </p>
              <p className="text-[0.45rem] text-white/20 uppercase">P&L</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black font-mono text-white/60">
                {todayLog.filter(e => VIOLATION_TYPES.includes(e.type)).length}
              </p>
              <p className="text-[0.45rem] text-white/20 uppercase">Violations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation */}
      {riskLevel !== 'low' && (
        <div className="px-4 py-3 rounded-xl border" style={{ borderColor: `${levelColor}20`, background: `${levelColor}05` }}>
          <p className="text-[0.6rem] font-bold mb-1" style={{ color: `${levelColor}90` }}>
            {riskLevel === 'critical' ? 'Consider activating Kill Switch' :
             riskLevel === 'high' ? 'Consider stopping for the day' :
             'Proceed with caution'}
          </p>
          <p className="text-[0.55rem] text-white/30">
            {riskLevel === 'critical' ? 'Multiple risk factors are elevated. Continuing increases the chance of emotional decisions.' :
             riskLevel === 'high' ? 'Your behavior today shows signs of frustration or overtrading. Take a break.' :
             'Minor risk signals detected. Stay aware of your rules.'}
          </p>
        </div>
      )}

      {/* Calculation */}
      <div className="mt-5 px-4 py-3 rounded-xl border border-white/[0.03] bg-white/[0.01]">
        <p className="text-[0.55rem] font-bold text-white/25 uppercase tracking-[1.5px] mb-2">How It's Calculated</p>
        <div className="space-y-1 text-[0.55rem] text-white/20">
          <p>Consecutive losses: up to +30 (10 per loss)</p>
          <p>Trade speed: up to +20 (7 per rapid entry)</p>
          <p>Violations: up to +25 (8 per blocked attempt)</p>
          <p>Size increases: up to +15 (8 per increase)</p>
          <p>Bypass attempts: up to +10 (10 per attempt)</p>
          <p className="pt-1 border-t border-white/[0.03]">0-25 = Low | 26-50 = Moderate | 51-75 = High | 76-100 = Critical</p>
        </div>
      </div>

      {/* Footnote */}
      <p className="text-[0.5rem] text-white/15 text-center mt-4 italic">
        Calculates current risk, does not predict the future. Updates every 30 seconds.
      </p>
    </div>
  );
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

function todayPnl(trades: Trade[]): number {
  return trades.reduce((sum, t) => sum + t.pnl, 0);
}

function getRiskColor(level: RiskLevel, colors: any): string {
  switch (level) {
    case 'low': return colors.primary;
    case 'moderate': return '#fbbf24';
    case 'high': return '#f97316';
    case 'critical': return '#ef4444';
  }
}
