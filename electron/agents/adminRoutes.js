'use strict';

const { v4: uuid } = require('uuid');

/**
 * Admin API Routes - Complete CRUD for Clients, Vehicles, Services, Appointments
 * All endpoints require authorization in production
 */

function setupAdminRoutes(app, db) {
  // ==================== DASHBOARD ====================

  /**
   * GET /admin/dashboard - Overview stats
   */
  app.get('/admin/dashboard', (req, res) => {
    try {
      const stats = {
        totalClients: db.prepare('SELECT COUNT(*) as count FROM clients').get().count || 0,
        totalVehicles: db.prepare('SELECT COUNT(*) as count FROM cars').get().count || 0,
        totalAppointments: db.prepare('SELECT COUNT(*) as count FROM appointments').get().count || 0,
        
        pendingAppointments: db.prepare(
          "SELECT COUNT(*) as count FROM appointments WHERE status = 'Pending'"
        ).get().count || 0,
        
        confirmedAppointments: db.prepare(
          "SELECT COUNT(*) as count FROM appointments WHERE status = 'Confirmed'"
        ).get().count || 0,
        
        cancelledAppointments: db.prepare(
          "SELECT COUNT(*) as count FROM appointments WHERE status = 'Cancelled'"
        ).get().count || 0,

        overdueServices: db.prepare(
          "SELECT COUNT(*) as count FROM services WHERE next_due < date('now')"
        ).get().count || 0,

        dueThisWeek: db.prepare(
          "SELECT COUNT(*) as count FROM services WHERE next_due BETWEEN date('now') AND date('now', '+7 days')"
        ).get().count || 0,

        // Recent appointments (next 5)
        upcomingAppointments: db.prepare(`
          SELECT 
            a.id, a.plate, a.date, a.time, a.type, a.status,
            c.name as client_name, c.phone
          FROM appointments a
          JOIN clients c ON a.client_id = c.id
          WHERE a.date >= date('now')
          ORDER BY a.date, a.time
          LIMIT 5
        `).all(),

        // Overdue services (top 5)
        overdueServicesList: db.prepare(`
          SELECT 
            s.id, s.plate, s.type, s.next_due,
            ca.make, ca.model,
            cl.name as client_name, cl.email
          FROM services s
          JOIN cars ca ON s.plate = ca.plate
          JOIN clients cl ON ca.client_id = cl.id
          WHERE s.next_due < date('now')
          ORDER BY s.next_due
          LIMIT 5
        `).all(),
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== CLIENTS ====================

  /**
   * GET /admin/clients - List all clients
   */
  app.get('/admin/clients', (req, res) => {
    try {
      const clients = db.prepare(`
        SELECT 
          c.id, c.name, c.phone, c.email, c.since,
          COUNT(DISTINCT ca.id) as vehicle_count,
          COUNT(DISTINCT a.id) as appointment_count
        FROM clients c
        LEFT JOIN cars ca ON c.id = ca.client_id
        LEFT JOIN appointments a ON c.id = a.client_id
        GROUP BY c.id
        ORDER BY c.name
      `).all();

      res.json({ clients });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /admin/clients/:id - Get single client with vehicles & appointments
   */
  app.get('/admin/clients/:id', (req, res) => {
    try {
      const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
      
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const vehicles = db.prepare('SELECT * FROM cars WHERE client_id = ?').all(req.params.id);
      const appointments = db.prepare(`
        SELECT * FROM appointments WHERE client_id = ? ORDER BY date DESC
      `).all(req.params.id);

      res.json({ client, vehicles, appointments });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /admin/clients - Create new client
   */
  app.post('/admin/clients', (req, res) => {
    try {
      const { name, phone, email } = req.body;

      if (!name || !phone) {
        return res.status(400).json({ error: 'name and phone required' });
      }

      const id = uuid();
      db.prepare(`
        INSERT INTO clients (id, name, phone, email, since)
        VALUES (?, ?, ?, ?, date('now'))
      `).run(id, name, phone, email || null);

      res.json({ id, name, phone, email, message: 'Client created' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /admin/clients/:id - Update client
   */
  app.put('/admin/clients/:id', (req, res) => {
    try {
      const { name, phone, email } = req.body;

      const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      db.prepare(`
        UPDATE clients 
        SET name = ?, phone = ?, email = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(name || client.name, phone || client.phone, email !== undefined ? email : client.email, req.params.id);

      res.json({ id: req.params.id, message: 'Client updated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /admin/clients/:id - Delete client (RESTRICT if has appointments)
   */
  app.delete('/admin/clients/:id', (req, res) => {
    try {
      const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const appointments = db.prepare('SELECT COUNT(*) as count FROM appointments WHERE client_id = ?').get(req.params.id);
      if (appointments.count > 0) {
        return res.status(409).json({ error: 'Cannot delete client with appointments' });
      }

      db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
      res.json({ message: 'Client deleted' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== VEHICLES ====================

  /**
   * POST /admin/vehicles - Create vehicle
   */
  app.post('/admin/vehicles', (req, res) => {
    try {
      const { plate, make, model, year, color, client_id, mileage } = req.body;

      if (!plate || !make || !model || !client_id) {
        return res.status(400).json({ error: 'plate, make, model, client_id required' });
      }

      const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(client_id);
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const id = uuid();
      db.prepare(`
        INSERT INTO cars (id, plate, make, model, year, color, client_id, mileage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, plate, make, model, year || null, color || null, client_id, mileage || null);

      res.json({ id, plate, make, model, message: 'Vehicle created' });
    } catch (error) {
      if (error.message.includes('UNIQUE')) {
        res.status(409).json({ error: 'Plate already exists' });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  /**
   * PUT /admin/vehicles/:plate - Update vehicle
   */
  app.put('/admin/vehicles/:plate', (req, res) => {
    try {
      const { make, model, year, color, mileage } = req.body;

      const vehicle = db.prepare('SELECT * FROM cars WHERE plate = ?').get(req.params.plate);
      if (!vehicle) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }

      db.prepare(`
        UPDATE cars
        SET make = ?, model = ?, year = ?, color = ?, mileage = ?, updated_at = datetime('now')
        WHERE plate = ?
      `).run(
        make || vehicle.make,
        model || vehicle.model,
        year !== undefined ? year : vehicle.year,
        color !== undefined ? color : vehicle.color,
        mileage !== undefined ? mileage : vehicle.mileage,
        req.params.plate
      );

      res.json({ plate: req.params.plate, message: 'Vehicle updated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /admin/vehicles/:client_id - Get client's vehicles
   */
  app.get('/admin/vehicles/:client_id', (req, res) => {
    try {
      const vehicles = db.prepare(`
        SELECT 
          ca.*,
          COUNT(DISTINCT s.id) as service_count,
          COUNT(DISTINCT a.id) as appointment_count
        FROM cars ca
        LEFT JOIN services s ON ca.plate = s.plate
        LEFT JOIN appointments a ON ca.plate = a.plate
        WHERE ca.client_id = ?
        GROUP BY ca.id
      `).all(req.params.client_id);

      res.json({ vehicles });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== SERVICES ====================

  /**
   * POST /admin/services - Create service record
   */
  app.post('/admin/services', (req, res) => {
    try {
      const { plate, type, date, next_due, cost, mileage, status, tech, notes } = req.body;

      if (!plate || !type || !date || !next_due) {
        return res.status(400).json({ error: 'plate, type, date, next_due required' });
      }

      const id = uuid();
      db.prepare(`
        INSERT INTO services (id, plate, type, date, next_due, cost, mileage, status, tech, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, plate, type, date, next_due, cost || null, mileage || null,
        status || 'Completed', tech || null, notes || null
      );

      res.json({ id, plate, type, message: 'Service created' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /admin/services/:plate - Get vehicle's service history
   */
  app.get('/admin/services/:plate', (req, res) => {
    try {
      const services = db.prepare(`
        SELECT * FROM services WHERE plate = ? ORDER BY date DESC
      `).all(req.params.plate);

      res.json({ services });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /admin/services/:id - Update service
   */
  app.put('/admin/services/:id', (req, res) => {
    try {
      const { type, date, next_due, cost, mileage, status, tech, notes } = req.body;

      const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      db.prepare(`
        UPDATE services
        SET type = ?, date = ?, next_due = ?, cost = ?, mileage = ?, status = ?, tech = ?, notes = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        type || service.type,
        date || service.date,
        next_due || service.next_due,
        cost !== undefined ? cost : service.cost,
        mileage !== undefined ? mileage : service.mileage,
        status || service.status,
        tech !== undefined ? tech : service.tech,
        notes !== undefined ? notes : service.notes,
        req.params.id
      );

      res.json({ id: req.params.id, message: 'Service updated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /admin/services/:id - Delete service
   */
  app.delete('/admin/services/:id', (req, res) => {
    try {
      const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
      res.json({ message: 'Service deleted' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== APPOINTMENTS ====================

  /**
   * POST /admin/appointments - Create appointment
   */
  app.post('/admin/appointments', (req, res) => {
    try {
      const { client_id, plate, date, time, type, status } = req.body;

      if (!client_id || !plate || !date || !time || !type) {
        return res.status(400).json({ error: 'client_id, plate, date, time, type required' });
      }

      // Check for conflicts
      const conflict = db.prepare(`
        SELECT * FROM appointments 
        WHERE plate = ? AND date = ? AND status != 'Cancelled'
      `).get(plate, date);

      if (conflict) {
        return res.status(409).json({ error: 'Appointment already exists for this vehicle on this date' });
      }

      const id = uuid();
      db.prepare(`
        INSERT INTO appointments (id, client_id, plate, date, time, type, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, client_id, plate, date, time, type, status || 'Confirmed');

      res.json({ id, client_id, plate, date, time, message: 'Appointment created' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /admin/appointments - List all appointments (with filters)
   */
  app.get('/admin/appointments', (req, res) => {
    try {
      const { status, plate, client_id, from_date, to_date } = req.query;

      let query = `
        SELECT 
          a.*, 
          c.name as client_name, c.phone as client_phone, c.email,
          ca.make, ca.model
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        JOIN cars ca ON a.plate = ca.plate
        WHERE 1=1
      `;

      if (status) query += ` AND a.status = '${status}'`;
      if (plate) query += ` AND a.plate = '${plate}'`;
      if (client_id) query += ` AND a.client_id = '${client_id}'`;
      if (from_date) query += ` AND a.date >= '${from_date}'`;
      if (to_date) query += ` AND a.date <= '${to_date}'`;

      query += ` ORDER BY a.date DESC, a.time DESC`;

      const appointments = db.prepare(query).all();
      res.json({ appointments, count: appointments.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /admin/appointments/:id - Get single appointment
   */
  app.get('/admin/appointments/:id', (req, res) => {
    try {
      const appointment = db.prepare(`
        SELECT 
          a.*, 
          c.name as client_name, c.phone as client_phone, c.email,
          ca.make, ca.model, ca.year
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        JOIN cars ca ON a.plate = ca.plate
        WHERE a.id = ?
      `).get(req.params.id);

      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      res.json({ appointment });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /admin/appointments/:id - Update appointment
   */
  app.put('/admin/appointments/:id', (req, res) => {
    try {
      const { date, time, type, status } = req.body;

      const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      db.prepare(`
        UPDATE appointments
        SET date = ?, time = ?, type = ?, status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        date || appointment.date,
        time || appointment.time,
        type || appointment.type,
        status || appointment.status,
        req.params.id
      );

      res.json({ id: req.params.id, message: 'Appointment updated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /admin/appointments/:id - Cancel appointment
   */
  app.delete('/admin/appointments/:id', (req, res) => {
    try {
      const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      db.prepare('UPDATE appointments SET status = ?, updated_at = datetime(?) WHERE id = ?').run(
        'Cancelled',
        'now',
        req.params.id
      );

      res.json({ id: req.params.id, message: 'Appointment cancelled' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /admin/appointments/:id/approve - Approve pending appointment
   */
  app.post('/admin/appointments/:id/approve', (req, res) => {
    try {
      const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run('Confirmed', req.params.id);
      res.json({ id: req.params.id, status: 'Confirmed' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /admin/appointments/:id/reject - Reject pending appointment
   */
  app.post('/admin/appointments/:id/reject', (req, res) => {
    try {
      const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run('Cancelled', req.params.id);
      res.json({ id: req.params.id, status: 'Cancelled' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = { setupAdminRoutes };
