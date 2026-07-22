import { exec } from 'child_process';
import { DatabaseManager } from './database';

/**
 * ProcessBlocker monitors running processes and kills trading apps
 * that launch outside allowed session hours.
 * 
 * Blocks: Tradesea, TopstepX desktop apps
 * Only active when session hours feature is enabled
 */
export class ProcessBlocker {
  private db: DatabaseManager;
  private interval: NodeJS.Timeout | null = null;
  private enabled: boolean = false;
  private startMinutes: number = 510; // 8:30 AM
  private endMinutes: number = 960; // 4:00 PM

  // Process names to block (case-insensitive matching)
  private blockedProcesses = [
    'tradesea',
    'TopstepX',
    'topstepx',
    'ProjectX',
    'projectx',
  ];

  constructor(db: DatabaseManager) {
    this.db = db;
    this.loadSettings();
  }

  loadSettings(): void {
    const settings = this.db.getSettings();
    if (settings) {
      this.enabled = settings.session_enabled === 1;
      const [sh, sm] = (settings.session_start || '08:30').split(':').map(Number);
      const [eh, em] = (settings.session_end || '16:00').split(':').map(Number);
      this.startMinutes = sh * 60 + sm;
      this.endMinutes = eh * 60 + em;
    }
  }

  start(): void {
    // Check every 5 seconds
    this.interval = setInterval(() => {
      this.loadSettings();
      if (this.enabled && this.isOutsideHours()) {
        this.checkAndKillProcesses();
      }
    }, 5000);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private isOutsideHours(): boolean {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return currentMinutes < this.startMinutes || currentMinutes >= this.endMinutes;
  }

  private checkAndKillProcesses(): void {
    // Use tasklist to get running processes
    exec('tasklist /FO CSV /NH', (error, stdout) => {
      if (error) return;

      const lines = stdout.split('\n');
      for (const line of lines) {
        const processName = line.split(',')[0]?.replace(/"/g, '').toLowerCase() || '';

        for (const blocked of this.blockedProcesses) {
          if (processName.includes(blocked.toLowerCase())) {
            this.killProcess(processName);
          }
        }
      }
    });
  }

  private killProcess(name: string): void {
    exec(`taskkill /IM "${name}" /F`, (error) => {
      if (!error) {
        this.db.logActivity('process_blocked', `Killed ${name} — outside allowed trading hours`);
      }
    });
  }
}
