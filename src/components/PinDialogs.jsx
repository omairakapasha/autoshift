import React, { useState } from 'react';
import { databaseManager } from '../database/index.js';

const T = { card: "#FFFFFF", border: "#E0E0D8", accent: "#9B3131", text: "#2D2D2D", muted: "#6D6D6D", danger: "#B22222" };

function Overlay({ title, children, onClose }) {
  return (
    <div role="dialog" aria-label={title} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: T.card, borderRadius: 12, padding: 24, width: 340, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', fontFamily: "'Roboto', sans-serif" }}>
        <h2 style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 14 }}>{title}</h2>
        {children}
        <button type="button" onClick={onClose} style={{ marginTop: 8, width: '100%', padding: 8, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, color: T.muted, cursor: 'pointer', fontWeight: 700, fontFamily: "'Roboto Condensed', sans-serif" }}>Cancel</button>
      </div>
    </div>
  );
}

function PinInput({ label, value, onChange, autoFocus }) {
  return (
    <label style={{ display: 'block', marginBottom: 12, fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: 0.5 }}>
      {label}
      <input
        type="password" inputMode="numeric" autoComplete="off" maxLength={12}
        autoFocus={autoFocus} value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        style={{ display: 'block', width: '100%', marginTop: 4, padding: '10px 12px', fontSize: 18, letterSpacing: 4, border: `1px solid ${T.border}`, borderRadius: 6, fontFamily: "'Roboto', sans-serif" }}
      />
    </label>
  );
}

const primary = (busy) => ({ width: '100%', padding: 10, background: T.accent, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 800, fontFamily: "'Roboto Condensed', sans-serif", cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 });

/** Replaces window.prompt (which Electron does not support) for owner actions. */
export function AdminPinDialog({ onSuccess, onClose }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const st = await databaseManager.auth.elevate(pin);
      if (st.role === 'admin') return onSuccess();
      setErr(st.lockedUntil ? 'Too many wrong attempts. Try again later.' : `Incorrect admin PIN. ${st.attemptsLeft} attempt(s) left`);
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); setPin(''); }
  };

  return (
    <Overlay title="Admin PIN" onClose={onClose}>
      <form onSubmit={submit}>
        <PinInput label="ENTER ADMIN PIN" value={pin} onChange={setPin} autoFocus />
        {err && <div role="alert" style={{ color: T.danger, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{err}</div>}
        <button type="submit" disabled={busy || pin.length < 4} style={primary(busy)}>Unlock owner actions</button>
      </form>
    </Overlay>
  );
}

export function ChangePinDialog({ onDone, onClose }) {
  const [which, setWhich] = useState('staff');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (next !== confirm) return setErr("The new PINs don't match");
    setBusy(true); setErr('');
    try {
      await databaseManager.auth.changePin(which, next, adminPin);
      onDone(which);
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  return (
    <Overlay title="Change PIN" onClose={onClose}>
      <form onSubmit={submit}>
        <label style={{ display: 'block', marginBottom: 12, fontSize: 12, fontWeight: 700, color: T.muted }}>
          WHICH PIN
          <select value={which} onChange={(e) => setWhich(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, border: `1px solid ${T.border}`, borderRadius: 6, fontFamily: "'Roboto', sans-serif" }}>
            <option value="staff">Staff PIN</option>
            <option value="admin">Admin PIN</option>
          </select>
        </label>
        <PinInput label="NEW PIN (4–12 DIGITS)" value={next} onChange={setNext} />
        <PinInput label="CONFIRM NEW PIN" value={confirm} onChange={setConfirm} />
        <PinInput label="CURRENT ADMIN PIN" value={adminPin} onChange={setAdminPin} />
        {err && <div role="alert" style={{ color: T.danger, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{err}</div>}
        <button type="submit" disabled={busy || next.length < 4 || adminPin.length < 4} style={primary(busy)}>Save PIN</button>
      </form>
    </Overlay>
  );
}
