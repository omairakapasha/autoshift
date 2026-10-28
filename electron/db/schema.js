'use strict';

/**
 * Schema + migrations for the local SQLite database.
 *
 * Migrations are run in order inside a transaction. The applied version is
 * tracked with PRAGMA user_version, so adding a change = appending a new
 * function to MIGRATIONS. Never edit a migration that has shipped.
 */

const MIGRATIONS = [
  // v1 — initial schema
  (db) => {
    db.exec(`
      CREATE TABLE clients (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
        phone       TEXT NOT NULL CHECK (length(trim(phone)) > 0),
        email       TEXT,
        since       TEXT NOT NULL DEFAULT (date('now')),
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE TABLE cars (
        id          TEXT PRIMARY KEY,
        plate       TEXT NOT NULL UNIQUE CHECK (length(trim(plate)) > 0),
        make        TEXT NOT NULL,
        model       TEXT NOT NULL,
        year        INTEGER,
        color       TEXT,
        -- RESTRICT: removing a client must never silently wipe their vehicles.
        client_id   TEXT REFERENCES clients(id) ON DELETE RESTRICT,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE TABLE services (
        id          TEXT PRIMARY KEY,
        plate       TEXT NOT NULL REFERENCES cars(plate) ON UPDATE CASCADE ON DELETE CASCADE,
        type        TEXT NOT NULL,
        date        TEXT NOT NULL,
        next_due    TEXT NOT NULL,
        cost        REAL,
        status      TEXT NOT NULL DEFAULT 'Completed',
        tech        TEXT,
        notes       TEXT,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE TABLE appointments (
        id          TEXT PRIMARY KEY,
        plate       TEXT REFERENCES cars(plate) ON UPDATE CASCADE ON DELETE CASCADE,
        client_id   TEXT REFERENCES clients(id) ON DELETE CASCADE,
        date        TEXT NOT NULL,
        time        TEXT NOT NULL,
        type        TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'Pending',
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE TABLE settings (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL,
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE INDEX idx_cars_client        ON cars(client_id);
      CREATE INDEX idx_services_plate     ON services(plate);
      CREATE INDEX idx_services_next_due  ON services(next_due);
      CREATE INDEX idx_appts_date         ON appointments(date);
      CREATE INDEX idx_appts_plate        ON appointments(plate);
      CREATE INDEX idx_clients_phone      ON clients(phone);
    `);
  },
  // v2 — add mileage tracking
  (db) => {
    db.exec(`
      ALTER TABLE cars ADD COLUMN mileage INTEGER;
      ALTER TABLE services ADD COLUMN mileage INTEGER;
    `);
  },
  // v3 — add reminder tracking to prevent duplicate notifications
  (db) => {
    db.exec(`
      ALTER TABLE services ADD COLUMN last_reminder_sent TEXT;
    `);
  },
];

const SCHEMA_VERSION = MIGRATIONS.length;

function migrate(db) {
  const current = db.pragma('user_version', { simple: true });
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `Database is version ${current} but this app only understands up to ${SCHEMA_VERSION}. ` +
      'Update AutoShift before opening this data file.'
    );
  }
  for (let v = current; v < SCHEMA_VERSION; v++) {
    db.transaction(() => {
      MIGRATIONS[v](db);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
  return SCHEMA_VERSION;
}

/**
 * Whitelist of columns the renderer may read/write, per table (camelCase API
 * names). Column names are interpolated into SQL, so ONLY names in this map
 * are ever allowed through.
 */
const TABLES = {
  clients:      { fields: ['name', 'phone', 'email', 'since'], required: ['name', 'phone'] },
  cars:         { fields: ['plate', 'make', 'model', 'year', 'color', 'mileage', 'clientId'], required: ['plate', 'make', 'model'] },
  services:     { fields: ['plate', 'type', 'date', 'nextDue', 'mileage', 'cost', 'status', 'tech', 'notes'], required: ['plate', 'type', 'date', 'nextDue'] },
  appointments: { fields: ['plate', 'clientId', 'date', 'time', 'type', 'status'], required: ['date', 'time', 'type'] },
};

module.exports = { migrate, SCHEMA_VERSION, TABLES };
