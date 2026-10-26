'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AutoShiftDatabase, ValidationError } = require('./Database');
const { SCHEMA_VERSION } = require('./schema');

let db;
beforeEach(() => { db = new AutoShiftDatabase(':memory:'); });
afterEach(() => db.close());

const mkClient = (o = {}) => db.create('clients', { name: 'Ahmed', phone: '+92-300-1', ...o });
const mkCar = (clientId, o = {}) => db.create('cars', { plate: 'LHR-1', make: 'Toyota', model: 'Corolla', year: 2020, clientId, ...o });

describe('schema', () => {
  test('migrates to current version and enables foreign keys', () => {
    expect(db.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
    expect(db.db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  test('refuses a database written by a newer app version', () => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'as-')), 'x.db');
    const a = new AutoShiftDatabase(f);
    a.db.pragma(`user_version = ${SCHEMA_VERSION + 1}`);
    a.close();
    expect(() => new AutoShiftDatabase(f)).toThrow(/Update AutoShift/);
  });

  test('reopening an existing file keeps data and does not re-migrate', () => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'as-')), 'x.db');
    const a = new AutoShiftDatabase(f);
    a.create('clients', { name: 'Persist', phone: '1' });
    a.close();
    const b = new AutoShiftDatabase(f);
    expect(b.read('clients')).toHaveLength(1);
    b.close();
  });
});

describe('CRUD', () => {
  test('create returns camelCase row with generated id and timestamps', () => {
    const c = mkClient();
    const car = mkCar(c.id);
    expect(car.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(car.clientId).toBe(c.id);
    expect(car.createdAt).toBeTruthy();
  });

  test('normalises plate to upper case and coerces numbers', () => {
    const c = mkClient();
    const car = mkCar(c.id, { plate: ' lhr-77 ', year: '2021' });
    expect(car.plate).toBe('LHR-77');
    expect(car.year).toBe(2021);
    mkCar(c.id, { plate: 'LHR-88' });
    const s = db.create('services', { plate: 'LHR-77', type: 'Oil', date: '2026-01-01', nextDue: '2026-07-01', cost: '3500' });
    expect(s.cost).toBe(3500);
    expect(s.nextDue).toBe('2026-07-01');
  });

  test('required fields are enforced', () => {
    expect(() => db.create('clients', { name: '  ', phone: '1' })).toThrow(ValidationError);
    expect(() => db.create('clients', { name: 'A' })).toThrow(/phone is required/);
    expect(() => db.create('cars', { make: 'x', model: 'y' })).toThrow(/plate is required/);
  });

  test('plate is unique', () => {
    const c = mkClient(); mkCar(c.id);
    expect(() => mkCar(c.id)).toThrow(/UNIQUE/);
  });

  test('update is partial, bumps updated_at, and ignores non-whitelisted fields', async () => {
    const c = mkClient();
    const before = db.getById('clients', c.id);
    await new Promise((r) => setTimeout(r, 5));
    const after = db.update('clients', c.id, { phone: '999', id: 'hacked', createdAt: '1999-01-01' });
    expect(after.phone).toBe('999');
    expect(after.name).toBe('Ahmed');
    expect(after.id).toBe(c.id);
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.updatedAt >= before.updatedAt).toBe(true);
  });

  test('update of a missing record throws', () => {
    expect(() => db.update('clients', 'nope', { name: 'x' })).toThrow(/not found/);
  });

  test('update cannot blank a required field', () => {
    const c = mkClient();
    expect(() => db.update('clients', c.id, { name: '' })).toThrow(/name is required/);
  });

  test('read filters by whitelisted fields', () => {
    const c1 = mkClient(); const c2 = mkClient({ name: 'Sara' });
    mkCar(c1.id, { plate: 'A-1' }); mkCar(c2.id, { plate: 'B-2' });
    expect(db.read('cars', { clientId: c2.id }).map((c) => c.plate)).toEqual(['B-2']);
  });
});

describe('safety', () => {
  test('unknown tables and filter columns are rejected (no SQL injection via names)', () => {
    expect(() => db.read('clients; DROP TABLE clients')).toThrow(/Unknown table/);
    expect(() => db.create('sqlite_master', {})).toThrow(/Unknown table/);
    expect(() => db.read('clients', { 'name = 1 OR 1': 'x' })).toThrow(/Cannot filter/);
    expect(db.stats().clients).toBe(0);
  });

  test('values are parameterised', () => {
    const c = mkClient({ name: "Robert'); DROP TABLE clients;--" });
    expect(db.getById('clients', c.id).name).toContain('DROP TABLE');
    expect(db.read('clients')).toHaveLength(1);
  });
});

describe('relationships', () => {
  test('deleting a car cascades to its services and appointments', () => {
    const c = mkClient(); const car = mkCar(c.id);
    db.create('services', { plate: 'LHR-1', type: 'Oil', date: '2026-01-01', nextDue: '2026-07-01' });
    db.create('appointments', { plate: 'LHR-1', clientId: c.id, date: '2026-02-01', time: '10:00 AM', type: 'Oil' });
    expect(db.delete('cars', car.id)).toBe(true);
    expect(db.stats()).toMatchObject({ cars: 0, services: 0, appointments: 0, clients: 1 });
  });

  test('a client with vehicles cannot be deleted', () => {
    const c = mkClient(); mkCar(c.id);
    expect(() => db.delete('clients', c.id)).toThrow(/FOREIGN KEY/);
    expect(db.stats().cars).toBe(1);
  });

  test('changing a plate cascades to services', () => {
    const c = mkClient(); const car = mkCar(c.id);
    db.create('services', { plate: 'LHR-1', type: 'Oil', date: '2026-01-01', nextDue: '2026-07-01' });
    db.update('cars', car.id, { plate: 'LHR-2' });
    expect(db.read('services')[0].plate).toBe('LHR-2');
  });

  test('a service for an unknown plate is rejected', () => {
    expect(() => db.create('services', { plate: 'NOPE', type: 'Oil', date: '2026-01-01', nextDue: '2026-07-01' }))
      .toThrow(/FOREIGN KEY/);
  });
});

describe('settings', () => {
  test('round-trips JSON and upserts', () => {
    expect(db.getSetting('technicians', ['x'])).toEqual(['x']);
    db.setSetting('technicians', ['A', 'B']);
    db.setSetting('technicians', ['C']);
    expect(db.getSetting('technicians')).toEqual(['C']);
  });
});

describe('export / import', () => {
  test('export → import into a fresh database reproduces the data', () => {
    const c = mkClient(); mkCar(c.id);
    db.create('services', { plate: 'LHR-1', type: 'Oil', date: '2026-01-01', nextDue: '2026-07-01', cost: 10 });
    const dump = JSON.parse(JSON.stringify(db.exportJson()));
    const fresh = new AutoShiftDatabase(':memory:');
    expect(fresh.importJson(dump)).toEqual({ clients: 1, cars: 1, services: 1, appointments: 0 });
    expect(fresh.getAll().cars[0].clientId).toBe(c.id);
    fresh.close();
  });

  test('importing twice merges instead of duplicating', () => {
    mkClient();
    const dump = db.exportJson();
    db.importJson(dump); db.importJson(dump);
    expect(db.stats().clients).toBe(1);
  });

  test('accepts the legacy IndexedDB export format (snake_case + sync metadata)', () => {
    const legacy = {
      clients: [{ id: 'c1', name: 'Old', phone: '1', since: '2023-01-01', _sync_status: 'synced', _version: 3, created_at: '2023-01-01T00:00:00Z' }],
      cars: [{ id: 'k1', plate: 'OLD-1', make: 'M', model: 'X', year: 2019, client_id: 'c1', _sync_status: 'pending' }],
      services: [{ id: 's1', plate: 'OLD-1', type: 'Oil', date: '2024-01-01', next_due: '2024-07-01', cost: 100 }],
    };
    expect(db.importJson(legacy)).toMatchObject({ clients: 1, cars: 1, services: 1 });
    expect(db.read('cars')[0].clientId).toBe('c1');
    expect(db.read('services')[0].nextDue).toBe('2024-07-01');
    expect(db.read('clients')[0].createdAt).toBe('2023-01-01T00:00:00Z');
  });

  test('a bad record rolls the whole import back', () => {
    const bad = { clients: [{ id: 'ok', name: 'Fine', phone: '1' }, { id: 'bad', name: '', phone: '1' }] };
    expect(() => db.importJson(bad)).toThrow(/name is required/);
    expect(db.stats().clients).toBe(0);
  });

  test('rejects garbage input', () => {
    expect(() => db.importJson(null)).toThrow(/not valid/);
    expect(() => db.importJson({ hello: 'world' })).toThrow(/no clients/);
  });
});

describe('backups', () => {
  test('backupTo writes a complete, openable copy', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-'));
    const src = new AutoShiftDatabase(path.join(dir, 'live.db'));
    src.create('clients', { name: 'Backed', phone: '1' });
    const dest = await src.backupTo(path.join(dir, 'bk', 'autoshift-2026-01-01.db'));
    const copy = new AutoShiftDatabase(dest);
    expect(copy.read('clients')[0].name).toBe('Backed');
    copy.close(); src.close();
  });

  test('a failed backup leaves no partial file behind', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-'));
    const src = new AutoShiftDatabase(':memory:');
    src.close();
    await expect(src.backupTo(path.join(dir, 'autoshift-x.db'))).rejects.toThrow();
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  test('pruneBackups removes stale .partial files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-'));
    fs.writeFileSync(path.join(dir, 'autoshift-2026-01-01.db.partial'), '');
    fs.writeFileSync(path.join(dir, 'autoshift-2026-01-02.db'), '');
    AutoShiftDatabase.pruneBackups(dir, 5);
    expect(fs.readdirSync(dir)).toEqual(['autoshift-2026-01-02.db']);
  });

  test('pruneBackups keeps only the newest N', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-'));
    ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'].forEach((d) => fs.writeFileSync(path.join(dir, `autoshift-${d}.db`), ''));
    fs.writeFileSync(path.join(dir, 'unrelated.txt'), '');
    const removed = AutoShiftDatabase.pruneBackups(dir, 2);
    expect(removed).toEqual(['autoshift-2026-01-01.db', 'autoshift-2026-01-02.db']);
    expect(fs.readdirSync(dir).sort()).toEqual(['autoshift-2026-01-03.db', 'autoshift-2026-01-04.db', 'unrelated.txt']);
  });
});
