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
  backup: {
    now: () => call('backup:now'),
    info: () => call('backup:info'),
    chooseDir: () => call('backup:chooseDir'),
  },
});
