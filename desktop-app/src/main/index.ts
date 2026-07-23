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

const isDev = process.env.NODE_ENV === 'development';

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800, height: 850, minWidth: 600, minHeight: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
    title: 'Tradovate Risk Settings Lock', autoHideMenuBar: true,
  });
  if (isDev) { mainWindow.loadURL('http://localhost:5173'); }
  else { mainWindow.loadFile(path.join(__dirname, '../renderer/index.html')); }

  mainWindow.on('close', (event) => {
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
    if (isDev) {
      lockManager.forceUnlock();
      updateTrayMenu();
      return { success: true };
    }
    return { success: false, error: 'Not in dev mode' };
  });
  ipcMain.handle('request-early-unlock', (_e, reason) => lockManager.requestEarlyUnlock(reason));
  ipcMain.handle('set-trusted-password', (_e, password) => lockManager.setTrustedPassword(password));
  ipcMain.handle('remove-trusted-password', (_e, password) => lockManager.removeTrustedPassword(password));
  ipcMain.handle('get-activity-log', (_e, limit) => db.getActivityLog(limit));
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
    if (lockManager.isLocked()) {
      db.logActivity('extension_disconnected', 'Extension disconnected while locked — protection inactive');
      // Show the app window with warning
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('extension-disconnected');
      }
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
