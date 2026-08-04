import React, { useState, useMemo } from 'react';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../themeColors';
import { Logo } from './Logo';
import { SUPPORTED_FIRMS, ACCOUNT_STAGES, getAccountSizesForFirm, findPreset, calculateDefaultPlan } from '../data/firm-presets';
import type { FirmRulesPreset } from '../data/firm-presets';

interface Props {
  onComplete: () => void;
}

type Step = 'profile' | 'plan';

/**
 * Onboarding — 2-screen setup for new users
 * 
 * Screen 1: Trading Profile (firm, platform, account size, stage)
 * Screen 2: My Trading Plan (max contracts, loss, trades, target, lock config)
 * 
 * After completion, user goes directly to Home. Never shown again unless profile is missing.
 */
export const Onboarding: React.FC<Props> = ({ onComplete }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const [step, setStep] = useState<Step>('profile');

  // Profile fields
  const [firm, setFirm] = useState('topstepx');
  const [accountStage, setAccountStage] = useState('evaluation');
  const [accountSize, setAccountSize] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<FirmRulesPreset | null>(null);

  // Plan fields
  const [maxContracts, setMaxContracts] = useState('2');
  const [dailyLoss, setDailyLoss] = useState('400');
  const [maxTrades, setMaxTrades] = useState('3');
  const [profitTarget, setProfitTarget] = useState('600');
  const [lockDuration, setLockDuration] = useState('4');

  // Derived: available account sizes for selected firm
  const accountSizes = useMemo(() => {
    if (firm === 'personal' || firm === 'other') return [];
    return getAccountSizesForFirm(firm, accountStage);
  }, [firm, accountStage]);

  // When firm/stage/size changes, find preset
  const updatePreset = (f: string, stage: string, size: string) => {
    if (f === 'personal' || f === 'other' || !size) {
      setSelectedPreset(null);
      return;
    }
    const preset = findPreset(f, size, stage);
    setSelectedPreset(preset || null);
  };

  const handleFirmChange = (f: string) => {
    setFirm(f);
    setAccountSize('');
    setSelectedPreset(null);
    if (f === 'personal' || f === 'other') {
      setAccountStage('personal');
    } else {
      setAccountStage('evaluation');
    }
  };

  const handleSizeChange = (size: string) => {
    setAccountSize(size);
    updatePreset(firm, accountStage, size);
  };

  const handleStageChange = (stage: string) => {
    setAccountStage(stage);
    updatePreset(firm, stage, accountSize);
  };

  const handleNextToPlain = () => {
    // Pre-populate plan with conservative defaults if preset available
    if (selectedPreset) {
      const defaults = calculateDefaultPlan(selectedPreset);
      setMaxContracts(String(defaults.maxContracts));
      setDailyLoss(String(defaults.dailyLoss));
      setMaxTrades(String(defaults.maxTrades));
      setProfitTarget(String(defaults.profitTarget));
    }
    setStep('plan');
  };

  const handleSave = async () => {
    // Save profile
    await (window as any).electronAPI?.saveTradingProfile?.({
      firm,
      platform: firm === 'topstepx' ? 'tradovate' : firm,
      program: selectedPreset?.program || '',
      accountStage,
      accountSize: accountSize || 'custom',
      firmMaxContracts: selectedPreset?.maxContracts || null,
      firmDailyLoss: selectedPreset?.dailyLossLimit || null,
      firmDrawdown: selectedPreset?.maxDrawdown || null,
      drawdownType: selectedPreset?.drawdownType || 'intraday_trailing',
      rulesPresetId: selectedPreset?.id || null,
      rulesPresetVersion: selectedPreset?.effectiveDate || null,
    });

    // Save plan
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

    onComplete();
  };

  // ─── SCREEN 1: Trading Profile ─────────────────────────────────────────
  if (step === 'profile') {
    return (
      <div className="h-screen flex flex-col items-center justify-center relative overflow-hidden">
        <div className="nebula-bg" />
        <div className="stars" />
        <div className="relative z-10 w-full max-w-md px-6 animate-reveal">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Logo size={120} />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-gradient mt-4 mb-1">Trading Profile</h1>
            <p className="text-[0.6rem] text-white/25 uppercase tracking-[2px]">Step 1 of 2</p>
          </div>

          {/* Firm */}
          <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-4">
            <div className="relative z-10">
              <label className="block text-[0.6rem] font-bold text-white/30 uppercase tracking-[1.5px] mb-2">Firm / Platform</label>
              <div className="grid grid-cols-2 gap-2">
                {SUPPORTED_FIRMS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleFirmChange(f.id)}
                    className="py-2.5 rounded-lg text-[0.6rem] font-bold transition-all press-scale"
                    style={{
                      background: firm === f.id ? `${colors.primary}20` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${firm === f.id ? colors.primary + '40' : 'rgba(255,255,255,0.06)'}`,
                      color: firm === f.id ? colors.primary : 'rgba(255,255,255,0.35)',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Stage + Size (only for prop firms) */}
          {firm !== 'personal' && firm !== 'other' && (
            <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-4">
              <div className="relative z-10">
                <label className="block text-[0.6rem] font-bold text-white/30 uppercase tracking-[1.5px] mb-2">Account Stage</label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {ACCOUNT_STAGES.filter(s => s.id !== 'personal').map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleStageChange(s.id)}
                      className="py-2 rounded-lg text-[0.6rem] font-bold transition-all press-scale"
                      style={{
                        background: accountStage === s.id ? `${colors.primary}20` : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${accountStage === s.id ? colors.primary + '40' : 'rgba(255,255,255,0.06)'}`,
                        color: accountStage === s.id ? colors.primary : 'rgba(255,255,255,0.35)',
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {accountSizes.length > 0 && (
                  <>
                    <label className="block text-[0.6rem] font-bold text-white/30 uppercase tracking-[1.5px] mb-2">Account Size</label>
                    <div className="grid grid-cols-3 gap-2">
                      {accountSizes.map(size => (
                        <button
                          key={size}
                          onClick={() => handleSizeChange(size)}
                          className="py-2.5 rounded-lg text-[0.65rem] font-bold transition-all press-scale"
                          style={{
                            background: accountSize === size ? `${colors.primary}20` : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${accountSize === size ? colors.primary + '40' : 'rgba(255,255,255,0.06)'}`,
                            color: accountSize === size ? colors.primary : 'rgba(255,255,255,0.35)',
                          }}
                        >
                          ${size.replace('k', 'K')}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Firm Reference (informational only) */}
          {selectedPreset && (
            <div className="relative rounded-xl p-4 overflow-hidden card-premium mb-4">
              <div className="relative z-10">
                <p className="text-[0.55rem] font-bold text-white/20 uppercase tracking-[1.5px] mb-2">Firm Rules (Reference Only)</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-sm font-bold font-mono text-white/40">{selectedPreset.maxContracts}</p>
                    <p className="text-[0.45rem] text-white/15 uppercase">Max Contracts</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold font-mono text-white/40">${selectedPreset.dailyLossLimit?.toLocaleString()}</p>
                    <p className="text-[0.45rem] text-white/15 uppercase">Daily Loss</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold font-mono text-white/40">${selectedPreset.maxDrawdown?.toLocaleString()}</p>
                    <p className="text-[0.45rem] text-white/15 uppercase">Drawdown</p>
                  </div>
                </div>
                <p className="text-[0.45rem] text-white/10 mt-2 text-center italic">
                  Verify against your account agreement. Last checked: {selectedPreset.lastVerifiedAt}
                </p>
              </div>
            </div>
          )}

          {/* Next button */}
          <button
            onClick={handleNextToPlain}
            disabled={firm !== 'personal' && firm !== 'other' && !accountSize && accountSizes.length > 0}
            className="w-full py-4 btn-premium text-xs font-bold uppercase tracking-[2.5px] rounded-xl press-scale disabled:opacity-20 disabled:cursor-not-allowed mt-4"
          >
            Next →
          </button>
        </div>
      </div>
    );
  }

  // ─── SCREEN 2: My Trading Plan ─────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="nebula-bg" />
      <div className="stars" />
      <div className="relative z-10 w-full max-w-md px-6 animate-reveal">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black tracking-tight text-gradient mb-1">My Trading Plan</h1>
          <p className="text-[0.6rem] text-white/25 uppercase tracking-[2px]">Step 2 of 2 — Your baseline rules</p>
        </div>

        {/* Plan fields */}
        <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-4">
          <div className="relative z-10 space-y-4">
            {/* Max Contracts */}
            <div>
              <label className="block text-[0.6rem] font-bold text-white/30 uppercase tracking-[1.5px] mb-1.5">Maximum Contracts</label>
              <input
                type="number" min="1" max="50" value={maxContracts}
                onChange={(e) => setMaxContracts(e.target.value)}
                className="w-20 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white font-mono text-sm font-bold text-center focus:outline-none transition-all input-premium"
              />
              {selectedPreset && (
                <span className="ml-3 text-[0.5rem] text-white/15">Firm allows: {selectedPreset.maxContracts}</span>
              )}
            </div>

            {/* Daily Loss */}
            <div>
              <label className="block text-[0.6rem] font-bold text-white/30 uppercase tracking-[1.5px] mb-1.5">Daily Loss Limit</label>
              <div className="flex items-center gap-1">
                <span className="text-white/25 text-sm">$</span>
                <input
                  type="number" min="50" step="25" value={dailyLoss}
                  onChange={(e) => setDailyLoss(e.target.value)}
                  className="w-24 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white font-mono text-sm font-bold text-center focus:outline-none transition-all input-premium"
                />
                {selectedPreset && (
                  <span className="ml-2 text-[0.5rem] text-white/15">Firm: ${selectedPreset.dailyLossLimit?.toLocaleString()}</span>
                )}
              </div>
            </div>

            {/* Max Trades */}
            <div>
              <label className="block text-[0.6rem] font-bold text-white/30 uppercase tracking-[1.5px] mb-1.5">Maximum Trades Per Day</label>
              <input
                type="number" min="1" max="50" value={maxTrades}
                onChange={(e) => setMaxTrades(e.target.value)}
                className="w-20 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white font-mono text-sm font-bold text-center focus:outline-none transition-all input-premium"
              />
            </div>

            {/* Profit Target */}
            <div>
              <label className="block text-[0.6rem] font-bold text-white/30 uppercase tracking-[1.5px] mb-1.5">Profit Target</label>
              <div className="flex items-center gap-1">
                <span className="text-white/25 text-sm">$</span>
                <input
                  type="number" min="50" step="25" value={profitTarget}
                  onChange={(e) => setProfitTarget(e.target.value)}
                  className="w-24 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white font-mono text-sm font-bold text-center focus:outline-none transition-all input-premium"
                />
              </div>
            </div>

            {/* Lock Duration */}
            <div>
              <label className="block text-[0.6rem] font-bold text-white/30 uppercase tracking-[1.5px] mb-1.5">Default Lock Duration</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="1" max="12" value={lockDuration}
                  onChange={(e) => setLockDuration(e.target.value)}
                  className="w-16 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white font-mono text-sm font-bold text-center focus:outline-none transition-all input-premium"
                />
                <span className="text-[0.6rem] text-white/25">hours</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="px-4 py-3 rounded-xl border border-white/[0.03] bg-white/[0.01] mb-4">
          <p className="text-[0.5rem] text-white/20 leading-relaxed">
            This is your long-term trading plan. Trading Readiness will temporarily tighten these values on days when your readiness is lower. You can edit this plan anytime from the Protection page.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setStep('profile')}
            className="px-6 py-3.5 text-xs font-bold uppercase tracking-[1.5px] rounded-xl text-white/30 hover:text-white/50 transition-all"
          >
            ← Back
          </button>
          <button
            onClick={handleSave}
            disabled={!maxContracts || !dailyLoss}
            className="flex-1 py-3.5 btn-premium text-xs font-bold uppercase tracking-[2.5px] rounded-xl press-scale disabled:opacity-20 disabled:cursor-not-allowed"
          >
            Save Plan
          </button>
        </div>
      </div>
    </div>
  );
};
