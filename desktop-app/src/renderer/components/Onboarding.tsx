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
        <div className="relative z-10 w-full max-w-xl px-8 py-6 animate-reveal">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              <Logo size={128} />
            </div>
            <h1 className="text-[1.7rem] font-black tracking-tight text-gradient mt-4 mb-1">Trading Profile</h1>
            <p className="text-[0.65rem] text-white/25 uppercase tracking-[2px]">Step 1 of 2</p>
            <p className="text-[0.75rem] text-white/25 mt-2.5">Tell Sentinel about your trading account</p>
          </div>

          {/* Firm */}
          <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-4 hover:border-white/[0.08] transition-all duration-200">
            <div className="relative z-10">
              <label className="block text-[0.6rem] font-bold text-white/30 uppercase tracking-[1.5px] mb-2">Firm / Platform</label>
              <div className="grid grid-cols-2 gap-2">
                {SUPPORTED_FIRMS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleFirmChange(f.id)}
                    className="py-3 rounded-lg text-[0.65rem] font-bold transition-all duration-200 press-scale relative"
                    style={{
                      background: firm === f.id ? `${colors.primary}20` : 'rgba(255,255,255,0.02)',
                      border: firm === f.id ? `2px solid ${colors.primary}40` : '1px solid rgba(255,255,255,0.06)',
                      color: firm === f.id ? colors.primary : 'rgba(255,255,255,0.4)',
                      boxShadow: firm === f.id ? `0 0 12px ${colors.primary}15` : 'none',
                    }}
                  >
                    {f.label}
                    {firm === f.id && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[0.6rem] opacity-70">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Stage + Size (only for prop firms) */}
          {firm !== 'personal' && firm !== 'other' && (
            <div className="relative rounded-xl p-5 overflow-hidden card-premium mb-4 hover:border-white/[0.08] transition-all duration-200">
              <div className="relative z-10">
                <label className="block text-[0.6rem] font-bold text-white/30 uppercase tracking-[1.5px] mb-2">Account Stage</label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {ACCOUNT_STAGES.filter(s => s.id !== 'personal').map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleStageChange(s.id)}
                      className="py-3 rounded-lg text-[0.65rem] font-bold transition-all duration-200 press-scale relative"
                      style={{
                        background: accountStage === s.id ? `${colors.primary}20` : 'rgba(255,255,255,0.02)',
                        border: accountStage === s.id ? `2px solid ${colors.primary}40` : '1px solid rgba(255,255,255,0.06)',
                        color: accountStage === s.id ? colors.primary : 'rgba(255,255,255,0.4)',
                        boxShadow: accountStage === s.id ? `0 0 12px ${colors.primary}15` : 'none',
                      }}
                    >
                      {s.label}
                      {accountStage === s.id && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[0.6rem] opacity-70">✓</span>
                      )}
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
                          className="py-3 rounded-lg text-[0.65rem] font-bold transition-all duration-200 press-scale relative"
                          style={{
                            background: accountSize === size ? `${colors.primary}20` : 'rgba(255,255,255,0.02)',
                            border: accountSize === size ? `2px solid ${colors.primary}40` : '1px solid rgba(255,255,255,0.06)',
                            color: accountSize === size ? colors.primary : 'rgba(255,255,255,0.4)',
                            boxShadow: accountSize === size ? `0 0 12px ${colors.primary}15` : 'none',
                          }}
                        >
                          ${size.replace('k', 'K')}
                          {accountSize === size && (
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[0.6rem] opacity-70">✓</span>
                          )}
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
            <div className="relative rounded-xl p-4 overflow-hidden card-premium mb-4 hover:border-white/[0.08] transition-all duration-200">
              <div className="relative z-10">
                <p className="text-[0.55rem] font-bold text-white/20 uppercase tracking-[1.5px] mb-3 flex items-center">
                  Firm Rules
                  <span className="ml-2 px-2 py-0.5 rounded text-[0.45rem] font-bold uppercase tracking-[1px] bg-white/[0.03] border border-white/[0.04] text-white/20">Reference Only</span>
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
                    <span className="text-[0.55rem] text-white/30 uppercase tracking-wide">Maximum Contracts</span>
                    <span className="text-sm font-bold font-mono text-white/40">{selectedPreset.maxContracts}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
                    <span className="text-[0.55rem] text-white/30 uppercase tracking-wide">Daily Loss Limit</span>
                    <span className="text-sm font-bold font-mono text-white/40">${selectedPreset.dailyLossLimit?.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-[0.55rem] text-white/30 uppercase tracking-wide">Trailing Drawdown</span>
                    <span className="text-sm font-bold font-mono text-white/40">${selectedPreset.maxDrawdown?.toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-[0.45rem] text-white/10 mt-3 text-center italic">
                  Verify against your account agreement. Last checked: {selectedPreset.lastVerifiedAt}
                </p>
              </div>
            </div>
          )}

          {/* Next button */}
          <button
            onClick={handleNextToPlain}
            disabled={firm !== 'personal' && firm !== 'other' && !accountSize && accountSizes.length > 0}
            className="w-full py-4 text-sm font-bold uppercase tracking-[3px] rounded-xl press-scale disabled:opacity-20 disabled:cursor-not-allowed mt-4 transition-all duration-200 hover:-translate-y-[1px]"
            style={{
              background: (firm !== 'personal' && firm !== 'other' && !accountSize && accountSizes.length > 0)
                ? 'rgba(255,255,255,0.05)'
                : `linear-gradient(135deg, ${colors.primary}dd, ${colors.secondary}cc)`,
              color: (firm !== 'personal' && firm !== 'other' && !accountSize && accountSizes.length > 0)
                ? 'rgba(255,255,255,0.3)'
                : '#ffffff',
              boxShadow: (firm !== 'personal' && firm !== 'other' && !accountSize && accountSizes.length > 0)
                ? 'none'
                : `0 0 20px ${colors.primary}30`,
            }}
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
      <div className="relative z-10 w-full max-w-xl px-8 py-6 animate-reveal">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-[1.7rem] font-black tracking-tight text-gradient mb-1">My Trading Plan</h1>
          <p className="text-[0.65rem] text-white/25 uppercase tracking-[2px]">Step 2 of 2</p>
          <p className="text-[0.75rem] text-white/25 mt-2.5">These are your long-term trading rules.</p>
        </div>

        {/* Plan fields */}
        <div className="relative rounded-xl p-6 overflow-hidden card-premium mb-5 hover:border-white/[0.08] transition-all duration-200">
          <div className="relative z-10 space-y-6">
            {/* Max Contracts */}
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-[0.7rem] font-semibold text-white/50">Maximum Contracts</label>
                {selectedPreset && <span className="text-[0.5rem] text-white/15">Firm allows: {selectedPreset.maxContracts}</span>}
              </div>
              <input
                type="number" min="1" max="50" value={maxContracts}
                onChange={(e) => setMaxContracts(e.target.value)}
                className="w-20 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-3.5 text-white font-mono text-base font-bold text-center focus:outline-none transition-all duration-200 input-premium"
              />
            </div>

            {/* Daily Loss */}
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-[0.7rem] font-semibold text-white/50">Daily Loss Limit</label>
                {selectedPreset && <span className="text-[0.5rem] text-white/15">Firm: ${selectedPreset.dailyLossLimit?.toLocaleString()}</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-white/30 text-sm font-mono">$</span>
                <input
                  type="number" min="50" step="25" value={dailyLoss}
                  onChange={(e) => setDailyLoss(e.target.value)}
                  className="w-24 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-3.5 text-white font-mono text-base font-bold text-center focus:outline-none transition-all duration-200 input-premium"
                />
              </div>
            </div>

            {/* Max Trades */}
            <div className="flex items-center justify-between">
              <label className="text-[0.7rem] font-semibold text-white/50">Maximum Trades Per Day</label>
              <input
                type="number" min="1" max="50" value={maxTrades}
                onChange={(e) => setMaxTrades(e.target.value)}
                className="w-20 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-3.5 text-white font-mono text-base font-bold text-center focus:outline-none transition-all duration-200 input-premium"
              />
            </div>

            {/* Profit Target */}
            <div className="flex items-center justify-between">
              <label className="text-[0.7rem] font-semibold text-white/50">Profit Target</label>
              <div className="flex items-center gap-1.5">
                <span className="text-white/30 text-sm font-mono">$</span>
                <input
                  type="number" min="50" step="25" value={profitTarget}
                  onChange={(e) => setProfitTarget(e.target.value)}
                  className="w-24 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-3.5 text-white font-mono text-base font-bold text-center focus:outline-none transition-all duration-200 input-premium"
                />
              </div>
            </div>

            {/* Lock Duration */}
            <div className="flex items-center justify-between">
              <label className="text-[0.7rem] font-semibold text-white/50">Default Lock Duration</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="1" max="12" value={lockDuration}
                  onChange={(e) => setLockDuration(e.target.value)}
                  className="w-16 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-3.5 text-white font-mono text-base font-bold text-center focus:outline-none transition-all duration-200 input-premium"
                />
                <span className="text-[0.65rem] text-white/25">hours</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Summary Card */}
        <div className="relative rounded-xl p-4 overflow-hidden card-premium mb-5 hover:border-white/[0.08] transition-all duration-200">
          <div className="relative z-10">
            <p className="text-[0.55rem] font-bold text-white/20 uppercase tracking-[1.5px] mb-3">Today's Default Plan</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[0.65rem] text-white/35">
              <span>• <span className="font-mono font-bold text-white/50">{maxContracts || '—'}</span> Contracts</span>
              <span>• <span className="font-mono font-bold text-white/50">${dailyLoss || '—'}</span> Daily Loss</span>
              <span>• <span className="font-mono font-bold text-white/50">{maxTrades || '—'}</span> Max Trades</span>
              <span>• <span className="font-mono font-bold text-white/50">${profitTarget || '—'}</span> Profit Target</span>
              <span>• <span className="font-mono font-bold text-white/50">{lockDuration || '—'}h</span> Lock</span>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="relative rounded-xl p-4 overflow-hidden mb-5" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="relative z-10">
            <p className="text-[0.6rem] font-bold text-white/20 uppercase tracking-[1px] mb-1.5">Your Trading Plan</p>
            <p className="text-[0.6rem] text-white/25 leading-relaxed">
              Trading Readiness may temporarily tighten these limits before each session, but your Trading Plan always remains your baseline. You can edit it anytime from the Protection page.
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setStep('profile')}
            className="px-6 py-4 text-xs font-bold uppercase tracking-[1.5px] rounded-xl text-white/30 hover:text-white/50 transition-all duration-200"
          >
            ← Back
          </button>
          <button
            onClick={handleSave}
            disabled={!maxContracts || !dailyLoss}
            className="flex-1 py-4 text-sm font-bold uppercase tracking-[3px] rounded-xl press-scale disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-[1px]"
            style={{
              background: (!maxContracts || !dailyLoss)
                ? 'rgba(255,255,255,0.05)'
                : `linear-gradient(135deg, ${colors.primary}dd, ${colors.secondary}cc)`,
              color: (!maxContracts || !dailyLoss)
                ? 'rgba(255,255,255,0.3)'
                : '#ffffff',
              boxShadow: (!maxContracts || !dailyLoss)
                ? 'none'
                : `0 0 20px ${colors.primary}30`,
            }}
          >
            Save Plan
          </button>
        </div>
      </div>
    </div>
  );
};
