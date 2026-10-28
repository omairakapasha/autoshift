'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Unwrap {ok,data,error} envelopes so renderer code can just await / try-catch.
const call = async (channel, ...args) => {
  const res = await ipcRenderer.invoke(channel, ...args);
  if (!res.ok) throw new Error(res.error);
  return res.data;
};

contextBridge.exposeInMainWorld('autoshift', {
  db: {
    create: (table, data) => call('db:create', table, data),
    read: (table, query) => call('db:read', table, query),
    update: (table, id, data) => call('db:update', table, id, data),
    delete: (table, id) => call('db:delete', table, id),
    stats: () => call('db:stats'),
    getSetting: (key, fallback) => call('db:getSetting', key, fallback),
    setSetting: (key, value) => call('db:setSetting', key, value),
    exportJson: () => call('db:exportJson'),
    importJson: (payload) => call('db:importJson', payload),
  },
  auth: {
    status: () => call('auth:status'),
    setup: (staffPin, adminPin) => call('auth:setup', staffPin, adminPin),
    unlock: (pin) => call('auth:unlock', pin),
    elevate: (pin) => call('auth:elevate', pin),
    drop: () => call('auth:drop'),
    lock: () => call('auth:lock'),
    changePin: (which, newPin, adminPin) => call('auth:changePin', which, newPin, adminPin),
  },
  backup: {
    now: () => call('backup:now'),
    info: () => call('backup:info'),
    chooseDir: () => call('backup:chooseDir'),
  },
});

// ==================== CLIENT COMMUNICATION (Email & SMS Only) ====================
contextBridge.exposeInMainWorld('autoshiftAgent', {
  // Send email to client
  sendEmail: (to, clientName, messageType, appointmentDetails) => 
    ipcRenderer.invoke('agent:send-email', { to, clientName, messageType, appointmentDetails }),

  // Send SMS to client
  sendSMS: (phone, message) => 
    ipcRenderer.invoke('agent:send-sms', { phone, message }),

  // Admin functions for backend management
    // Dashboard
    getDashboard: () => ipcRenderer.invoke('admin:get-dashboard'),
    
    // Clients
    getClients: () => ipcRenderer.invoke('admin:get-clients'),
    getClient: (clientId) => ipcRenderer.invoke('admin:get-client', clientId),
    createClient: (data) => ipcRenderer.invoke('admin:create-client', data),
    updateClient: (data) => ipcRenderer.invoke('admin:update-client', data),
    
    // Vehicles
    getVehicles: (clientId) => ipcRenderer.invoke('admin:get-vehicles', clientId),
    createVehicle: (data) => ipcRenderer.invoke('admin:create-vehicle', data),
    
    // Appointments
    getAppointments: (filters) => ipcRenderer.invoke('admin:get-appointments', filters),
    createAppointment: (data) => ipcRenderer.invoke('admin:create-appointment', data),
    updateAppointment: (data) => ipcRenderer.invoke('admin:update-appointment', data),
    cancelAppointment: (id) => ipcRenderer.invoke('admin:cancel-appointment', id),
    
    // Services
    getServices: (plate) => ipcRenderer.invoke('admin:get-services', plate),
    createService: (data) => ipcRenderer.invoke('admin:create-service', data),
  },

  // Listen for events from main process
  onReminderCheck: (callback) => ipcRenderer.on('agent:reminder-check', (event, data) => callback(data)),
});
