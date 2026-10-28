# AutoShift Admin API Documentation

Complete REST API for managing clients, vehicles, services, and appointments.

**Base URL:** `http://localhost:3001`

---

## 📊 Dashboard

### Get Dashboard Stats
```
GET /admin/dashboard
```

**Response:**
```json
{
  "totalClients": 42,
  "totalVehicles": 78,
  "totalAppointments": 156,
  "pendingAppointments": 5,
  "confirmedAppointments": 140,
  "cancelledAppointments": 11,
  "overdueServices": 8,
  "dueThisWeek": 12,
  "upcomingAppointments": [
    {
      "id": "apt123",
      "plate": "ABC123",
      "date": "2026-10-31",
      "time": "10:00",
      "type": "Oil Change",
      "status": "Confirmed",
      "client_name": "John Smith",
      "client_phone": "555-1234"
    }
  ],
  "overdueServicesList": [
    {
      "id": "srv456",
      "plate": "XYZ789",
      "type": "Tire Rotation",
      "next_due": "2026-10-15",
      "make": "Honda",
      "model": "Civic",
      "client_name": "Jane Doe",
      "client_email": "jane@example.com"
    }
  ]
}
```

---

## 👥 Clients

### List All Clients
```
GET /admin/clients
```

**Response:**
```json
{
  "clients": [
    {
      "id": "cli123",
      "name": "John Smith",
      "phone": "555-1234",
      "email": "john@example.com",
      "since": "2026-01-15",
      "vehicle_count": 2,
      "appointment_count": 5
    }
  ]
}
```

### Get Single Client with Details
```
GET /admin/clients/:id
```

**Response:**
```json
{
  "client": {
    "id": "cli123",
    "name": "John Smith",
    "phone": "555-1234",
    "email": "john@example.com",
    "since": "2026-01-15"
  },
  "vehicles": [
    {
      "id": "car123",
      "plate": "ABC123",
      "make": "Toyota",
      "model": "Camry",
      "year": 2022,
      "color": "Silver",
      "mileage": 45000
    }
  ],
  "appointments": [
    {
      "id": "apt123",
      "plate": "ABC123",
      "date": "2026-10-31",
      "time": "10:00",
      "type": "Oil Change",
      "status": "Confirmed"
    }
  ]
}
```

### Create Client
```
POST /admin/clients

Content-Type: application/json

{
  "name": "John Smith",
  "phone": "555-1234",
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "id": "cli123",
  "name": "John Smith",
  "phone": "555-1234",
  "email": "john@example.com",
  "message": "Client created"
}
```

### Update Client
```
PUT /admin/clients/:id

Content-Type: application/json

{
  "name": "John Smith",
  "phone": "555-5678",
  "email": "john.smith@example.com"
}
```

**Response:**
```json
{
  "id": "cli123",
  "message": "Client updated"
}
```

### Delete Client
```
DELETE /admin/clients/:id
```

**Note:** Can only delete if client has no appointments.

**Response:**
```json
{
  "message": "Client deleted"
}
```

---

## 🚗 Vehicles

### Get Client's Vehicles
```
GET /admin/vehicles/:client_id
```

**Response:**
```json
{
  "vehicles": [
    {
      "id": "car123",
      "plate": "ABC123",
      "make": "Toyota",
      "model": "Camry",
      "year": 2022,
      "color": "Silver",
      "client_id": "cli123",
      "mileage": 45000,
      "service_count": 3,
      "appointment_count": 2
    }
  ]
}
```

### Create Vehicle
```
POST /admin/vehicles

Content-Type: application/json

{
  "plate": "ABC123",
  "make": "Toyota",
  "model": "Camry",
  "year": 2022,
  "color": "Silver",
  "client_id": "cli123",
  "mileage": 45000
}
```

**Required:** `plate`, `make`, `model`, `client_id`

**Response:**
```json
{
  "id": "car123",
  "plate": "ABC123",
  "make": "Toyota",
  "model": "Camry",
  "message": "Vehicle created"
}
```

### Update Vehicle
```
PUT /admin/vehicles/:plate

Content-Type: application/json

{
  "mileage": 50000,
  "color": "Blue"
}
```

**Response:**
```json
{
  "plate": "ABC123",
  "message": "Vehicle updated"
}
```

---

## 🔧 Services

### Get Vehicle's Service History
```
GET /admin/services/:plate
```

**Response:**
```json
{
  "services": [
    {
      "id": "srv123",
      "plate": "ABC123",
      "type": "Oil Change",
      "date": "2026-10-20",
      "next_due": "2027-01-20",
      "cost": 49.99,
      "mileage": 50000,
      "status": "Completed",
      "tech": "Mike Johnson",
      "notes": "Full synthetic oil used"
    }
  ]
}
```

### Create Service Record
```
POST /admin/services

Content-Type: application/json

{
  "plate": "ABC123",
  "type": "Oil Change",
  "date": "2026-10-20",
  "next_due": "2027-01-20",
  "cost": 49.99,
  "mileage": 50000,
  "status": "Completed",
  "tech": "Mike Johnson",
  "notes": "Full synthetic oil used"
}
```

**Required:** `plate`, `type`, `date`, `next_due`

**Response:**
```json
{
  "id": "srv123",
  "plate": "ABC123",
  "type": "Oil Change",
  "message": "Service created"
}
```

### Update Service
```
PUT /admin/services/:id

Content-Type: application/json

{
  "next_due": "2027-02-20",
  "status": "Completed",
  "notes": "Updated service record"
}
```

**Response:**
```json
{
  "id": "srv123",
  "message": "Service updated"
}
```

### Delete Service
```
DELETE /admin/services/:id
```

**Response:**
```json
{
  "message": "Service deleted"
}
```

---

## 📅 Appointments

### List Appointments (with filters)
```
GET /admin/appointments?status=Pending&from_date=2026-10-01&to_date=2026-10-31
```

**Query Parameters:**
- `status` - "Pending", "Confirmed", "Cancelled"
- `plate` - Vehicle plate
- `client_id` - Client ID
- `from_date` - YYYY-MM-DD
- `to_date` - YYYY-MM-DD

**Response:**
```json
{
  "count": 5,
  "appointments": [
    {
      "id": "apt123",
      "client_id": "cli123",
      "plate": "ABC123",
      "date": "2026-10-31",
      "time": "10:00",
      "type": "Oil Change",
      "status": "Pending",
      "client_name": "John Smith",
      "client_phone": "555-1234",
      "client_email": "john@example.com",
      "make": "Toyota",
      "model": "Camry"
    }
  ]
}
```

### Get Single Appointment
```
GET /admin/appointments/:id
```

**Response:**
```json
{
  "appointment": {
    "id": "apt123",
    "client_id": "cli123",
    "plate": "ABC123",
    "date": "2026-10-31",
    "time": "10:00",
    "type": "Oil Change",
    "status": "Pending",
    "client_name": "John Smith",
    "client_phone": "555-1234",
    "client_email": "john@example.com",
    "make": "Toyota",
    "model": "Camry",
    "year": 2022
  }
}
```

### Create Appointment
```
POST /admin/appointments

Content-Type: application/json

{
  "client_id": "cli123",
  "plate": "ABC123",
  "date": "2026-10-31",
  "time": "10:00",
  "type": "Oil Change",
  "status": "Confirmed"
}
```

**Required:** `client_id`, `plate`, `date`, `time`, `type`

**Response:**
```json
{
  "id": "apt123",
  "client_id": "cli123",
  "plate": "ABC123",
  "date": "2026-10-31",
  "time": "10:00",
  "message": "Appointment created"
}
```

### Update Appointment
```
PUT /admin/appointments/:id

Content-Type: application/json

{
  "date": "2026-11-02",
  "time": "14:00",
  "status": "Confirmed"
}
```

**Response:**
```json
{
  "id": "apt123",
  "message": "Appointment updated"
}
```

### Cancel Appointment
```
DELETE /admin/appointments/:id
```

**Response:**
```json
{
  "id": "apt123",
  "message": "Appointment cancelled"
}
```

### Approve Pending Appointment
```
POST /admin/appointments/:id/approve
```

**Response:**
```json
{
  "id": "apt123",
  "status": "Confirmed"
}
```

### Reject Pending Appointment
```
POST /admin/appointments/:id/reject
```

**Response:**
```json
{
  "id": "apt123",
  "status": "Cancelled"
}
```

---

## 🛡️ Features

✅ **Full CRUD Operations**
- Create, Read, Update, Delete for all entities
- Linked relationships (clients → vehicles → services/appointments)

✅ **Smart Validation**
- Prevents duplicate vehicle plates
- Prevents client deletion with active appointments
- Detects appointment conflicts
- Validates required fields

✅ **Filtering & Search**
- Filter appointments by status, date range, client, vehicle
- List vehicles by client
- View appointment history per client

✅ **Dashboard Stats**
- Total counts
- Pending/confirmed/cancelled appointments
- Overdue services
- Upcoming appointments
- Recent activity summaries

✅ **Ready for Frontend**
- JSON responses
- Standard HTTP status codes
- Consistent error handling
- Pagination-ready design

---

## 🚀 Usage Examples

### Create a Complete Service Flow

**1. Create Client**
```bash
curl -X POST http://localhost:3001/admin/clients \
  -H "Content-Type: application/json" \
  -d '{"name":"John Smith","phone":"555-1234","email":"john@example.com"}'
```

**2. Add Vehicle**
```bash
curl -X POST http://localhost:3001/admin/vehicles \
  -H "Content-Type: application/json" \
  -d '{"plate":"ABC123","make":"Toyota","model":"Camry","client_id":"cli123"}'
```

**3. Record Service**
```bash
curl -X POST http://localhost:3001/admin/services \
  -H "Content-Type: application/json" \
  -d '{"plate":"ABC123","type":"Oil Change","date":"2026-10-20","next_due":"2027-01-20"}'
```

**4. Book Appointment**
```bash
curl -X POST http://localhost:3001/admin/appointments \
  -H "Content-Type: application/json" \
  -d '{"client_id":"cli123","plate":"ABC123","date":"2026-10-31","time":"10:00","type":"Oil Change"}'
```

**5. View Dashboard**
```bash
curl http://localhost:3001/admin/dashboard
```

---

## 📋 Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `409` - Conflict (duplicate, booking conflict)
- `500` - Server Error

---

## 🔐 Security Notes

⚠️ **Current Status:** No authentication
- All endpoints are public
- Add JWT tokens before production
- Implement role-based access control (admin, staff, client)
- Rate limit API calls
- Validate all inputs

---

Ready for frontend integration! 🎉
