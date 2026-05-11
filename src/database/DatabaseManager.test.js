import 'fake-indexeddb/auto';

// Polyfill structuredClone for older environments
if (typeof structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// Helper to create a chainable mock
const createChainableMock = (finalValue = { data: [], error: null }) => {
  const mock = {
    insert: jest.fn(() => Promise.resolve({ error: null })),
    update: jest.fn(() => mock),
    delete: jest.fn(() => mock),
    eq: jest.fn(() => Promise.resolve({ error: null })),
    select: jest.fn(() => mock),
    gt: jest.fn(() => mock),
    order: jest.fn(() => mock),
    range: jest.fn(() => Promise.resolve(finalValue)),
  };
  return mock;
};

// Mock Supabase using standard jest.mock and global jest
jest.mock('../supabaseClient.js', () => ({
  supabase: {
    from: jest.fn(() => createChainableMock())
  }
}));

// Import after mock
import { databaseManager } from './DatabaseManager.js';
import { localDatabase, SYNC_STATUS, OPERATION_TYPES } from './LocalDatabase.js';
import { supabase } from '../supabaseClient.js';

describe('DatabaseManager', () => {
  beforeEach(async () => {
    // @ts-ignore
    const indexedDB = await import('fake-indexeddb');
    // @ts-ignore
    indexedDB.default.deleteDatabase('AutoShowroomDB');
    await databaseManager.initialize();
    jest.clearAllMocks();
    
    // Default mock behavior reset
    supabase.from.mockImplementation(() => createChainableMock());
  });

  afterEach(async () => {
    await databaseManager.close();
  });

  test('should create a record locally and queue it', async () => {
    const client = { name: 'New Client', phone: '123' };
    const result = await databaseManager.create('clients', client);
    
    expect(result.id).toBeDefined();
    expect(result.name).toBe('New Client');
    
    const queued = await localDatabase.getQueuedOperations();
    expect(queued.length).toBe(1);
    expect(queued[0].operation).toBe(OPERATION_TYPES.CREATE);
  });

  test('should resolve conflicts using field-level merging', async () => {
    // 1. Create a local record
    const client = await databaseManager.create('clients', { name: 'Local Name', phone: '123' });
    
    // 2. Mock a remote record with a different field
    const remoteRecord = {
      id: client.id,
      name: 'Local Name', // Same as local
      phone: '456',       // Different from local
      created_at: new Date().toISOString()
    };

    // 3. Manually trigger conflict resolution
    await databaseManager._resolveConflict('clients', remoteRecord);

    // 4. Verify merged result
    const localRecords = await databaseManager.read('clients', { id: client.id });
    expect(localRecords[0].name).toBe('Local Name'); // Kept local/same
    expect(localRecords[0].phone).toBe('456');        // Merged from remote
    expect(localRecords[0]._sync_status).toBe(SYNC_STATUS.PENDING); // Should be pending to upload merged version
  });

  test('should handle exponential backoff on upload failure', async () => {
    // 1. Mock supabase failure
    supabase.from.mockImplementation(() => ({
      insert: jest.fn(() => Promise.resolve({ error: { message: 'Network Error' } }))
    }));

    // 2. Create local record
    await databaseManager.create('clients', { name: 'Fail Test' });

    // 3. Try to sync (should fail and update retry count)
    await databaseManager.syncWithSupabase();

    const ops = await localDatabase.getQueuedOperations();
    expect(ops[0].retry_count).toBe(1);
    expect(ops[0].last_retry).toBeDefined();

    // 4. Try to sync again immediately (should be skipped due to backoff)
    const consoleSpy = jest.spyOn(console, 'log');
    await databaseManager.syncWithSupabase();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping operation'));
    consoleSpy.mockRestore();
  });
});
