import bcrypt from 'bcryptjs';
import { DateTime } from 'luxon';
import * as schedule from 'node-schedule';
import { DatabaseManager } from './database';

export interface RiskSettings {
  dailyLossLimit: number;
  dailyProfitTarget: number;
  maxContracts: number;
  // For "Until Time" mode display only (not used for scheduling after lockExpiresAt is set)
  resetTime: string;
  resetTimezone: string;
  // NEW: Absolute expiry timestamp (used for ALL scheduling)
  lockExpiresAt?: string;
  lockMode?: 'duration' | 'time';
  platform: 'web' | 'desktop' | 'pwa';
}

export interface LockState {
  isLocked: boolean;
  sessionEnded: boolean;
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
  private sessionEnded: boolean = false;
  private currentSettings: RiskSettings | null = null;
  private lockTime: string | null = null;
  private lockExpiresAt: string | null = null;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.restoreState();
    this.scheduleReset();
  }

  private restoreState(): void {
    const state = this.db.getLockState();
    if (state && state.is_locked) {
      this.locked = true;
      this.sessionEnded = state.session_ended === 1;
      this.lockTime = state.lock_time;
      this.lockExpiresAt = state.reset_time; // Stored as ISO timestamp
      this.currentSettings = {
        dailyLossLimit: state.daily_loss_limit,
        dailyProfitTarget: state.daily_profit_target,
        maxContracts: state.max_contracts,
        resetTime: state.reset_time?.split('T')[1]?.substring(0, 5) || '17:00',
        resetTimezone: state.reset_timezone || 'America/New_York',
        platform: (state.platform as any) || 'web',
      };
      // Check if lock has already expired
      if (this.lockExpiresAt) {
        const expiryDT = DateTime.fromISO(this.lockExpiresAt);
        if (DateTime.now() > expiryDT) {
          this.performReset();
        }
      }
    }
  }

  private scheduleReset(): void {
    if (!this.locked || !this.lockExpiresAt) return;
    if (this.resetJob) { this.resetJob.cancel(); }

    const expiryDT = DateTime.fromISO(this.lockExpiresAt);

    // If already expired, reset immediately
    if (expiryDT <= DateTime.now()) {
      this.performReset();
      return;
    }

    // Schedule job at the absolute expiry time
    this.resetJob = schedule.scheduleJob(expiryDT.toJSDate(), () => { this.performReset(); });
  }

  private performReset(): void {
    this.locked = false;
    this.sessionEnded = false;
    this.lockTime = null;
    this.lockExpiresAt = null;
    this.currentSettings = null;
    this.db.saveLockState({ isLocked: false, sessionEnded: false, lockTime: null, resetTime: null, resetTimezone: null, dailyLossLimit: null, dailyProfitTarget: null, maxContracts: null, platform: null });
    this.db.resetBypassAttempts();
    this.db.logActivity('auto_reset', 'Lock automatically reset at scheduled time');
    if (this.resetJob) { this.resetJob.cancel(); this.resetJob = null; }
  }

  private saveState(): void {
    this.db.saveLockState({
      isLocked: this.locked, sessionEnded: this.sessionEnded, lockTime: this.lockTime, resetTime: this.lockExpiresAt,
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

    // Simple: lockExpiresAt - now = seconds remaining
    if (this.locked && this.lockExpiresAt) {
      const diff = DateTime.fromISO(this.lockExpiresAt).diff(DateTime.now(), 'seconds');
      timeRemaining = Math.max(0, Math.floor(diff.seconds));
    }

    return {
      isLocked: this.locked, sessionEnded: this.sessionEnded, settings: this.currentSettings, lockTime: this.lockTime,
      resetTime: this.lockExpiresAt, timeRemaining, bypassAttempts: this.db.getBypassAttemptCount(),
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

    // Calculate lockExpiresAt based on mode
    if (settings.lockExpiresAt) {
      // Frontend already calculated the absolute timestamp (duration mode)
      this.lockExpiresAt = settings.lockExpiresAt;
    } else if (settings.resetTime) {
      // "Until Time" mode - convert HH:MM in timezone to absolute timestamp ONCE
      const [hours, minutes] = settings.resetTime.split(':').map(Number);
      const timezone = settings.resetTimezone || 'America/New_York';
      let resetDT = DateTime.now().setZone(timezone).set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
      // If this time has already passed today in the target timezone, schedule for tomorrow
      if (resetDT <= DateTime.now()) {
        resetDT = resetDT.plus({ days: 1 });
      }
      this.lockExpiresAt = resetDT.toISO();
    } else {
      // Fallback: 4 hours from now
      this.lockExpiresAt = DateTime.now().plus({ hours: 4 }).toISO();
    }

    this.saveState();
    this.scheduleReset();
    this.db.logActivity('lock_activated', JSON.stringify({ ...settings, lockExpiresAt: this.lockExpiresAt }));
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

  endSession(): { success: boolean; error?: string } {
    if (!this.locked) return { success: false, error: 'No active session to end' };
    if (this.sessionEnded) return { success: false, error: 'Session already ended' };
    this.sessionEnded = true;
    this.saveState();
    this.db.logActivity('session_ended', 'User ended session — new entries blocked, exits allowed, lock remains until ' + (this.lockExpiresAt || 'scheduled reset'));
    return { success: true };
  }

  isSessionEnded(): boolean { return this.sessionEnded; }

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
    return { cooldownHours: s.cooldown_hours, startWithWindows: s.start_with_windows === 1, minimizeToTray: s.minimize_to_tray === 1, trustedPersonEnabled: s.trusted_person_enabled === 1, killBrowserOnBypass: s.kill_browser_on_bypass === 1, soundOnBlock: s.sound_on_block === 1 };
  }

  updateSettings(newSettings: any): { success: boolean } {
    if (this.locked && (newSettings.cooldownHours !== undefined || newSettings.trustedPersonEnabled !== undefined)) return { success: false };
    this.db.updateSettings(newSettings);
    return { success: true };
  }

  recordBypassAttempt(details: string, logIt: boolean = true): void {
    this.db.incrementBypassAttempts();
    if (logIt) this.db.logActivity('bypass_attempt', details);
  }
}
