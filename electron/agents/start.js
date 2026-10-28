'use strict';

require('dotenv').config(); // Load .env file first

const Database = require('better-sqlite3');
const { WebhookServer } = require('./webhookServer');
const { ServiceAgent } = require('./serviceAgent');
const { EmailHandler } = require('./emailHandler');
const config = require('./config');
const path = require('path');

/**
 * Startup script for AutoShift Agent webhook server
 * Includes automatic service reminder scheduler
 * Usage: node start.js
 */

// Initialize database
const dbPath = path.join(__dirname, '../../autoshift.db');
const db = new Database(dbPath);

console.log(`📦 Database: ${dbPath}`);
console.log('✅ Database connected');

// Initialize services
const agent = new ServiceAgent(db, config);
const email = new EmailHandler(config);

// Initialize and start webhook server
const server = new WebhookServer(db);
server.start(3001);

/**
 * Scheduler: Check for due services every hour
 */
function startReminderScheduler() {
  // Run immediately on startup
  checkAndSendReminders();

  // Then run every hour (3600000 ms)
  const interval = setInterval(checkAndSendReminders, 3600000);

  console.log('⏰ Service reminder scheduler started (checks every hour)');

  // Graceful shutdown for scheduler
  process.on('SIGINT', () => {
    clearInterval(interval);
  });
}

/**
 * Check for due services and send reminders
 */
async function checkAndSendReminders() {
  try {
    console.log(`\n🔍 [${new Date().toLocaleString()}] Checking for due services...`);

    // Check if tables exist first
    const tableCheck = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('clients', 'cars', 'services')`)
      .all();

    if (tableCheck.length < 3) {
      console.log('⏭️  Database not initialized yet (missing tables)');
      return;
    }

    const dueSoon = db
      .prepare(`
        SELECT DISTINCT
          cl.id as client_id,
          cl.phone,
          cl.email,
          cl.name,
          GROUP_CONCAT(c.plate || ' (' || c.make || ' ' || c.model || ')') as vehicles,
          COUNT(*) as count
        FROM clients cl
        JOIN cars c ON cl.id = c.client_id
        JOIN services s ON c.plate = s.plate
        WHERE s.next_due <= date('now', '+14 days')
          AND s.next_due > date('now', '-1 days')
        GROUP BY cl.id
      `)
      .all();

    if (dueSoon.length === 0) {
      console.log('✅ No reminders needed');
      return;
    }

    console.log(`📬 Found ${dueSoon.length} client(s) with due services`);

    // Send reminders
    for (const client of dueSoon) {
      try {
        // Send email reminder
        const emailResult = await email.sendServiceReminder(
          client.email,
          client.name,
          client.vehicles.split(', '),
          14
        );

        if (emailResult.success) {
          console.log(`  ✅ Email sent to ${client.email}`);
        } else {
          console.log(`  ❌ Email failed for ${client.email}: ${emailResult.error}`);
        }

        // Log SMS placeholder (will use Twilio when available)
        console.log(`  📱 SMS ready for ${client.phone} (Twilio not configured)`);
      } catch (error) {
        console.error(`  ❌ Error sending reminders to ${client.name}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ Scheduler error:', error.message);
  }
}

// Start the scheduler
startReminderScheduler();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  db.close();
  process.exit(0);
});
