# AutoShift — Confidential Administrator & Operations Manual
> **CONFIDENTIAL / ADMIN ONLY**: Do not distribute this document to general showroom staff or include it in public repositories. Store a copy in your secure Google Drive or encrypted password manager.

---

## 1. Quick Emergency Cheatsheet

| Task | PowerShell Command / Action |
|---|---|
| **Reset Forgotten PINs** | `$env:AUTOSHIFT_RESET_PINS="1"; & ".\dist\win-unpacked\AutoShift.exe"` |
| **Reset PINs (CMD)** | `set AUTOSHIFT_RESET_PINS=1 && ".\dist\win-unpacked\AutoShift.exe"` |
| **Locate Database** | `%APPDATA%\automobile-showroom\autoshift.db` |
| **Manual Instant Backup** | Copy `autoshift.db` to your Google Drive folder while app is closed |
| **Instant Lockout Unfreeze** | Run `UPDATE settings SET value = '{"failed":0,"lockedUntil":0}' WHERE key = 'authLock';` |

---

## 2. Database Storage & Architecture

AutoShift stores all application records in a single, high-performance SQLite database file on the local machine.

### Exact File Paths
- **Active SQLite Database**:
  ```text
  %APPDATA%\automobile-showroom\autoshift.db
  ```
  *Full Windows Path:*
  ```text
  C:\Users\<YourUsername>\AppData\Roaming\automobile-showroom\autoshift.db
  ```
- **Automated Rolling Backups Directory**:
  ```text
  %APPDATA%\automobile-showroom\backups\
  ```
  AutoShift automatically writes consistent snapshot backups every 24 hours and retains the 14 most recent copies.

### Database Tables Schema
- `clients`: Customer details (id, name, phone, email, notes, createdAt, updatedAt).
- `cars`: Vehicle inventory (id, clientId, make, model, year, vin, regNumber, color, mileage, status, createdAt, updatedAt).
- `services`: Maintenance & repair history (id, carId, date, description, cost, technician, mileage, nextServiceDue, notes).
- `appointments`: Scheduled bookings (id, clientId, carId, date, time, serviceType, status, notes).
- `settings`: Key-value application state (auth PIN hashes, lockout counter, custom backup folder, technician list).

---

## 3. Database Management & UI Inspection

You can view, search, export, and manually inspect the raw `.db` file using visual SQLite tools.

### Recommended Free Tools
1. **DB Browser for SQLite** (Recommended): [https://sqlitebrowser.org/](https://sqlitebrowser.org/)
2. **VS Code Extension**: "SQLite Viewer" by Florian Klampfer.

> **CRITICAL RULE**: Always close AutoShift before opening `autoshift.db` in an external viewer. SQLite enforces a single-writer lock; accessing it while the app is running can cause temporary lock contention.

### Essential Administrative SQL Queries

Open `autoshift.db` in DB Browser for SQLite -> Navigate to the **Execute SQL** tab:

#### 1. Check Authentication & Lockout Status
```sql
SELECT key, value FROM settings WHERE key IN ('auth', 'authLock');
```

#### 2. Instantly Clear Lockout Timer (Without Resetting PINs)
If staff got locked out by 5 consecutive wrong guesses, but you know the valid PIN and don't want to wait out the timer:
```sql
UPDATE settings 
SET value = '{"failed":0,"lockedUntil":0}' 
WHERE key = 'authLock';
```
*(Remember to click "Write Changes" in DB Browser).*

#### 3. Count Total Records Across All Tables
```sql
SELECT 'clients' as tbl, count(*) as count FROM clients
UNION ALL
SELECT 'cars' as tbl, count(*) FROM cars
UNION ALL
SELECT 'services' as tbl, count(*) FROM services
UNION ALL
SELECT 'appointments' as tbl, count(*) FROM appointments;
```

#### 4. Vacuum / Optimize Database Size
```sql
VACUUM;
```

---

## 4. PIN Security & Lockout Recovery

### Access Control Hierarchy
- **Staff PIN**: Allows daily showroom operations (viewing inventory, registering clients, adding vehicles, logging services, booking appointments, viewing dashboard).
- **Admin PIN**: Full control (all Staff abilities + deleting records, changing system settings, modifying technician rosters, changing PINs, importing backups).

### Lockout Mechanism
- **Threshold**: After 5 consecutive failed PIN attempts, progressive lockout engages.
- **Progression**: Initial lockout is 30 seconds, doubling on every subsequent failed attempt up to a maximum of 15 minutes.
- **Persistence**: Lockout state is stored directly in SQLite (`settings.authLock`) and survives system restarts.

### Recovery Procedures

#### Procedure A: Complete PIN Reset (Recommended)
This clears only the stored salted scrypt PIN hashes. **All your business data (clients, vehicles, services, appointments) remains 100% untouched.**

1. Close AutoShift completely (verify in Windows Task Manager that no background process remains).
2. Open **PowerShell** or **Command Prompt**.
3. Run the reset command pointing to your AutoShift executable:

**Using PowerShell:**
```powershell
$env:AUTOSHIFT_RESET_PINS="1"; & "C:\Users\sunom\OneDrive\Desktop\autoshift\dist\win-unpacked\AutoShift.exe"
```
*(Or if running directly from project source: `$env:AUTOSHIFT_RESET_PINS="1"; npm run electron-dev`)*

**Using Command Prompt (CMD):**
```cmd
set AUTOSHIFT_RESET_PINS=1 && "C:\Users\sunom\OneDrive\Desktop\autoshift\dist\win-unpacked\AutoShift.exe"
```

4. AutoShift will launch and display the first-time setup screen, prompting you to set fresh Staff and Admin PINs.
5. Once configured, close the app and launch it normally.

---

## 5. Google Drive & Cloud Backup Setup

To ensure complete protection against hard drive failure or ransomware, mirror backups to Google Drive.

### Option 1: Automatic Backup to Google Drive (Zero Manual Effort)
1. Install **Google Drive for Desktop** on the Windows machine (maps to `G:\` or a local sync folder).
2. Create a folder in your Google Drive: `My Drive\AutoShift_Backups`.
3. In AutoShift, enter **Admin Mode** (sidebar -> Admin unlock).
4. Go to **Settings** -> **Backup Directory**.
5. Click **Change Folder** and select `G:\My Drive\AutoShift_Backups`.
6. AutoShift will now automatically stream its rolling 24-hour backup snapshots directly to your Google Drive cloud storage.

### Option 2: Manual Cold Copy
Before doing any major system updates or maintenance:
1. Exit AutoShift.
2. Press `Win + R`, paste `%APPDATA%\automobile-showroom`, and hit Enter.
3. Copy `autoshift.db` to your Google Drive folder or a secure USB flash drive.

### Restoring from a Backup
If you ever need to restore your database on a new PC:
1. Install AutoShift on the new PC.
2. Copy your backup `.db` file into `%APPDATA%\automobile-showroom\autoshift.db`.
3. Launch AutoShift. All data and PINs are instantly live.

---

## 6. Developer & Build Operations

If you need to recompile, rebuild native modules, or package a new `.exe`:

### Native Dependency Architecture (`better-sqlite3@12.11.1`)
`better-sqlite3` requires matching binary ABIs depending on whether you run tests in Node or package in Electron:
- **Node 24**: ABI 137
- **Electron 41**: ABI 145

### Build Commands Reference

| Action | Command | Details |
|---|---|---|
| **Run Dev Server** | `npm run electron-dev` | Automatically rebuilds for Electron and starts with hot-reloading |
| **Run Unit Tests** | `npm run rebuild:node`<br>`npm test -- --watchAll=false` | Switches native module to Node ABI and runs full test suite |
| **Run DB Tests** | `npm run test:db` | Tests SQLite schema, constraints, migrations, and IPC handlers |
| **Build Installer & Exe** | `npm run electron-pack` | Compiles React and builds `dist\AutoShift Setup 1.0.0.exe` |

### Output Files
When you run `npm run electron-pack`, the artifacts are in `dist/`:
- **Portable Unpacked Folder**: `dist\win-unpacked\AutoShift.exe` (run directly without installing)
- **Standalone Installer**: `dist\AutoShift Setup 1.0.0.exe` (standard Windows setup wizard)
