import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { DatabaseManager } from './database';
import { LockManager } from './lock-manager';
import { WebSocketServer } from './websocket-server';
import { TamperGuard } from './tamper-guard';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let db: DatabaseManager;
let lockManager: LockManager;
let wsServer: WebSocketServer;
let tamperGuard: TamperGuard;

const isDev = process.env.NODE_ENV === 'development';

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800, height: 700, minWidth: 600, minHeight: 500,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
    title: 'Tradovate Risk Settings Lock', autoHideMenuBar: true,
  });
  if (isDev) { mainWindow.loadURL('http://localhost:5173'); }
  else { mainWindow.loadFile(path.join(__dirname, '../renderer/index.html')); }

  mainWindow.on('close', (event) => {
    if (lockManager.isLocked()) {
      event.preventDefault();
      mainWindow?.hide();
      db.logActivity('app_close_attempt', 'User attempted to close while lock active');
    }
  });
}

function setupIPC(): void {
  ipcMain.handle('get-lock-state', () => lockManager.getState());
  ipcMain.handle('lock-settings', (_e, settings) => lockManager.lock(settings));
  ipcMain.handle('unlock-settings', (_e, password?) => lockManager.unlock(password));
  ipcMain.handle('request-early-unlock', (_e, reason) => lockManager.requestEarlyUnlock(reason));
  ipcMain.handle('set-trusted-password', (_e, password) => lockManager.setTrustedPassword(password));
  ipcMain.handle('remove-trusted-password', (_e, password) => lockManager.removeTrustedPassword(password));
  ipcMain.handle('get-activity-log', (_e, limit) => db.getActivityLog(limit));
  ipcMain.handle('get-settings', () => lockManager.getSettings());
  ipcMain.handle('update-settings', (_e, settings) => lockManager.updateSettings(settings));
  ipcMain.handle('get-bypass-attempts', () => db.getBypassAttemptCount());
}

app.whenReady().then(() => {
  db = new DatabaseManager();
  lockManager = new LockManager(db);
  wsServer = new WebSocketServer(lockManager, db);
  tamperGuard = new TamperGuard(lockManager, db);
  createWindow();
  setupIPC();
  tamperGuard.start();
  db.logActivity('app_started', 'Application started');
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !lockManager.isLocked()) app.quit(); });

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) { app.quit(); }
else { app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } }); }
