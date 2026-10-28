# AutoShift Service Reminder Agent

AI-powered SMS chatbot for automated service reminders and appointment booking using Twilio, LangChain, LangGraph, and **LiteLLM** (model-agnostic LLM support).

## Features

- ✅ **Multi-Model Support**: Works with Gemini, Claude, GPT-4, Ollama, Mistral, etc.
- ✅ **Service Reminders**: Automatically notify clients when services are due
- ✅ **Smart Booking**: Clients reply via SMS to book appointments
- ✅ **Multi-turn Conversation**: Natural language dialogue using any LLM
- ✅ **Admin Notifications**: Staff notified of new bookings
- ✅ **Appointment Management**: Approve/reject bookings from admin dashboard

## Quick Start (Gemini - Recommended)

### 1. Install Dependencies

```bash
npm install
```

### 2. Get API Keys

**Google Gemini** (FREE tier available):
- Go to https://makersuite.google.com/app/apikeys
- Create API key (no credit card needed for free tier)

**Twilio:**
- Go to https://www.twilio.com/console
- Get Account SID, Auth Token, and SMS phone number

### 3. Configure `.env`

```env
TWILIO_ACCOUNT_SID=AC...your_sid
TWILIO_AUTH_TOKEN=...your_token
TWILIO_PHONE_NUMBER=+1234567890

GOOGLE_API_KEY=AIzaSy...your_gemini_key
```

### 4. Run Agent Server

```bash
node electron/agents/webhookServer.js
```

Server runs on `http://localhost:3001`

## Model Options

Just change `config.llm.provider` and `config.llm.model` in `config.js`:

### 🆓 Google Gemini (Recommended - FREE)
```javascript
llm: {
  provider: 'gemini',
  model: 'gemini-1.5-flash', // Fast & free
  apiKey: process.env.GOOGLE_API_KEY,
}
```

### OpenAI GPT-4
```javascript
llm: {
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
}
```

### Anthropic Claude
```javascript
llm: {
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
}
```

### 🏠 Open Source - Ollama (Local)
```javascript
llm: {
  provider: 'ollama',
  model: 'llama2', // or mistral, neural-chat, etc.
  // No API key needed - runs locally
}
```

### Mistral AI
```javascript
llm: {
  provider: 'mistral',
  model: 'mistral-large',
  apiKey: process.env.MISTRAL_API_KEY,
}
```

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
│  │ LiteLLM (Model-Agnostic)            │   │
│  │ • Gemini, Claude, GPT-4, etc.       │   │
│  │ • Single API → any model            │   │
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

## Switching Models

**To use Claude instead of Gemini:**

1. Get Anthropic API key from https://console.anthropic.com
2. Update `config.js`:
   ```javascript
   llm: {
     provider: 'anthropic',
     model: 'claude-3-5-sonnet-20241022',
     apiKey: process.env.ANTHROPIC_API_KEY,
   }
   ```
3. Update `.env`: `ANTHROPIC_API_KEY=sk-ant-...your_key`
4. Restart server

**That's it!** No other code changes needed. LiteLLM handles the API translation.

## Deployment Notes

- **Webhook URL**: Configure in Twilio console (e.g., `https://yourserver.com/webhook/sms`)
- **Environment**: Load `.env` from project root
- **Database**: Must be same SQLite instance used by Electron app
- **Scaling**: Each agent instance runs a separate LLM client; consider connection pooling for high volume
- **Model Costs**: Gemini free tier / GPT-4 pay-as-you-go / Claude pricing varies

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
- Check API key is valid for your chosen provider
- Monitor model rate limits and quotas
- Check `config.llm.provider` and `config.llm.model` match your setup

**Switch to different model didn't work:**
- Clear any cached API clients
- Restart the webhook server
- Check `.env` has the correct API key for new provider

## Future Enhancements

- [ ] WhatsApp integration
- [ ] Email notifications
- [ ] Payment processing
- [ ] Calendar sync
- [ ] Multi-language support
- [ ] Analytics dashboard
- [ ] Streaming responses for faster replies
- [ ] Context memory for multi-session conversations

