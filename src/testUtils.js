import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

global.IS_REACT_ACT_ENVIRONMENT = true;

export async function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(element); });
  await flush();
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

export const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const findButton = (container, label) =>
  [...container.querySelectorAll('button')].find(
    (b) => b.getAttribute('aria-label') === label || b.textContent.trim() === label
  );

export async function tap(container, label) {
  const b = findButton(container, label);
  if (!b) throw new Error(`No button "${label}". Buttons: ${[...container.querySelectorAll('button')].map((x) => x.textContent.trim() || x.getAttribute('aria-label')).join(' | ')}`);
  await act(async () => { b.click(); });
  await flush();
}

export async function typePin(container, digits) {
  for (const d of digits) await tap(container, d);
}

export async function key(k) {
  await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k })); });
  await flush();
}

export function authMock(overrides = {}) {
  return {
    status: jest.fn(async () => ({ configured: true, role: 'none', lockedUntil: 0, attemptsLeft: 5 })),
    setup: jest.fn(async () => ({ configured: true, role: 'admin' })),
    unlock: jest.fn(async () => ({ configured: true, role: 'staff', lockedUntil: 0, attemptsLeft: 5 })),
    elevate: jest.fn(async () => ({ configured: true, role: 'admin' })),
    drop: jest.fn(async () => ({ role: 'staff' })),
    lock: jest.fn(async () => ({ role: 'none' })),
    changePin: jest.fn(async () => ({})),
    ...overrides,
  };
}
