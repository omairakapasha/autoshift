import { databaseManager } from './DatabaseManager';

afterEach(() => { delete window.autoshift; });

test('gives a clear error when not running inside the desktop app', () => {
  expect(() => databaseManager.getClients()).toThrow(/desktop app/);
});

test('delegates CRUD to the preload bridge', async () => {
  const db = {
    create: jest.fn().mockResolvedValue({ id: '1' }),
    read: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ id: '1' }),
    delete: jest.fn().mockResolvedValue(true),
  };
  window.autoshift = { db, backup: {} };
  await databaseManager.create('clients', { name: 'A' });
  await databaseManager.update('clients', '1', { name: 'B' });
  await databaseManager.delete('clients', '1');
  await databaseManager.getCars();
  expect(db.create).toHaveBeenCalledWith('clients', { name: 'A' });
  expect(db.update).toHaveBeenCalledWith('clients', '1', { name: 'B' });
  expect(db.delete).toHaveBeenCalledWith('clients', '1');
  expect(db.read).toHaveBeenCalledWith('cars');
});

test('loadAll returns all four collections', async () => {
  window.autoshift = { db: { read: jest.fn(async (t) => [t]) }, backup: {} };
  expect(await databaseManager.loadAll()).toEqual({
    clients: ['clients'], cars: ['cars'], services: ['services'], appointments: ['appointments'],
  });
});
