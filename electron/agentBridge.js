'use strict';

const { ipcMain } = require('electron');
const Database = require('better-sqlite3');
const { ServiceAgent } = require('./agents/serviceAgent');
const { EmailHandler } = require('./agents/emailHandler');
const { setupAdminRoutes } = require('./agents/adminRoutes');
const config = require('./agents/config');
const path = require('path');

/**
 * Agent Bridge - Integrates AI agents into Electron main process
 * Allows React frontend to communicate with agents via IPC
 */

class AgentBridge {
  constructor(mainWindow, dbPath) {
    this.mainWindow = mainWindow;
    this.dbPath = dbPath;
    this.db = null;
    this.agent = null;
    this.email = null;
    this.conversationHistory = new Map();
    this.reminderScheduler = null;

    this.initialize();
    this.setupIpcHandlers();
  }

  initialize() {
    try {
      // Connect to database
      this.db = new Database(this.dbPath);
      console.log('✅ Agent Bridge: Database connected');

      // Initialize services
      this.agent = new ServiceAgent(this.db, config);
      this.email = new EmailHandler(config);

      console.log(`✅ Agent Bridge: Initialized with ${config.llm.provider}/${config.llm.model}`);
    } catch (error) {
      console.error('❌ Agent Bridge initialization failed:', error.message);
    }
  }

  setupIpcHandlers() {
    if (!this.agent) {
      console.warn('⚠️ Agent not initialized - IPC handlers skipped');
      return;
    }

    // ==================== CHAT ====================
    ipcMain.handle('agent:chat', async (event, message, clientId) => {
      try {
        const response = await this.agent.chat(message, clientId);
        return { success: true, response };
      } catch (error) {
        console.error('Chat error:', error.message);
        return { success: false, error: error.message };
      }
    });

    // ==================== APPOINTMENTS ====================
    ipcMain.handle('agent:get-pending-appointments', async (event) => {
      try {
        const appointments = this.agent.getPendingAppointments();
        return { success: true, appointments };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // ==================== EMAIL ====================
    ipcMain.handle('agent:send-email', async (event, { to, clientName, messageType, appointmentDetails }) => {
      try {
        let result;
        if (messageType === 'reminder') {
          result = await this.email.sendServiceReminder(to, clientName, appointmentDetails?.vehicles || [], appointmentDetails?.daysUntilDue || 7);
        } else if (messageType === 'confirmation') {
          result = await this.email.sendAppointmentConfirmation(to, clientName, appointmentDetails?.vehiclePlate, appointmentDetails?.date, appointmentDetails?.time, appointmentDetails?.serviceType);
        } else if (messageType === 'appointment_reminder') {
          result = await this.email.sendAppointmentReminder(to, clientName, appointmentDetails?.vehiclePlate, appointmentDetails?.date, appointmentDetails?.time);
        }
        return { success: true, ...result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // ==================== ADMIN OPERATIONS ====================
    ipcMain.handle('admin:get-dashboard', async (event) => {
      try {
        const stats = {
          totalClients: this.db.prepare('SELECT COUNT(*) as count FROM clients').get().count || 0,
          totalVehicles: this.db.prepare('SELECT COUNT(*) as count FROM cars').get().count || 0,
          totalAppointments: this.db.prepare('SELECT COUNT(*) as count FROM appointments').get().count || 0,
          pendingAppointments: this.db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'Pending'").get().count || 0,
          confirmedAppointments: this.db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'Confirmed'").get().count || 0,
          cancelledAppointments: this.db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'Cancelled'").get().count || 0,
          overdueServices: this.db.prepare("SELECT COUNT(*) as count FROM services WHERE next_due < date('now')").get().count || 0,
          dueThisWeek: this.db.prepare("SELECT COUNT(*) as count FROM services WHERE next_due BETWEEN date('now') AND date('now', '+7 days')").get().count || 0,
        };
        return { success: true, stats };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('admin:get-clients', async (event) => {
      try {
        const clients = this.db.prepare(`
          SELECT c.*, COUNT(DISTINCT ca.id) as vehicle_count
          FROM clients c
          LEFT JOIN cars ca ON c.id = ca.client_id
          GROUP BY c.id
          ORDER BY c.name
        `).all();
        return { success: true, clients };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('admin:get-client', async (event, clientId) => {
      try {
        const client = this.db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
        if (!client) return { success: false, error: 'Client not found' };

        const vehicles = this.db.prepare('SELECT * FROM cars WHERE client_id = ?').all(clientId);
        const appointments = this.db.prepare('SELECT * FROM appointments WHERE client_id = ? ORDER BY date DESC').all(clientId);

        return { success: true, client, vehicles, appointments };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('admin:create-client', async (event, { name, phone, email }) => {
      try {
        const { v4: uuid } = require('uuid');
        const id = uuid();
        this.db.prepare('INSERT INTO clients (id, name, phone, email, since) VALUES (?, ?, ?, ?, date("now"))').run(id, name, phone, email || null);
        return { success: true, id, name, phone, email };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('admin:update-client', async (event, { id, name, phone, email }) => {
      try {
        this.db.prepare('UPDATE clients SET name = ?, phone = ?, email = ?, updated_at = datetime("now") WHERE id = ?').run(name, phone, email || null, id);
        return { success: true, message: 'Client updated' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('admin:create-vehicle', async (event, { plate, make, model, year, color, client_id, mileage }) => {
      try {
        const { v4: uuid } = require('uuid');
        const id = uuid();
        this.db.prepare('INSERT INTO cars (id, plate, make, model, year, color, client_id, mileage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, plate, make, model, year || null, color || null, client_id, mileage || null);
        return { success: true, id, plate, make, model };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('admin:get-vehicles', async (event, clientId) => {
      try {
        const vehicles = this.db.prepare('SELECT * FROM cars WHERE client_id = ?').all(clientId);
        return { success: true, vehicles };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('admin:create-appointment', async (event, { client_id, plate, date, time, type, status }) => {
      try {
        const { v4: uuid } = require('uuid');
        const id = uuid();
        this.db.prepare('INSERT INTO appointments (id, client_id, plate, date, time, type, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, client_id, plate, date, time, type, status || 'Confirmed');
        return { success: true, id, client_id, plate, date, time };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('admin:get-appointments', async (event, { status, plate, client_id }) => {
      try {
        let query = 'SELECT a.*, c.name as client_name, ca.make, ca.model FROM appointments a JOIN clients c ON a.client_id = c.id JOIN cars ca ON a.plate = ca.plate WHERE 1=1';
        if (status) query += ` AND a.status = '${status}'`;
        if (plate) query += ` AND a.plate = '${plate}'`;
        if (client_id) query += ` AND a.client_id = '${client_id}'`;
        query += ' ORDER BY a.date DESC';

        const appointments = this.db.prepare(query).all();
        return { success: true, appointments };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('admin:update-appointment', async (event, { id, date, time, type, status }) => {
      try {
        this.db.prepare('UPDATE appointments SET date = ?, time = ?, type = ?, status = ?, updated_at = datetime("now") WHERE id = ?').run(date, time, type, status, id);
        return { success: true, message: 'Appointment updated' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('admin:cancel-appointment', async (event, id) => {
      try {
        this.db.prepare('UPDATE appointments SET status = ?, updated_at = datetime("now") WHERE id = ?').run('Cancelled', id);
        return { success: true, message: 'Appointment cancelled' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('admin:create-service', async (event, { plate, type, date, next_due, cost, mileage, status, tech, notes }) => {
      try {
        const { v4: uuid } = require('uuid');
        const id = uuid();
        this.db.prepare('INSERT INTO services (id, plate, type, date, next_due, cost, mileage, status, tech, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, plate, type, date, next_due, cost || null, mileage || null, status || 'Completed', tech || null, notes || null);
        return { success: true, id, plate, type };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('admin:get-services', async (event, plate) => {
      try {
        const services = this.db.prepare('SELECT * FROM services WHERE plate = ? ORDER BY date DESC').all(plate);
        return { success: true, services };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    console.log('✅ Agent Bridge: IPC handlers registered');
  }

  /**
   * Start reminder scheduler
   */
  startReminderScheduler() {
    if (this.reminderScheduler) return;

    const checkReminders = async () => {
      try {
        const dueSoon = this.db.prepare(`
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
            AND (s.last_reminder_sent IS NULL OR s.last_reminder_sent <= date('now', '-30 days'))
          GROUP BY cl.id
        `).all();

        if (dueSoon.length > 0) {
          this.mainWindow.webContents.send('agent:reminder-check', { count: dueSoon.length, clients: dueSoon });

          for (const client of dueSoon) {
            try {
              await this.email.sendServiceReminder(client.email, client.name, client.vehicles.split(', '), 14);
              this.db.prepare(`
                UPDATE services SET last_reminder_sent = datetime('now')
                WHERE plate IN (SELECT plate FROM cars WHERE client_id = ?)
                AND next_due <= date('now', '+14 days')
              `).run(client.client_id);
            } catch (error) {
              console.error(`Failed to send reminder to ${client.email}:`, error.message);
            }
          }
        }
      } catch (error) {
        console.error('Reminder scheduler error:', error.message);
      }
    };

    // Run immediately and then every hour
    checkReminders();
    this.reminderScheduler = setInterval(checkReminders, 3600000);
    console.log('⏰ Agent Bridge: Reminder scheduler started');
  }

  /**
   * Stop scheduler and close database
   */
  shutdown() {
    if (this.reminderScheduler) {
      clearInterval(this.reminderScheduler);
    }
    if (this.db) {
      this.db.close();
    }
    console.log('🛑 Agent Bridge: Shutdown complete');
  }
}

module.exports = { AgentBridge };
