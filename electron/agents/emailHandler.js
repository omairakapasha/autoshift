'use strict';

const nodemailer = require('nodemailer');

/**
 * Email notification handler
 * Supports Gmail, SendGrid, and custom SMTP
 */

class EmailHandler {
  constructor(config) {
    this.config = config.email;
    this.provider = this.config.provider;
    this.from = this.config.from;
    this.setupTransporter();
  }

  setupTransporter() {
    if (this.provider === 'gmail') {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: this.config.gmail.user,
          pass: this.config.gmail.password, // Gmail App Password
        },
      });
    } else if (this.provider === 'sendgrid') {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: this.config.sendgrid.apiKey,
        },
      });
    } else if (this.provider === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        secure: this.config.smtp.secure,
        auth: {
          user: this.config.smtp.user,
          pass: this.config.smtp.password,
        },
      });
    } else {
      throw new Error(`Unsupported email provider: ${this.provider}`);
    }

    console.log(`✅ Email service initialized (${this.provider})`);
  }

  /**
   * Send service reminder email
   */
  async sendServiceReminder(clientEmail, clientName, vehicles, daysUntilDue) {
    const subject = `🔧 Service Reminder - ${vehicles}`;
    const html = `
      <h2>Hi ${clientName},</h2>
      <p>Your vehicle(s) need service:</p>
      <ul>
        ${vehicles.map(v => `<li>${v}</li>`).join('')}
      </ul>
      <p><strong>Due in: ${daysUntilDue} days</strong></p>
      <p>
        <a href="https://autoshift.app/book" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">
          Book Service Now
        </a>
      </p>
      <p>Please reply to this email or text us to confirm your appointment.</p>
      <p>AutoShift Team</p>
    `;

    return this.send(clientEmail, subject, html);
  }

  /**
   * Send appointment confirmation email
   */
  async sendAppointmentConfirmation(clientEmail, clientName, vehiclePlate, date, time, serviceType) {
    const subject = `✅ Appointment Confirmed - ${vehiclePlate}`;
    const html = `
      <h2>Hi ${clientName},</h2>
      <p>Your service appointment has been confirmed!</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Vehicle:</strong> ${vehiclePlate}</p>
        <p><strong>Service:</strong> ${serviceType}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Time:</strong> ${time}</p>
      </div>
      <p>Please arrive 10 minutes early. If you need to reschedule, please reply to this email.</p>
      <p>AutoShift Team</p>
    `;

    return this.send(clientEmail, subject, html);
  }

  /**
   * Send appointment reminder email (day before)
   */
  async sendAppointmentReminder(clientEmail, clientName, vehiclePlate, date, time) {
    const subject = `📅 Appointment Tomorrow - ${vehiclePlate}`;
    const html = `
      <h2>Hi ${clientName},</h2>
      <p>This is a friendly reminder about your appointment tomorrow!</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Vehicle:</strong> ${vehiclePlate}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Time:</strong> ${time}</p>
      </div>
      <p>Please arrive on time. If you need to reschedule, contact us immediately.</p>
      <p>AutoShift Team</p>
    `;

    return this.send(clientEmail, subject, html);
  }

  /**
   * Send admin notification of new booking
   */
  async sendAdminNotification(adminEmail, clientName, vehiclePlate, date, time, serviceType, clientPhone) {
    const subject = `🆕 New Appointment Booking - ${vehiclePlate}`;
    const html = `
      <h2>New Service Booking</h2>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
        <p><strong>Client Name:</strong> ${clientName}</p>
        <p><strong>Phone:</strong> ${clientPhone}</p>
        <p><strong>Vehicle:</strong> ${vehiclePlate}</p>
        <p><strong>Service Type:</strong> ${serviceType}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Time:</strong> ${time}</p>
      </div>
      <p>
        <a href="https://autoshift.app/admin/appointments" style="display: inline-block; padding: 10px 20px; background: #28a745; color: white; text-decoration: none; border-radius: 5px;">
          Approve/Reject Booking
        </a>
      </p>
    `;

    return this.send(adminEmail, subject, html);
  }

  /**
   * Generic email send
   */
  async send(to, subject, html) {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
        text: html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      });

      console.log(`✅ Email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send bulk reminders to multiple clients
   */
  async sendBulkReminders(reminders) {
    const results = [];
    for (const reminder of reminders) {
      const result = await this.sendServiceReminder(
        reminder.email,
        reminder.name,
        reminder.vehicles,
        reminder.daysUntilDue
      );
      results.push({ email: reminder.email, ...result });
    }
    return results;
  }

  /**
   * Test email configuration
   */
  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email connection verified');
      return { success: true };
    } catch (error) {
      console.error('❌ Email connection failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { EmailHandler };
