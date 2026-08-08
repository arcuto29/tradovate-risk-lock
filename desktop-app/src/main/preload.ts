import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // License
  checkLicense: () => ipcRenderer.invoke('check-license'),
  activateLicense: (key: string) => ipcRenderer.invoke('activate-license', key),
  getLicenseInfo: () => ipcRenderer.invoke('get-license-info'),
  generateKey: () => ipcRenderer.invoke('generate-key'),
  // App
  getLockState: () => ipcRenderer.invoke('get-lock-state'),
  lockSettings: (settings: any) => ipcRenderer.invoke('lock-settings', settings),
  unlockSettings: (password?: string) => ipcRenderer.invoke('unlock-settings', password),
  requestEarlyUnlock: (reason: string) => ipcRenderer.invoke('request-early-unlock', reason),
  setTrustedPassword: (password: string) => ipcRenderer.invoke('set-trusted-password', password),
  removeTrustedPassword: (password: string) => ipcRenderer.invoke('remove-trusted-password', password),
  getActivityLog: (limit?: number) => ipcRenderer.invoke('get-activity-log', limit),
  getDisciplineScore: () => ipcRenderer.invoke('get-discipline-score'),
  // Platform blocklist
  getPlatforms: () => ipcRenderer.invoke('get-platforms'),
  addCustomPlatform: (platform: any) => ipcRenderer.invoke('add-custom-platform', platform),
  removeCustomPlatform: (id: string) => ipcRenderer.invoke('remove-custom-platform', id),
  updatePlatformEnabled: (id: string, enabled: boolean) => ipcRenderer.invoke('update-platform-enabled', id, enabled),
  // Day rules
  getDayRules: () => ipcRenderer.invoke('get-day-rules'),
  updateDayRules: (rules: any) => ipcRenderer.invoke('update-day-rules', rules),
  // News blocker
  getNewsBlockerConfig: () => ipcRenderer.invoke('get-news-blocker-config'),
  updateNewsBlockerConfig: (config: any) => ipcRenderer.invoke('update-news-blocker-config', config),
  syncForexFactory: () => ipcRenderer.invoke('sync-forex-factory'),
  // Widget
  openWidget: () => ipcRenderer.invoke('open-widget'),
  closeWidget: () => ipcRenderer.invoke('close-widget'),
  // Advanced protection
  getAdvancedConfig: () => ipcRenderer.invoke('get-advanced-config'),
  updateAdvancedConfig: (config: any) => ipcRenderer.invoke('update-advanced-config', config),
  // Trade analytics
  getTrades: (limit?: number) => ipcRenderer.invoke('get-trades', limit),
  getTradeStats: () => ipcRenderer.invoke('get-trade-stats'),
  getTradesByDate: (startDate: string, endDate: string) => ipcRenderer.invoke('get-trades-by-date', startDate, endDate),
  fullDayBlock: () => ipcRenderer.invoke('full-day-block'),
  killSwitch: () => ipcRenderer.invoke('kill-switch'),
  toggleGhostMode: (enabled: boolean) => ipcRenderer.invoke('toggle-ghost-mode', enabled),
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
  // Trading Profile + Plan + Session
  getTradingProfile: () => ipcRenderer.invoke('get-trading-profile'),
  saveTradingProfile: (profile: any) => ipcRenderer.invoke('save-trading-profile', profile),
  getTradingPlan: () => ipcRenderer.invoke('get-trading-plan'),
  saveTradingPlan: (plan: any) => ipcRenderer.invoke('save-trading-plan', plan),
  getDailySessionPlan: (tradingDate: string) => ipcRenderer.invoke('get-daily-session-plan', tradingDate),
  saveDailySessionPlan: (plan: any) => ipcRenderer.invoke('save-daily-session-plan', plan),
  getRecentSessionPlans: (limit?: number) => ipcRenderer.invoke('get-recent-session-plans', limit),
  // Economic Calendar
  economicSync: () => ipcRenderer.invoke('economic-sync'),
  economicGetUpcoming: (limit?: number) => ipcRenderer.invoke('economic-get-upcoming', limit),
  economicGetNextNfp: () => ipcRenderer.invoke('economic-get-next-nfp'),
  economicGetSourceStatuses: () => ipcRenderer.invoke('economic-get-source-statuses'),
  economicGetLastSync: () => ipcRenderer.invoke('economic-get-last-sync'),
  economicGetBlocking: () => ipcRenderer.invoke('economic-get-blocking'),
  // NFP
  nfpGetStatus: () => ipcRenderer.invoke('nfp-get-status'),
  nfpGetSettings: () => ipcRenderer.invoke('nfp-get-settings'),
  nfpSaveSettings: (settings: any) => ipcRenderer.invoke('nfp-save-settings', settings),
});
