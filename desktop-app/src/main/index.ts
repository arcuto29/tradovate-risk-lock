import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { DatabaseManager } from './database';
import { LockManager } from './lock-manager';
import { WebSocketServer } from './websocket-server';
import { TamperGuard } from './tamper-guard';
import { ProcessBlocker } from './process-blocker';
import { PlatformBlocker } from './platform-blocker';
import { setupAutoUpdater } from './auto-updater';
import { isActivated, activate, generateLicenseKey, getLicenseInfo } from './license';

// Set app user model ID so Windows can pin it to taskbar
app.setAppUserModelId('com.tradovate-risk-lock.app');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let db: DatabaseManager;
let lockManager: LockManager;
let wsServer: WebSocketServer;
let tamperGuard: TamperGuard;
let processBlocker: ProcessBlocker;
let platformBlocker: PlatformBlocker;
let bypassWarningActive = false;

const isDev = process.env.NODE_ENV === 'development';

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800, height: 850, minWidth: 600, minHeight: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
    title: 'Tradovate Risk Settings Lock', autoHideMenuBar: true,
  });
  mainWindow.setMenu(null);
  if (isDev) { mainWindow.loadURL('http://localhost:5173'); }
  else { mainWindow.loadFile(path.join(__dirname, '../renderer/index.html')); }

  mainWindow.on('close', (event) => {
    if (bypassWarningActive) {
      event.preventDefault(); // Cannot close during bypass warning — trapped
      return;
    }
    if (lockManager.isLocked()) {
      event.preventDefault();
      mainWindow?.hide();
      db.logActivity('app_close_attempt', 'User attempted to close while lock active — minimized to tray');
    }
  });
}

function createTray(): void {
  // Create a 16x16 red square icon programmatically (no external file needed)
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = 239;     // R
    canvas[i * 4 + 1] = 68;  // G
    canvas[i * 4 + 2] = 68;  // B
    canvas[i * 4 + 3] = 255; // A
  }
  const icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });

  tray = new Tray(icon);
  tray.setToolTip('Tradovate Risk Lock');

  updateTrayMenu();

  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function updateTrayMenu(): void {
  if (!tray) return;

  const locked = lockManager?.isLocked() ?? false;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => { mainWindow?.show(); mainWindow?.focus(); },
    },
    { type: 'separator' },
    {
      label: locked ? 'Status: LOCKED' : 'Status: Unlocked',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        if (!locked) {
          app.exit(0);
        } else {
          db.logActivity('quit_attempt', 'User attempted to quit via tray while lock active');
          mainWindow?.show();
          mainWindow?.focus();
        }
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip(locked ? 'Tradovate Risk Lock — LOCKED' : 'Tradovate Risk Lock');
}

function applyStartupSetting(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: ['--hidden'],
  });
}

function setupIPC(): void {
  ipcMain.handle('get-lock-state', () => lockManager.getState());

  // License
  ipcMain.handle('check-license', () => ({ activated: isActivated() }));
  ipcMain.handle('activate-license', (_e, key) => activate(key));
  ipcMain.handle('get-license-info', () => getLicenseInfo());
  ipcMain.handle('generate-key', () => ({ key: generateLicenseKey() }));

  // Full day block (Pre-Market Check)
  ipcMain.handle('full-day-block', () => {
    wsServer.broadcastFullDayBlock();
    db.logActivity('full_day_block', 'Pre-Market Check: user admitted to revenge trading — blocked for the day');
    return { success: true };
  });

  // Kill Switch — immediate 24hr lockout
  ipcMain.handle('kill-switch', () => {
    wsServer.broadcastFullDayBlock();
    db.logActivity('kill_switch', 'User activated kill switch — blocked for 24 hours');
    if (!lockManager.isLocked()) {
      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 24);
      const hours = tomorrow.getHours().toString().padStart(2, '0');
      const mins = tomorrow.getMinutes().toString().padStart(2, '0');
      lockManager.lock({ dailyLossLimit: 1, dailyProfitTarget: 0, maxContracts: 0, resetTime: `${hours}:${mins}`, resetTimezone: 'America/New_York', platform: 'web' });
    }
    return { success: true };
  });

  // Ghost Mode
  ipcMain.handle('toggle-ghost-mode', (_e, enabled) => {
    wsServer.broadcastGhostMode(enabled);
    db.logActivity('ghost_mode', enabled ? 'Ghost mode ON — P&L hidden' : 'Ghost mode OFF');
    return { success: true };
  });
  ipcMain.handle('lock-settings', (_e, settings) => {
    // Apply day rules if applicable
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = DAYS[new Date().getDay()];
    const dayRulesStr = db.getDayRulesConfig();
    if (dayRulesStr) {
      try {
        const dayRules = JSON.parse(dayRulesStr);
        const todayRules = dayRules[today];
        if (todayRules && todayRules.enabled) {
          // Block all trading this day
          if (todayRules.blocked) {
            return { success: false, error: `Trading is blocked on ${today}. You set this rule yourself. Come back tomorrow.` };
          }
          // Auto-tighten: halve max contracts and loss limit
          if (todayRules.tighten) {
            if (settings.maxContracts > 0) settings.maxContracts = Math.max(1, Math.floor(settings.maxContracts / 2));
            if (settings.dailyLossLimit > 0) settings.dailyLossLimit = Math.floor(settings.dailyLossLimit / 2);
          }
          // Override with day-specific values if set
          if (todayRules.lossLimit > 0) settings.dailyLossLimit = todayRules.lossLimit;
          if (todayRules.sessionEnd) settings.resetTime = todayRules.sessionEnd;
          // maxTrades is handled by the extension via position limits broadcast
        }
      } catch {}
    }

    const result = lockManager.lock(settings);
    if (result.success) {
      updateTrayMenu();
      platformBlocker?.activate();
    }
    return result;
  });
  ipcMain.handle('unlock-settings', (_e, password?) => {
    const result = lockManager.unlock(password);
    if (result.success) {
      updateTrayMenu();
      platformBlocker?.deactivate();
    }
    return result;
  });

  // Dev-only force unlock
  ipcMain.handle('dev-force-unlock', () => {
    lockManager.forceUnlock();
    platformBlocker?.deactivate();
    updateTrayMenu();
    return { success: true };
  });

  // Exit fullscreen
  ipcMain.handle('exit-fullscreen', () => {
    bypassWarningActive = false;
    if (mainWindow) {
      mainWindow.setFullScreen(false);
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setClosable(true);
      mainWindow.setMinimizable(true);
    }
    return { success: true };
  });

  // Shutdown PC
  ipcMain.handle('shutdown-pc', () => {
    const { exec } = require('child_process');
    exec('shutdown /s /t 3 /c "Trading Guardian: Stepping away from charts."', () => {});
    return { success: true };
  });
  ipcMain.handle('request-early-unlock', (_e, reason) => lockManager.requestEarlyUnlock(reason));
  ipcMain.handle('set-trusted-password', (_e, password) => lockManager.setTrustedPassword(password));
  ipcMain.handle('remove-trusted-password', (_e, password) => lockManager.removeTrustedPassword(password));
  ipcMain.handle('get-activity-log', (_e, limit) => db.getActivityLog(limit));

  // Discipline Score
  ipcMain.handle('get-discipline-score', () => {
    const log = db.getActivityLog(500);
    const today = new Date().toISOString().split('T')[0];
    const scores: { [date: string]: { score: number; violations: string[] } } = {};

    // Process each log entry into daily scores
    log.forEach((entry: any) => {
      const ts = entry.timestamp || '';
      // SQLite datetime uses space separator, ISO uses T - handle both
      const date = ts.includes('T') ? ts.split('T')[0] : ts.split(' ')[0] || today;
      if (!scores[date]) scores[date] = { score: 100, violations: [] };

      switch (entry.type) {
        case 'bypass_attempt':
          // Only count if not already covered by a specific type
          if (!scores[date].violations.some(v => v.includes('position size') || v.includes('session') || v.includes('symbol'))) {
            scores[date].score -= 10;
            scores[date].violations.push('Rule broken');
          }
          break;
        case 'extension_disconnected':
          scores[date].score -= 25;
          scores[date].violations.push('Extension disabled while locked');
          break;
        case 'session_blocked':
          scores[date].score -= 10;
          scores[date].violations.push('Traded outside session hours');
          break;
        case 'size_blocked':
          scores[date].score -= 10;
          scores[date].violations.push('Exceeded position size limit');
          break;
        case 'symbol_blocked':
          scores[date].score -= 5;
          scores[date].violations.push('Traded a blocked symbol');
          break;
        case 'coach_blocked':
          scores[date].score -= 5;
          scores[date].violations.push('Traded during cooldown');
          break;
        case 'stacking_blocked':
          scores[date].score -= 5;
          scores[date].violations.push('Tried to stack positions');
          break;
        case 'app_close_attempt':
          scores[date].score -= 5;
          scores[date].violations.push('Tried to close app while locked');
          break;
        case 'unlock_failed':
          scores[date].score -= 10;
          scores[date].violations.push('Failed unlock attempt');
          break;
        case 'kill_switch':
          scores[date].score -= 20;
          scores[date].violations.push('Kill switch activated');
          break;
      }

      // Floor at 0
      if (scores[date].score < 0) scores[date].score = 0;
    });

    // Make sure today exists
    if (!scores[today]) scores[today] = { score: 100, violations: [] };

    // Calculate weekly average
    const last7Days: number[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      last7Days.push(scores[key]?.score ?? 100);
    }
    const weeklyAvg = Math.round(last7Days.reduce((a, b) => a + b, 0) / last7Days.length);

    // Calculate monthly average
    const last30Days: number[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      last30Days.push(scores[key]?.score ?? 100);
    }
    const monthlyAvg = Math.round(last30Days.reduce((a, b) => a + b, 0) / last30Days.length);

    // Calculate streak (consecutive days with score >= 80)
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      if ((scores[key]?.score ?? 100) >= 80) streak++;
      else break;
    }

    // Build history
    const history: { date: string; score: number; violations: string[] }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      if (scores[key]) {
        history.push({ date: key, ...scores[key] });
      } else {
        history.push({ date: key, score: 100, violations: [] });
      }
    }

    return {
      todayScore: scores[today].score,
      violations: deduplicateViolations(scores[today].violations),
      weeklyAvg,
      monthlyAvg,
      streak,
      history,
    };
  });

  function deduplicateViolations(violations: string[]): string[] {
    const counts: Record<string, number> = {};
    violations.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    return Object.entries(counts).map(([msg, count]) => count > 1 ? `${msg} (x${count})` : msg);
  }
  ipcMain.handle('get-settings', () => lockManager.getSettings());
  ipcMain.handle('update-settings', (_e, settings) => {
    const result = lockManager.updateSettings(settings);
    if (settings.startWithWindows !== undefined) {
      applyStartupSetting(settings.startWithWindows);
    }
    return result;
  });
  ipcMain.handle('get-bypass-attempts', () => db.getBypassAttemptCount());

  // Session hours
  ipcMain.handle('get-session-hours', () => {
    const settings = db.getSettings();
    const sessionHours = {
      enabled: settings.session_enabled === 1,
      startTime: settings.session_start || '08:30',
      endTime: settings.session_end || '16:00',
      timezone: settings.session_timezone || 'America/New_York',
      currentlyBlocked: false,
    };
    // Check if currently blocked
    if (sessionHours.enabled) {
      const now = new Date();
      const [sh, sm] = sessionHours.startTime.split(':').map(Number);
      const [eh, em] = sessionHours.endTime.split(':').map(Number);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;
      sessionHours.currentlyBlocked = currentMinutes < startMinutes || currentMinutes >= endMinutes;
    }
    return sessionHours;
  });

  ipcMain.handle('update-session-hours', (_e, hours) => {
    const current = db.getSettings();
    db.updateSessionHours(hours);
    db.logActivity('session_hours_updated', JSON.stringify(hours));
    wsServer.broadcastSessionChange();
    return { success: true };
  });

  // Position limits
  ipcMain.handle('get-position-limits', () => {
    const settings = db.getSettings();
    try {
      const limits = settings.position_limits ? JSON.parse(settings.position_limits) : null;
      return limits || { limits: [
        { symbol: 'NQ', maxSize: 1, label: 'NQ (Nasdaq Futures)' },
        { symbol: 'MNQ', maxSize: 5, label: 'MNQ (Micro Nasdaq)' },
        { symbol: 'ES', maxSize: 1, label: 'ES (S&P Futures)' },
        { symbol: 'MES', maxSize: 5, label: 'MES (Micro S&P)' },
      ], defaultMax: 2 };
    } catch { return { limits: [], defaultMax: 2 }; }
  });

  ipcMain.handle('update-position-limits', (_e, limitsData) => {
    db.updatePositionLimits(JSON.stringify(limitsData));
    db.logActivity('position_limits_updated', JSON.stringify(limitsData));
    wsServer.broadcastPositionLimits();
    return { success: true };
  });

  // Psychology coach
  ipcMain.handle('get-coach-config', () => {
    const settings = db.getSettings();
    try {
      const config = settings.coach_config ? JSON.parse(settings.coach_config) : null;
      return config || { enabled: true, maxTradesPerDay: 10, cooldownSeconds: 120, maxDailyLoss: 500 };
    } catch { return { enabled: true, maxTradesPerDay: 10, cooldownSeconds: 120, maxDailyLoss: 500 }; }
  });

  ipcMain.handle('update-coach-config', (_e, config) => {
    db.updateCoachConfig(JSON.stringify(config));
    db.logActivity('coach_config_updated', JSON.stringify(config));
    wsServer.broadcastCoachConfig(config);
    return { success: true };
  });

  // ─── Platform Blocklist ─────────────────────────────────────────────────
  ipcMain.handle('get-platforms', () => {
    return platformBlocker.getPlatforms();
  });

  ipcMain.handle('add-custom-platform', (_e, platform: { name: string; processes: string; domain: string }) => {
    const id = 'custom_' + Date.now();
    const processes = platform.processes ? platform.processes.split(',').map(p => p.trim()).filter(Boolean) : [];
    const domains = platform.domain ? [platform.domain.trim()] : [];
    const newPlatform = { id, name: platform.name, processes, domains };
    db.addCustomPlatform(newPlatform);
    platformBlocker.loadCustomPlatforms(db.getCustomPlatforms());
    db.logActivity('platform_added', `Added custom platform: ${platform.name}`);
    return { success: true, id };
  });

  ipcMain.handle('remove-custom-platform', (_e, id: string) => {
    db.removeCustomPlatform(id);
    platformBlocker.loadCustomPlatforms(db.getCustomPlatforms());
    return { success: true };
  });

  ipcMain.handle('update-platform-enabled', (_e, id: string, enabled: boolean) => {
    platformBlocker.updatePlatformEnabled(id, enabled);
    // Save built-in state
    const platforms = platformBlocker.getPlatforms();
    const config: Record<string, boolean> = {};
    platforms.forEach(p => { config[p.id] = p.enabled; });
    db.saveBlocklistConfig(JSON.stringify(config));
    return { success: true };
  });

  // Day Rules
  ipcMain.handle('get-day-rules', () => {
    const configStr = db.getDayRulesConfig();
    if (configStr) {
      try { return JSON.parse(configStr); } catch {}
    }
    // Default: Friday protection enabled
    return {
      Monday: { enabled: false, blocked: false, maxTrades: 0, lossLimit: 0, sessionEnd: '', tighten: false },
      Tuesday: { enabled: false, blocked: false, maxTrades: 0, lossLimit: 0, sessionEnd: '', tighten: false },
      Wednesday: { enabled: false, blocked: false, maxTrades: 0, lossLimit: 0, sessionEnd: '', tighten: false },
      Thursday: { enabled: false, blocked: false, maxTrades: 0, lossLimit: 0, sessionEnd: '', tighten: false },
      Friday: { enabled: true, blocked: false, maxTrades: 2, lossLimit: 0, sessionEnd: '', tighten: true },
    };
  });

  ipcMain.handle('update-day-rules', (_e, rules) => {
    db.saveDayRulesConfig(JSON.stringify(rules));
    db.logActivity('day_rules_updated', 'Day rules configuration updated');
    return { success: true };
  });

  // News Blocker
  ipcMain.handle('get-news-blocker-config', () => {
    const configStr = db.getNewsBlockerConfig();
    if (configStr) {
      try { return JSON.parse(configStr); } catch {}
    }
    return { enabled: false, blockMinutesBefore: 30, blockMinutesAfter: 15, customEvents: [] };
  });

  ipcMain.handle('update-news-blocker-config', (_e, config) => {
    db.saveNewsBlockerConfig(JSON.stringify(config));
    db.logActivity('news_blocker_updated', 'News blocker configuration updated');
    return { success: true };
  });
}

app.whenReady().then(async () => {
  db = new DatabaseManager();
  await db.waitReady();
  lockManager = new LockManager(db);
  wsServer = new WebSocketServer(lockManager, db);
  
  // Auto-sync: when extension reads Tradovate risk settings, send to renderer
  wsServer.onTradovateSettingsRead = (settings) => {
    if (mainWindow) {
      mainWindow.webContents.send('tradovate-settings-synced', settings);
    }
  };

  // Tilt meter: forward updates from extension to renderer
  wsServer.onTiltUpdate = (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('tilt-update', data);
    }
  };

  // Anti-bypass: if extension disconnects while locked, ESCALATE to full blocklist
  wsServer.onExtensionDisconnected = () => {
    if (!lockManager.isLocked()) return; // Do nothing if not locked
    
    bypassWarningActive = true;
    db.logActivity('extension_disconnected', 'Extension removed while locked — full blocklist activated');
    
    // ESCALATE: Activate the full platform blocker (hosts file + process killing)
    // This blocks ALL trading websites in EVERY browser + kills desktop apps continuously
    // They can't bypass this by opening a different browser or reinstalling later
    if (platformBlocker && !platformBlocker.isActive()) {
      platformBlocker.activate();
    }

    // Go fullscreen warning
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setFullScreen(true);
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.setClosable(false);
      mainWindow.setMinimizable(false);
      mainWindow.webContents.send('extension-disconnected');

      // If they switch away, re-focus every 2 seconds
      const refocusInterval = setInterval(() => {
        if (!bypassWarningActive) { clearInterval(refocusInterval); return; }
        if (mainWindow && !mainWindow.isFocused()) {
          mainWindow.focus();
          mainWindow.setAlwaysOnTop(true, 'screen-saver');
        }
      }, 2000);

      // Release fullscreen after 5 minutes (but blocklist stays active until lock ends)
      setTimeout(() => {
        bypassWarningActive = false;
        clearInterval(refocusInterval);
        mainWindow?.setFullScreen(false);
        mainWindow?.setAlwaysOnTop(false);
        mainWindow?.setClosable(true);
        mainWindow?.setMinimizable(true);
      }, 300000);
    }
  };

  tamperGuard = new TamperGuard(lockManager, db);
  createWindow();
  createTray();
  setupIPC();
  tamperGuard.start();

  // Auto-updater
  if (!isDev && mainWindow) {
    setupAutoUpdater(mainWindow);
  }

  // Start process blocker (kills Tradesea/TopstepX outside trading hours)
  processBlocker = new ProcessBlocker(db);
  processBlocker.start();

  // Platform blocker (kills apps + hosts file when locked)
  platformBlocker = new PlatformBlocker();
  db.initCustomPlatforms();
  const customPlatforms = db.getCustomPlatforms();
  platformBlocker.loadCustomPlatforms(customPlatforms);
  // Restore built-in enabled/disabled state
  const blocklistConfig = db.getBlocklistConfig();
  if (blocklistConfig) {
    try {
      const config = JSON.parse(blocklistConfig);
      Object.entries(config).forEach(([id, enabled]) => {
        platformBlocker.updatePlatformEnabled(id, enabled as boolean);
      });
    } catch {}
  }
  // If currently locked, activate the blocker
  if (lockManager.isLocked()) {
    platformBlocker.activate();
  }

  // Apply startup setting on launch
  const settings = lockManager.getSettings();
  if (settings.startWithWindows) {
    applyStartupSetting(true);
  }

  db.logActivity('app_started', 'Application started');
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !lockManager.isLocked()) app.exit(0); });

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) { app.quit(); }
else { app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } }); }
