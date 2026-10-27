import React, { useState, useEffect, useCallback } from 'react';
import { Delete, ArrowRight, ShieldCheck, Wrench } from 'lucide-react';
import { databaseManager } from '../database/index.js';
import autoShiftLogo from '../logo.png';

const T = {
  bg: "#FDFDFB", accent: "#9B3131", text: "#2D2D2D", textBright: "#1A1A1A",
  muted: "#6D6D6D", danger: "#B22222", border: "#E0E0D8", warning: "#C48A31",
};

const MIN_LEN = 4;
const MAX_LEN = 12;

// Setup walks through four prompts; unlock is a single prompt.
const SETUP_STEPS = [
  { key: 'staff', title: 'Create the STAFF PIN', hint: 'Used by showroom staff every day' },
  { key: 'staffConfirm', title: 'Confirm the staff PIN', hint: 'Enter it once more' },
  { key: 'admin', title: 'Create the ADMIN PIN', hint: 'Owner only: delete, import, manage staff. Must differ from the staff PIN' },
  { key: 'adminConfirm', title: 'Confirm the admin PIN', hint: 'Enter it once more' },
];

function fmtWait(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

export default function PinGate({ onUnlock }) {
  const [mode, setMode] = useState('loading'); // loading | setup | unlock | fatal
  const [pin, setPin] = useState('');
  const [step, setStep] = useState(0);
  const [entered, setEntered] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const showroomName = process.env.REACT_APP_SHOWROOM_NAME || 'AutoShift';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const st = await databaseManager.auth.status();
        if (cancelled) return;
        if (st.role !== 'none') return onUnlock(st.role);   // session already open (e.g. dev reload)
        setLockedUntil(st.lockedUntil || 0);
        setMode(st.configured ? 'unlock' : 'setup');
      } catch (e) {
        if (!cancelled) { setMode('fatal'); setMessage(e.message || String(e)); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!lockedUntil) return undefined;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const locked = lockedUntil > now;

  const fail = useCallback((msg) => {
    setError(true); setShake(true); setMessage(msg);
    setTimeout(() => { setShake(false); setPin(''); }, 500);
  }, []);

  const press = (d) => { if (!busy && !locked && pin.length < MAX_LEN) { setPin((p) => p + d); setError(false); setMessage(''); } };
  const del = () => { setPin((p) => p.slice(0, -1)); setError(false); };

  const submit = useCallback(async () => {
    if (busy || locked) return;
    if (pin.length < MIN_LEN) return fail(`PIN must be at least ${MIN_LEN} digits`);
    setBusy(true);
    try {
      if (mode === 'unlock') {
        const st = await databaseManager.auth.unlock(pin);
        if (st.role !== 'none') return onUnlock(st.role);
        setLockedUntil(st.lockedUntil || 0); setNow(Date.now());
        fail(st.lockedUntil ? 'Too many wrong attempts' : `Wrong PIN. ${st.attemptsLeft} attempt${st.attemptsLeft === 1 ? '' : 's'} left`);
      } else if (mode === 'setup') {
        const cur = SETUP_STEPS[step].key;
        if (cur === 'staffConfirm' && pin !== entered.staff) { setStep(0); setEntered({}); return fail("PINs didn't match. Start again"); }
        if (cur === 'adminConfirm' && pin !== entered.admin) { setStep(2); setEntered((e) => ({ staff: e.staff })); return fail("PINs didn't match. Enter the admin PIN again"); }
        if (cur === 'admin' && pin === entered.staff) return fail('Admin PIN must differ from the staff PIN');
        if (cur === 'adminConfirm') {
          const st = await databaseManager.auth.setup(entered.staff, entered.admin);
          return onUnlock(st.role);
        }
        setEntered((e) => ({ ...e, [cur]: pin }));
        setStep(step + 1); setPin('');
      }
    } catch (e) {
      if (/Too many wrong/.test(e.message)) {
        try { const st = await databaseManager.auth.status(); setLockedUntil(st.lockedUntil || 0); setNow(Date.now()); } catch (_) { /* ignore */ }
      }
      fail(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }, [busy, locked, pin, mode, step, entered, onUnlock, fail]);

  // Keyboard: digits, Backspace, Enter
  useEffect(() => {
    if (mode !== 'unlock' && mode !== 'setup') return undefined;
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') del();
      else if (e.key === 'Enter') submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const title = mode === 'setup' ? SETUP_STEPS[step].title : 'SYSTEM ACCESS REQUIRED';
  const sub = mode === 'setup' ? SETUP_STEPS[step].hint : 'Enter your PIN';

  return (
    <div style={{ height: '100vh', width: '100vw', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Roboto', sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        button, input { font-family: inherit; }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-10px)} 75%{transform:translateX(10px)} }
        .shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <img src={autoShiftLogo} alt="AutoShift" style={{ width: 60, height: 60, borderRadius: 12, objectFit: 'contain', margin: '0 auto 20px', display: 'block', background: '#FFFFFF', padding: 6, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
        <h1 style={{ fontFamily: "'Roboto Condensed', sans-serif", fontSize: 32, fontWeight: 800, color: T.textBright, marginBottom: 8, letterSpacing: 1 }}>
          {showroomName.toUpperCase()}
        </h1>
        {mode === 'loading' && <p style={{ color: T.muted, fontSize: 14 }}>Starting…</p>}
        {mode === 'fatal' && <p role="alert" style={{ color: T.danger, fontSize: 14, maxWidth: 320 }}>{message}</p>}
        {(mode === 'unlock' || mode === 'setup') && (
          <>
            {mode === 'setup' && <p style={{ color: T.accent, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>FIRST-TIME SETUP · STEP {step + 1} OF 4</p>}
            <p style={{ color: T.textBright, fontSize: 16, fontWeight: 700, letterSpacing: 0.5 }}>{title}</p>
            <p style={{ color: T.muted, fontSize: 13, maxWidth: 320, margin: '4px auto 0' }}>{sub}</p>
          </>
        )}
      </div>

      {(mode === 'unlock' || mode === 'setup') && (
        <div className={shake ? 'shake' : ''} style={{ width: 320 }}>
          <div aria-label="PIN entry" style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 12, minHeight: 16 }}>
            {[...Array(Math.max(6, pin.length))].map((_, i) => (
              <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${error ? T.danger : T.accent}`, background: i < pin.length ? (error ? T.danger : T.accent) : 'transparent', transition: 'all 0.15s' }} />
            ))}
          </div>

          <div role="status" style={{ textAlign: 'center', minHeight: 20, marginBottom: 16, fontSize: 13, fontWeight: 600, color: locked ? T.warning : T.danger }}>
            {locked ? `Locked. Try again in ${fmtWait(lockedUntil - now)}` : message}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 15, opacity: locked ? 0.4 : 1 }}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => <PadButton key={n} onClick={() => press(n)} disabled={locked}>{n}</PadButton>)}
            <PadButton onClick={del} variant="ghost" label="Delete"><Delete size={20} /></PadButton>
            <PadButton onClick={() => press('0')} disabled={locked}>0</PadButton>
            <PadButton onClick={submit} variant="accent" label="Submit" disabled={locked || busy}><ArrowRight size={20} /></PadButton>
          </div>
        </div>
      )}

      <div style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 8, color: T.muted, fontSize: 12, fontWeight: 600 }}>
        <ShieldCheck size={14} /> SECURE SHOWROOM TERMINAL
      </div>
    </div>
  );
}

function PadButton({ children, onClick, variant = 'default', label, disabled }) {
  const [isPressed, setIsPressed] = useState(false);
  const styles = {
    default: { background: '#FFFFFF', color: T.textBright, border: `1px solid ${T.border}` },
    ghost: { background: 'transparent', color: T.muted, border: '1px solid transparent' },
    accent: { background: T.accent, color: '#FFFFFF', border: `1px solid ${T.accent}` },
  };
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onClick={onClick}
      style={{
        height: 70, borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 24, fontWeight: 700, fontFamily: "'Roboto Condensed', sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s',
        transform: isPressed ? 'scale(0.95)' : 'scale(1)',
        boxShadow: isPressed ? 'none' : '0 4px 10px rgba(0,0,0,0.05)',
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}
