'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const BetterSqlite3 = require('better-sqlite3');
const { migrate, TABLES } = require('./schema');

const toSnake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const IMPORT_ORDER = ['clients', 'cars', 'services', 'appointments']; // FK-safe order
const EXPOSED_META = ['id', 'createdAt', 'updatedAt'];

class ValidationError extends Error {
  constructor(message) { super(message); this.name = 'ValidationError'; }
}

class AutoShiftDatabase {
  /** @param {string} filePath  path to the .db file, or ':memory:' */
  constructor(filePath) {
    this.filePath = filePath;
    if (filePath !== ':memory:') fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new BetterSqlite3(filePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('synchronous = NORMAL');
    migrate(this.db);
    this._stmts = new Map();
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  _table(name) {
    const t = TABLES[name];
    if (!t) throw new ValidationError(`Unknown table: ${name}`);
    return t;
  }

  _stmt(sql) {
    let s = this._stmts.get(sql);
    if (!s) { s = this.db.prepare(sql); this._stmts.set(sql, s); }
    return s;
  }

  /** Keep only whitelisted fields, normalise empties, coerce numbers. */
  _clean(table, data, { partial }) {
    const { fields, required } = this._table(table);
    const out = {};
    for (const f of fields) {
      if (data[f] === undefined) continue;
      let v = data[f];
      if (typeof v === 'string') v = v.trim();
      if (v === '') v = null;
      if (f === 'year' && v != null) v = Number.parseInt(v, 10);
      if (f === 'cost' && v != null) v = Number(v);
      if ((f === 'year' || f === 'cost') && v != null && Number.isNaN(v)) {
        throw new ValidationError(`${f} must be a number`);
      }
      if (f === 'plate' && typeof v === 'string') v = v.toUpperCase();
      out[f] = v;
    }
    const needed = partial ? required.filter((f) => f in out) : required;
    for (const f of needed) {
      if (out[f] == null) throw new ValidationError(`${table.slice(0, -1)} ${f} is required`);
    }
    return out;
  }

  _row(row) {
    if (!row) return row;
    const o = {};
    for (const [k, v] of Object.entries(row)) o[toCamel(k)] = v;
    return o;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  create(table, data) {
    const clean = this._clean(table, data || {}, { partial: false });
    const id = (data && data.id) || crypto.randomUUID();
    const cols = ['id', ...Object.keys(clean).map(toSnake)];
    const vals = [id, ...Object.values(clean)];
    this._stmt(
      `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    ).run(...vals);
    return this.getById(table, id);
  }

  getById(table, id) {
    this._table(table);
    return this._row(this._stmt(`SELECT * FROM ${table} WHERE id = ?`).get(id));
  }

  /** read('cars', { clientId: '…' }) — equality filters on whitelisted fields only */
  read(table, query = {}) {
    const { fields } = this._table(table);
    const where = [];
    const params = [];
    for (const [k, v] of Object.entries(query || {})) {
      if (k !== 'id' && !fields.includes(k)) throw new ValidationError(`Cannot filter ${table} by ${k}`);
      where.push(`${toSnake(k)} = ?`);
      params.push(v);
    }
    const sql = `SELECT * FROM ${table}` +
      (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
      ' ORDER BY created_at ASC, rowid ASC';
    return this._stmt(sql).all(...params).map((r) => this._row(r));
  }

  update(table, id, data) {
    const clean = this._clean(table, data || {}, { partial: true });
    const keys = Object.keys(clean);
    if (keys.length) {
      const sets = keys.map((k) => `${toSnake(k)} = ?`).join(', ');
      const res = this._stmt(
        `UPDATE ${table} SET ${sets}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
      ).run(...keys.map((k) => clean[k]), id);
      if (res.changes === 0) throw new ValidationError(`${table} record not found: ${id}`);
    }
    const row = this.getById(table, id);
    if (!row) throw new ValidationError(`${table} record not found: ${id}`);
    return row;
  }

  delete(table, id) {
    this._table(table);
    return this._stmt(`DELETE FROM ${table} WHERE id = ?`).run(id).changes > 0;
  }

  getAll() {
    return Object.fromEntries(IMPORT_ORDER.map((t) => [t, this.read(t)]));
  }

  stats() {
    return Object.fromEntries(
      IMPORT_ORDER.map((t) => [t, this._stmt(`SELECT COUNT(*) c FROM ${t}`).get().c])
    );
  }

  // ── settings (key/value, JSON-encoded) ───────────────────────────────────
  getSetting(key, fallback = null) {
    const row = this._stmt('SELECT value FROM settings WHERE key = ?').get(key);
    if (!row) return fallback;
    try { return JSON.parse(row.value); } catch { return fallback; }
  }

  setSetting(key, value) {
    this._stmt(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
    ).run(key, JSON.stringify(value));
    return value;
  }

  // ── export / import ──────────────────────────────────────────────────────
  exportJson() {
    return { app: 'autoshift', version: 1, exportedAt: new Date().toISOString(), ...this.getAll() };
  }

  /**
   * Merge a JSON backup into the database (upsert by id). Accepts this
   * app's export format AND the legacy IndexedDB export (snake_case keys,
   * `_sync_status` etc. — unknown/underscore keys are ignored).
   * All-or-nothing: any invalid record rolls the whole import back.
   */
  importJson(payload) {
    if (!payload || typeof payload !== 'object') throw new ValidationError('Backup file is not valid');
    if (!IMPORT_ORDER.some((t) => Array.isArray(payload[t]))) {
      throw new ValidationError('Backup file contains no clients, cars, services or appointments');
    }
    const counts = {};
    this.db.transaction(() => {
      for (const table of IMPORT_ORDER) {
        const records = Array.isArray(payload[table]) ? payload[table] : [];
        counts[table] = 0;
        for (const raw of records) {
          const rec = {};
          for (const [k, v] of Object.entries(raw)) rec[toCamel(k)] = v;
          if (!rec.id) rec.id = crypto.randomUUID();
          const clean = this._clean(table, rec, { partial: false });
          const meta = {};
          if (rec.createdAt) meta.created_at = rec.createdAt;
          const cols = ['id', ...Object.keys(clean).map(toSnake), ...Object.keys(meta)];
          const vals = [rec.id, ...Object.values(clean), ...Object.values(meta)];
          const updates = cols.filter((c) => c !== 'id' && c !== 'created_at')
            .map((c) => `${c} = excluded.${c}`).join(', ');
          this._stmt(
            `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})
             ON CONFLICT(id) DO UPDATE SET ${updates},
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
          ).run(...vals);
          counts[table]++;
        }
      }
    })();
    return counts;
  }

  // ── backups ──────────────────────────────────────────────────────────────
  /**
   * Consistent online copy using SQLite's backup API (safe with WAL).
   * Written to a unique <dest>.<pid>-<time>.partial file and renamed only on success, so an interrupted
   * backup can never be mistaken for a valid one.
   */
  async backupTo(destFile) {
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    const tmp = `${destFile}.${process.pid}-${Date.now()}.partial`;
    try {
      await this.db.backup(tmp);
      fs.renameSync(tmp, destFile);
    } catch (err) {
      try { fs.unlinkSync(tmp); } catch { /* nothing to clean */ }
      throw err;
    }
    return destFile;
  }

  /** Delete oldest autoshift-*.db files, keeping the newest `keep`. */
  static pruneBackups(dir, keep = 14) {
    if (!fs.existsSync(dir)) return [];
    fs.readdirSync(dir).filter((f) => /^autoshift-.*\.partial$/.test(f))
      .forEach((f) => { try { fs.unlinkSync(path.join(dir, f)); } catch { /* ignore */ } });
    const files = fs.readdirSync(dir).filter((f) => /^autoshift-.*\.db$/.test(f)).sort();
    const doomed = files.slice(0, Math.max(0, files.length - keep));
    doomed.forEach((f) => fs.unlinkSync(path.join(dir, f)));
    return doomed;
  }

  close() {
    this._stmts.clear();
    if (this.db.open) this.db.close();
  }
}

module.exports = { AutoShiftDatabase, ValidationError, EXPOSED_META };
