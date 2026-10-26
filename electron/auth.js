'use strict';

/**
 * Access control for the single-machine app.
 *
 *  - PINs are stored only as scrypt hashes (per-PIN random salt) in the
 *    settings table. Hashes never leave the main process.
 *  - The unlocked/admin session lives HERE, not in the renderer, and every
 *    IPC channel checks it. A tampered renderer can't skip the PIN screen.
 *  - Failed attempts are counted and persisted; after MAX_FREE_ATTEMPTS the
 *    app locks out for an exponentially growing time (survives restarts).
 *
 * Threat model: this is a screen lock for a shared showroom terminal. Someone
 * with the Windows account / data files can still read the database; use
 * BitLocker + a Windows password for that.
 */

const crypto = require('crypto');

const PIN_RE = /^\d{4,12}$/;
const MAX_FREE_ATTEMPTS = 5;
const BASE_LOCK_MS = 30 * 1000;
const MAX_LOCK_MS = 15 * 60 * 1000;
const ROLE_RANK = { none: 0, staff: 1, admin: 2 };

class AuthError extends Error {
  constructor(message, code) { super(message); this.name = 'AuthError'; this.code = code; }
}

function hashPin(pin, salt = crypto.randomBytes(16)) {
  const hash = crypto.scryptSync(pin, salt, 32);
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}

function matches(pin, record) {
  if (!record) return false;
  const expected = Buffer.from(record.hash, 'hex');
  const actual = crypto.scryptSync(pin, Buffer.from(record.salt, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

class AuthService {
  /**
   * @param {import('./db/Database').AutoShiftDatabase} database
   * @param {{ now?: () => number }} [opts]
   */
  constructor(database, { now = () => Date.now() } = {}) {
    this.db = database;
    this.now = now;
    this.role = 'none';
  }

  // ── state ────────────────────────────────────────────────────────────────
  _creds() { return this.db.getSetting('auth', null); }
  _lock() { return this.db.getSetting('authLock', { failed: 0, lockedUntil: 0 }); }

  isConfigured() {
    const c = this._creds();
    return !!(c && c.staff && c.admin);
  }

  status() {
    const lock = this._lock();
    const lockedUntil = lock.lockedUntil > this.now() ? lock.lockedUntil : 0;
    return {
      configured: this.isConfigured(),
      role: this.role,
      lockedUntil,
      attemptsLeft: lockedUntil ? 0 : Math.max(0, MAX_FREE_ATTEMPTS - lock.failed),
    };
  }

  /** Throws unless the current session has at least `need`. */
  require(need) {
    if (!need) return;
    if (this.role === 'none') throw new AuthError('AutoShift is locked', 'LOCKED');
    if (ROLE_RANK[this.role] < ROLE_RANK[need]) throw new AuthError('Admin PIN required', 'ADMIN_REQUIRED');
  }

  // ── PIN rules ────────────────────────────────────────────────────────────
  static validatePin(pin, label = 'PIN') {
    if (typeof pin !== 'string' || !PIN_RE.test(pin)) {
      throw new AuthError(`${label} must be 4 to 12 digits`, 'BAD_PIN');
    }
  }

  // ── lifecycle ────────────────────────────────────────────────────────────
  /** First-run only. Creates both PINs and signs the owner in with an admin session. */
  setup(staffPin, adminPin) {
    if (this.isConfigured()) throw new AuthError('PINs are already set up', 'ALREADY_CONFIGURED');
    AuthService.validatePin(staffPin, 'Staff PIN');
    AuthService.validatePin(adminPin, 'Admin PIN');
    if (staffPin === adminPin) throw new AuthError('Staff and admin PINs must be different', 'BAD_PIN');
    this.db.setSetting('auth', { staff: hashPin(staffPin), admin: hashPin(adminPin) });
    this.db.setSetting('authLock', { failed: 0, lockedUntil: 0 });
    this.role = 'admin';
    return this.status();
  }

  _attempt(pin, check) {
    const lock = this._lock();
    if (lock.lockedUntil > this.now()) {
      throw new AuthError('Too many wrong attempts. Try again later.', 'LOCKED_OUT');
    }
    if (typeof pin !== 'string' || !PIN_RE.test(pin)) return this._fail(lock);
    const role = check(this._creds() || {});
    if (!role) return this._fail(lock);
    this.db.setSetting('authLock', { failed: 0, lockedUntil: 0 });
    return role;
  }

  _fail(lock) {
    const failed = lock.failed + 1;
    let lockedUntil = 0;
    if (failed >= MAX_FREE_ATTEMPTS) {
      const ms = Math.min(BASE_LOCK_MS * 2 ** (failed - MAX_FREE_ATTEMPTS), MAX_LOCK_MS);
      lockedUntil = this.now() + ms;
    }
    this.db.setSetting('authLock', { failed, lockedUntil });
    return null;
  }

  /** Unlock the app. The admin PIN also works here and starts an admin session. */
  unlock(pin) {
    if (!this.isConfigured()) throw new AuthError('PINs have not been set up yet', 'NOT_CONFIGURED');
    const role = this._attempt(pin, (c) => {
      // Check both so timing doesn't reveal which PIN class was close.
      const isStaff = matches(pin, c.staff);
      const isAdmin = matches(pin, c.admin);
      return isAdmin ? 'admin' : isStaff ? 'staff' : null;
    });
    if (role) this.role = role;
    return this.status();
  }

  /** Staff → admin, for owner-only actions. Requires an unlocked session. */
  elevate(pin) {
    this.require('staff');
    const role = this._attempt(pin, (c) => (matches(pin, c.admin) ? 'admin' : null));
    if (role) this.role = 'admin';
    return this.status();
  }

  drop() { if (this.role === 'admin') this.role = 'staff'; return this.status(); }
  lock() { this.role = 'none'; return this.status(); }

  /** Change one PIN. Requires an admin session AND re-entering the admin PIN. */
  changePin(which, newPin, adminPin) {
    this.require('admin');
    if (which !== 'staff' && which !== 'admin') throw new AuthError('Unknown PIN type', 'BAD_PIN');
    AuthService.validatePin(newPin, `${which === 'staff' ? 'Staff' : 'Admin'} PIN`);
    const ok = this._attempt(adminPin, (c) => (matches(adminPin, c.admin) ? 'admin' : null));
    if (!ok) throw new AuthError('Admin PIN is incorrect', 'BAD_PIN');
    const c = this._creds();
    const other = which === 'staff' ? 'admin' : 'staff';
    if (matches(newPin, c[other])) throw new AuthError('Staff and admin PINs must be different', 'BAD_PIN');
    this.db.setSetting('auth', { ...c, [which]: hashPin(newPin) });
    return this.status();
  }

  /** Owner recovery (launch with AUTOSHIFT_RESET_PINS=1). Needs machine access by design. */
  reset() {
    this.db.setSetting('auth', null);
    this.db.setSetting('authLock', { failed: 0, lockedUntil: 0 });
    this.role = 'none';
  }
}

module.exports = { AuthService, AuthError, PIN_RE, MAX_FREE_ATTEMPTS, BASE_LOCK_MS, MAX_LOCK_MS };
