'use strict';

require('dotenv').config(); // Load .env file first

const Database = require('better-sqlite3');
const { WebhookServer } = require('./webhookServer');
const path = require('path');

/**
 * Startup script for AutoShift Agent webhook server
 * Usage: node start.js
 */

// Initialize database
const dbPath = path.join(__dirname, '../../autoshift.db');
const db = new Database(dbPath);

console.log(`📦 Database: ${dbPath}`);
console.log('✅ Database connected');

// Initialize and start webhook server
const server = new WebhookServer(db);
server.start(3001);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  db.close();
  process.exit(0);
});
