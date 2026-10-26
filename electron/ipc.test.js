'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AutoShiftDatabase } = require('./db/Database');
const { registerIpc, scheduleBackups } = require('./ipc');

function setup(extra = {}) {
  const handlers = {};
  const ipcMain = { handle: (ch, fn) => { handlers[ch] = fn; } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-ipc-'));
  const db = new AutoShiftDatabase(':memory:');
  const api = registerIpc(ipcMain, db, { defaultBackupDir: path.join(dir, 'backups'), ...extra });
  const call = (ch, ...a) => handlers[ch]({}, ...a);
  return { db, call, dir, api, handlers };
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
