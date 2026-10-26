const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;
const { AutoShiftDatabase } = require('../electron/db/Database');
const { registerIpc, scheduleBackups } = require('../electron/ipc');
const { AuthService } = require('../electron/auth');

let mainWindow = null;
let database = null;
let stopBackups = null;
let ipcApi = null;
let auth = null;
let readyToQuit = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Renderer is sandboxed: no Node, no fs. It only sees window.autoshift.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, '../electron/preload.js'),
    },
    icon: path.join(__dirname, 'favicon.ico'),
    title: 'AutoShift Showroom Management',
  });

  // The app is a closed system: no popups, no navigating away, no permissions.
  const appOrigin = isDev ? 'http://localhost:3000' : 'file://';
  const wc = mainWindow.webContents;
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (event, url) => {
    if (!url.startsWith(appOrigin)) event.preventDefault();
  });
  // Any full page load (reload, dev refresh) ends the session: PIN required again.
  wc.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace && auth) auth.lock();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// One instance only: two processes must never open the same database file.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    const userData = app.getPath('userData');
    try {
      database = new AutoShiftDatabase(path.join(userData, 'autoshift.db'));
    } catch (err) {
      dialog.showErrorBox(
        'AutoShift cannot open its database',
        `${err.message}\n\nYour data file is at:\n${path.join(userData, 'autoshift.db')}\n\n` +
        'Do not delete it. Restore from a backup or contact support.'
      );
      app.quit();
      return;
    }

    auth = new AuthService(database);
    if (process.env.AUTOSHIFT_RESET_PINS === '1') {
      // Owner recovery for a forgotten PIN. Requires launching the app from the machine itself.
      auth.reset();
    }

    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

    ipcApi = registerIpc(ipcMain, database, {
      auth,
      defaultBackupDir: path.join(userData, 'backups'),
      dialog,
      getWindow: () => mainWindow,
    });
    stopBackups = scheduleBackups(database, ipcApi.runBackup);

    createWindow();
  });
}

// Let an in-flight backup finish before the database is closed.
app.on('before-quit', (event) => {
  if (readyToQuit || !database) return;
  event.preventDefault();
  if (stopBackups) stopBackups();
  Promise.resolve(ipcApi && ipcApi.idle()).finally(() => {
    database.close();
    readyToQuit = true;
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && database) createWindow();
});
