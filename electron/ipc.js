'use strict';

/**
 * IPC surface between renderer and the SQLite database.
 * The renderer never gets filesystem or SQL access — only these channels.
 */

const path = require('path');

const TODAY = () => new Date().toISOString().slice(0, 10);

// The renderer may only touch these settings. Everything else (PIN hashes,
// lockout counters, backup folder, last-backup time) is main-process only.
const RENDERER_SETTINGS = new Set(['technicians']);
const checkSettingKey = (key) => {
  if (!RENDERER_SETTINGS.has(key)) throw new Error(`Setting not accessible: ${key}`);
};

/**
 * @param {Electron.IpcMain} ipcMain
 * @param {import('./db/Database').AutoShiftDatabase} database
 * @param {{ defaultBackupDir: string, dialog?: Electron.Dialog, getWindow?: () => Electron.BrowserWindow }} opts
 */
function registerIpc(ipcMain, database, opts) {
  const { AutoShiftDatabase } = require('./db/Database');
  const { defaultBackupDir, dialog, getWindow, auth } = opts;
  if (!auth) throw new Error('registerIpc requires an AuthService');

  // `need` is enforced HERE, in the main process, on every call.
  const handle = (channel, fn, need = 'staff') =>
    ipcMain.handle(channel, async (_event, ...args) => {
      try {
        auth.require(need);
        return { ok: true, data: await fn(...args) };
      } catch (err) {
        // Errors cross IPC as plain data so the renderer gets a clean message.
        return { ok: false, error: err.message || String(err) };
      }
    });

  const backupDir = () => database.getSetting('backupDir', defaultBackupDir);

  // Backups run one at a time; quitting waits for the one in flight.
  let inflight = Promise.resolve();
  const runBackup = () => {
    const p = inflight.then(doBackup);
    inflight = p.catch(() => {});
    return p;
  };

  async function doBackup() {
    const dir = backupDir();
    const dest = path.join(dir, `autoshift-${TODAY()}.db`);
    await database.backupTo(dest);
    AutoShiftDatabase.pruneBackups(dir, 14);
    database.setSetting('lastBackupAt', new Date().toISOString());
    return { path: dest, at: database.getSetting('lastBackupAt') };
  }

  // ── data (needs an unlocked session) ──
  handle('db:create', (table, data) => database.create(table, data));
  handle('db:read', (table, query) => database.read(table, query));
  handle('db:update', (table, id, data) => database.update(table, id, data));
  handle('db:delete', (table, id) => database.delete(table, id), 'admin');
  handle('db:stats', () => database.stats());
  handle('db:getSetting', (key, fallback) => { checkSettingKey(key); return database.getSetting(key, fallback); });
  handle('db:setSetting', (key, value) => { checkSettingKey(key); return database.setSetting(key, value); }, 'admin');
  handle('db:exportJson', () => database.exportJson());
  handle('db:importJson', (payload) => database.importJson(payload), 'admin');

  handle('backup:now', () => runBackup());
  handle('backup:info', () => ({
    dir: backupDir(),
    lastBackupAt: database.getSetting('lastBackupAt', null),
  }));
  handle('backup:chooseDir', async () => {
    if (!dialog) throw new Error('Folder picker unavailable');
    const res = await dialog.showOpenDialog(getWindow ? getWindow() : undefined, {
      title: 'Choose backup folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    database.setSetting('backupDir', res.filePaths[0]);
    return res.filePaths[0];
  }, 'admin');

  // ── access control ──
  handle('auth:status', () => auth.status(), null);
  handle('auth:setup', (staffPin, adminPin) => auth.setup(staffPin, adminPin), null);
  handle('auth:unlock', (pin) => auth.unlock(pin), null);
  handle('auth:elevate', (pin) => auth.elevate(pin), null); // checks for a session itself
  handle('auth:drop', () => auth.drop(), null);
  handle('auth:lock', () => auth.lock(), null);
  handle('auth:changePin', (which, newPin, adminPin) => auth.changePin(which, newPin, adminPin), null);

  return { runBackup, idle: () => inflight };
}

/**
 * Daily automatic backup: runs at startup if the last one is >24h old,
 * then re-checks hourly while the app stays open.
 */
function scheduleBackups(database, runBackup, { onError = console.error, intervalMs = 3600000 } = {}) {
  const DAY = 24 * 3600 * 1000;
  const check = async () => {
    const last = database.getSetting('lastBackupAt', null);
    if (!last || Date.now() - new Date(last).getTime() >= DAY) {
      try { await runBackup(); } catch (e) { onError('Automatic backup failed:', e); }
    }
  };
  check();
  const timer = setInterval(check, intervalMs);
  if (timer.unref) timer.unref();
  return () => clearInterval(timer);
}

module.exports = { registerIpc, scheduleBackups };
