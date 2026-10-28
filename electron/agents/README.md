# AutoShift Service Reminder Agent

AI-powered SMS chatbot for automated service reminders and appointment booking using Twilio, LangChain, and LangGraph.

## Features

- **Service Reminders**: Automatically notify clients when services are due
- **Smart Booking**: Clients can reply via SMS to book appointments
- **Multi-turn Conversation**: Natural language dialogue using Claude LLM
- **Admin Notifications**: Staff notified of new bookings
- **Appointment Management**: Approve/reject bookings from admin dashboard

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
TWILIO_ACCOUNT_SID=AC...your_sid
TWILIO_AUTH_TOKEN=...your_token
TWILIO_PHONE_NUMBER=+1234567890

ANTHROPIC_API_KEY=sk-ant-...your_key
```

### 3. Get API Keys

**Twilio:**
- Go to https://www.twilio.com/console
- Get Account SID and Auth Token
- Get a Twilio phone number for SMS
- Set up webhook URL in Twilio console pointing to `/webhook/sms`

**Anthropic (Claude):**
- Go to https://console.anthropic.com
- Create API key
- Use model: `claude-3-5-sonnet-20241022`

### 4. Run Agent Server

```bash
node electron/agents/webhookServer.js
```

Server runs on `http://localhost:3001`

## Architecture

```
┌─────────────────────────────────────────────┐
│           Twilio SMS Webhook                │
│        (handles incoming messages)          │
└─────────┬───────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│       ServiceAgent (LangGraph)              │
│  ┌─────────────────────────────────────┐   │
│  │ Claude LLM (3.5 Sonnet)             │   │
│  │ • Understands intent                │   │
│  │ • Calls tools for booking           │   │
│  │ • Multi-turn conversation           │   │
│  └─────────────────────────────────────┘   │
└────┬────────────────────┬────────────────────┘
     │                    │
     ▼                    ▼
┌──────────────┐   ┌──────────────────────┐
│ Database     │   │ Tool Functions       │
│ (SQLite)     │   │ • get_due_services   │
│              │   │ • get_appointment_   │
│              │   │   slots              │
│              │   │ • book_appointment   │
│              │   │ • notify_staff       │
└──────────────┘   │ • send_sms           │
                   └──────────────────────┘
```

## API Endpoints

### POST `/webhook/sms`
Twilio sends incoming SMS here. Agent processes and replies.

### POST `/api/chat`
Direct chat with agent (for testing or web UI)

```json
{
  "message": "I want to book service for my car",
  "clientPhone": "+92300123456"
}
```

### POST `/admin/send-reminders`
Manually trigger service reminders for all due vehicles

### GET `/admin/appointments`
List all pending appointments awaiting staff approval

### POST `/admin/appointments/:id/:action`
Approve or reject appointment

```
POST /admin/appointments/apt_123/approve
POST /admin/appointments/apt_123/reject
```

## Tools Available to Agent

1. **get_due_services** → Fetch vehicles needing service for a client
2. **get_appointment_slots** → Check available time slots for a date
3. **book_appointment** → Reserve a service appointment
4. **notify_staff** → Alert admin about new bookings
5. **send_sms** → Send SMS reply to client

## Conversation Flow

```
Client: "My car needs an oil change"
    ↓
Agent: Understands intent, calls get_due_services
    ↓
Agent: "Found your Toyota Corolla - oil change due. Choose a date:"
    ↓
Client: "Tomorrow at 10 AM"
    ↓
Agent: Calls get_appointment_slots, then book_appointment
    ↓
Agent: "Booked! Your appointment is tomorrow at 10 AM. Staff will confirm."
    ↓
Staff: Notified via notify_staff, can approve/reject in admin panel
```

## Deployment Notes

- **Webhook URL**: Configure in Twilio console (e.g., `https://yourserver.com/webhook/sms`)
- **Environment**: Load `.env` from project root
- **Database**: Must be same SQLite instance used by Electron app
- **Scaling**: Each agent instance runs a separate LLM client; consider connection pooling for high volume

## Troubleshooting

**Agent not receiving messages:**
- Check Twilio webhook URL is public and accessible
- Verify phone number matches `TWILIO_PHONE_NUMBER`
- Check server logs for errors

**Booking fails:**
- Verify client phone matches database phone field exactly
- Check vehicle plate is registered to that client
- Ensure appointment slot isn't already booked

**LLM not responding:**
- Check `ANTHROPIC_API_KEY` is valid
- Monitor Anthropic quota and rate limits

## Future Enhancements

- [ ] WhatsApp integration
- [ ] Email notifications
- [ ] Payment processing
- [ ] Calendar sync
- [ ] Multi-language support
- [ ] Analytics dashboard
