import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import App from './AutoShowroom.jsx';
import { authMock, tap, typePin, flush } from './testUtils';

function mockBridge({ tables = {}, settings = {}, failLoad = false, role = 'staff', auth = {} } = {}) {
  const calls = [];
  const session = { role };   // behaves like the main process: lock()/unlock() change what status() reports
  window.autoshift = {
    auth: authMock({
      status: jest.fn(async () => ({ configured: true, role: session.role, lockedUntil: 0 })),
      unlock: jest.fn(async () => { session.role = 'staff'; return { configured: true, role: 'staff', lockedUntil: 0 }; }),
      lock: jest.fn(async () => { session.role = 'none'; return { role: 'none' }; }),
      ...auth,
    }),
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

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete window.autoshift;
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

describe('PIN gate integration', () => {
  test('nothing is read from the database while the app is locked', async () => {
    mockBridge({ role: 'none' });
    await mount();
    expect(container.textContent).toContain('SYSTEM ACCESS REQUIRED');
    expect(window.autoshift.db.read).not.toHaveBeenCalled();
    await typePin(container, '1111');
    await tap(container, 'Submit');
    await flush();
    expect(window.autoshift.db.read).toHaveBeenCalled();     // loaded only after unlock
    expect(container.textContent).toContain('Dashboard');
  });

  test('LOCK SYSTEM ends the session in the main process and clears the screen', async () => {
    mockBridge();
    await mount();
    expect(container.textContent).toContain('Dashboard');
    await tap(container, 'LOCK SYSTEM');
    expect(window.autoshift.auth.lock).toHaveBeenCalled();
    expect(container.textContent).toContain('SYSTEM ACCESS REQUIRED');
    expect(container.textContent).not.toContain('BACKUP NOW');
  });

  test('admin mode uses an in-app PIN dialog (window.prompt is unsupported in Electron)', async () => {
    mockBridge();
    const promptSpy = jest.spyOn(window, 'prompt').mockImplementation(() => { throw new Error('prompt() is not supported'); });
    await mount();
    expect(container.textContent).not.toContain('CHANGE PINS');
    await tap(container, 'SWITCH TO ADMIN');
    expect(promptSpy).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    const input = container.querySelector('input[type="password"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, '987654');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await tap(container, 'Unlock owner actions');
    expect(window.autoshift.auth.elevate).toHaveBeenCalledWith('987654');
    expect(container.textContent).toContain('ADMIN MODE: ON');
    expect(container.textContent).toContain('CHANGE PINS');
    await tap(container, 'ADMIN MODE: ON');
    expect(window.autoshift.auth.drop).toHaveBeenCalled();
    expect(container.textContent).not.toContain('CHANGE PINS');
    promptSpy.mockRestore();
  });

  test('a wrong admin PIN keeps owner actions off', async () => {
    mockBridge({ auth: { elevate: jest.fn(async () => ({ role: 'staff', lockedUntil: 0, attemptsLeft: 4 })) } });
    await mount();
    await tap(container, 'SWITCH TO ADMIN');
    const input = container.querySelector('input[type="password"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '000000');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await tap(container, 'Unlock owner actions');
    expect(container.querySelector('[role="alert"]').textContent).toContain('Incorrect admin PIN');
    expect(container.textContent).not.toContain('ADMIN MODE: ON');
  });
});
