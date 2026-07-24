import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { DatabaseManager } from './database';
import { LockManager } from './lock-manager';
import { WebSocketServer } from './websocket-server';
import { TamperGuard } from './tamper-guard';
import { ProcessBlocker } from './process-blocker';
import { setupAutoUpdater } from './auto-updater';

// Set app user model ID so Windows can pin it to taskbar
app.setAppUserModelId('com.tradovate-risk-lock.app');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let db: DatabaseManager;
let lockManager: LockManager;
let wsServer: WebSocketServer;
let tamperGuard: TamperGuard;
let processBlocker: ProcessBlocker;
let bypassWarningActive = false;

const isDev = process.env.NODE_ENV === 'development';

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800, height: 850, minWidth: 600, minHeight: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
    title: 'Tradovate Risk Settings Lock', autoHideMenuBar: true, menuBarVisible: false,
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

  // Full day block (Pre-Market Check)
  ipcMain.handle('full-day-block', () => {
    wsServer.broadcastFullDayBlock();
    db.logActivity('full_day_block', 'Pre-Market Check: user admitted to revenge trading — blocked for the day');
    return { success: true };
  });
  ipcMain.handle('lock-settings', (_e, settings) => {
    const result = lockManager.lock(settings);
    if (result.success) updateTrayMenu();
    return result;
  });
  ipcMain.handle('unlock-settings', (_e, password?) => {
    const result = lockManager.unlock(password);
    if (result.success) updateTrayMenu();
    return result;
  });

  // Dev-only force unlock
  ipcMain.handle('dev-force-unlock', () => {
    lockManager.forceUnlock();
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
      const date = entry.timestamp?.split('T')[0] || today;
      if (!scores[date]) scores[date] = { score: 100, violations: [] };

      switch (entry.type) {
        case 'bypass_attempt':
          scores[date].score -= 15;
          scores[date].violations.push('Bypass attempt: ' + (entry.details || '').substring(0, 50));
          break;
        case 'extension_disconnected':
          scores[date].score -= 25;
          scores[date].violations.push('Extension disabled while locked');
          break;
        case 'session_blocked':
          scores[date].score -= 10;
          scores[date].violations.push('Tried to trade outside session hours');
          break;
        case 'size_blocked':
          scores[date].score -= 10;
          scores[date].violations.push('Exceeded position size limit');
          break;
        case 'app_close_attempt':
          scores[date].score -= 5;
          scores[date].violations.push('Tried to close app while locked');
          break;
        case 'unlock_failed':
          scores[date].score -= 10;
          scores[date].violations.push('Failed unlock attempt');
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
      violations: scores[today].violations,
      weeklyAvg,
      monthlyAvg,
      streak,
      history,
    };
  });
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

  // Anti-bypass: if extension disconnects while locked, warn the user
  wsServer.onExtensionDisconnected = () => {
    if (!lockManager.isLocked()) return; // Do nothing if not locked
    
    bypassWarningActive = true;
    db.logActivity('extension_disconnected', 'Extension disconnected while locked — protection inactive');
    // Kill trading platforms
    const { exec } = require('child_process');
    exec('taskkill /F /IM Tradesea.exe /T', () => {});
    exec('taskkill /F /IM TopstepX.exe /T', () => {});

      // Go fullscreen warning (simplified — no kiosk, no keyboard hooks)
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

        // Release after 5 minutes
        setTimeout(() => {
          bypassWarningActive = false;
          clearInterval(refocusInterval);
          mainWindow?.setFullScreen(false);
          mainWindow?.setAlwaysOnTop(false);
          mainWindow?.setClosable(true);
          mainWindow?.setMinimizable(true);
        }, 300000);
      }

      // 5-minute kill loop: keep killing trading desktop apps every 3 seconds
      let killCount = 0;
      const killLoop = setInterval(() => {
        killCount++;
        exec('taskkill /F /IM Tradesea.exe /T', () => {});
        exec('taskkill /F /IM TopstepX.exe /T', () => {});
        if (killCount >= 100) clearInterval(killLoop);
      }, 3000);
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
