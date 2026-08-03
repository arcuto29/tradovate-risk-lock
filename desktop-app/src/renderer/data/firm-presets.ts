/**
 * Prop Firm Rules Presets
 * 
 * Reference only — never used for protection calculations.
 * The user's Trading Plan is always the baseline.
 * 
 * These presets are versioned and should be periodically verified.
 * Display: "Confirm these limits against your current account agreement."
 */

export interface FirmRulesPreset {
  id: string;
  firm: string;
  platform?: string;
  program: string;
  stage: string;
  accountSize: string;
  maxContracts?: number;
  dailyLossLimit?: number;
  maxDrawdown?: number;
  drawdownType?: 'static' | 'intraday_trailing' | 'eod_trailing';
  effectiveDate: string;
  lastVerifiedAt: string;
  sourceLabel: string;
}

export const FIRM_PRESETS: FirmRulesPreset[] = [
  // ─── TopstepX ──────────────────────────────────────────────────────────
  { id: 'topstepx-50k-eval', firm: 'topstepx', program: 'Trading Combine', stage: 'evaluation', accountSize: '50k', maxContracts: 5, dailyLossLimit: 1000, maxDrawdown: 2000, drawdownType: 'intraday_trailing', effectiveDate: '2025-01-01', lastVerifiedAt: '2025-07-01', sourceLabel: 'TopstepX website' },
  { id: 'topstepx-50k-funded', firm: 'topstepx', program: 'Express Funded', stage: 'funded', accountSize: '50k', maxContracts: 5, dailyLossLimit: 1000, maxDrawdown: 2000, drawdownType: 'eod_trailing', effectiveDate: '2025-01-01', lastVerifiedAt: '2025-07-01', sourceLabel: 'TopstepX website' },
  { id: 'topstepx-100k-eval', firm: 'topstepx', program: 'Trading Combine', stage: 'evaluation', accountSize: '100k', maxContracts: 10, dailyLossLimit: 2000, maxDrawdown: 3000, drawdownType: 'intraday_trailing', effectiveDate: '2025-01-01', lastVerifiedAt: '2025-07-01', sourceLabel: 'TopstepX website' },
  { id: 'topstepx-100k-funded', firm: 'topstepx', program: 'Express Funded', stage: 'funded', accountSize: '100k', maxContracts: 10, dailyLossLimit: 2000, maxDrawdown: 3000, drawdownType: 'eod_trailing', effectiveDate: '2025-01-01', lastVerifiedAt: '2025-07-01', sourceLabel: 'TopstepX website' },
  { id: 'topstepx-150k-eval', firm: 'topstepx', program: 'Trading Combine', stage: 'evaluation', accountSize: '150k', maxContracts: 15, dailyLossLimit: 3000, maxDrawdown: 4500, drawdownType: 'intraday_trailing', effectiveDate: '2025-01-01', lastVerifiedAt: '2025-07-01', sourceLabel: 'TopstepX website' },
  { id: 'topstepx-150k-funded', firm: 'topstepx', program: 'Express Funded', stage: 'funded', accountSize: '150k', maxContracts: 15, dailyLossLimit: 3000, maxDrawdown: 4500, drawdownType: 'eod_trailing', effectiveDate: '2025-01-01', lastVerifiedAt: '2025-07-01', sourceLabel: 'TopstepX website' },

  // ─── Apex Trader Funding ───────────────────────────────────────────────
  { id: 'apex-25k-eval', firm: 'apex', program: 'Evaluation', stage: 'evaluation', accountSize: '25k', maxContracts: 4, dailyLossLimit: 500, maxDrawdown: 1500, drawdownType: 'eod_trailing', effectiveDate: '2025-01-01', lastVerifiedAt: '2025-07-01', sourceLabel: 'Apex website' },
  { id: 'apex-50k-eval', firm: 'apex', program: 'Evaluation', stage: 'evaluation', accountSize: '50k', maxContracts: 6, dailyLossLimit: 1100, maxDrawdown: 2500, drawdownType: 'eod_trailing', effectiveDate: '2025-01-01', lastVerifiedAt: '2025-07-01', sourceLabel: 'Apex website' },
  { id: 'apex-100k-eval', firm: 'apex', program: 'Evaluation', stage: 'evaluation', accountSize: '100k', maxContracts: 12, dailyLossLimit: 2200, maxDrawdown: 3500, drawdownType: 'eod_trailing', effectiveDate: '2025-01-01', lastVerifiedAt: '2025-07-01', sourceLabel: 'Apex website' },
  { id: 'apex-150k-eval', firm: 'apex', program: 'Evaluation', stage: 'evaluation', accountSize: '150k', maxContracts: 15, dailyLossLimit: 3300, maxDrawdown: 5000, drawdownType: 'eod_trailing', effectiveDate: '2025-01-01', lastVerifiedAt: '2025-07-01', sourceLabel: 'Apex website' },
  { id: 'apex-250k-eval', firm: 'apex', program: 'Evaluation', stage: 'evaluation', accountSize: '250k', maxContracts: 22, dailyLossLimit: 5500, maxDrawdown: 6500, drawdownType: 'eod_trailing', effectiveDate: '2025-01-01', lastVerifiedAt: '2025-07-01', sourceLabel: 'Apex website' },
  { id: 'apex-300k-eval', firm: 'apex', program: 'Evaluation', stage: 'evaluation', accountSize: '300k', maxContracts: 25, dailyLossLimit: 6600, maxDrawdown: 7500, drawdownType: 'eod_trailing', effectiveDate: '2025-01-01', lastVerifiedAt: '2025-07-01', sourceLabel: 'Apex website' },

  // ─── Tradeify ──────────────────────────────────────────────────────────
  { id: 'tradeify-50k-eval', firm: 'tradeify', program: 'Evaluation', stage: 'evaluation', accountSize: '50k', maxContracts: 5, dailyLossLimit: 1100, maxDrawdown: 2000, drawdownType: 'eod_trailing', effectiveDate: '2025-01-01', lastVerifiedAt: '2025-07-01', sourceLabel: 'Tradeify website' },
  { id: 'tradeify-100k-eval', firm: 'tradeify', program: 'Evaluation', stage: 'evaluation', accountSize: '100k', maxContracts: 10, dailyLossLimit: 2200, maxDrawdown: 3500, drawdownType: 'eod_trailing', effectiveDate: '2025-01-01', lastVerifiedAt: '2025-07-01', sourceLabel: 'Tradeify website' },
  { id: 'tradeify-150k-eval', firm: 'tradeify', program: 'Evaluation', stage: 'evaluation', accountSize: '150k', maxContracts: 15, dailyLossLimit: 3300, maxDrawdown: 5000, drawdownType: 'eod_trailing', effectiveDate: '2025-01-01', lastVerifiedAt: '2025-07-01', sourceLabel: 'Tradeify website' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

export const SUPPORTED_FIRMS = [
  { id: 'topstepx', label: 'TopstepX' },
  { id: 'apex', label: 'Apex Trader Funding' },
  { id: 'tradeify', label: 'Tradeify' },
  { id: 'personal', label: 'Personal Account' },
  { id: 'other', label: 'Other' },
];

export const ACCOUNT_STAGES = [
  { id: 'evaluation', label: 'Evaluation' },
  { id: 'funded', label: 'Funded' },
  { id: 'live', label: 'Live' },
  { id: 'personal', label: 'Personal' },
];

export function getPresetsForFirm(firm: string): FirmRulesPreset[] {
  return FIRM_PRESETS.filter(p => p.firm === firm);
}

export function getAccountSizesForFirm(firm: string, stage?: string): string[] {
  const presets = FIRM_PRESETS.filter(p => p.firm === firm && (!stage || p.stage === stage));
  return [...new Set(presets.map(p => p.accountSize))];
}

export function findPreset(firm: string, accountSize: string, stage: string): FirmRulesPreset | undefined {
  return FIRM_PRESETS.find(p => p.firm === firm && p.accountSize === accountSize && p.stage === stage);
}

/**
 * Calculate conservative default plan from firm preset.
 * Uses ~40% of firm maximums as starting point.
 */
export function calculateDefaultPlan(preset: FirmRulesPreset): {
  maxContracts: number; dailyLoss: number; maxTrades: number; profitTarget: number;
} {
  const maxContracts = Math.max(1, Math.floor((preset.maxContracts || 5) * 0.4));
  const dailyLoss = Math.max(100, Math.floor(((preset.dailyLossLimit || 1000) * 0.4) / 25) * 25);
  const maxTrades = 3;
  const profitTarget = Math.max(100, Math.floor(((preset.dailyLossLimit || 1000) * 0.5) / 25) * 25);
  return { maxContracts, dailyLoss, maxTrades, profitTarget };
}
