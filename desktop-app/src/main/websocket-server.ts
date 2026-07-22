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
    ws.on('close', () => this.clients.delete(ws));
    ws.on('error', () => this.clients.delete(ws));
    ws.send(JSON.stringify({ type: 'connected', locked: this.lockManager.isLocked(), token: this.authToken }));
  }

  private handleMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'check_lock':
        ws.send(JSON.stringify({ type: 'lock_state', locked: this.lockManager.isLocked(), settings: this.lockManager.isLocked() ? this.lockManager.getState().settings : null }));
        break;
      case 'report_bypass':
        if (this.lockManager.isLocked()) { this.lockManager.recordBypassAttempt(message.details || 'Browser bypass attempt'); ws.send(JSON.stringify({ type: 'bypass_recorded' })); }
        break;
      case 'report_settings_access':
        if (this.lockManager.isLocked()) { this.db.logActivity('settings_access_blocked', `Extension: ${message.url || 'risk settings'}`); }
        ws.send(JSON.stringify({ type: 'access_blocked_recorded' }));
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', locked: this.lockManager.isLocked() }));
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
