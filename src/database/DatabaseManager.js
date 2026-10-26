/**
 * DatabaseManager — renderer-side client for the local SQLite database.
 *
 * All storage lives in the Electron main process (see electron/). This module
 * is a thin, promise-based wrapper over window.autoshift, exposed by the
 * preload script, so UI code keeps the same calls it always had.
 */

function api() {
  if (typeof window === 'undefined' || !window.autoshift) {
    throw new Error(
      'AutoShift must run inside the desktop app (window.autoshift is missing). ' +
      'Use "npm run electron-dev" instead of opening the dev server in a browser.'
    );
  }
  return window.autoshift;
}

export const databaseManager = {
  create: (table, data) => api().db.create(table, data),
  read: (table, query = {}) => api().db.read(table, query),
  update: (table, id, data) => api().db.update(table, id, data),
  delete: (table, id) => api().db.delete(table, id),

  getClients: () => api().db.read('clients'),
  getCars: () => api().db.read('cars'),
  getServices: () => api().db.read('services'),
  getAppointments: () => api().db.read('appointments'),

  async loadAll() {
    const [clients, cars, services, appointments] = await Promise.all([
      this.getClients(), this.getCars(), this.getServices(), this.getAppointments(),
    ]);
    return { clients, cars, services, appointments };
  },

  getSetting: (key, fallback = null) => api().db.getSetting(key, fallback),
  setSetting: (key, value) => api().db.setSetting(key, value),

  exportJson: () => api().db.exportJson(),
  importJson: (payload) => api().db.importJson(payload),

  // Access control. The session lives in the main process; these only relay.
  auth: {
    status: () => api().auth.status(),
    setup: (staffPin, adminPin) => api().auth.setup(staffPin, adminPin),
    unlock: (pin) => api().auth.unlock(pin),
    elevate: (pin) => api().auth.elevate(pin),
    drop: () => api().auth.drop(),
    lock: () => api().auth.lock(),
    changePin: (which, newPin, adminPin) => api().auth.changePin(which, newPin, adminPin),
  },

  backupNow: () => api().backup.now(),
  backupInfo: () => api().backup.info(),
  chooseBackupDir: () => api().backup.chooseDir(),
};
