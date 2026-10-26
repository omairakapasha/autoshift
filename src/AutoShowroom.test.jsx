import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import App from './AutoShowroom.jsx';

global.IS_REACT_ACT_ENVIRONMENT = true;

function mockBridge({ tables = {}, settings = {}, failLoad = false } = {}) {
  const calls = [];
  window.autoshift = {
    db: {
      read: jest.fn(async (t) => { if (failLoad) throw new Error('disk on fire'); return tables[t] || []; }),
      create: jest.fn(async (t, d) => { calls.push(['create', t, d]); return { id: 'new', ...d }; }),
      update: jest.fn(), delete: jest.fn(),
      getSetting: jest.fn(async (k, f) => (k in settings ? settings[k] : f)),
      setSetting: jest.fn(async (k, v) => v),
    },
    backup: {
      info: jest.fn(async () => ({ dir: '/b', lastBackupAt: new Date().toISOString() })),
      now: jest.fn(), chooseDir: jest.fn(),
    },
  };
  return calls;
}

let container, root;
async function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<App />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

beforeEach(() => { sessionStorage.setItem('autoshift_unlocked', 'true'); });
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete window.autoshift;
  sessionStorage.clear();
});

test('renders the dashboard against an EMPTY database (no fake seed data)', async () => {
  mockBridge();
  await mount();
  expect(container.textContent).toContain('AutoShift');
  expect(container.textContent).toContain('Dashboard');
  expect(container.textContent).not.toContain('Ahmed Raza'); // old SEED data is gone
  expect(container.textContent).not.toMatch(/sync/i);
});

test('renders with real data and shows backup status', async () => {
  mockBridge({
    tables: {
      clients: [{ id: 'c1', name: 'Zainab Test', phone: '1', since: '2026-01-01' }],
      cars: [{ id: 'k1', plate: 'TST-1', make: 'Honda', model: 'City', year: 2022, clientId: 'c1' }],
      services: [{ id: 's1', plate: 'TST-1', type: 'Oil Change', date: '2026-01-01', nextDue: '2026-12-01', cost: 100, status: 'Completed', tech: 'Bilal Ahmed' }],
    },
  });
  await mount();
  expect(container.textContent).toContain('DATA BACKED UP');
  expect(container.textContent).toContain('BACKUP NOW');
  expect(container.textContent).not.toContain('CLEAR LOCAL CACHE');
});

test('loads saved technicians from settings', async () => {
  mockBridge({ settings: { technicians: ['Only Tech'] } });
  await mount();
  expect(window.autoshift.db.getSetting).toHaveBeenCalledWith('technicians', null);
});

test('shows an error screen (not fake data) when the database cannot be read', async () => {
  mockBridge({ failLoad: true });
  await mount();
  expect(container.textContent).toContain('Could not open the database');
  expect(container.textContent).toContain('disk on fire');
});
