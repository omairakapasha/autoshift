import React from 'react';
import PinGate from './PinGate';
import { mount, tap, typePin, key, authMock } from '../testUtils';

let view;
afterEach(() => { view && view.unmount(); view = null; delete window.autoshift; });
const withAuth = (auth) => { window.autoshift = { auth }; return auth; };

describe('unlock', () => {
  test('correct staff PIN opens the app with role staff', async () => {
    const auth = withAuth(authMock());
    const onUnlock = jest.fn();
    view = await mount(<PinGate onUnlock={onUnlock} />);
    expect(view.container.textContent).toContain('SYSTEM ACCESS REQUIRED');
    await typePin(view.container, '4321');
    await tap(view.container, 'Submit');
    expect(auth.unlock).toHaveBeenCalledWith('4321');
    expect(onUnlock).toHaveBeenCalledWith('staff');
  });

  test('works from the keyboard (digits, Backspace, Enter)', async () => {
    const auth = withAuth(authMock());
    const onUnlock = jest.fn();
    view = await mount(<PinGate onUnlock={onUnlock} />);
    for (const k of ['1', '2', '9', '3', '4', 'Backspace', '5']) await key(k);
    await key('Enter');
    expect(auth.unlock).toHaveBeenCalledWith('12935');
    expect(onUnlock).toHaveBeenCalled();
  });

  test('a wrong PIN stays locked and shows attempts left', async () => {
    withAuth(authMock({ unlock: jest.fn(async () => ({ role: 'none', lockedUntil: 0, attemptsLeft: 3 })) }));
    const onUnlock = jest.fn();
    view = await mount(<PinGate onUnlock={onUnlock} />);
    await typePin(view.container, '0000');
    await tap(view.container, 'Submit');
    expect(onUnlock).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain('Wrong PIN. 3 attempts left');
  });

  test('too-short PINs are rejected without calling the main process', async () => {
    const auth = withAuth(authMock());
    view = await mount(<PinGate onUnlock={jest.fn()} />);
    await typePin(view.container, '123');
    await tap(view.container, 'Submit');
    expect(auth.unlock).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain('at least 4 digits');
  });

  test('lockout shows a countdown and disables the keypad', async () => {
    const until = Date.now() + 45_000;
    const auth = withAuth(authMock({
      status: jest.fn(async () => ({ configured: true, role: 'none', lockedUntil: until, attemptsLeft: 0 })),
    }));
    view = await mount(<PinGate onUnlock={jest.fn()} />);
    expect(view.container.textContent).toMatch(/Locked\. Try again in \d+s/);
    expect(view.container.querySelector('button[aria-label="Submit"]').disabled).toBe(true);
    expect([...view.container.querySelectorAll('button')].find((b) => b.textContent === '5').disabled).toBe(true);
    await key('1'); await key('Enter');
    expect(auth.unlock).not.toHaveBeenCalled();
  });

  test('an already-open session (e.g. dev hot reload) skips the gate', async () => {
    withAuth(authMock({ status: jest.fn(async () => ({ configured: true, role: 'admin', lockedUntil: 0 })) }));
    const onUnlock = jest.fn();
    view = await mount(<PinGate onUnlock={onUnlock} />);
    expect(onUnlock).toHaveBeenCalledWith('admin');
  });

  test('the old default PIN 1234 is not special-cased anywhere in the renderer', async () => {
    const auth = withAuth(authMock({ unlock: jest.fn(async () => ({ role: 'none', lockedUntil: 0, attemptsLeft: 4 })) }));
    const onUnlock = jest.fn();
    view = await mount(<PinGate onUnlock={onUnlock} />);
    await typePin(view.container, '1234');
    await tap(view.container, 'Submit');
    expect(auth.unlock).toHaveBeenCalledWith('1234');   // decided by the main process only
    expect(onUnlock).not.toHaveBeenCalled();
  });

  test('shows a clear error if the main process cannot be reached', async () => {
    withAuth(authMock({ status: jest.fn(async () => { throw new Error('IPC down'); }) }));
    view = await mount(<PinGate onUnlock={jest.fn()} />);
    expect(view.container.querySelector('[role="alert"]').textContent).toContain('IPC down');
  });
});

describe('first-run setup', () => {
  const unconfigured = () => ({ status: jest.fn(async () => ({ configured: false, role: 'none', lockedUntil: 0 })) });

  test('walks staff → confirm → admin → confirm, then creates both PINs', async () => {
    const auth = withAuth(authMock(unconfigured()));
    const onUnlock = jest.fn();
    view = await mount(<PinGate onUnlock={onUnlock} />);
    expect(view.container.textContent).toContain('STEP 1 OF 4');
    await typePin(view.container, '1111'); await tap(view.container, 'Submit');
    expect(view.container.textContent).toContain('STEP 2 OF 4');
    await typePin(view.container, '1111'); await tap(view.container, 'Submit');
    expect(view.container.textContent).toContain('STEP 3 OF 4');
    await typePin(view.container, '987654'); await tap(view.container, 'Submit');
    await typePin(view.container, '987654'); await tap(view.container, 'Submit');
    expect(auth.setup).toHaveBeenCalledWith('1111', '987654');
    expect(onUnlock).toHaveBeenCalledWith('admin');
    expect(auth.unlock).not.toHaveBeenCalled();
  });

  test('a mismatched confirmation restarts the staff PIN step and never calls setup', async () => {
    const auth = withAuth(authMock(unconfigured()));
    view = await mount(<PinGate onUnlock={jest.fn()} />);
    await typePin(view.container, '1111'); await tap(view.container, 'Submit');
    await typePin(view.container, '2222'); await tap(view.container, 'Submit');
    expect(view.container.textContent).toContain("didn't match");
    expect(view.container.textContent).toContain('STEP 1 OF 4');
    expect(auth.setup).not.toHaveBeenCalled();
  });

  test('the admin PIN cannot equal the staff PIN', async () => {
    const auth = withAuth(authMock(unconfigured()));
    view = await mount(<PinGate onUnlock={jest.fn()} />);
    await typePin(view.container, '1111'); await tap(view.container, 'Submit');
    await typePin(view.container, '1111'); await tap(view.container, 'Submit');
    await typePin(view.container, '1111'); await tap(view.container, 'Submit');
    expect(view.container.textContent).toContain('must differ');
    expect(view.container.textContent).toContain('STEP 3 OF 4');
    expect(auth.setup).not.toHaveBeenCalled();
  });
});
