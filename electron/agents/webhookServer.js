'use strict';

const express = require('express');
const { ServiceAgent } = require('./serviceAgent');
const { TwilioHandler } = require('./twilioHandler');
const { EmailHandler } = require('./emailHandler');
const config = require('./config');

/**
 * Express server for Twilio webhook and agent management
 * Run this as a separate Node process alongside the Electron app
 */

class WebhookServer {
  constructor(db) {
    this.db = db;
    this.app = express();
    this.agent = new ServiceAgent(db, config);
    this.twilio = new TwilioHandler(config);
    this.email = new EmailHandler(config);
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.urlencoded({ extended: false }));
    this.app.use(express.json());
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: 'AutoShift Agent' });
    });

    // Twilio SMS webhook
    this.app.post('/webhook/sms', async (req, res) => {
      const result = await this.twilio.handleIncomingSMS(req, this.agent);
      res.status(result.success ? 200 : 500).json(result);
    });

    // Manual reminder trigger (admin endpoint)
    this.app.post('/admin/send-reminders', async (req, res) => {
      const reminders = await this.agent.sendServiceReminders();
      const results = await this.twilio.sendBulkReminders(
        reminders.map((r) => ({
          phone: r.phone,
          message: `Service reminder for your vehicles. Reply to book an appointment.`,
        }))
      );
      res.json({ sent: results.length, results });
    });

    // Chat endpoint (for testing or web interface)
    this.app.post('/api/chat', async (req, res) => {
      const { message, clientPhone } = req.body;
      if (!message || !clientPhone) {
        return res.status(400).json({ error: 'Missing message or clientPhone' });
      }

      try {
        const response = await this.agent.chat(message, clientPhone);
        res.json({ response });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // List pending appointments (admin)
    this.app.get('/admin/appointments', (req, res) => {
      const pending = this.db
        .prepare(
          `
        SELECT 
          a.id,
          a.plate,
          a.date,
          a.time,
          a.type,
          c.name as client_name,
          c.phone as client_phone,
          ca.make,
          ca.model
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        JOIN cars ca ON a.plate = ca.plate
        WHERE a.status = 'Pending'
        ORDER BY a.date, a.time
      `
        )
        .all();

      res.json({ pending });
    });

    // Approve/reject appointment
    this.app.post('/admin/appointments/:id/:action', async (req, res) => {
      const { id, action } = req.params;
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
      }

      const status = action === 'approve' ? 'Confirmed' : 'Cancelled';
      this.db
        .prepare('UPDATE appointments SET status = ? WHERE id = ?')
        .run(status, id);

      // Get appointment details and send email confirmation
      const apt = this.db
        .prepare(`
          SELECT a.*, c.email, c.name, ca.plate, ca.make, ca.model
          FROM appointments a
          JOIN clients c ON a.client_id = c.id
          JOIN cars ca ON a.plate = ca.plate
          WHERE a.id = ?
        `)
        .get(id);

      if (apt && apt.email && action === 'approve') {
        await this.email.sendAppointmentConfirmation(
          apt.email,
          apt.name,
          apt.plate,
          apt.date,
          apt.time,
          apt.type
        );
      }

      res.json({ status, appointmentId: id });
    });

    // Email endpoints
    this.app.post('/admin/send-email', async (req, res) => {
      const { to, clientName, messageType, appointmentDetails } = req.body;
      if (!to || !messageType) {
        return res.status(400).json({ error: 'Missing to or messageType' });
      }

      let result;
      if (messageType === 'reminder') {
        result = await this.email.sendServiceReminder(
          to,
          clientName,
          appointmentDetails?.vehicles || [],
          appointmentDetails?.daysUntilDue || 7
        );
      } else if (messageType === 'confirmation') {
        result = await this.email.sendAppointmentConfirmation(
          to,
          clientName,
          appointmentDetails?.vehiclePlate,
          appointmentDetails?.date,
          appointmentDetails?.time,
          appointmentDetails?.serviceType
        );
      } else if (messageType === 'appointment_reminder') {
        result = await this.email.sendAppointmentReminder(
          to,
          clientName,
          appointmentDetails?.vehiclePlate,
          appointmentDetails?.date,
          appointmentDetails?.time
        );
      }

      res.json(result);
    });

    // Test email connection
    this.app.get('/admin/email-test', async (req, res) => {
      const result = await this.email.testConnection();
      res.json(result);
    });
  }

  start(port = 3001) {
    this.app.listen(port, () => {
      console.log(`🤖 AutoShift Agent running on port ${port}`);
      console.log(`Twilio webhook: POST http://localhost:${port}/webhook/sms`);
    });
  }
}

module.exports = { WebhookServer };
