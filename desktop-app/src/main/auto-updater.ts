import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  // Check for updates silently on launch
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    sendToRenderer(mainWindow, 'update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    sendToRenderer(mainWindow, 'update-status', { status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    sendToRenderer(mainWindow, 'update-status', { status: 'up-to-date' });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer(mainWindow, 'update-status', { status: 'downloading', percent: Math.round(progress.percent) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendToRenderer(mainWindow, 'update-status', { status: 'ready', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    sendToRenderer(mainWindow, 'update-status', { status: 'error', message: err.message });
  });

  // IPC handlers for renderer
  ipcMain.handle('check-for-updates', () => {
    autoUpdater.checkForUpdates().catch(() => {});
    return { success: true };
  });

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  });

  // Check for updates 5 seconds after launch (non-blocking)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 5000);

  // Check every 30 minutes
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 30 * 60 * 1000);
}

function sendToRenderer(win: BrowserWindow, channel: string, data: any): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data);
  }
}
