/**
 * NFP Detector
 * 
 * Detects NFP week, NFP day, and countdown.
 * Provides protection level recommendations.
 * 
 * NFP = Non-Farm Payrolls (first Friday of each month, 8:30 AM ET)
 */

import { DatabaseManager } from '../database';

export type NfpProtectionLevel = 'none' | 'caution' | 'reduce_size' | 'tighten_loss' | 'avoid_trading';

export interface NfpStatus {
  isNfpWeek: boolean;
  isNfpDay: boolean;
  isNfpBlocking: boolean;
  nextNfpDate: string | null;      // ISO date
  nextNfpTime: string | null;      // ISO datetime UTC
  minutesUntilNfp: number | null;
  blockWindowStart: string | null;  // ISO datetime UTC
  blockWindowEnd: string | null;    // ISO datetime UTC
}

export interface NfpSettings {
  enabled: boolean;
  weekProtection: NfpProtectionLevel;
  dayBlockMinutesBefore: number;
  dayBlockMinutesAfter: number;
  // Protection modifiers for NFP week
  weekSizeReduction: number;        // Percentage to reduce (e.g. 50 = half size)
  weekLossReduction: number;        // Percentage to reduce daily loss
}

const DEFAULT_NFP_SETTINGS: NfpSettings = {
  enabled: true,
  weekProtection: 'caution',
  dayBlockMinutesBefore: 30,
  dayBlockMinutesAfter: 15,
  weekSizeReduction: 50,
  weekLossReduction: 25,
};

export class NfpDetector {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  /** Get current NFP status */
  getStatus(): NfpStatus {
    const nextNfp = this.db.getNextNfpEvent();

    if (!nextNfp) {
      return {
        isNfpWeek: false,
        isNfpDay: false,
        isNfpBlocking: false,
        nextNfpDate: null,
        nextNfpTime: null,
        minutesUntilNfp: null,
        blockWindowStart: null,
        blockWindowEnd: null,
      };
    }

    const now = new Date();
    const nfpTime = new Date(nextNfp.starts_at_utc);
    const nfpDate = nextNfp.starts_at_utc.split('T')[0];
    const todayDate = now.toISOString().split('T')[0];

    // Is it NFP week? (Monday through Friday of the NFP week)
    const nfpDay = nfpTime.getDay(); // Should be 5 (Friday)
    const mondayOfNfpWeek = new Date(nfpTime);
    mondayOfNfpWeek.setDate(nfpTime.getDate() - (nfpDay - 1)); // Go back to Monday
    const fridayOfNfpWeek = new Date(nfpTime);
    fridayOfNfpWeek.setDate(nfpTime.getDate()); // Friday is the NFP day

    const isNfpWeek = now >= mondayOfNfpWeek && todayDate <= nfpDate;
    const isNfpDay = todayDate === nfpDate;

    // Calculate minutes until NFP
    const diffMs = nfpTime.getTime() - now.getTime();
    const minutesUntilNfp = Math.max(0, Math.floor(diffMs / 60000));

    // Block window
    const blockBefore = nextNfp.block_minutes_before || 30;
    const blockAfter = nextNfp.block_minutes_after || 15;
    const blockStart = new Date(nfpTime.getTime() - blockBefore * 60000);
    const blockEnd = new Date(nfpTime.getTime() + blockAfter * 60000);
    const isNfpBlocking = now >= blockStart && now <= blockEnd;

    return {
      isNfpWeek,
      isNfpDay,
      isNfpBlocking,
      nextNfpDate: nfpDate,
      nextNfpTime: nextNfp.starts_at_utc,
      minutesUntilNfp: minutesUntilNfp > 0 ? minutesUntilNfp : null,
      blockWindowStart: blockStart.toISOString(),
      blockWindowEnd: blockEnd.toISOString(),
    };
  }

  /** Get NFP settings from database */
  getSettings(): NfpSettings {
    try {
      const configStr = this.db.getNewsBlockerConfig();
      if (configStr) {
        const config = JSON.parse(configStr);
        if (config.nfpSettings) return { ...DEFAULT_NFP_SETTINGS, ...config.nfpSettings };
      }
    } catch {}
    return DEFAULT_NFP_SETTINGS;
  }

  /** Save NFP settings */
  saveSettings(settings: NfpSettings): void {
    try {
      const configStr = this.db.getNewsBlockerConfig();
      const config = configStr ? JSON.parse(configStr) : {};
      config.nfpSettings = settings;
      this.db.saveNewsBlockerConfig(JSON.stringify(config));
    } catch {}
  }

  /** Calculate protection adjustments for NFP week */
  getWeekAdjustments(settings: NfpSettings, basePlan: { maxContracts: number; dailyLoss: number }): { maxContracts: number; dailyLoss: number } | null {
    if (!settings.enabled || settings.weekProtection === 'none' || settings.weekProtection === 'caution') {
      return null; // No adjustment needed
    }

    const status = this.getStatus();
    if (!status.isNfpWeek) return null;

    if (settings.weekProtection === 'reduce_size') {
      return {
        maxContracts: Math.max(1, Math.floor(basePlan.maxContracts * (1 - settings.weekSizeReduction / 100))),
        dailyLoss: basePlan.dailyLoss,
      };
    }

    if (settings.weekProtection === 'tighten_loss') {
      return {
        maxContracts: Math.max(1, Math.floor(basePlan.maxContracts * (1 - settings.weekSizeReduction / 100))),
        dailyLoss: Math.max(25, Math.floor(basePlan.dailyLoss * (1 - settings.weekLossReduction / 100))),
      };
    }

    if (settings.weekProtection === 'avoid_trading') {
      return { maxContracts: 0, dailyLoss: 0 }; // Signals "don't trade"
    }

    return null;
  }
}
