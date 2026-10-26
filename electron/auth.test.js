'use strict';
const { AutoShiftDatabase } = require('./db/Database');
const { AuthService, MAX_FREE_ATTEMPTS, BASE_LOCK_MS, MAX_LOCK_MS } = require('./auth');

let db; let t; let auth;
const mk = () => new AuthService(db, { now: () => t });
beforeEach(() => { db = new AutoShiftDatabase(':memory:'); t = 1_000_000; auth = mk(); });
afterEach(() => db.close());

describe('first-run setup', () => {
  test('starts unconfigured and locked', () => {
    expect(auth.status()).toMatchObject({ configured: false, role: 'none' });
  });

  test('creates both PINs, signs the owner in as admin, stores only hashes', () => {
    auth.setup('1234', '987654');
    expect(auth.status()).toMatchObject({ configured: true, role: 'admin' });
    const raw = JSON.stringify(db.getSetting('auth'));
    expect(raw).not.toContain('1234');
    expect(raw).not.toContain('987654');
    expect(db.getSetting('auth').staff.salt).not.toBe(db.getSetting('auth').admin.salt);
  });

  test('same PIN twice gives different hashes (random salt)', () => {
    auth.setup('1234', '987654');
    const a = db.getSetting('auth').staff.hash;
    auth.reset(); auth.setup('1234', '987654');
    expect(db.getSetting('auth').staff.hash).not.toBe(a);
  });

  test.each([['123'], ['1234567890123'], ['12a4'], [''], [1234], [null], ['12 34']])(
    'rejects invalid PIN %p', (bad) => {
      expect(() => auth.setup(bad, '987654')).toThrow(/Staff PIN must be 4 to 12 digits/);
    });

  test('staff and admin PINs must differ', () => {
    expect(() => auth.setup('1234', '1234')).toThrow(/different/);
  });

  test('cannot be run again once configured (no takeover)', () => {
    auth.setup('1234', '987654');
    expect(() => auth.setup('1111', '2222')).toThrow(/already set up/);
  });
});

describe('unlock', () => {
  beforeEach(() => { auth.setup('1234', '987654'); auth.lock(); });

  test('staff PIN → staff, admin PIN → admin, wrong PIN → still locked', () => {
    expect(auth.unlock('0000').role).toBe('none');
    expect(auth.unlock('1234').role).toBe('staff');
    auth.lock();
    expect(auth.unlock('987654').role).toBe('admin');
  });

  test('cannot unlock before setup', () => {
    const fresh = new AuthService(new AutoShiftDatabase(':memory:'));
    expect(() => fresh.unlock('1234')).toThrow(/not been set up/);
  });

  test('non-string / malformed input counts as a failed attempt, never throws or unlocks', () => {
    for (const bad of [undefined, null, 1234, {}]) expect(auth.unlock(bad).role).toBe('none');
    expect(auth.status().attemptsLeft).toBe(MAX_FREE_ATTEMPTS - 4);
    expect(auth.unlock('abcd').role).toBe('none'); // 5th failure → now locked out
    expect(() => auth.unlock('1234')).toThrow(/Too many/);
  });
});

describe('lockout', () => {
  beforeEach(() => { auth.setup('1234', '987654'); auth.lock(); });

  test('allows MAX_FREE_ATTEMPTS wrong tries then locks, even for the right PIN', () => {
    for (let i = 0; i < MAX_FREE_ATTEMPTS - 1; i++) {
      expect(auth.unlock('0000').attemptsLeft).toBe(MAX_FREE_ATTEMPTS - 1 - i);
    }
    const st = auth.unlock('0000');
    expect(st.lockedUntil).toBe(t + BASE_LOCK_MS);
    expect(() => auth.unlock('1234')).toThrow(/Too many wrong attempts/);
    expect(auth.status().role).toBe('none');
  });

  test('lock expires, success resets the counter', () => {
    for (let i = 0; i < MAX_FREE_ATTEMPTS; i++) auth.unlock('0000');
    t += BASE_LOCK_MS + 1;
    expect(auth.unlock('1234').role).toBe('staff');
    expect(auth.status().attemptsLeft).toBe(MAX_FREE_ATTEMPTS);
  });

  test('repeated failures back off exponentially up to a cap', () => {
    for (let i = 0; i < MAX_FREE_ATTEMPTS; i++) auth.unlock('0000');
    let prev = BASE_LOCK_MS;
    for (let round = 0; round < 12; round++) {
      t += prev + 1;
      const until = auth.unlock('0000').lockedUntil;
      const dur = until - t;
      expect(dur).toBeGreaterThanOrEqual(prev);
      expect(dur).toBeLessThanOrEqual(MAX_LOCK_MS);
      prev = dur;
    }
    expect(prev).toBe(MAX_LOCK_MS);
  });

  test('lockout survives an app restart', () => {
    for (let i = 0; i < MAX_FREE_ATTEMPTS; i++) auth.unlock('0000');
    const restarted = mk();
    expect(restarted.status().lockedUntil).toBeGreaterThan(t);
    expect(() => restarted.unlock('1234')).toThrow(/Too many/);
  });

  test('a restart does not leave the session unlocked', () => {
    auth.unlock('1234');
    expect(mk().status().role).toBe('none');
  });
});

describe('roles', () => {
  beforeEach(() => { auth.setup('1234', '987654'); auth.lock(); });

  test('require() enforces order none < staff < admin', () => {
    expect(() => auth.require('staff')).toThrow(/locked/);
    auth.unlock('1234');
    expect(() => auth.require('staff')).not.toThrow();
    expect(() => auth.require('admin')).toThrow(/Admin PIN required/);
    auth.elevate('987654');
    expect(() => auth.require('admin')).not.toThrow();
    expect(() => auth.require(null)).not.toThrow();
  });

  test('the staff PIN cannot elevate; wrong elevate counts toward lockout', () => {
    auth.unlock('1234');
    expect(auth.elevate('1234').role).toBe('staff');
    expect(auth.status().attemptsLeft).toBe(MAX_FREE_ATTEMPTS - 1);
  });

  test('drop() returns admin to staff; lock() ends everything', () => {
    auth.unlock('987654');
    expect(auth.drop().role).toBe('staff');
    expect(auth.lock().role).toBe('none');
    expect(auth.drop().role).toBe('none');
  });
});

describe('changePin', () => {
  beforeEach(() => { auth.setup('1234', '987654'); });

  test('needs an admin session AND the admin PIN again', () => {
    auth.drop();
    expect(() => auth.changePin('staff', '5555', '987654')).toThrow(/Admin PIN required/);
    auth.elevate('987654');
    expect(() => auth.changePin('staff', '5555', 'wrong1')).toThrow(/incorrect/);
    auth.changePin('staff', '5555', '987654');
    auth.lock();
    expect(auth.unlock('1234').role).toBe('none');
    expect(auth.unlock('5555').role).toBe('staff');
  });

  test('new PIN must be valid and different from the other role', () => {
    expect(() => auth.changePin('staff', '12', '987654')).toThrow(/4 to 12 digits/);
    expect(() => auth.changePin('staff', '987654', '987654')).toThrow(/different/);
    expect(() => auth.changePin('root', '5555', '987654')).toThrow(/Unknown PIN type/);
  });
});

test('reset() (owner recovery) clears PINs and the session', () => {
  auth.setup('1234', '987654');
  auth.reset();
  expect(auth.status()).toMatchObject({ configured: false, role: 'none' });
  expect(() => auth.setup('1111', '2222')).not.toThrow();
});
