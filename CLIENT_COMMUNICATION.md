# Client Communication - Email & SMS Only

Clients interact with AutoShift through **2 simple channels**:
1. **Email** - Receive reminders, confirmations, appointment updates
2. **SMS** - (Coming soon) Receive and respond to service notifications

---

## 📧 Email Communication Flow

### **1. Service Reminder Email** (Automatic - Hourly)

**Triggered by:** Scheduler when service is due within 14 days

**Email Content:**
```
Subject: 🔧 Service Reminder - Your Vehicle Needs Service

Hi John,

Your vehicle(s) need service:
• Toyota Camry (ABC123)
• Honda Civic (XYZ789)

Due in: 7 days

[Book Service Now] → Opens appointment booking link

AutoShift Team
```

**Data sent to client:**
- Vehicle plates & models
- Days until due
- Link to book appointment

---

### **2. Appointment Confirmation Email** (Manual - Admin sends)

**Triggered by:** Admin approves pending appointment OR automated after booking

**Email Content:**
```
Subject: ✅ Appointment Confirmed - ABC123

Hi John,

Your service appointment has been confirmed!

Vehicle: ABC123 (Toyota Camry)
Service: Oil Change
Date: October 31, 2026
Time: 10:00 AM

Please arrive 10 minutes early.

AutoShift Team
```

---

### **3. Appointment Reminder Email** (Automatic - Day before)

**Triggered by:** Scheduler 1 day before appointment

**Email Content:**
```
Subject: 📅 Appointment Tomorrow - ABC123

Hi John,

This is a friendly reminder about your appointment tomorrow!

Vehicle: ABC123 (Toyota Camry)
Date: October 31, 2026
Time: 10:00 AM

Please arrive on time.

AutoShift Team
```

---

### **4. Admin Notification Email** (Automatic - When client replies)

**Triggered by:** When client replies to email OR when new appointment created via SMS

**Email Content:**
```
Subject: 🆕 New Appointment Booking - ABC123

New Service Booking Received

Client Name: John Smith
Phone: 555-1234
Email: john@example.com
Vehicle: ABC123 (Toyota Camry)
Service Type: Oil Change
Date: October 31, 2026
Time: 10:00 AM

[Approve/Reject Booking] → Admin portal link

AutoShift Team
```

---

## 💬 SMS Communication Flow (Coming Soon)

### **1. Service Reminder SMS**

**Triggered by:** Scheduler when service is due

```
AutoShift: Your Toyota Camry needs service in 7 days. 
Reply "BOOK" to schedule or visit https://autoshift.app/book
```

---

### **2. Appointment Confirmation SMS**

```
AutoShift: Your appointment for Oil Change is confirmed!
Date: Oct 31, 10:00 AM
Vehicle: Toyota Camry (ABC123)
Reply CANCEL to reschedule.
```

---

### **3. Appointment Reminder SMS**

```
AutoShift: Reminder - You have an appointment tomorrow at 10:00 AM
for your Toyota Camry. See you then!
```

---

### **4. Client SMS to Book/Cancel/Reschedule**

**Client can reply:**
- `BOOK` → Links to booking form
- `CANCEL` → Cancels next appointment
- `RESCHEDULE [DATE] [TIME]` → Books new time
- Any text → Routes to admin

---

## 🔧 How to Send Emails in React Components

### **Send Service Reminder**
```jsx
async function sendServiceReminder(clientEmail, clientName, vehicles, daysUntilDue) {
  try {
    const result = await window.autoshiftAgent.sendEmail(
      clientEmail,
      clientName,
      'reminder',
      {
        vehicles,
        daysUntilDue
      }
    );

    if (result.success) {
      console.log('Reminder sent:', result.messageId);
    } else {
      console.error('Failed:', result.error);
    }
  } catch (error) {
    console.error('Email error:', error);
  }
}

// Usage
sendServiceReminder(
  'john@example.com',
  'John Smith',
  ['Toyota Camry (ABC123)', 'Honda Civic (XYZ789)'],
  7
);
```

---

### **Send Appointment Confirmation**
```jsx
async function sendAppointmentConfirmation(clientEmail, clientName, plate, date, time, serviceType) {
  try {
    const result = await window.autoshiftAgent.sendEmail(
      clientEmail,
      clientName,
      'confirmation',
      {
        vehiclePlate: plate,
        date,
        time,
        serviceType
      }
    );

    if (result.success) {
      console.log('Confirmation sent');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Usage
sendAppointmentConfirmation(
  'john@example.com',
  'John Smith',
  'ABC123',
  '2026-10-31',
  '10:00',
  'Oil Change'
);
```

---

### **Send Appointment Reminder (Day Before)**
```jsx
async function sendAppointmentReminder(clientEmail, clientName, plate, date, time) {
  try {
    const result = await window.autoshiftAgent.sendEmail(
      clientEmail,
      clientName,
      'appointment_reminder',
      {
        vehiclePlate: plate,
        date,
        time
      }
    );

    if (result.success) {
      console.log('Appointment reminder sent');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

## 📋 Admin Dashboard - Send Emails

### **Bulk Send Reminders to Due Services**

```jsx
export function SendRemindersButton() {
  const [loading, setLoading] = useState(false);

  const handleSendReminders = async () => {
    setLoading(true);
    try {
      // Get all clients with due services
      const result = await window.autoshiftAgent.admin.getDashboard();
      
      if (result.success) {
        const { overdueServicesList } = result.stats;
        
        // Send reminder to each client
        for (const service of overdueServicesList) {
          await window.autoshiftAgent.sendEmail(
            service.client_email,
            service.client_name,
            'reminder',
            {
              vehicles: [service.plate],
              daysUntilDue: 0 // Already overdue
            }
          );
        }
        
        alert(`Reminders sent to ${overdueServicesList.length} clients`);
      }
    } catch (error) {
      alert('Error sending reminders: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleSendReminders} disabled={loading}>
      {loading ? 'Sending...' : 'Send Reminders'}
    </button>
  );
}
```

---

### **Approve Appointment & Send Confirmation**

```jsx
export function PendingAppointments() {
  const [appointments, setAppointments] = useState([]);

  const handleApprove = async (apt) => {
    try {
      // Update appointment status
      const updateResult = await window.autoshiftAgent.admin.updateAppointment({
        id: apt.id,
        status: 'Confirmed'
      });

      if (updateResult.success) {
        // Send confirmation email
        await window.autoshiftAgent.sendEmail(
          apt.client_email,
          apt.client_name,
          'confirmation',
          {
            vehiclePlate: apt.plate,
            date: apt.date,
            time: apt.time,
            serviceType: apt.type
          }
        );

        alert('Appointment confirmed and email sent!');
        refreshAppointments();
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  return (
    <div>
      {appointments.map(apt => (
        <div key={apt.id}>
          <p>{apt.client_name} - {apt.date} {apt.time}</p>
          <button onClick={() => handleApprove(apt)}>Approve & Send Email</button>
        </div>
      ))}
    </div>
  );
}
```

---

## 🔄 Automatic Workflows

### **Workflow 1: Service Due → Email Reminder → SMS Reminder**
```
1. Daily scheduler checks for due services
2. Sends email reminder (if not sent in 30 days)
3. Next day sends SMS reminder (when Twilio added)
4. Client sees "Book Service Now" link in email
```

### **Workflow 2: Client Books → Confirmation Sent**
```
1. Admin creates appointment in system
2. System sends confirmation email immediately
3. Day before: sends appointment reminder email
4. SMS reminder sent day before (when Twilio ready)
```

### **Workflow 3: Email Reply → Admin Notified**
```
1. Client receives service reminder email
2. Client replies to email
3. Email listener captures reply
4. Admin gets notification email
5. Admin can approve/book from notification
```

---

## 📊 Communication Channels Status

| Channel | Status | Features |
|---------|--------|----------|
| **Email** | ✅ Active | Reminders, confirmations, notifications |
| **SMS** | ⏳ Coming | Reminders, confirmations, replies |
| **Chat** | ❌ Not Needed | Admin uses dashboard, not chat |
| **Phone** | ❌ Future | Maybe VoiceCall API later |

---

## ⚙️ Configuration

### **Email Providers** (Choose in `.env`)
- Gmail (recommended for testing)
- SendGrid (production)
- Custom SMTP

### **SMS Providers** (Coming)
- Twilio (when credentials added)

---

## 🎯 Client Experience

**Client receives:**
1. ✉️ Service reminder email
2. 📧 Option to book appointment via link
3. ✅ Confirmation email when approved
4. 📅 Appointment reminder email (day before)
5. 💬 (Optional) SMS reminders (when SMS ready)

**No Chat, No Complexity** - Just clear, simple emails!

---

## 🚀 Next Steps

1. ✅ Email system ready
2. ⏳ Add Twilio credentials for SMS
3. ⏳ Test email workflows with real clients
4. ⏳ Monitor email delivery rates
5. ⏳ Set up auto-reply templates

Simple, clean, effective! 📧📱
