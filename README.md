# AutoShift AI Powered Automobile Showroom Management System

> A productiongrade **Electron desktop application** for automobile showrooms — featuring offlinefirst data architecture, Google Gemini AIdriven client outreach, WhatsApp/SMS automation, and realtime Supabase cloud synchronization.



## ✨ What Value AutoShift Adds

Most showroom management tools require constant internet and manual followup. AutoShift eliminates both:

 **Works without internet** — every action is instant, locally stored, and synced when connection returns
 **AI handles client communication** — Gemini AI reads client replies and autobooks appointments, no staff input needed
 **Real notifications** — customers receive actual WhatsApp/SMS messages, not just inapp pings
 **Desktopgrade reliability** — packaged as a native `.exe`, not a browser tab that crashes



## 🚀 Key Features

### 🤖 AI Smart Outreach (Gemini + Twilio)
 Daily automated scan of upcoming vehicle service dates via `pg_cron`
 Twilio sends personalised WhatsApp or SMS reminders to clients automatically
 Incoming client replies are processed by **Google Gemini AI**, which interprets intent and autocreates `pending` appointments based on vehicle history — zero manual intervention required

### 📡 OfflineFirst Sync Engine
 All reads and writes hit local **IndexedDB** first — zerolatency UI regardless of connectivity
 Changes queue locally and push to **Supabase (PostgreSQL)** the moment internet returns
 Background delta sync every 30 seconds pulls remote changes from other devices
 **Exponential backoff** with up to 3 retry attempts for failed uploads
 **Fieldlevel conflict resolution** using LastWriteWins timestamps — prevents data loss on concurrent edits
 Chunked fetching prevents memory overload on large datasets

### 🔐 RoleBased PinGate Authentication
 Touchfriendly numpad login — designed for shared showroom terminals
 **Staff PIN** — daytoday operations: register vehicles, log services, view appointments
 **Admin PIN** — unlocks destructive actions: delete/edit records, force resync, clear local cache

### 📊 Core Management Modules
 **Client Registry** — full customer profiles with service history
 **Vehicle Lookup** — car records linked to clients with full maintenance logs
 **Service Tracking** — log and monitor repair/maintenance jobs per vehicle
 **Appointment Scheduling** — manual booking + AIdriven autoscheduling from client replies

### 🛡️ Production Monitoring
 **Sentry** (`@sentry/react` v10) — realtime error boundaries, sync exception tracking, and crash reporting
 Offline/online status indicators in the UI
 Realtime sync status logs for transparency



## 🛠️ Tech Stack

| Layer | Technology | Purpose |
||||
| Desktop wrapper | Electron v41.5.0 | Native `.exe` app packaging |
| Frontend | React 18 (CommonJS) | UI and state management |
| Local database | IndexedDB (Native API) | Offlinefirst data persistence |
| Cloud database | Supabase (PostgreSQL) | Remote sync and edge functions |
| AI | Google Gemini AI | Reply interpretation & autoscheduling |
| Messaging | Twilio | WhatsApp + SMS outreach |
| Monitoring | Sentry (`@sentry/react` v10) | Error tracking and sync monitoring |
| Icons | Lucide React | UI iconography |
| Styling | CSSinJS (Vanilla) | Component styling |



## 🏗️ System Architecture

```
┌─────────────────────────────────────────────┐
│              AutoShift Desktop App           │
│                 (Electron + React)           │
│                                             │
│  ┌──────────┐  ┌────────────┐  ┌─────────┐  │
│  │ PinGate  │  │    Core    │  │ Sentry  │  │
│  │   Auth   │  │    UI      │  │Monitor  │  │
│  └──────────┘  └────────────┘  └─────────┘  │
│                      │                      │
│            ┌─────────────────┐              │
│            │ DatabaseManager │              │
│            │  (Sync Engine)  │              │
│            └────────┬────────┘              │
│                     │                       │
│            ┌────────▼────────┐              │
│            │    IndexedDB    │              │
│            │  (Local Store)  │              │
└────────────┴────────┬────────┴──────────────┘
                      │ Bidirectional Sync
                      │ (Push on change /
                      │  Pull every 30s)
┌─────────────────────▼───────────────────────┐
│                   Supabase                   │
│                                             │
│  ┌──────────────┐    ┌────────────────────┐  │
│  │  PostgreSQL  │    │    Edge Functions  │  │
│  │   Database   │    │                    │  │
│  │              │    │  clientoutreach   │  │
│  │  pg_cron     │───▶│  (Twilio sender)   │  │
│  │  daily scan  │    │                    │  │
│  │              │    │  outreachreply    │  │
│  │              │    │  (Gemini AI parser)│  │
│  └──────────────┘    └────────────────────┘  │
└─────────────────────────────────────────────┘
          │                        │
          ▼                        ▼
   Twilio sends              Client replies
   WhatsApp/SMS              via WhatsApp/SMS
   to client                       │
                                   ▼
                          Gemini AI interprets
                          intent → autocreates
                          pending appointment
```



## 🤖 AI Outreach Flow (EndtoEnd)

```
pg_cron runs daily
    ↓
Scans vehicles with upcoming nextDue service dates
    ↓
clientoutreach edge function fires
    ↓
Twilio sends WhatsApp/SMS:
"Your [Car Model] is due for service on [Date].
Reply YES to book an appointment."
    ↓
Client replies on WhatsApp/SMS
    ↓
outreachreply edge function receives reply
    ↓
Gemini AI reads reply → understands intent
    ↓
Autocreates pending appointment in Supabase
    ↓
Synced to showroom desktop app within 30 seconds
```

No staff involvement required after initial setup.



## 🔄 Sync Engine — How It Works

The `DatabaseManager` is the core of AutoShift's reliability. Here is the exact flow for every user action:

1. **User performs an action** (books appointment, adds service, registers car)
2. **Saved to IndexedDB instantly** — UI responds immediately, no waiting
3. **Change queued** in the local `operation_queue`
4. **Immediate push attempted** to Supabase
    ✅ Success → uploaded, queue cleared
    ❌ Failure → retried with exponential backoff (up to 3 attempts)
5. **Every 30 seconds** — background pull fetches remote changes (`created_at > last_sync`)
6. **Conflicts resolved** using LastWriteWins with fieldlevel merging


## 🚦 Getting Started

### Prerequisites
 Node.js 18+
 Windows OS (for Electron `.exe` packaging)
 Supabase account
 Twilio account (for WhatsApp/SMS)
 Google Gemini API key

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Run the included Windows configuration script:
```bash
configure_showroom.bat
```

Or manually create a `.env` file in the root:
```env
# Supabase
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_PUBLISHABLE_KEY=your_public_anon_key

# Twilio (WhatsApp/SMS)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_FROM_NUMBER=your_twilio_number

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Sentry Monitoring
REACT_APP_SENTRY_DSN=your_sentry_dsn

# Showroom Configuration
REACT_APP_SHOWROOM_NAME=Your Showroom Name
REACT_APP_SHOWROOM_PIN=staff_pin_here
REACT_APP_ADMIN_PIN=admin_pin_here
```

### 3. Supabase Schema Setup

Create these tables with **UUID** as primary key type:

```sql
 Required tables
clients, cars, services, appointments
```

Enable Row Level Security and create policies for the `anon` role:

```sql
CREATE POLICY "Enable all for anon" ON public.clients
FOR ALL TO anon USING (true) WITH CHECK (true);
 Repeat for: cars, services, appointments
```

### 4. Deploy Edge Functions to Supabase

```bash
supabase functions deploy clientoutreach
supabase functions deploy outreachreply
```

### 5. Run in Development
```bash
npm start
```

### 6. Build Desktop App (`.exe`)
> ⚠️ **Must run as Windows Administrator or with Developer Mode enabled**

```bash
npm run electronpack
```



## 👤 Role Permissions

| Action | Staff PIN | Admin PIN |
||||
| Register new vehicle | ✅ | ✅ |
| Add service record | ✅ | ✅ |
| View appointments | ✅ | ✅ |
| Edit existing records | ❌ | ✅ |
| Delete records | ❌ | ✅ |
| Force resync | ❌ | ✅ |
| Clear local cache | ❌ | ✅ |



## 📁 Project Structure

```
autoshift/
├── src/
│   ├── AutoShowroom.jsx          # Main app shell, state, UI logic
│   ├── database/
│   │   ├── DatabaseManager.js    # Sync engine and data API
│   │   └── LocalDatabase.js      # IndexedDB schema and operations
│   └── supabaseClient.js         # Supabase connection config
├── supabase/
│   └── functions/
│       ├── clientoutreach/      # Twilio outreach edge function
│       └── outreachreply/       # Gemini AI reply parser edge function
├── configure_showroom.bat        # Windows environment setup script
├── .env                          # Local environment variables
└── package.json
```
