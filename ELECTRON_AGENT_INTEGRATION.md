# Electron App - AI Agent Integration Guide

The AI agent system is now **fully integrated** into the Electron app via IPC (Inter-Process Communication). React components can directly use agent functionalities without external HTTP calls.

---

## 🚀 How to Use in React Components

### 1. **AI Chat with Gemini**

```jsx
import { useState } from 'react';

export function ChatComponent() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChat = async () => {
    if (!message.trim()) return;

    setLoading(true);
    try {
      // Call agent through IPC
      const result = await window.autoshiftAgent.chat(message, 'customer-123');
      
      if (result.success) {
        setResponse(result.response);
      } else {
        setResponse(`Error: ${result.error}`);
      }
    } catch (error) {
      setResponse(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
      setMessage('');
    }
  };

  return (
    <div>
      <input 
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask something..."
      />
      <button onClick={handleChat} disabled={loading}>
        {loading ? 'Thinking...' : 'Send'}
      </button>
      {response && <p>{response}</p>}
    </div>
  );
}
```

---

### 2. **Send Email to Client**

```jsx
async function sendServiceReminder() {
  try {
    const result = await window.autoshiftAgent.sendEmail(
      'john@example.com',
      'John Smith',
      'reminder',
      {
        vehicles: ['Toyota Camry (ABC123)', 'Honda Civic (XYZ789)'],
        daysUntilDue: 7
      }
    );

    if (result.success) {
      console.log('Email sent:', result.messageId);
    }
  } catch (error) {
    console.error('Email failed:', error.message);
  }
}
```

---

### 3. **Get Dashboard Stats**

```jsx
export function DashboardWidget() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const result = await window.autoshiftAgent.admin.getDashboard();
        
        if (result.success) {
          setStats(result.stats);
        }
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      }
    }

    loadStats();
  }, []);

  if (!stats) return <p>Loading...</p>;

  return (
    <div>
      <h2>Dashboard</h2>
      <p>Total Clients: {stats.totalClients}</p>
      <p>Pending Appointments: {stats.pendingAppointments}</p>
      <p>Overdue Services: {stats.overdueServices}</p>
      <p>Due This Week: {stats.dueThisWeek}</p>
      
      <h3>Upcoming Appointments</h3>
      {stats.upcomingAppointments.map(apt => (
        <div key={apt.id}>
          {apt.client_name} - {apt.date} at {apt.time}
        </div>
      ))}
    </div>
  );
}
```

---

### 4. **CRUD Operations - Clients**

```jsx
// Get all clients
async function loadClients() {
  const result = await window.autoshiftAgent.admin.getClients();
  if (result.success) {
    return result.clients;
  }
}

// Get single client with details
async function loadClientDetail(clientId) {
  const result = await window.autoshiftAgent.admin.getClient(clientId);
  if (result.success) {
    const { client, vehicles, appointments } = result;
    // Use data...
  }
}

// Create new client
async function createNewClient() {
  const result = await window.autoshiftAgent.admin.createClient({
    name: 'John Smith',
    phone: '555-1234',
    email: 'john@example.com'
  });

  if (result.success) {
    console.log('Created client:', result.id);
  }
}

// Update client
async function updateClient(clientId) {
  const result = await window.autoshiftAgent.admin.updateClient({
    id: clientId,
    name: 'John Doe',
    phone: '555-5678',
    email: 'john.doe@example.com'
  });

  if (result.success) {
    console.log('Client updated');
  }
}
```

---

### 5. **CRUD Operations - Appointments**

```jsx
// Get appointments with filters
async function getAppointments() {
  const result = await window.autoshiftAgent.admin.getAppointments({
    status: 'Pending',
    plate: 'ABC123',
    from_date: '2026-10-01',
    to_date: '2026-10-31'
  });

  if (result.success) {
    return result.appointments;
  }
}

// Create appointment
async function bookAppointment() {
  const result = await window.autoshiftAgent.admin.createAppointment({
    client_id: 'cli123',
    plate: 'ABC123',
    date: '2026-10-31',
    time: '10:00',
    type: 'Oil Change',
    status: 'Confirmed'
  });

  if (result.success) {
    console.log('Appointment created:', result.id);
  }
}

// Update appointment
async function rescheduleAppointment(appointmentId) {
  const result = await window.autoshiftAgent.admin.updateAppointment({
    id: appointmentId,
    date: '2026-11-02',
    time: '14:00'
  });

  if (result.success) {
    console.log('Appointment rescheduled');
  }
}

// Cancel appointment
async function cancelAppointment(appointmentId) {
  const result = await window.autoshiftAgent.admin.cancelAppointment(appointmentId);

  if (result.success) {
    console.log('Appointment cancelled');
  }
}
```

---

### 6. **CRUD Operations - Services**

```jsx
// Get service history
async function getServiceHistory(plate) {
  const result = await window.autoshiftAgent.admin.getServices(plate);
  
  if (result.success) {
    return result.services;
  }
}

// Record new service
async function recordService() {
  const result = await window.autoshiftAgent.admin.createService({
    plate: 'ABC123',
    type: 'Oil Change',
    date: '2026-10-20',
    next_due: '2027-01-20',
    cost: 49.99,
    mileage: 50000,
    status: 'Completed',
    tech: 'Mike Johnson',
    notes: 'Full synthetic oil used'
  });

  if (result.success) {
    console.log('Service recorded:', result.id);
  }
}
```

---

### 7. **CRUD Operations - Vehicles**

```jsx
// Get client's vehicles
async function getClientVehicles(clientId) {
  const result = await window.autoshiftAgent.admin.getVehicles(clientId);
  
  if (result.success) {
    return result.vehicles;
  }
}

// Add new vehicle
async function addVehicle() {
  const result = await window.autoshiftAgent.admin.createVehicle({
    plate: 'ABC123',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    color: 'Silver',
    client_id: 'cli123',
    mileage: 45000
  });

  if (result.success) {
    console.log('Vehicle added:', result.id);
  }
}
```

---

## 📡 Listen for Reminder Events

When the scheduler sends service reminders, the React app can listen for notifications:

```jsx
useEffect(() => {
  // Listen for reminder checks
  const unsubscribe = window.autoshiftAgent.onReminderCheck((data) => {
    console.log(`${data.count} clients need service reminders`);
    
    // Update UI or notify user
    showNotification(`Sent reminders to ${data.count} clients`);
    
    // Refresh appointments list
    refreshAppointments();
  });

  return () => unsubscribe?.();
}, []);
```

---

## 🔄 Complete Workflow Example

**User books appointment through chat:**

```jsx
export function AppointmentFlow() {
  const handleBookingViaChat = async (message) => {
    // 1. User chats with agent
    const chatResult = await window.autoshiftAgent.chat(
      message,
      'customer-123'
    );

    if (chatResult.success) {
      // 2. Agent responds with availability
      console.log('Agent:', chatResult.response);

      // 3. User confirms booking through chat
      const confirmResult = await window.autoshiftAgent.chat(
        'Yes, book it!',
        'customer-123'
      );

      // 4. Backend creates appointment automatically
      // 5. Send confirmation email
      await window.autoshiftAgent.sendEmail(
        'customer@example.com',
        'John Smith',
        'confirmation',
        {
          vehiclePlate: 'ABC123',
          date: '2026-10-31',
          time: '10:00',
          serviceType: 'Oil Change'
        }
      );

      // 6. Refresh UI
      const appointments = await window.autoshiftAgent.admin.getAppointments({ 
        status: 'Confirmed' 
      });
      
      if (appointments.success) {
        updateAppointmentsList(appointments.appointments);
      }
    }
  };

  return (
    <ChatInterface onSubmit={handleBookingViaChat} />
  );
}
```

---

## 💾 Data Flow Architecture

```
┌─────────────────────────────────┐
│  React Components (Frontend)    │
│  • Chat Interface               │
│  • Admin Dashboard              │
│  • Appointment Management       │
└──────────────┬──────────────────┘
               │
               ↓ IPC (electron.invoke)
               │
┌──────────────┴──────────────────┐
│  Electron Main Process          │
│  • AgentBridge                  │
│  • IPC Handlers                 │
└──────────────┬──────────────────┘
               │
               ↓ Direct Function Calls
               │
┌──────────────┴──────────────────┐
│  AI System (In-Process)         │
│  • ServiceAgent (Gemini LLM)    │
│  • EmailHandler (Gmail)         │
│  • Admin Routes                 │
│  • Database Access              │
└─────────────────────────────────┘
```

---

## 🎯 Key Advantages

✅ **No HTTP Overhead** - Direct IPC calls (faster)
✅ **Offline Capable** - Works without external server
✅ **Unified Experience** - Agent + UI in same app
✅ **Shared Database** - Single source of truth
✅ **Automatic Scheduling** - Reminders run in background
✅ **Real-time Updates** - Listen to agent events

---

## ⚠️ Important Notes

1. **Async/Await** - All IPC calls are async, always use `await`
2. **Error Handling** - Always check `result.success` or wrap in try-catch
3. **Offline** - Agent works offline (no internet needed for local chat)
4. **Email** - Requires internet + Gmail/SMTP credentials
5. **Performance** - Gemini calls can take 2-5 seconds (normal for LLM)

---

## 🚀 Ready to Build!

Your React components now have full access to:
- 💬 AI chat (Gemini)
- 📧 Email system (Gmail/SMTP)
- 📋 Complete CRUD operations
- 📊 Dashboard data
- ⏰ Scheduled reminders

Build amazing features with AI-powered workflows! 🎉
