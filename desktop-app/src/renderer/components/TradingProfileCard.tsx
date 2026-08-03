import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';

interface TradingProfile {
  firm: string;
  platform: string;
  account_stage: string;
  account_size: string;
  firm_max_contracts: number | null;
  firm_daily_loss: number | null;
  firm_drawdown: number | null;
}

interface TradingPlan {
  max_contracts: number;
  daily_loss: number;
  max_trades: number;
  profit_target: number;
  lock_duration_hours: number;
}

/**
 * Trading Profile Card — Shows profile summary + plan at top of Protection page
 * Links to Edit Profile / Edit Trading Plan
 */
export const TradingProfileCard: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [profile, setProfile] = useState<TradingProfile | null>(null);
  const [plan, setPlan] = useState<TradingPlan | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable plan fields
  const [maxContracts, setMaxContracts] = useState('');
  const [dailyLoss, setDailyLoss] = useState('');
  const [maxTrades, setMaxTrades] = useState('');
  const [profitTarget, setProfitTarget] = useState('');
  const [lockDuration, setLockDuration] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [p, pl] = await Promise.all([
      (window as any).electronAPI?.getTradingProfile?.(),
      (window as any).electronAPI?.getTradingPlan?.(),
    ]);
    if (p) setProfile(p);
    if (pl) {
      setPlan(pl);
      setMaxContracts(String(pl.max_contracts));
      setDailyLoss(String(pl.daily_loss));
      setMaxTrades(String(pl.max_trades));
      setProfitTarget(String(pl.profit_target));
      setLockDuration(String(pl.lock_duration_hours));
    }
  };

  const handleSavePlan = async () => {
    setSaving(true);
    await (window as any).electronAPI?.saveTradingPlan?.({
      maxContracts: Number(maxContracts) || 2,
      dailyLoss: Number(dailyLoss) || 400,
      maxTrades: Number(maxTrades) || 3,
      profitTarget: Number(profitTarget) || 600,
      lockDurationHours: Number(lockDuration) || 4,
      lockMode: 'duration',
      resetTime: '17:00',
      resetTimezone: 'America/New_York',
    });
    await loadData();
    setEditingPlan(false);
    setSaving(false);
  };

  const firmLabel = (firm: string) => {
    switch (firm) {
      case 'topstepx': return 'TopstepX';
      case 'apex': return 'Apex';
      case 'tradeify': return 'Tradeify';
      case 'personal': return 'Personal';
      default: return firm || 'Not set';
    }
  };

  return (
    <div className="mb-8">
      {/* Profile Summary */}
      <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-4 animate-reveal">
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}30, transparent)` }} />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase" style={{ color: `${colors.primary}80` }}>Trading Profile</p>
            {profile && (
              <span className="text-[0.55rem] text-white/20">
                {firmLabel(profile.firm)} • ${profile.account_size?.replace('k', 'K')} • {profile.account_stage}
              </span>
            )}
          </div>
          {profile?.firm_max_contracts && (
            <div className="flex items-center gap-4 text-[0.55rem] text-white/15">
              <span>Firm: {profile.firm_max_contracts} contracts</span>
              <span>|</span>
              <span>${profile.firm_daily_loss?.toLocaleString()} loss</span>
              <span>|</span>
              <span>${profile.firm_drawdown?.toLocaleString()} drawdown</span>
            </div>
          )}
        </div>
      </div>

      {/* My Trading Plan */}
      <div className="relative rounded-xl p-5 overflow-hidden card-premium animate-reveal">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[0.6rem] font-bold tracking-[2.5px] uppercase" style={{ color: `${colors.primary}80` }}>My Trading Plan</p>
            {!isLocked && !editingPlan && (
              <button
                onClick={() => setEditingPlan(true)}
                className="px-3 py-1.5 text-[0.55rem] font-bold rounded-lg press-scale transition-all"
                style={{ background: `${colors.primary}10`, border: `1px solid ${colors.primary}20`, color: `${colors.primary}99` }}
              >
                Edit Plan
              </button>
            )}
          </div>

          {!editingPlan ? (
            /* Display mode */
            plan ? (
              <div className="grid grid-cols-5 gap-3 text-center">
                <div>
                  <p className="text-lg font-black font-mono" style={{ color: colors.primary }}>{plan.max_contracts}</p>
                  <p className="text-[0.45rem] text-white/20 uppercase">Contracts</p>
                </div>
                <div>
                  <p className="text-lg font-black font-mono" style={{ color: colors.primary }}>${plan.daily_loss}</p>
                  <p className="text-[0.45rem] text-white/20 uppercase">Loss</p>
                </div>
                <div>
                  <p className="text-lg font-black font-mono" style={{ color: colors.primary }}>{plan.max_trades}</p>
                  <p className="text-[0.45rem] text-white/20 uppercase">Trades</p>
                </div>
                <div>
                  <p className="text-lg font-black font-mono" style={{ color: colors.primary }}>${plan.profit_target}</p>
                  <p className="text-[0.45rem] text-white/20 uppercase">Target</p>
                </div>
                <div>
                  <p className="text-lg font-black font-mono" style={{ color: colors.primary }}>{plan.lock_duration_hours}h</p>
                  <p className="text-[0.45rem] text-white/20 uppercase">Lock</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/25">No plan set. Complete onboarding first.</p>
            )
          ) : (
            /* Edit mode */
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[0.5rem] text-white/25 uppercase tracking-[1px] mb-1">Max Contracts</label>
                  <input type="number" min="1" max="50" value={maxContracts} onChange={e => setMaxContracts(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-white font-mono text-sm font-bold text-center focus:outline-none input-premium" />
                </div>
                <div>
                  <label className="block text-[0.5rem] text-white/25 uppercase tracking-[1px] mb-1">Daily Loss ($)</label>
                  <input type="number" min="50" step="25" value={dailyLoss} onChange={e => setDailyLoss(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-white font-mono text-sm font-bold text-center focus:outline-none input-premium" />
                </div>
                <div>
                  <label className="block text-[0.5rem] text-white/25 uppercase tracking-[1px] mb-1">Max Trades</label>
                  <input type="number" min="1" max="50" value={maxTrades} onChange={e => setMaxTrades(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-white font-mono text-sm font-bold text-center focus:outline-none input-premium" />
                </div>
                <div>
                  <label className="block text-[0.5rem] text-white/25 uppercase tracking-[1px] mb-1">Profit Target ($)</label>
                  <input type="number" min="50" step="25" value={profitTarget} onChange={e => setProfitTarget(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-white font-mono text-sm font-bold text-center focus:outline-none input-premium" />
                </div>
              </div>
              <div>
                <label className="block text-[0.5rem] text-white/25 uppercase tracking-[1px] mb-1">Lock Duration (hours)</label>
                <input type="number" min="1" max="12" value={lockDuration} onChange={e => setLockDuration(e.target.value)} className="w-20 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-white font-mono text-sm font-bold text-center focus:outline-none input-premium" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSavePlan} disabled={saving} className="flex-1 py-2.5 btn-premium text-[0.6rem] font-bold uppercase tracking-[2px] rounded-lg press-scale disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Plan'}
                </button>
                <button onClick={() => setEditingPlan(false)} className="px-4 py-2.5 text-[0.6rem] text-white/30 hover:text-white/50 transition-all">
                  Cancel
                </button>
              </div>
              <p className="text-[0.5rem] text-white/15 italic">Changes apply to your next session. Today's locked plan is not affected.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
