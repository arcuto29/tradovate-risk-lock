import bcrypt from 'bcryptjs';
import { DateTime } from 'luxon';
import * as schedule from 'node-schedule';
import { DatabaseManager } from './database';

export interface RiskSettings {
  dailyLossLimit: number;
  dailyProfitTarget: number;
  maxContracts: number;
  resetTime: string;
  resetTimezone: string;
  platform: 'web' | 'desktop' | 'pwa';
}

export interface LockState {
  isLocked: boolean;
  settings: RiskSettings | null;
  lockTime: string | null;
  resetTime: string | null;
  timeRemaining: number | null;
  bypassAttempts: number;
  earlyUnlockRequest: any | null;
  trustedPersonEnabled: boolean;
}

export class LockManager {
  private db: DatabaseManager;
  private resetJob: schedule.Job | null = null;
  private locked: boolean = false;
  private currentSettings: RiskSettings | null = null;
  private lockTime: string | null = null;
  private scheduledResetTime: string | null = null;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.restoreState();
    this.scheduleReset();
  }

  private restoreState(): void {
    const state = this.db.getLockState();
    if (state && state.is_locked) {
      this.locked = true;
      this.lockTime = state.lock_time;
      this.scheduledResetTime = state.reset_time;
      this.currentSettings = {
        dailyLossLimit: state.daily_loss_limit,
        dailyProfitTarget: state.daily_profit_target,
        maxContracts: state.max_contracts,
        resetTime: state.reset_time?.split('T')[1]?.substring(0, 5) || '17:00',
        resetTimezone: state.reset_timezone || 'America/New_York',
        platform: (state.platform as any) || 'web',
      };
      if (this.scheduledResetTime) {
        const resetDT = DateTime.fromISO(this.scheduledResetTime);
        if (DateTime.now() > resetDT) { this.performReset(); }
      }
    }
  }

  private scheduleReset(): void {
    if (!this.locked || !this.currentSettings) return;
    if (this.resetJob) { this.resetJob.cancel(); }

    const [hours, minutes] = this.currentSettings.resetTime.split(':').map(Number);
    const timezone = this.currentSettings.resetTimezone;

    let resetDT = DateTime.now().setZone(timezone).set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
    if (resetDT < DateTime.now().setZone(timezone)) {
      const lockDT = this.lockTime ? DateTime.fromISO(this.lockTime) : null;
      if (lockDT && lockDT < resetDT) { this.performReset(); return; }
      resetDT = resetDT.plus({ days: 1 });
    }

    this.scheduledResetTime = resetDT.toISO();
    this.saveState();
    this.resetJob = schedule.scheduleJob(resetDT.toJSDate(), () => { this.performReset(); });
  }

  private performReset(): void {
    this.locked = false;
    this.lockTime = null;
    this.scheduledResetTime = null;
    this.currentSettings = null;
    this.db.saveLockState({ isLocked: false, lockTime: null, resetTime: null, resetTimezone: null, dailyLossLimit: null, dailyProfitTarget: null, maxContracts: null, platform: null });
    this.db.resetBypassAttempts();
    this.db.logActivity('auto_reset', 'Lock automatically reset at scheduled time');
    if (this.resetJob) { this.resetJob.cancel(); this.resetJob = null; }
  }

  private saveState(): void {
    this.db.saveLockState({
      isLocked: this.locked, lockTime: this.lockTime, resetTime: this.scheduledResetTime,
      resetTimezone: this.currentSettings?.resetTimezone || null,
      dailyLossLimit: this.currentSettings?.dailyLossLimit || null,
      dailyProfitTarget: this.currentSettings?.dailyProfitTarget || null,
      maxContracts: this.currentSettings?.maxContracts || null,
      platform: this.currentSettings?.platform || null,
    });
  }

  isLocked(): boolean { return this.locked; }

  getState(): LockState {
    const settings = this.db.getSettings();
    let timeRemaining: number | null = null;
    if (this.locked && this.scheduledResetTime) {
      const diff = DateTime.fromISO(this.scheduledResetTime).diff(DateTime.now(), 'seconds');
      timeRemaining = Math.max(0, Math.floor(diff.seconds));
    }
    return {
      isLocked: this.locked, settings: this.currentSettings, lockTime: this.lockTime,
      resetTime: this.scheduledResetTime, timeRemaining, bypassAttempts: this.db.getBypassAttemptCount(),
      earlyUnlockRequest: this.db.getActiveUnlockRequest(),
      trustedPersonEnabled: settings?.trusted_person_enabled === 1,
    };
  }

  lock(settings: RiskSettings): { success: boolean; error?: string } {
    if (this.locked) return { success: false, error: 'Settings are already locked' };
    if (settings.dailyLossLimit <= 0 && settings.dailyProfitTarget <= 0 && settings.maxContracts <= 0) {
      return { success: false, error: 'At least one risk limit must be greater than zero' };
    }
    this.locked = true;
    this.currentSettings = settings;
    this.lockTime = DateTime.now().toISO();
    this.saveState();
    this.scheduleReset();
    this.db.logActivity('lock_activated', JSON.stringify(settings));
    return { success: true };
  }

  unlock(password?: string): { success: boolean; error?: string } {
    if (!this.locked) return { success: false, error: 'Settings are not locked' };
    const settings = this.db.getSettings();

    if (settings.trusted_person_enabled) {
      if (!password) return { success: false, error: 'Trusted person password required' };
      const hash = this.db.getTrustedPasswordHash();
      if (!hash) return { success: false, error: 'No trusted person password configured' };
      if (!bcrypt.compareSync(password, hash)) {
        this.db.incrementBypassAttempts();
        this.db.logActivity('unlock_failed', 'Invalid trusted person password provided');
        return { success: false, error: 'Invalid password' };
      }
      this.db.logActivity('trusted_unlock', 'Lock removed by trusted person');
    } else {
      const request = this.db.getActiveUnlockRequest();
      if (!request) return { success: false, error: 'Submit an early unlock request first' };
      const availableAt = DateTime.fromISO(request.available_at);
      if (DateTime.now() < availableAt) {
        const remaining = availableAt.diff(DateTime.now(), ['hours', 'minutes']);
        return { success: false, error: `Cooldown not complete. ${Math.floor(remaining.hours)}h ${Math.floor(remaining.minutes)}m remaining` };
      }
      this.db.resolveUnlockRequest(request.id, true);
      this.db.logActivity('early_unlock', 'Lock removed via early unlock request after cooldown');
    }
    this.performReset();
    return { success: true };
  }

  forceUnlock(): void {
    this.performReset();
    this.db.logActivity('dev_force_unlock', 'Force unlocked via dev shortcut');
  }

  requestEarlyUnlock(reason: string): { success: boolean; error?: string } {
    if (!this.locked) return { success: false, error: 'Settings are not locked' };
    if (!reason || reason.trim().length < 10) return { success: false, error: 'Please provide a detailed reason (at least 10 characters)' };
    const existing = this.db.getActiveUnlockRequest();
    if (existing) return { success: false, error: 'An early unlock request is already pending' };
    const settings = this.db.getSettings();
    const cooldownHours = settings.cooldown_hours || 12;
    const availableAt = DateTime.now().plus({ hours: cooldownHours }).toISO()!;
    this.db.saveEarlyUnlockRequest(reason, cooldownHours, availableAt);
    this.db.logActivity('early_unlock_request', `Reason: ${reason}. Cooldown: ${cooldownHours}h`);
    return { success: true };
  }

  setTrustedPassword(password: string): { success: boolean; error?: string } {
    if (this.locked) return { success: false, error: 'Cannot change trusted person settings while locked' };
    if (!password || password.length < 6) return { success: false, error: 'Password must be at least 6 characters' };
    const hash = bcrypt.hashSync(password, 12);
    this.db.updateSettings({ trustedPersonEnabled: true, trustedPasswordHash: hash });
    this.db.logActivity('trusted_person_set', 'Trusted person password configured');
    return { success: true };
  }

  removeTrustedPassword(password: string): { success: boolean; error?: string } {
    if (this.locked) return { success: false, error: 'Cannot change trusted person settings while locked' };
    const hash = this.db.getTrustedPasswordHash();
    if (!hash) return { success: false, error: 'No trusted person password configured' };
    if (!bcrypt.compareSync(password, hash)) return { success: false, error: 'Invalid password' };
    this.db.updateSettings({ trustedPersonEnabled: false, trustedPasswordHash: null });
    this.db.logActivity('trusted_person_removed', 'Trusted person password removed');
    return { success: true };
  }

  getSettings(): any {
    const s = this.db.getSettings();
    return { cooldownHours: s.cooldown_hours, startWithWindows: s.start_with_windows === 1, minimizeToTray: s.minimize_to_tray === 1, trustedPersonEnabled: s.trusted_person_enabled === 1 };
  }

  updateSettings(newSettings: any): { success: boolean } {
    if (this.locked && (newSettings.cooldownHours !== undefined || newSettings.trustedPersonEnabled !== undefined)) return { success: false };
    this.db.updateSettings(newSettings);
    return { success: true };
  }

  recordBypassAttempt(details: string): void {
    this.db.incrementBypassAttempts();
    this.db.logActivity('bypass_attempt', details);
  }
}
