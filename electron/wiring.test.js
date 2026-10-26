'use strict';
/**
 * Contract tests for the parts that can't run without a real Electron:
 *  - every channel the preload calls has a main-process handler (and vice versa)
 *  - the BrowserWindow is created with the hardened webPreferences
 *  - the database is opened in userData and closed on quit
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

let userData;
const running = [];

function loadMain(lock = true) {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'as-ud-')); // one data folder per app instance
  jest.resetModules();
  const handlers = {};
  const windows = [];
  const appHandlers = {};
  const electron = {
    app: {
      isPackaged: true,
      getPath: jest.fn(() => userData),
      whenReady: jest.fn(() => Promise.resolve()),
      on: jest.fn((ev, fn) => { appHandlers[ev] = fn; }),
      quit: jest.fn(),
      requestSingleInstanceLock: jest.fn(() => lock),
    },
    BrowserWindow: Object.assign(
      jest.fn(function (opts) {
        this.opts = opts; this.loadFile = jest.fn(); this.loadURL = jest.fn();
        this.on = jest.fn(); this.webContents = { openDevTools: jest.fn() };
        windows.push(this);
      }),
      { getAllWindows: () => windows }
    ),
    ipcMain: { handle: jest.fn((ch, fn) => { handlers[ch] = fn; }) },
    dialog: { showErrorBox: jest.fn(), showOpenDialog: jest.fn() },
  };
  jest.doMock('electron', () => electron, { virtual: true });
  require('../public/electron.js');
  running.push(appHandlers);
  return { electron, handlers, windows, appHandlers };
}

// Shut every simulated app down cleanly (waits for any in-flight backup).
afterEach(async () => {
  while (running.length) {
    const h = running.pop();
    if (h['before-quit']) {
      h['before-quit']({ preventDefault() {} });
      await new Promise((r) => setTimeout(r, 150));
    }
  }
});

test('window is created sandboxed, isolated, with no Node integration', async () => {
  const { windows } = loadMain();
  await new Promise((r) => setImmediate(r));
  expect(windows).toHaveLength(1);
  const wp = windows[0].opts.webPreferences;
  expect(wp.nodeIntegration).toBe(false);
  expect(wp.contextIsolation).toBe(true);
  expect(wp.sandbox).toBe(true);
  expect(path.basename(wp.preload)).toBe('preload.js');
  expect(fs.existsSync(wp.preload)).toBe(true);
});

test('a second instance quits immediately without touching the database or opening a window', async () => {
  const { electron, windows } = loadMain(false);
  await new Promise((r) => setImmediate(r));
  expect(electron.app.quit).toHaveBeenCalled();
  expect(windows).toHaveLength(0);
  expect(fs.readdirSync(userData)).toEqual([]);
});

test('database file is created in userData; quit waits for the in-flight backup, then closes', async () => {
  const { appHandlers, electron } = loadMain();
  await new Promise((r) => setImmediate(r)); // startup backup is now in flight
  expect(fs.existsSync(path.join(userData, 'autoshift.db'))).toBe(true);
  const event = { preventDefault: jest.fn() };
  appHandlers['before-quit'](event);
  expect(event.preventDefault).toHaveBeenCalled();           // first pass defers the quit
  await new Promise((r) => setTimeout(r, 200));
  expect(electron.app.quit).toHaveBeenCalledTimes(1);        // …then quits for real
  const second = { preventDefault: jest.fn() };
  appHandlers['before-quit'](second);
  expect(second.preventDefault).not.toHaveBeenCalled();      // and does not loop
  const backups = fs.readdirSync(path.join(userData, 'backups'));
  expect(backups.some((f) => /^autoshift-.*\.db$/.test(f))).toBe(true);
  expect(backups.some((f) => f.endsWith('.partial'))).toBe(false);
});

test('preload channels and main-process handlers match exactly', async () => {
  const { handlers } = loadMain();
  await new Promise((r) => setImmediate(r));
  const src = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');
  const used = [...src.matchAll(/call\('([a-z]+:[A-Za-z]+)'/g)].map((m) => m[1]).sort();
  expect(used.length).toBeGreaterThan(10);
  expect(Object.keys(handlers).sort()).toEqual(used);
});

test('renderer-facing bridge exposes only db + backup (no fs / ipcRenderer leak)', () => {
  jest.resetModules();
  const exposed = {};
  jest.doMock('electron', () => ({
    contextBridge: { exposeInMainWorld: (k, v) => { exposed[k] = v; } },
    ipcRenderer: { invoke: jest.fn(async () => ({ ok: true, data: 1 })) },
  }), { virtual: true });
  require('./preload.js');
  expect(Object.keys(exposed)).toEqual(['autoshift']);
  expect(Object.keys(exposed.autoshift).sort()).toEqual(['backup', 'db']);
});

test('preload unwraps error envelopes into thrown Errors', async () => {
  jest.resetModules();
  const exposed = {};
  jest.doMock('electron', () => ({
    contextBridge: { exposeInMainWorld: (k, v) => { exposed[k] = v; } },
    ipcRenderer: { invoke: jest.fn(async () => ({ ok: false, error: 'plate is required' })) },
  }), { virtual: true });
  require('./preload.js');
  await expect(exposed.autoshift.db.create('cars', {})).rejects.toThrow('plate is required');
});
