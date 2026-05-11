import React, { useState, useEffect } from 'react';
import { Delete, ArrowRight, ShieldCheck, Wrench } from 'lucide-react';

const T = {
  bg: "#FDFDFB",
  sidebar: "#2D2D2D",
  accent: "#9B3131",
  accentDim: "rgba(155, 49, 49, 0.1)",
  text: "#2D2D2D",
  textBright: "#1A1A1A",
  muted: "#6D6D6D",
  success: "#4A7C59",
  danger: "#B22222",
  border: "#E0E0D8",
};

export default function PinGate({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const expectedPin = process.env.REACT_APP_SHOWROOM_PIN || '1234';
  const showroomName = process.env.REACT_APP_SHOWROOM_NAME || 'AutoShift';

  const handlePress = (num) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  useEffect(() => {
    if (pin.length >= 4 && pin === expectedPin) {
      setTimeout(() => onUnlock(), 300);
    } else if (pin.length >= 6 && pin !== expectedPin) {
      triggerError();
    }
  }, [pin]);

  const triggerError = () => {
    setError(true);
    setShake(true);
    setTimeout(() => {
      setShake(false);
      setPin('');
    }, 500);
  };

  const handleSubmit = () => {
    if (pin === expectedPin) {
      onUnlock();
    } else {
      triggerError();
    }
  };

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      background: T.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Barlow', sans-serif"
    }}>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ 
          width: 60, height: 60, background: T.accent, borderRadius: 12, 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          margin: '0 auto 20px', boxShadow: '0 10px 25px rgba(155, 49, 49, 0.3)'
        }}>
          <Wrench size={32} color="#0A0C10" />
        </div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 800, color: T.textBright, marginBottom: 8, letterSpacing: 1 }}>
          {showroomName.toUpperCase()}
        </h1>
        <p style={{ color: T.muted, fontSize: 14, fontWeight: 500, letterSpacing: 0.5 }}>SYSTEM ACCESS REQUIRED</p>
      </div>

      <div className={shake ? 'shake' : ''} style={{ width: 320 }}>
        {/* PIN Display */}
        <div style={{ 
          display: 'flex', justifyContent: 'center', gap: 15, marginBottom: 40 
        }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{
              width: 16, height: 16, borderRadius: '50%',
              border: `2px solid ${error ? T.danger : T.accent}`,
              background: i < pin.length ? (error ? T.danger : T.accent) : 'transparent',
              transition: 'all 0.15s'
            }} />
          ))}
        </div>

        {/* Numpad Grid */}
        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 15 
        }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <PadButton key={num} onClick={() => handlePress(num.toString())}>{num}</PadButton>
          ))}
          <PadButton onClick={handleDelete} variant="ghost"><Delete size={20} /></PadButton>
          <PadButton onClick={() => handlePress('0')}>0</PadButton>
          <PadButton onClick={handleSubmit} variant="accent"><ArrowRight size={20} /></PadButton>
        </div>
      </div>

      <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 8, color: T.muted, fontSize: 12, fontWeight: 600 }}>
        <ShieldCheck size={14} /> SECURE SHOWROOM TERMINAL
      </div>
    </div>
  );
}

function PadButton({ children, onClick, variant = 'default' }) {
  const [isPressed, setIsPressed] = useState(false);
  
  const styles = {
    default: { background: '#FFFFFF', color: T.textBright, border: `1px solid ${T.border}` },
    ghost: { background: 'transparent', color: T.muted, border: '1px solid transparent' },
    accent: { background: T.accent, color: '#FFFFFF', border: `1px solid ${T.accent}` }
  };

  const currentStyle = styles[variant];

  return (
    <button
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onClick={onClick}
      style={{
        height: 70, borderRadius: 12, border: 'none', cursor: 'pointer',
        fontSize: 24, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.1s',
        transform: isPressed ? 'scale(0.95)' : 'scale(1)',
        boxShadow: isPressed ? 'none' : '0 4px 10px rgba(0,0,0,0.05)',
        ...currentStyle
      }}
    >
      {children}
    </button>
  );
}
