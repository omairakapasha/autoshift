'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AutoShiftDatabase } = require('./db/Database');
const { registerIpc, scheduleBackups } = require('./ipc');
const { AuthService } = require('./auth');

function setup(extra = {}, { signedIn = 'admin' } = {}) {
  const handlers = {};
  const ipcMain = { handle: (ch, fn) => { handlers[ch] = fn; } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-ipc-'));
  const db = new AutoShiftDatabase(':memory:');
  const auth = new AuthService(db);
  auth.setup('1111', '222222');                 // leaves an admin session
  if (signedIn === 'staff') auth.drop();
  if (signedIn === 'none') auth.lock();
  const api = registerIpc(ipcMain, db, { auth, defaultBackupDir: path.join(dir, 'backups'), ...extra });
  const call = (ch, ...a) => handlers[ch]({}, ...a);
  return { db, call, dir, api, handlers, auth };
}

test('success is wrapped as {ok,data}; errors as {ok:false,error} (never thrown across IPC)', async () => {
  const { call } = setup();
  const ok = await call('db:create', 'clients', { name: 'A', phone: '1' });
  expect(ok.ok).toBe(true);
  expect(ok.data.name).toBe('A');
  const bad = await call('db:create', 'clients', { name: '' });
  expect(bad).toEqual({ ok: false, error: expect.stringMatching(/name is required/) });
  const evil = await call('db:read', 'sqlite_master');
  expect(evil.ok).toBe(false);
});

test('backup:now writes a dated file, records lastBackupAt, reports info', async () => {
  const { call, dir } = setup();
  await call('db:create', 'clients', { name: 'A', phone: '1' });
  const res = await call('backup:now');
  expect(res.ok).toBe(true);
  expect(fs.existsSync(res.data.path)).toBe(true);
  expect(path.basename(res.data.path)).toMatch(/^autoshift-\d{4}-\d{2}-\d{2}\.db$/);
  const info = (await call('backup:info')).data;
  expect(info.dir).toBe(path.join(dir, 'backups'));
  expect(info.lastBackupAt).toBeTruthy();
});

test('backup:chooseDir persists the chosen folder and honours cancel', async () => {
  const chosen = fs.mkdtempSync(path.join(os.tmpdir(), 'as-usb-'));
  const dialog = { showOpenDialog: jest.fn() };
  const { call } = setup({ dialog });
  dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
  expect((await call('backup:chooseDir')).data).toBeNull();
  dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [chosen] });
  expect((await call('backup:chooseDir')).data).toBe(chosen);
  const res = (await call('backup:now')).data;
  expect(path.dirname(res.path)).toBe(chosen);
});

describe('scheduleBackups', () => {
  test('runs immediately when never backed up, skips when recent, runs when stale', async () => {
    const { db } = setup();
    const run = jest.fn().mockResolvedValue({});
    let stop = scheduleBackups(db, run, { intervalMs: 1e9 });
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
    stop();

    db.setSetting('lastBackupAt', new Date().toISOString());
    run.mockClear();
    stop = scheduleBackups(db, run, { intervalMs: 1e9 });
    await Promise.resolve();
    expect(run).not.toHaveBeenCalled();
    stop();

    db.setSetting('lastBackupAt', new Date(Date.now() - 25 * 3600 * 1000).toISOString());
    stop = scheduleBackups(db, run, { intervalMs: 1e9 });
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
    stop();
  });

  test('a failing backup is reported, not thrown', async () => {
    const { db } = setup();
    const onError = jest.fn();
    const stop = scheduleBackups(db, async () => { throw new Error('disk full'); }, { onError, intervalMs: 1e9 });
    await new Promise((r) => setImmediate(r));
    expect(onError).toHaveBeenCalledWith('Automatic backup failed:', expect.any(Error));
    stop();
  });
});

describe('session enforcement (main process, not UI)', () => {
  test('everything data-related is refused while locked', async () => {
    const { call } = setup({}, { signedIn: 'none' });
    for (const [ch, args] of [
      ['db:read', ['clients']], ['db:create', ['clients', { name: 'x', phone: '1' }]],
      ['db:update', ['clients', 'id', {}]], ['db:delete', ['cars', 'id']], ['db:stats', []],
      ['db:exportJson', []], ['db:importJson', [{}]], ['db:getSetting', ['technicians']],
      ['db:setSetting', ['technicians', []]], ['backup:now', []], ['backup:info', []], ['backup:chooseDir', []],
    ]) {
      expect(await call(ch, ...args)).toEqual({ ok: false, error: 'AutoShift is locked' });
    }
  });

  test('staff can work with data but not delete, import, or reconfigure', async () => {
    const { call } = setup({}, { signedIn: 'staff' });
    expect((await call('db:create', 'clients', { name: 'A', phone: '1' })).ok).toBe(true);
    expect((await call('db:read', 'clients')).ok).toBe(true);
    expect((await call('backup:now')).ok).toBe(true);
    for (const [ch, args] of [
      ['db:delete', ['clients', 'x']], ['db:importJson', [{ clients: [] }]],
      ['db:setSetting', ['technicians', ['x']]], ['backup:chooseDir', []],
    ]) {
      expect(await call(ch, ...args)).toEqual({ ok: false, error: 'Admin PIN required' });
    }
  });

  test('the renderer can never read or write auth/backup internals through settings', async () => {
    const { call, db } = setup();
    for (const key of ['auth', 'authLock', 'backupDir', 'lastBackupAt']) {
      expect((await call('db:getSetting', key)).ok).toBe(false);
      expect((await call('db:setSetting', key, { evil: true })).ok).toBe(false);
    }
    expect(db.getSetting('auth').staff.hash).toBeTruthy();   // untouched
    expect((await call('db:setSetting', 'technicians', ['A'])).ok).toBe(true);
  });

  test('auth channels never leak hashes or salts', async () => {
    const { call } = setup();
    const st = await call('auth:status');
    expect(JSON.stringify(st)).not.toMatch(/hash|salt/);
  });

  test('admin elevation via IPC, and dropping back to staff', async () => {
    const { call } = setup({}, { signedIn: 'staff' });
    expect((await call('auth:elevate', '000000')).data.role).toBe('staff');   // wrong PIN: stays staff
    expect((await call('auth:elevate', '222222')).data.role).toBe('admin');
    expect((await call('db:delete', 'clients', 'x')).ok).toBe(true);
    expect((await call('auth:drop')).data.role).toBe('staff');
    expect((await call('db:delete', 'clients', 'x')).ok).toBe(false);
  });

  test('elevate requires an unlocked session first', async () => {
    const { call } = setup({}, { signedIn: 'none' });
    expect(await call('auth:elevate', '222222')).toEqual({ ok: false, error: 'AutoShift is locked' });
  });

  test('automatic backups still run while the app is locked', async () => {
    const { api } = setup({}, { signedIn: 'none' });
    await expect(api.runBackup()).resolves.toMatchObject({ path: expect.stringContaining('autoshift-') });
  });
});
