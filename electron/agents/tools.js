'use strict';

/**
 * Tool definitions for the service reminder agent
 * Simple tool interface: { name, description, func }
 */

function createTools(db) {
  return [
    // Tool 1: Get services due for a client
    {
      name: 'get_due_services',
      description: 'Get list of services due for a vehicle or all client vehicles',
      func: async (params) => {
        const { plate, client_id } = params;
        
        let query = `
          SELECT 
            s.service_type,
            s.next_due,
            s.last_service_date,
            c.plate,
            c.make,
            c.model,
            c.mileage
          FROM services s
          JOIN cars c ON s.plate = c.plate
          WHERE 1=1
        `;
        
        const params = [];
        if (plate) {
          query += ` AND c.plate = ?`;
          params.push(plate);
        } else if (client_id) {
          query += ` AND c.client_id = ?`;
          params.push(client_id);
        }
        
        query += ` ORDER BY s.next_due ASC`;
        
        return db.prepare(query).all(...params);
      },
    },

    // Tool 2: Get available appointment slots
    {
      name: 'get_appointment_slots',
      description: 'Get available appointment slots for booking',
      func: async (params) => {
        const { date } = params;
        
        // Return mock slots (in production, query actual availability)
        const slots = [
          { time: '09:00', available: true },
          { time: '10:00', available: true },
          { time: '11:00', available: false },
          { time: '14:00', available: true },
          { time: '15:00', available: true },
          { time: '16:00', available: true },
        ];
        
        return { date: date || 'Today', slots };
      },
    },

    // Tool 3: Book an appointment
    {
      name: 'book_appointment',
      description: 'Book a service appointment for a vehicle',
      func: async (params) => {
        const { client_id, plate, date, time, service_type } = params;
        
        if (!client_id || !plate || !date || !time || !service_type) {
          return { 
            success: false,
            error: 'Missing required parameters: client_id, plate, date, time, service_type'
          };
        }
        
        try {
          db.prepare(`
            INSERT INTO appointments (client_id, plate, date, time, type, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'Pending', datetime('now'))
          `).run(client_id, plate, date, time, service_type);
          
          return {
            success: true,
            message: `Appointment booked for ${plate} on ${date} at ${time} for ${service_type}`,
            status: 'Pending approval'
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
    },

    // Tool 4: Notify staff of new booking
    {
      name: 'notify_staff',
      description: 'Send notification to staff about new appointment booking',
      func: async (params) => {
        const { appointment_id, staff_email } = params;
        
        console.log(`[STAFF_ALERT] Notification sent to ${staff_email} for appointment ${appointment_id}`);
        
        return {
          success: true,
          message: `Staff notified about appointment`,
          notified: staff_email
        };
      },
    },

    // Tool 5: Send SMS to client
    {
      name: 'send_sms',
      description: 'Send SMS message to client',
      func: async (params) => {
        const { client_phone, message } = params;
        
        if (!client_phone || !message) {
          return { 
            success: false,
            error: 'Missing parameters: client_phone, message'
          };
        }
        
        console.log(`[SMS] To ${client_phone}: ${message}`);
        
        return { 
          success: true, 
          to: client_phone,
          message: message.substring(0, 160) // SMS length limit
        };
      },
    },

    // Tool 6: Send email to client
    {
      name: 'send_email',
      description: 'Send email to client with service info or appointment details',
      func: async (params) => {
        const { client_email, subject, messageType, appointmentDetails } = params;
        
        if (!client_email || !subject) {
          return { 
            success: false,
            error: 'Missing parameters: client_email, subject'
          };
        }
        
        console.log(`[EMAIL] To ${client_email}: ${subject}`);
        console.log(`  Type: ${messageType || 'general'}`);
        
        return {
          success: true,
          to: client_email,
          subject: subject,
          type: messageType || 'general'
        };
      },
    },
  ];
}

module.exports = { createTools };
