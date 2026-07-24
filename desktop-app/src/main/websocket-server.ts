import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { LockManager } from './lock-manager';
import { DatabaseManager } from './database';
import crypto from 'crypto';

export class WebSocketServer {
  private wss: WSServer;
  private lockManager: LockManager;
  private db: DatabaseManager;
  private clients: Set<WebSocket> = new Set();
  private authToken: string;

  constructor(lockManager: LockManager, db: DatabaseManager) {
    this.lockManager = lockManager;
    this.db = db;
    this.authToken = crypto.randomBytes(32).toString('hex');
    this.wss = new WSServer({ port: 47392, host: '127.0.0.1' });
    this.wss.on('connection', (ws) => this.handleConnection(ws));
    this.wss.on('error', (error) => console.error('WebSocket server error:', error));
  }

  private handleConnection(ws: WebSocket): void {
    this.clients.add(ws);
    ws.on('message', (data) => {
      try { this.handleMessage(ws, JSON.parse(data.toString())); }
      catch { ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' })); }
    });
    ws.on('close', () => {
      this.clients.delete(ws);
      // Only trigger if locked AND no other clients connected
      if (this.lockManager.isLocked() && this.clients.size === 0) {
        this.db.logActivity('extension_disconnected', 'Extension disconnected while locked');
        if (this.onExtensionDisconnected) this.onExtensionDisconnected();
      }
    });
    ws.on('error', () => this.clients.delete(ws));
    ws.send(JSON.stringify({ type: 'connected', locked: this.lockManager.isLocked(), token: this.authToken }));

    // Send position limits on connection
    const settings = this.db.getSettings();
    let limitsData = { limits: [], defaultMax: 2 };
    try { if (settings.position_limits) limitsData = JSON.parse(settings.position_limits); } catch {}
    ws.send(JSON.stringify({ type: 'position_limits', ...limitsData }));
  }

  private handleMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'check_lock':
        const state = this.lockManager.getState();
        ws.send(JSON.stringify({ type: 'lock_state', locked: state.isLocked, settings: state.isLocked ? { ...state.settings, resetTimeISO: state.resetTime, timeRemaining: state.timeRemaining } : null }));
        break;
      case 'report_bypass':
        if (this.lockManager.isLocked()) { this.lockManager.recordBypassAttempt(message.details || 'Browser bypass attempt'); ws.send(JSON.stringify({ type: 'bypass_recorded' })); }
        break;
      case 'report_settings_access':
        if (this.lockManager.isLocked()) { this.db.logActivity('settings_access_blocked', `Extension: ${message.url || 'risk settings'}`); }
        ws.send(JSON.stringify({ type: 'access_blocked_recorded' }));
        break;
      case 'tradovate_settings_read':
        // Auto-sync: Tradovate's current risk settings have been read by the extension
        console.log('Received Tradovate risk settings:', message.settings);
        this.db.logActivity('tradovate_settings_read', JSON.stringify(message.settings));
        // Broadcast to the desktop app UI
        this.broadcastTradovateSettings(message.settings);
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', locked: this.lockManager.isLocked() }));
        break;
      case 'tilt_update':
        if (this.onTiltUpdate) this.onTiltUpdate(message);
        break;
      case 'check_session':
        ws.send(JSON.stringify(this.getSessionState()));
        break;
    }
  }

  broadcastLockChange(): void {
    const msg = JSON.stringify({ type: 'lock_state_changed', locked: this.lockManager.isLocked() });
    this.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
  }

  broadcastSessionChange(): void {
    const msg = JSON.stringify(this.getSessionState());
    this.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
  }

  broadcastCoachConfig(config: any): void {
    const msg = JSON.stringify({ type: 'coach_config', ...config });
    this.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
  }

  broadcastPositionLimits(): void {
    const settings = this.db.getSettings();
    let limitsData: any = { limits: [], defaultMax: 2, blockedSymbols: [] };
    try {
      if (settings.position_limits) {
        const parsed = JSON.parse(settings.position_limits);
        limitsData = { ...limitsData, ...parsed };
      }
    } catch {}
    const msg = JSON.stringify({ type: 'position_limits', ...limitsData });
    this.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
  }

  broadcastTradovateSettings(settings: any): void {
    // Send to the Electron renderer via IPC (will be handled in index.ts)
    if (this.onTradovateSettingsRead) {
      this.onTradovateSettingsRead(settings);
    }
  }

  onTradovateSettingsRead: ((settings: any) => void) | null = null;
  onExtensionDisconnected: (() => void) | null = null;
  onTiltUpdate: ((data: any) => void) | null = null;

  private getSessionState(): any {
    const settings = this.db.getSettings();
    const enabled = settings?.session_enabled === 1;
    let blocked = false;
    if (enabled) {
      const now = new Date();
      const [sh, sm] = (settings.session_start || '08:30').split(':').map(Number);
      const [eh, em] = (settings.session_end || '16:00').split(':').map(Number);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      blocked = currentMinutes < (sh * 60 + sm) || currentMinutes >= (eh * 60 + em);
    }
    return {
      type: 'session_state',
      enabled,
      blocked,
      sessionHours: enabled ? { startHour: parseInt(settings.session_start), startMin: parseInt(settings.session_start?.split(':')[1] || '0'), endHour: parseInt(settings.session_end), endMin: parseInt(settings.session_end?.split(':')[1] || '0') } : null,
    };
  }

  getAuthToken(): string { return this.authToken; }
  close(): void { this.wss.close(); }
}
