# AutoShift — AI-Powered Automobile Showroom Management System

> A production-grade **Electron desktop application** for automobile showrooms — featuring offline-first data architecture, Google Gemini AI-driven client outreach, Twilio WhatsApp/SMS automation, and real-time Supabase cloud synchronization.

---

## ✨ What Makes AutoShift Different

Most showroom management tools require constant internet and manual follow-up. AutoShift eliminates both:

- **Works without internet** — every action is instant, locally stored, and synced when connection returns
- **AI handles client communication** — Gemini AI reads client replies and auto-books appointments, no staff input needed
- **Real notifications** — customers receive actual WhatsApp/SMS messages, not just in-app pings
- **Desktop-grade reliability** — packaged as a native `.exe`, not a browser tab that crashes

---

## 🚀 Key Features

### 🤖 AI Smart Outreach (Gemini + Twilio)
- Daily automated scan of upcoming vehicle service dates via `pg_cron`
- Twilio sends personalised WhatsApp or SMS reminders to clients automatically
- Incoming client replies are processed by **Google Gemini AI**, which interprets intent and auto-creates `pending` appointments based on vehicle history — zero manual intervention required

### 📡 Offline-First Sync Engine
- All reads and writes hit local **IndexedDB** first — zero-latency UI regardless of connectivity
- Changes queue locally and push to **Supabase (PostgreSQL)** the moment internet returns
- Background delta sync every 30 seconds pulls remote changes from other devices
- **Exponential backoff** with up to 3 retry attempts for failed uploads
- **Field-level conflict resolution** using Last-Write-Wins timestamps — prevents data loss on concurrent edits
- Chunked fetching prevents memory overload on large datasets

### 🔐 Role-Based PinGate Authentication
- Touch-friendly numpad login — designed for shared showroom terminals
- **Staff PIN** — day-to-day operations: register vehicles, log services, view appointments
- **Admin PIN** — unlocks destructive actions: delete/edit records, force resync, clear local cache

### 📊 Core Management Modules
- **Client Registry** — full customer profiles with service history
- **Vehicle Lookup** — car records linked to clients with full maintenance logs
- **Service Tracking** — log and monitor repair/maintenance jobs per vehicle
- **Appointment Scheduling** — manual booking + AI-driven auto-scheduling from client replies

### 🛡️ Production Monitoring
- **Sentry** (`@sentry/react` v10) — real-time error boundaries, sync exception tracking, and crash reporting
- Offline/online status indicators in the UI
- Real-time sync status logs for transparency

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Desktop wrapper | Electron v41.5.0 | Native `.exe` app packaging |
| Frontend | React 18 (CommonJS) | UI and state management |
| Local database | IndexedDB (Native API) | Offline-first data persistence |
| Cloud database | Supabase (PostgreSQL) | Remote sync and edge functions |
| AI | Google Gemini AI | Reply interpretation & auto-scheduling |
| Messaging | Twilio | WhatsApp + SMS outreach |
| Monitoring | Sentry (`@sentry/react` v10) | Error tracking and sync monitoring |
| Icons | Lucide React | UI iconography |
| Styling | CSS-in-JS (Vanilla) | Component styling |

---

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
│  │              │    │  client-outreach   │  │
│  │  pg_cron     │───▶│  (Twilio sender)   │  │
│  │  daily scan  │    │                    │  │
│  │              │    │  outreach-reply    │  │
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
                          intent → auto-creates
                          pending appointment
```

---

## 🤖 AI Outreach Flow (End-to-End)

```
pg_cron runs daily
    ↓
Scans vehicles with upcoming nextDue service dates
    ↓
client-outreach edge function fires
    ↓
Twilio sends WhatsApp/SMS:
"Your [Car Model] is due for service on [Date].
Reply YES to book an appointment."
    ↓
Client replies on WhatsApp/SMS
    ↓
outreach-reply edge function receives reply
    ↓
Gemini AI reads reply → understands intent
    ↓
Auto-creates pending appointment in Supabase
    ↓
Synced to showroom desktop app within 30 seconds
```

No staff involvement required after initial setup.

---

## 🔄 Sync Engine — How It Works

The `DatabaseManager` is the core of AutoShift's reliability. Here is the exact flow for every user action:

1. **User performs an action** (books appointment, adds service, registers car)
2. **Saved to IndexedDB instantly** — UI responds immediately, no waiting
3. **Change queued** in the local `operation_queue`
4. **Immediate push attempted** to Supabase
   - ✅ Success → uploaded, queue cleared
   - ❌ Failure → retried with exponential backoff (up to 3 attempts)
5. **Every 30 seconds** — background pull fetches remote changes (`created_at > last_sync`)
6. **Conflicts resolved** using Last-Write-Wins with field-level merging

**Schema mapping** is handled transparently: frontend uses camelCase (`clientId`), database uses snake_case (`client_id`) — the engine converts automatically.

---

## 🚦 Getting Started

### Prerequisites
- Node.js 18+
- Windows OS (for Electron `.exe` packaging)
- Supabase account
- Twilio account (for WhatsApp/SMS)
- Google Gemini API key

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
-- Required tables
clients, cars, services, appointments
```

Enable Row Level Security and create policies for the `anon` role:

```sql
CREATE POLICY "Enable all for anon" ON public.clients
FOR ALL TO anon USING (true) WITH CHECK (true);
-- Repeat for: cars, services, appointments
```

### 4. Deploy Edge Functions to Supabase

```bash
supabase functions deploy client-outreach
supabase functions deploy outreach-reply
```

### 5. Run in Development
```bash
npm start
```

### 6. Build Desktop App (`.exe`)
> ⚠️ **Must run as Windows Administrator or with Developer Mode enabled**

```bash
npm run electron-pack
```

---

## 🔍 Troubleshooting

### ❌ Electron Packaging Fails (`Cannot create symbolic link`)
**Cause:** `winCodeSign` utilities require symbolic link permissions.

**Fix (choose one):**
- Run terminal as **Administrator**
- Enable **Windows Developer Mode** → Settings → For Developers → Developer Mode ON
- Then re-run `npm run electron-pack`

### ❌ Supabase `401 Unauthorized` / `RLS Policy Violation`
1. Go to **Supabase Dashboard** → **Database** → **Policies**
2. Enable RLS for each table
3. Create `anon` role policy (see schema setup above)

### ❌ Twilio Messages Not Sending
- Verify `TWILIO_FROM_NUMBER` is WhatsApp-enabled in Twilio console
- Confirm the client's number is in E.164 format (`+923001234567`)
- Check Supabase edge function logs for Twilio error codes

### ❌ Sync Issues / UUID Mismatch
- Old integer-based local data is incompatible with UUID schema
- Use **"CLEAR LOCAL CACHE"** button (Admin PIN required) → app re-downloads clean data from Supabase

### 🔍 Checking Sync Status
Open browser/Electron DevTools console to see live sync logs:
```
Starting Supabase synchronization...
Successfully uploaded 3 operations...
Remote sync complete — 2 new records merged
```

---

## 👤 Role Permissions

| Action | Staff PIN | Admin PIN |
|---|---|---|
| Register new vehicle | ✅ | ✅ |
| Add service record | ✅ | ✅ |
| View appointments | ✅ | ✅ |
| Edit existing records | ❌ | ✅ |
| Delete records | ❌ | ✅ |
| Force resync | ❌ | ✅ |
| Clear local cache | ❌ | ✅ |

---

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
│       ├── client-outreach/      # Twilio outreach edge function
│       └── outreach-reply/       # Gemini AI reply parser edge function
├── configure_showroom.bat        # Windows environment setup script
├── .env                          # Local environment variables
└── package.json
```

---

## 🗺️ Roadmap

- [x] Offline-first sync engine with exponential backoff
- [x] Gemini AI client reply interpretation
- [x] Twilio WhatsApp/SMS automated outreach
- [x] Role-based PinGate authentication
- [x] Sentry error monitoring
- [x] Chunked fetching and field-level conflict resolution
- [ ] Electron auto-updater for `.exe` deployments
- [ ] E2E testing suite (Playwright)
- [ ] Manual conflict resolution UI for edge cases
- [ ] AI-powered vehicle health scoring (integration with OBD-II data)
- [ ] Multi-branch showroom support

---

## 📄 Specifications

Detailed requirements and design specs are in `.kiro/specs/`:
- `offline-sync-capability/` — sync engine requirements and conflict strategies
- `automobile-showroom-bugfix/` — original bug analysis and resolution plan

---

*Built with React 18, Electron, Supabase, Google Gemini AI, and Twilio.*
