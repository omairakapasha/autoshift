/**
 * LocalDatabase - IndexedDB implementation for offline-first sync capability
 * 
 * This module provides a complete local database that mirrors the Supabase schema
 * with additional sync metadata fields for offline operations and conflict resolution.
 */

/**
 * LocalQueryBuilder - Provides Supabase-like query syntax for LocalDatabase
 */
class LocalQueryBuilder {
  constructor(database, tableName, fields) {
    this.database = database;
    this.tableName = tableName;
    this.query = {
      $select: fields
    };
  }

  eq(column, value) {
    this.query[column] = value;
    return this;
  }

  neq(column, value) {
    this.query[`${column}$neq`] = value;
    return this;
  }

  gt(column, value) {
    this.query[`${column}$gt`] = value;
    return this;
  }

  lt(column, value) {
    this.query[`${column}$lt`] = value;
    return this;
  }

  order(column, ascending = true) {
    this.query.$order = `${column}:${ascending ? 'asc' : 'desc'}`;
    return this;
  }

  limit(count) {
    this.query.$limit = count;
    return this;
  }

  offset(count) {
    this.query.$offset = count;
    return this;
  }

  async single() {
    this.query.$limit = 1;
    const results = await this.database.read(this.tableName, this.query);
    return results.length > 0 ? results[0] : null;
  }

  async execute() {
    return this.database.read(this.tableName, this.query);
  }
}

// Database configuration
const DB_NAME = 'AutoShowroomDB';
const DB_VERSION = 2;

// Sync status constants
export const SYNC_STATUS = {
  SYNCED: 'synced',
  PENDING: 'pending', 
  CONFLICT: 'conflict'
};

// Operation types for queue
export const OPERATION_TYPES = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete'
};

/**
 * LocalDatabase class - Main interface for IndexedDB operations
 */
export class LocalDatabase {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;
        
        console.log(`Database upgrade from version ${oldVersion} to ${DB_VERSION}`);
        this._createSchema(db, oldVersion);
      };
    });
  }

  _createSchema(db, oldVersion) {
    // Create clients table
    if (!db.objectStoreNames.contains('clients')) {
      const clientsStore = db.createObjectStore('clients', { keyPath: 'id', autoIncrement: true });
      clientsStore.createIndex('name', 'name', { unique: false });
      clientsStore.createIndex('phone', 'phone', { unique: false });
      clientsStore.createIndex('email', 'email', { unique: false });
      clientsStore.createIndex('since', 'since', { unique: false });
      clientsStore.createIndex('created_at', 'created_at', { unique: false });
      clientsStore.createIndex('_sync_status', '_sync_status', { unique: false });
      clientsStore.createIndex('_last_modified', '_last_modified', { unique: false });
      clientsStore.createIndex('_version', '_version', { unique: false });
    }

    // Create cars table
    if (!db.objectStoreNames.contains('cars')) {
      const carsStore = db.createObjectStore('cars', { keyPath: 'id', autoIncrement: true });
      carsStore.createIndex('plate', 'plate', { unique: true });
      carsStore.createIndex('make', 'make', { unique: false });
      carsStore.createIndex('model', 'model', { unique: false });
      carsStore.createIndex('year', 'year', { unique: false });
      carsStore.createIndex('color', 'color', { unique: false });
      carsStore.createIndex('client_id', 'client_id', { unique: false });
      carsStore.createIndex('created_at', 'created_at', { unique: false });
      carsStore.createIndex('_sync_status', '_sync_status', { unique: false });
      carsStore.createIndex('_last_modified', '_last_modified', { unique: false });
      carsStore.createIndex('_version', '_version', { unique: false });
    }

    // Create services table
    if (!db.objectStoreNames.contains('services')) {
      const servicesStore = db.createObjectStore('services', { keyPath: 'id', autoIncrement: true });
      servicesStore.createIndex('plate', 'plate', { unique: false });
      servicesStore.createIndex('type', 'type', { unique: false });
      servicesStore.createIndex('date', 'date', { unique: false });
      servicesStore.createIndex('next_due', 'next_due', { unique: false });
      servicesStore.createIndex('cost', 'cost', { unique: false });
      servicesStore.createIndex('status', 'status', { unique: false });
      servicesStore.createIndex('tech', 'tech', { unique: false });
      servicesStore.createIndex('created_at', 'created_at', { unique: false });
      servicesStore.createIndex('_sync_status', '_sync_status', { unique: false });
      servicesStore.createIndex('_last_modified', '_last_modified', { unique: false });
      servicesStore.createIndex('_version', '_version', { unique: false });
    }

    // Create appointments table
    if (!db.objectStoreNames.contains('appointments')) {
      const appointmentsStore = db.createObjectStore('appointments', { keyPath: 'id', autoIncrement: true });
      appointmentsStore.createIndex('plate', 'plate', { unique: false });
      appointmentsStore.createIndex('client_id', 'client_id', { unique: false });
      appointmentsStore.createIndex('date', 'date', { unique: false });
      appointmentsStore.createIndex('time', 'time', { unique: false });
      appointmentsStore.createIndex('type', 'type', { unique: false });
      appointmentsStore.createIndex('status', 'status', { unique: false });
      appointmentsStore.createIndex('created_at', 'created_at', { unique: false });
      appointmentsStore.createIndex('_sync_status', '_sync_status', { unique: false });
      appointmentsStore.createIndex('_last_modified', '_last_modified', { unique: false });
      appointmentsStore.createIndex('_version', '_version', { unique: false });
    }

    if (!db.objectStoreNames.contains('sync_metadata')) {
      const syncMetadataStore = db.createObjectStore('sync_metadata', { keyPath: 'table_name' });
      syncMetadataStore.createIndex('last_sync', 'last_sync', { unique: false });
      syncMetadataStore.createIndex('checksum', 'checksum', { unique: false });
    }

    if (!db.objectStoreNames.contains('operation_queue')) {
      const operationQueueStore = db.createObjectStore('operation_queue', { keyPath: 'id' });
      operationQueueStore.createIndex('table_name', 'table_name', { unique: false });
      operationQueueStore.createIndex('operation', 'operation', { unique: false });
      operationQueueStore.createIndex('timestamp', 'timestamp', { unique: false });
      operationQueueStore.createIndex('retry_count', 'retry_count', { unique: false });
    }
  }

  _addSyncMetadata(record, isNew = true) {
    const now = new Date().toISOString();
    if (record._sync_status && record._last_modified && record._version && isNew) {
      return { ...record, created_at: record.created_at || now };
    }
    return {
      ...record,
      _sync_status: SYNC_STATUS.PENDING,
      _last_modified: now,
      _version: isNew ? 1 : (record._version || 0) + 1,
      created_at: record.created_at || now
    };
  }

  async create(tableName, data) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([tableName], 'readwrite');
      const store = transaction.objectStore(tableName);
      const recordWithMetadata = this._addSyncMetadata(data, true);
      const request = store.add(recordWithMetadata);
      request.onsuccess = () => resolve({ ...recordWithMetadata, id: request.result });
      request.onerror = () => reject(new Error(`Failed to create: ${request.error}`));
    });
  }

  async read(tableName, query = {}) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([tableName], 'readonly');
      const store = transaction.objectStore(tableName);
      if (Object.keys(query).length === 0) {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(new Error(`Failed to read: ${request.error}`));
        return;
      }
      this._handleAdvancedQuery(store, query, resolve, reject);
    });
  }

  _handleAdvancedQuery(store, query, resolve, reject) {
    const filters = Object.entries(query).filter(([key]) => !key.startsWith('$'));
    
    // Check if we can use an index for the first filter
    if (filters.length > 0) {
      const [key, value] = filters[0];
      if (store.indexNames.contains(key)) {
        const index = store.index(key);
        const request = index.getAll(value);
        request.onsuccess = () => {
          let results = request.result || [];
          
          // Apply remaining filters in-memory
          if (filters.length > 1) {
            const remainingFilters = filters.slice(1);
            results = results.filter(record => 
              remainingFilters.every(([k, v]) => record[k] === v)
            );
          }
          
          this._applyOrderingAndPaging(results, query, resolve);
        };
        request.onerror = () => reject(new Error(`Index query failed: ${request.error}`));
        return;
      }
    }

    // Fallback to full table scan if no index is available for the first filter
    const request = store.getAll();
    request.onsuccess = () => {
      let results = request.result || [];
      if (filters.length > 0) {
        results = results.filter(record => 
          filters.every(([key, value]) => record[key] === value)
        );
      }
      this._applyOrderingAndPaging(results, query, resolve);
    };
    request.onerror = () => reject(new Error(`Query failed: ${request.error}`));
  }

  _applyOrderingAndPaging(results, query, resolve) {
    if (query.$order) {
      const [field, direction = 'asc'] = query.$order.split(':');
      results.sort((a, b) => {
        const aVal = a[field], bVal = b[field];
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    if (query.$offset) results = results.slice(query.$offset);
    if (query.$limit) results = results.slice(0, query.$limit);
    resolve(results);
  }

  async update(tableName, id, data) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([tableName], 'readwrite');
      const store = transaction.objectStore(tableName);
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) return reject(new Error(`Record ${id} not found`));
        const updated = this._addSyncMetadata({ ...existing, ...data, id }, false);
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve(updated);
        putRequest.onerror = () => reject(new Error(`Update failed: ${putRequest.error}`));
      };
    });
  }

  async delete(tableName, id) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([tableName], 'readwrite');
      const store = transaction.objectStore(tableName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Delete failed: ${request.error}`));
    });
  }

  async queueOperation(tableName, operation, data) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['operation_queue'], 'readwrite');
      const store = transaction.objectStore('operation_queue');
      const op = {
        id: `${tableName}_${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        table_name: tableName, 
        operation, 
        data, 
        timestamp: new Date().toISOString(), 
        retry_count: 0,
        last_retry: null
      };
      const request = store.add(op);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Queue failed: ${request.error}`));
    });
  }

  async getQueuedOperations() {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['operation_queue'], 'readonly');
      const store = transaction.objectStore('operation_queue');
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
      request.onerror = () => reject(new Error(`Get queue failed: ${request.error}`));
    });
  }

  async removeQueuedOperation(id) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['operation_queue'], 'readwrite');
      const store = transaction.objectStore('operation_queue');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Remove from queue failed: ${request.error}`));
    });
  }

  async updateOperationRetryCount(id, retryCount) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['operation_queue'], 'readwrite');
      const store = transaction.objectStore('operation_queue');
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const op = getRequest.result;
        if (op) {
          op.retry_count = retryCount;
          op.last_retry = new Date().toISOString();
          store.put(op);
          resolve();
        } else {
          reject(new Error(`Operation ${id} not found`));
        }
      };
      getRequest.onerror = () => reject(new Error(`Update retry count failed: ${getRequest.error}`));
    });
  }

  async backup() {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const tables = ['clients', 'cars', 'services', 'appointments'];
    const backupData = {};
    for (const table of tables) {
      backupData[table] = await this.read(table);
    }
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    return blob;
  }

  async getStats() {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const tables = ['clients', 'cars', 'services', 'appointments'];
    const stats = {};
    for (const table of tables) {
      stats[table] = await new Promise((resolve) => {
        const transaction = this.db.transaction([table], 'readonly');
        const store = transaction.objectStore(table);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
      });
    }
    return stats;
  }

  async clearAll() {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const tableNames = ['clients', 'cars', 'services', 'appointments', 'sync_metadata', 'operation_queue'];
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(tableNames, 'readwrite');
      let completed = 0;
      tableNames.forEach(tableName => {
        transaction.objectStore(tableName).clear().onsuccess = () => {
          if (++completed === tableNames.length) resolve();
        };
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  select(tableName, fields = '*') {
    return new LocalQueryBuilder(this, tableName, fields);
  }
}

export const localDatabase = new LocalDatabase();
export { DB_NAME, DB_VERSION };
