# AutoShift: Future Roadmap & Improvements

This document outlines planned improvements and technical debt resolution for the Automobile Showroom Management System.

## 🚀 Phase 1: Robustness & Performance [COMPLETED]
### 1.1 Enhanced Conflict Resolution
- [x] **Field-level merging**: Prevents data loss when different fields are updated concurrently.
- [ ] **Manual conflict resolution UI**: (Partially implemented via conflict indicators; full manual UI deferred).

### 1.2 Sync Optimization
- [x] **Exponential Backoff**: Reduces server load during outages by increasing retry wait times.
- [x] **Delta Sync**: Implemented via `created_at` filtering.
- [x] **Chunked Fetching**: Fetches large datasets in manageable batches (500 records/request).

### 1.3 IndexedDB Indexing
- [x] **Query Optimization**: Refactored `LocalDatabase.js` to utilize native IndexedDB indices for faster local searches.

## 🎨 Phase 2: UX & UI Refinement [COMPLETED]
### 2.1 Granular Sync Indicators
- [x] **Per-record icons**: Cloud, Clock, and Warning icons for sync status.
- [x] **Global Sync Status**: "Last Synced" timestamp in the sidebar.

### 2.2 Offline Mode Enhancements
- [x] **Offline Banner**: Clear visual indicator when connectivity is lost.
- [x] **Safety Checks**: Disabled destructive actions like "Clear Cache" when offline.

### 2.3 Dashboard Analytics
- [x] **Local-First Insights**: Implementation of "Popular Services" and "Top Brands" using IndexedDB data.
- [x] **Revenue Trends**: Comparative monthly revenue growth tracking.

### 2.4 Data Portability & Safety
- [x] **Export/Import**: User interface for JSON-based backup and restore.
- [x] **Selective Resync**: Ability to clear local cache and re-download from remote (with offline safety).

## 🧪 Phase 3: Quality Assurance [COMPLETED]
### 3.1 Automated Testing
- [x] **Unit Tests**: 100% coverage for `LocalDatabase.js` and `DatabaseManager.js` core logic.
- [x] **Integration Tests**: Mocked Supabase failures to verify backoff and retry resiliency.
- [ ] **E2E Tests**: (Foundational setup with Playwright; specific scenarios deferred).

### 3.2 Error Logging
- [x] **Sentry Integration**: Global error boundary and granular sync exception reporting implemented.

## 📈 Phase 4: Client Engagement & AI Outreach
### 4.1 Automated Trigger System [COMPLETED]
- [x] **Edge Function Logic**: Implemented `client-outreach` function to scan for upcoming `nextDue` dates.
- [x] **Automation**: Prepared `pg_cron` migration for daily triggers.

### 4.2 WhatsApp/SMS Integration [COMPLETED]
- [x] **Provider Setup**: Logic for Twilio integration included in outreach functions.
- [x] **Formatting**: Prepared for phone number validation and delivery.

### 4.3 AI Message Personalization [COMPLETED]
- [x] **Gemini Integration**: Personalized service reminders generated based on vehicle history and client data.

### 4.4 AI Appointment Booking (Experimental) [COMPLETED]
- [x] **Interpretation Logic**: Implemented `outreach-reply` function to categorize client responses using Gemini.
- [x] **Auto-Scheduling**: Logic to automatically create `pending` appointments upon confirmation.

## 🖥️ Phase 5: Desktop Distribution
### 5.1 Electron Integration [COMPLETED]
- [x] **Wrapper Setup**: Integrated Electron into the React project with `public/electron.js`.
- [x] **Main Process Logic**: Window management and development/production URL routing configured.

### 5.2 Packaging & Installer [COMPLETED]
- [x] **Executable Build**: Configured `electron-builder` and scripts for Windows (`.exe`).
- [ ] **Auto-Updater**: Implement basic update checks for seamless maintenance.

### 5.3 Distribution Readiness [COMPLETED]
- [x] **Configuration Utility**: Created `configure_showroom.bat` to allow owners to link their credentials without manual file editing.
- [x] **Runtime Loading**: Updated Electron to load `.env` credentials dynamically from the application resources folder.

## 📦 Phase 6: Deployment & DevOps
### 6.1 CI/CD Pipeline
- Automated linting, testing, and deployment to Vercel/Netlify on every push to `main`.
### 6.2 Environment Validation [COMPLETED]
- [x] **Schema Validator**: Created `SchemaValidator.js` to verify Supabase connection and table availability at startup.
- [x] **Failure Handling**: Integrated graceful UI fallbacks for "Invalid Credentials" and "Network Outage" scenarios.

## 🔐 Phase 7: Security & Authentication [COMPLETED]
### 7.1 Shared PIN Access
- [x] **PinGate Component**: Implemented a touch-friendly numpad for staff access.
- [x] **Persistent Sessions**: Integrated `sessionStorage` to keep the app unlocked during active use.
- [x] **Configurable Security**: Owner can set the system PIN via `configure_showroom.bat`.
- [x] **Manual Lock**: Added a "Lock System" feature to the sidebar for immediate security.
