import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getLockState: () => ipcRenderer.invoke('get-lock-state'),
  lockSettings: (settings: any) => ipcRenderer.invoke('lock-settings', settings),
  unlockSettings: (password?: string) => ipcRenderer.invoke('unlock-settings', password),
  requestEarlyUnlock: (reason: string) => ipcRenderer.invoke('request-early-unlock', reason),
  setTrustedPassword: (password: string) => ipcRenderer.invoke('set-trusted-password', password),
  removeTrustedPassword: (password: string) => ipcRenderer.invoke('remove-trusted-password', password),
  getActivityLog: (limit?: number) => ipcRenderer.invoke('get-activity-log', limit),
  getDisciplineScore: () => ipcRenderer.invoke('get-discipline-score'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: any) => ipcRenderer.invoke('update-settings', settings),
  getBypassAttempts: () => ipcRenderer.invoke('get-bypass-attempts'),
  getSessionHours: () => ipcRenderer.invoke('get-session-hours'),
  updateSessionHours: (hours: any) => ipcRenderer.invoke('update-session-hours', hours),
  getPositionLimits: () => ipcRenderer.invoke('get-position-limits'),
  updatePositionLimits: (limits: any) => ipcRenderer.invoke('update-position-limits', limits),
  getCoachConfig: () => ipcRenderer.invoke('get-coach-config'),
  updateCoachConfig: (config: any) => ipcRenderer.invoke('update-coach-config', config),
  onTradovateSettingsSynced: (callback: (settings: any) => void) => {
    ipcRenderer.on('tradovate-settings-synced', (_event, settings) => callback(settings));
  },
  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback: (status: any) => void) => {
    ipcRenderer.on('update-status', (_event, status) => callback(status));
  },
  // Tilt meter
  onTiltUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('tilt-update', (_event, data) => callback(data));
  },
  // Extension disconnected warning
  onExtensionDisconnected: (callback: () => void) => {
    ipcRenderer.on('extension-disconnected', () => callback());
  },
  // Exit fullscreen
  exitFullscreen: () => ipcRenderer.invoke('exit-fullscreen'),
  // Shutdown PC
  shutdownPC: () => ipcRenderer.invoke('shutdown-pc'),
  // Dev force unlock
  devForceUnlock: () => ipcRenderer.invoke('dev-force-unlock'),
});
