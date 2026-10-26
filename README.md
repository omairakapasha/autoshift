# AutoShift

Showroom management for a single Windows machine: clients, vehicles, service history and appointments, stored in a local SQLite database with automatic backups.

![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-local-003B57?logo=sqlite&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Windows-0078D6)

## What it does

- **Clients and vehicles**: full profiles, each car linked to its owner, with quick vehicle registration accessible across the app (Sidebar, Dashboard, Directory, and individual Client profiles).
- **Service tracking**: repair and maintenance jobs, technician, cost, next-due date, logged directly from vehicle profiles.
- **Alerts**: vehicles whose service is due or overdue.
- **Appointments**: schedule and view bookings.
- **Backups**: a consistent copy of the database is written automatically every 24 hours (last 14 kept), plus a *Backup now* button and a configurable backup folder (a USB drive or a synced OneDrive/Drive folder works well).
- **Export / import**: JSON export and import (import merges by id and is all-or-nothing).

There is no server, account or internet connection required. All data stays on the machine.

## Architecture

```
┌─────────────── Electron main process ───────────────┐
│  electron/db/Database.js   SQLite (better-sqlite3)  │
│  electron/db/schema.js     migrations + field list  │
│  electron/auth.js          authentication & lock    │
│  electron/ipc.js           IPC handlers + backups   │
└───────────────▲─────────────────────────────────────┘
                │ IPC (contextBridge: auth.*, db.*, backup.*)
┌───────────────┴─────────────────────────────────────┐
│  electron/preload.js       window.autoshift          │
│  Renderer (React, sandboxed, no Node access)         │
│  src/components/PinGate.jsx  → auth modal & lock    │
│  src/database/DatabaseManager.js → window.autoshift  │
└─────────────────────────────────────────────────────┘
```

- The renderer has **no filesystem or Node access** (`contextIsolation`, `sandbox`, no `nodeIntegration`). It can only call the channels the preload script exposes.
- Only whitelisted tables and columns can be read or written; values are always parameterised.
- Foreign keys are enforced: deleting a vehicle removes its services and appointments; a client who still owns vehicles cannot be deleted.
- Schema changes are versioned migrations (`PRAGMA user_version`). The app refuses to open a database written by a newer version.
- Only one copy of the app can run at a time, so two processes never write to the same database.

The database file is `autoshift.db` in the app's user-data folder:
`%APPDATA%\automobile-showroom\autoshift.db` (or `%APPDATA%\AutoShift\autoshift.db`).

## Access control

On first launch the owner is asked to create two PINs (4 to 12 digits, and they must differ):

| | Staff PIN | Admin PIN |
|---|---|---|
| Open the app, view and add clients, vehicles, services, appointments, edit records | yes | yes |
| Backup now, export | yes | yes |
| Delete records, import a backup, change the backup folder, manage the staff list, change PINs | no | yes |

Staff unlock the app with the staff PIN; the owner switches on **Admin mode** from the sidebar by entering the admin PIN (or unlocks directly with it).

- PIN authentication is enforced strictly by the **main process**; credentials are never exposed to the UI layer.
- Automated lockout protection engages upon repeated unsuccessful attempts to prevent unauthorized access.
- Sessions automatically terminate upon window reload, **Lock system**, or application close.
- **Forgot a PIN or locked out?** Contact your system administrator for authorized credentials recovery.

The application runs in a secure, isolated window with strict navigation controls and privacy-respecting diagnostics.

## Getting started

Prerequisites: Node.js 18+ and Windows (to build the installer).

```bash
npm install
npm run electron-dev      # rebuilds native modules for Electron, then starts app + dev server
npm run electron-pack     # builds the Windows installer and unpacked exe into dist/
```

The build produces:
- Standalone portable binary: `dist\win-unpacked\AutoShift.exe`
- Windows installer setup: `dist\AutoShift Setup 1.0.0.exe`

### Tests

```bash
npm run rebuild:node      # once, if you have run electron-dev (restores the Node build of better-sqlite3)
npm run test:db           # SQLite layer, IPC, Electron wiring (Node)
npm test                  # React UI, PIN gate and renderer client (jsdom)
```

`better-sqlite3` is a native module, so it is compiled for either Node (tests) or Electron (running the app). `electron-dev` switches it to Electron; `rebuild:node` switches it back. `electron-pack` rebuilds it for Electron automatically.

## Moving data from the old (IndexedDB + Supabase) version

1. In the **old** app, click **EXPORT** and save the JSON file.
2. In the new app, click **IMPORT** and choose that file. The old format (snake_case fields, sync metadata) is understood and converted.

## Known limitations

- No Content-Security-Policy is set yet (it needs testing against the packaged app and the dev server).
- The installer is unsigned and there is no auto-update yet.
- No demo data is loaded: a fresh install starts empty.

## License

Released under the [MIT License](LICENSE).
