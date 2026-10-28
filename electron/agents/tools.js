'use strict';

const { tool } = require('@langchain/core/tool');
const { z } = require('zod');

/**
 * Tool definitions for the service reminder agent
 * These tools allow the LLM to access database and booking functions
 */

function createTools(db) {
  return [
    // Tool 1: Get vehicles requiring service
    tool(
      async ({ clientPhone }) => {
        const client = db
          .prepare('SELECT id FROM clients WHERE phone = ?')
          .get(clientPhone);

        if (!client) return { error: 'Client not found' };

        const dueSoon = db
          .prepare(`
            SELECT 
              c.plate,
              c.make,
              c.model,
              c.year,
              s.type,
              s.next_due,
              CAST((julianday(s.next_due) - julianday('now')) AS INTEGER) as days_until
            FROM cars c
            LEFT JOIN services s ON c.plate = s.plate
            WHERE c.client_id = ?
              AND (s.next_due IS NULL OR s.next_due <= date('now', '+14 days'))
            ORDER BY s.next_due ASC
          `)
          .all(client.id);

        return { vehicles: dueSoon || [] };
      },
      {
        name: 'get_due_services',
        description: 'Get all vehicles for a client that have services due or overdue soon',
        schema: z.object({
          clientPhone: z.string().describe('Client phone number'),
        }),
      }
    ),

    // Tool 2: Get available appointment slots
    tool(
      async ({ date }) => {
        const slots = [
          { time: '09:00', available: true },
          { time: '10:00', available: true },
          { time: '11:00', available: true },
          { time: '14:00', available: true },
          { time: '15:00', available: true },
          { time: '16:00', available: true },
        ];

        // Check for existing appointments on this date
        const booked = db
          .prepare('SELECT time FROM appointments WHERE date = ?')
          .all(date)
          .map(a => a.time);

        return {
          date,
          slots: slots.map(s => ({
            ...s,
            available: !booked.includes(s.time),
          })),
        };
      },
      {
        name: 'get_appointment_slots',
        description: 'Get available appointment time slots for a specific date',
        schema: z.object({
          date: z.string().describe('Date in YYYY-MM-DD format'),
        }),
      }
    ),

    // Tool 3: Book appointment
    tool(
      async ({ clientPhone, vehiclePlate, date, time, serviceType }) => {
        const client = db
          .prepare('SELECT id FROM clients WHERE phone = ?')
          .get(clientPhone);

        if (!client) return { error: 'Client not found' };

        const vehicle = db
          .prepare('SELECT id FROM cars WHERE plate = ? AND client_id = ?')
          .get(vehiclePlate, client.id);

        if (!vehicle) return { error: 'Vehicle not found for this client' };

        // Check if slot is available
        const existing = db
          .prepare('SELECT id FROM appointments WHERE date = ? AND time = ?')
          .get(date, time);

        if (existing) return { error: 'This time slot is already booked' };

        // Create appointment
        const id = `apt_${Date.now()}`;
        db.prepare(`
          INSERT INTO appointments (id, plate, client_id, date, time, type, status)
          VALUES (?, ?, ?, ?, ?, ?, 'Pending')
        `).run(id, vehiclePlate, client.id, date, time, serviceType);

        return {
          success: true,
          appointmentId: id,
          message: `Appointment booked for ${date} at ${time}`,
        };
      },
      {
        name: 'book_appointment',
        description: 'Book a service appointment for a vehicle',
        schema: z.object({
          clientPhone: z.string(),
          vehiclePlate: z.string(),
          date: z.string().describe('YYYY-MM-DD'),
          time: z.string().describe('HH:MM in 24-hour format'),
          serviceType: z.string().describe('Type of service needed'),
        }),
      }
    ),

    // Tool 4: Send notification to staff
    tool(
      async ({ appointmentId, message }) => {
        // In production, this would send email/SMS to staff
        console.log(`[STAFF ALERT] Appointment ${appointmentId}: ${message}`);
        return { notified: true, message };
      },
      {
        name: 'notify_staff',
        description: 'Send notification to admin/staff about a new appointment',
        schema: z.object({
          appointmentId: z.string(),
          message: z.string(),
        }),
      }
    ),

    // Tool 5: Send SMS to client
    tool(
      async ({ clientPhone, message }) => {
        // In production, this would use Twilio client to send SMS
        console.log(`[SMS] To ${clientPhone}: ${message}`);
        return { sent: true, to: clientPhone };
      },
      {
        name: 'send_sms',
        description: 'Send SMS message to client',
        schema: z.object({
          clientPhone: z.string(),
          message: z.string().describe('SMS message content (160 chars or less)'),
        }),
      }
    ),
  ];
}

module.exports = { createTools };
