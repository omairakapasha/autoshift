import 'fake-indexeddb/auto';

// Polyfill structuredClone for older environments
if (typeof structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

import { LocalDatabase } from './LocalDatabase.js';

describe('LocalDatabase', () => {
  let db;

  beforeEach(async () => {
    // Reset IndexedDB for each test
    const indexedDB = await import('fake-indexeddb');
    // @ts-ignore
    indexedDB.default.deleteDatabase('AutoShowroomDB');
    db = new LocalDatabase();
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
  });

  test('should initialize correctly', async () => {
    await db.initialize();
    expect(db.isInitialized).toBe(true);
  });

  test('should create and read a record', async () => {
    await db.initialize();
    const client = { id: 'c1', name: 'Test Client', phone: '123' };
    await db.create('clients', client);
    
    const results = await db.read('clients', { id: 'c1' });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Test Client');
  });

  test('should update a record', async () => {
    await db.initialize();
    const client = { id: 'c1', name: 'Test Client' };
    await db.create('clients', client);
    
    await db.update('clients', 'c1', { name: 'Updated Client' });
    const results = await db.read('clients', { id: 'c1' });
    expect(results[0].name).toBe('Updated Client');
  });

  test('should delete a record', async () => {
    await db.initialize();
    const client = { id: 'c1', name: 'Test Client' };
    await db.create('clients', client);
    
    await db.delete('clients', 'c1');
    const results = await db.read('clients', { id: 'c1' });
    expect(results.length).toBe(0);
  });

  test('should use indexing for queries', async () => {
    await db.initialize();
    await db.create('cars', { id: '1', plate: 'LHR-1', make: 'Toyota' });
    await db.create('cars', { id: '2', plate: 'LHR-2', make: 'Honda' });
    
    // This should trigger _handleAdvancedQuery index logic
    const results = await db.read('cars', { plate: 'LHR-1' });
    expect(results.length).toBe(1);
    expect(results[0].make).toBe('Toyota');
  });

  test('should handle operation queue', async () => {
    await db.initialize();
    const opData = { id: 'c1', name: 'Queue Test' };
    await db.queueOperation('clients', 'CREATE', opData);
    
    const ops = await db.getQueuedOperations();
    expect(ops.length).toBe(1);
    expect(ops[0].operation).toBe('CREATE');
    expect(ops[0].data.name).toBe('Queue Test');
  });
});
