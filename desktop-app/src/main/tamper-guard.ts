import { LockManager } from './lock-manager';
import { DatabaseManager } from './database';

export class TamperGuard {
  private lockManager: LockManager;
  private db: DatabaseManager;
  private monitorInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(lockManager: LockManager, db: DatabaseManager) {
    this.lockManager = lockManager;
    this.db = db;
  }

  start(): void {
    this.monitorInterval = setInterval(() => this.checkIntegrity(), 5000);
    this.heartbeatInterval = setInterval(() => {
      if (this.lockManager.isLocked()) this.db.logActivity('heartbeat', 'Protection service running');
    }, 60000);
    this.db.logActivity('tamper_guard_started', 'Tamper guard monitoring started');
  }

  stop(): void {
    if (this.monitorInterval) { clearInterval(this.monitorInterval); this.monitorInterval = null; }
    if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
  }

  private checkIntegrity(): void {
    const dbState = this.db.getLockState();
    const memoryLocked = this.lockManager.isLocked();
    if (dbState && dbState.is_locked !== (memoryLocked ? 1 : 0)) {
      this.db.logActivity('integrity_violation', `DB state (${dbState.is_locked}) != memory (${memoryLocked})`);
    }
  }
}
