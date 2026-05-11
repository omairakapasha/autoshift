import { useState, useEffect } from "react";
import {
  LayoutDashboard, Search, Car, Bell, CalendarDays, Users,
  Plus, AlertTriangle, CheckCircle2, Clock, Wrench, ChevronRight,
  ArrowLeft, X, Phone, Mail, User, Zap, TrendingUp, FileText,
  MoreVertical, RefreshCw, Shield, Cloud, CloudOff,
  Download, Upload
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { databaseManager, localDatabase, SYNC_STATUS } from "./database/index.js";
import { validateEnvironment, VALIDATION_STATUS } from "./database/SchemaValidator";
import PinGate from "./components/PinGate";

// ─── UTILITIES ───────────────────────────────────────────────────────────────

function formatLastSynced(iso) {
  if (!iso) return "Never";
  const diff = Math.floor((new Date() - new Date(iso)) / 60000);
  if (diff < 1) return "Just now";
  if (diff < 60) return `${diff}m ago`;
  const hrs = Math.floor(diff / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

function SyncIcon({ status, size = 14 }) {
  if (status === SYNC_STATUS.SYNCED) return <CheckCircle2 size={size} color={T.success} title="Synced to Cloud" />;
  if (status === SYNC_STATUS.PENDING) return <Clock size={size} color={T.warning} title="Pending Sync" />;
  if (status === SYNC_STATUS.CONFLICT) return <AlertTriangle size={size} color={T.danger} title="Sync Conflict" />;
  return <CloudOff size={size} color={T.muted} title="Local Only" />;
}

function daysUntil(d) {
  if (!d) return 999;
  return Math.ceil((new Date(d + "T00:00:00") - new Date()) / 86400000);
}

function fmt(d) {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return d; }
}

function uid() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

function alertLevel(nextDue) {
  const d = daysUntil(nextDue);
  if (d < 0) return "overdue";
  if (d <= 7) return "warning";
  if (d <= 30) return "upcoming";
  return "ok";
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const SEED = {
  clients: [
    { id: "c1", name: "Ahmed Raza", phone: "+92-300-1234567", email: "ahmed.raza@gmail.com", since: "2023-06-15" },
    { id: "c2", name: "Sara Khan", phone: "+92-321-9876543", email: "sara.khan@gmail.com", since: "2023-09-01" },
    { id: "c3", name: "Usman Ali", phone: "+92-333-5551234", email: "usman.ali@gmail.com", since: "2024-01-20" },
    { id: "c4", name: "Fatima Malik", phone: "+92-345-7778889", email: "fatima.malik@gmail.com", since: "2024-04-10" },
  ],
  cars: [
    { plate: "LHR-2341", make: "Toyota", model: "Corolla", year: 2020, color: "Graphite Silver", clientId: "c1" },
    { plate: "ISB-8872", make: "Honda", model: "Civic", year: 2022, color: "Midnight Black", clientId: "c2" },
    { plate: "KHI-5519", make: "Suzuki", model: "Swift", year: 2019, color: "Pearl White", clientId: "c3" },
    { plate: "LHR-9001", make: "Hyundai", model: "Tucson", year: 2023, color: "Cobalt Blue", clientId: "c4" },
    { plate: "FSD-4433", make: "Toyota", model: "Prado", year: 2021, color: "Aspen White", clientId: "c1" },
  ],
  services: [
    { id: "s1", plate: "LHR-2341", type: "Oil Change", date: "2025-11-15", nextDue: "2026-05-15", cost: 3500, status: "Completed", tech: "Bilal Ahmed", notes: "5W-30 synthetic, 4 litres" },
    { id: "s2", plate: "LHR-2341", type: "Brake Inspection", date: "2025-09-01", nextDue: "2026-09-01", cost: 2000, status: "Completed", tech: "Imran Qureshi", notes: "Front brake pads replaced" },
    { id: "s3", plate: "ISB-8872", type: "Oil Change", date: "2025-12-10", nextDue: "2026-05-04", cost: 4200, status: "Completed", tech: "Bilal Ahmed", notes: "5W-40 semi-synthetic" },
    { id: "s4", plate: "KHI-5519", type: "Full Service", date: "2024-08-20", nextDue: "2025-08-20", cost: 12000, status: "Completed", tech: "Hassan Malik", notes: "All filters replaced, timing belt checked" },
    { id: "s5", plate: "LHR-9001", type: "Oil Change", date: "2026-01-20", nextDue: "2026-07-20", cost: 5500, status: "Completed", tech: "Bilal Ahmed", notes: "Mobil 1 0W-40 full synthetic" },
    { id: "s6", plate: "FSD-4433", type: "Transmission Service", date: "2025-10-05", nextDue: "2026-10-05", cost: 8500, status: "Completed", tech: "Imran Qureshi", notes: "ATF drained and refilled" },
    { id: "s7", plate: "ISB-8872", type: "AC Service", date: "2026-02-14", nextDue: "2026-05-05", cost: 3000, status: "Completed", tech: "Hassan Malik", notes: "Refrigerant recharged, cabin filter replaced" },
  ],
  appointments: [
    { id: "a1", plate: "LHR-2341", clientId: "c1", date: "2026-05-05", time: "10:00 AM", type: "Oil Change", status: "Confirmed" },
    { id: "a2", plate: "ISB-8872", clientId: "c2", date: "2026-05-05", time: "02:00 PM", type: "AC Service Follow-up", status: "Confirmed" },
    { id: "a3", plate: "KHI-5519", clientId: "c3", date: "2026-05-07", time: "11:00 AM", type: "Full Service", status: "Pending" },
    { id: "a4", plate: "FSD-4433", clientId: "c1", date: "2026-05-08", time: "09:00 AM", type: "General Inspection", status: "Confirmed" },
  ],
};

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg: "#FDFDFB", // Cream White
  sidebar: "#2D2D2D", // Dark Grey
  card: "#FFFFFF", // White
  cardHover: "#F5F5F0", // Light Cream
  border: "#E0E0D8", // Soft Grey/Cream
  borderLight: "#E8E8E0",
  accent: "#9B3131", // Brick Red
  accentDim: "rgba(155, 49, 49, 0.1)",
  accentGlow: "rgba(155, 49, 49, 0.2)",
  text: "#2D2D2D", // Dark Grey
  textBright: "#1A1A1A", 
  muted: "#6D6D6D", // Medium Grey
  success: "#4A7C59", // Muted Green
  successDim: "rgba(74, 124, 89, 0.12)",
  warning: "#C48A31", // Muted Gold
  warningDim: "rgba(196, 138, 49, 0.12)",
  danger: "#B22222", // Firebrick
  dangerDim: "rgba(178, 34, 34, 0.12)",
  info: "#4A6D8C", // Muted Blue
  infoDim: "rgba(74, 109, 140, 0.12)",
};

const ALERT_CONFIG = {
  overdue: { color: T.danger, dim: T.dangerDim, label: "OVERDUE" },
  warning: { color: T.warning, dim: T.warningDim, label: "DUE SOON" },
  upcoming: { color: T.info, dim: T.infoDim, label: "UPCOMING" },
  ok: { color: T.success, dim: T.successDim, label: "GOOD" },
};

const SERVICE_TYPES = [
  "Oil Change", "Full Service", "Brake Inspection", "AC Service",
  "Transmission Service", "Tyre Rotation", "Battery Check",
  "Engine Diagnostics", "Suspension Check", "General Inspection",
];

const DEFAULT_TECHNICIANS = ["Bilal Ahmed", "Imran Qureshi", "Hassan Malik", "Asif Rehman", "Tariq Mahmood"];

// ─── ATOMS ────────────────────────────────────────────────────────────────────

function ManageTechsModal({ techs, onSave, onClose }) {
  const [list, setList] = useState([...techs]);
  const [newTech, setNewTech] = useState("");

  const add = () => {
    if (newTech.trim() && !list.includes(newTech.trim())) {
      setList([...list, newTech.trim()]);
      setNewTech("");
    }
  };

  const remove = (t) => setList(list.filter(x => x !== t));

  return (
    <Modal title="Manage Maintenance Staff" onClose={onClose} width={400}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input 
          value={newTech} onChange={e => setNewTech(e.target.value)} 
          placeholder="New technician name..."
          style={{
            flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 6,
            padding: "9px 12px", color: T.textBright, fontSize: 13,
          }}
        />
        <Btn onClick={add} size="sm">Add</Btn>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto", paddingRight: 4 }}>
        {list.map(t => (
          <div key={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: T.cardHover, borderRadius: 6, border: `1px solid ${T.borderLight}` }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textBright }}>{t}</span>
            <button onClick={() => remove(t)} style={{ background: "none", border: "none", cursor: "pointer", color: T.danger }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave(list)}>Save Changes</Btn>
      </div>
    </Modal>
  );
}

function EditServiceModal({ service, techs, onSave, onClose }) {
  const [form, setForm] = useState({ ...service });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const valid = form.type && form.date && form.nextDue && form.tech;

  return (
    <Modal title={`Edit Service — ${service.plate}`} onClose={onClose} width={560}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <Select label="Service Type" required value={form.type} onChange={v => set("type", v)} options={SERVICE_TYPES} />
        </div>
        <Input label="Service Date" required type="date" value={form.date} onChange={v => set("date", v)} />
        <Input label="Next Due Date" required type="date" value={form.nextDue} onChange={v => set("nextDue", v)} />
        <Select label="Technician" required value={form.tech} onChange={v => set("tech", v)} options={techs} />
        <Input label="Cost (PKR)" type="number" value={form.cost} onChange={v => set("cost", v)} />
        <Select label="Status" value={form.status} onChange={v => set("status", v)} options={["Received","In Progress","Waiting for Parts","Completed"]} />
        <div style={{ gridColumn: "1/-1", display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase" }}>Notes</label>
          <textarea
            value={form.notes} onChange={e => set("notes", e.target.value)}
            style={{
              background: T.card, border: `1px solid ${T.border}`, borderRadius: 6,
              padding: "9px 12px", color: T.textBright, fontSize: 13,
              resize: "vertical", minHeight: 70, fontFamily: "'Barlow', sans-serif",
            }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!valid} onClick={() => onSave(form)}>Save Changes</Btn>
      </div>
    </Modal>
  );
}

function Plate({ plate, size = "md" }) {
  const sz = { sm: [12, "10px 8px", 4], md: [15, "7px 12px", 5], lg: [22, "10px 18px", 7] }[size];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: "linear-gradient(180deg, #F5F8FA 0%, #E8EDF2 100%)",
      color: "#0A1428",
      fontFamily: "'Courier New', monospace",
      fontWeight: 700, fontSize: sz[0],
      padding: sz[1], borderRadius: sz[2],
      border: "2px solid #C8D0D8",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.4)",
      letterSpacing: 2, whiteSpace: "nowrap",
    }}>
      🇵🇰 {plate}
    </span>
  );
}

function Badge({ level, custom }) {
  const cfg = custom ? { color: T.info, dim: T.infoDim, label: custom } : ALERT_CONFIG[level] || ALERT_CONFIG.ok;
  return (
    <span style={{
      display: "inline-block", padding: "2px 7px",
      borderRadius: 4, fontSize: 10, fontWeight: 800,
      letterSpacing: 0.8, textTransform: "uppercase",
      background: cfg.dim, color: cfg.color,
      border: `1px solid ${cfg.color}33`,
    }}>
      {cfg.label}
    </span>
  );
}

function Btn({ children, onClick, variant = "primary", size = "md", icon, disabled, style: extraStyle }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6,
    border: "none", cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
    letterSpacing: 0.5, transition: "all 0.15s", borderRadius: 6,
    opacity: disabled ? 0.5 : 1, fontSize: size === "sm" ? 13 : size === "lg" ? 16 : 14,
    padding: size === "sm" ? "6px 12px" : size === "lg" ? "12px 22px" : "8px 16px",
  };
  const variants = {
    primary: { background: T.accent, color: "#FFFFFF" },
    ghost: { background: "transparent", color: T.text, border: `1px solid ${T.border}` },
    danger: { background: T.dangerDim, color: T.danger, border: `1px solid ${T.danger}33` },
    success: { background: T.successDim, color: T.success, border: `1px solid ${T.success}33` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...extraStyle }}>
      {icon && <span style={{ opacity: 0.9 }}>{icon}</span>}
      {children}
    </button>
  );
}

function Input({ label, value, onChange, placeholder, type = "text", required, children, style: extra }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase" }}>
          {label}{required && <span style={{ color: T.danger }}> *</span>}
        </label>
      )}
      {children || (
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 6,
            padding: "9px 12px", color: T.textBright, fontSize: 14,
            transition: "border-color 0.15s", width: "100%", ...extra,
          }}
        />
      )}
    </div>
  );
}

function Select({ label, value, onChange, options, required }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase" }}>
          {label}{required && <span style={{ color: T.danger }}> *</span>}
        </label>
      )}
      <select
        value={value} onChange={e => onChange(e.target.value)}
        style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 6,
          padding: "9px 12px", color: T.textBright, fontSize: 14, width: "100%",
        }}
      >
        <option value="">Select…</option>
        {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
      </select>
    </div>
  );
}

function Card({ children, style: extra, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onClick && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? T.cardHover : T.card,
        border: `1px solid ${hov ? T.borderLight : T.border}`,
        borderRadius: 10, padding: 20,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.15s", ...extra,
      }}
    >
      {children}
    </div>
  );
}

function Modal({ title, onClose, children, width = 540 }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, backdropFilter: "blur(4px)", padding: 20,
    }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: T.card, border: `1px solid ${T.borderLight}`,
        borderRadius: 14, width: "100%", maxWidth: width,
        maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 24px 80px rgba(0,0,0,0.15)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 22px", borderBottom: `1px solid ${T.border}`,
        }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: T.textBright }}>
            {title}
          </span>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: T.muted, padding: 4, borderRadius: 4,
          }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}

function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28,
      background: T.success, color: "#FFFFFF",
      padding: "12px 20px", borderRadius: 8,
      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15,
      boxShadow: `0 8px 32px ${T.success}33`, zIndex: 2000,
      animation: "slideUp 0.2s ease",
    }}>
      <CheckCircle2 size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
      {msg}
    </div>
  );
}

function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const h = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', h); window.addEventListener('offline', h);
    return () => { window.removeEventListener('online', h); window.removeEventListener('offline', h); };
  }, []);

  if (isOnline) return null;
  return (
    <div style={{
      background: T.danger, color: "#FFFFFF", padding: "8px 20px",
      textAlign: "center", fontSize: 13, fontWeight: 700,
      fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1,
      position: "sticky", top: 0, zIndex: 1100,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
    }}>
      <CloudOff size={16} /> YOU ARE CURRENTLY OFFLINE. CHANGES WILL BE SAVED LOCALLY AND SYNCED WHEN RECONNECTED.
    </div>
  );
}
function AddServiceModal({ plate, techs, onSave, onClose }) {
  const [form, setForm] = useState({
    type: "", date: new Date().toISOString().split("T")[0],
    nextDue: "", cost: "", tech: "", notes: "", status: "In Progress",
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const valid = form.type && form.date && form.nextDue && form.tech;

  return (
    <Modal title={`New Service Record — ${plate}`} onClose={onClose} width={560}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <Select label="Service Type" required value={form.type} onChange={v => set("type", v)} options={SERVICE_TYPES} />
        </div>
        <Input label="Service Date" required type="date" value={form.date} onChange={v => set("date", v)} />
        <Input label="Next Due Date" required type="date" value={form.nextDue} onChange={v => set("nextDue", v)} />
        <Select label="Technician" required value={form.tech} onChange={v => set("tech", v)} options={techs} />
        <Input label="Cost (PKR)" type="number" value={form.cost} onChange={v => set("cost", v)} placeholder="0" />
        <Select label="Status" value={form.status} onChange={v => set("status", v)} options={["Received","In Progress","Waiting for Parts","Completed"]} />
        <div style={{ gridColumn: "1/-1", display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase" }}>Notes</label>
          <textarea
            value={form.notes} onChange={e => set("notes", e.target.value)}
            placeholder="Describe the work done, parts used…"
            style={{
              background: T.card, border: `1px solid ${T.border}`, borderRadius: 6,
              padding: "9px 12px", color: T.textBright, fontSize: 13,
              resize: "vertical", minHeight: 70, fontFamily: "'Barlow', sans-serif",
            }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!valid} onClick={() => valid && onSave({ ...form, id: "s" + uid(), plate, cost: Number(form.cost) || 0 })}>
          Save Record
        </Btn>
      </div>
    </Modal>
  );
}

// ─── ADD CAR MODAL ────────────────────────────────────────────────────────────
function AddCarModal({ prefillPlate = "", clients, onSave, onClose }) {
  const [tab, setTab] = useState("existing"); // "existing" | "new"
  const [form, setForm] = useState({ plate: prefillPlate, make: "", model: "", year: new Date().getFullYear(), color: "", clientId: "" });
  const [newClient, setNewClient] = useState({ name: "", phone: "", email: "" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setNC = (k, v) => setNewClient(p => ({ ...p, [k]: v }));

  const validCar = form.plate && form.make && form.model && form.year;
  const validClient = tab === "existing" ? form.clientId : newClient.name && newClient.phone;

  return (
    <Modal title="Register New Vehicle" onClose={onClose} width={580}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <Input label="Number Plate" required value={form.plate} onChange={v => set("plate", v.toUpperCase())} placeholder="e.g. LHR-1234" />
        </div>
        <Input label="Make" required value={form.make} onChange={v => set("make", v)} placeholder="e.g. Toyota" />
        <Input label="Model" required value={form.model} onChange={v => set("model", v)} placeholder="e.g. Corolla" />
        <Input label="Year" required type="number" value={form.year} onChange={v => set("year", Number(v))} />
        <Input label="Color" value={form.color} onChange={v => set("color", v)} placeholder="e.g. Silver" />
      </div>

      <div style={{ marginTop: 20, marginBottom: 12, height: 1, background: T.border }} />
      <p style={{ fontSize: 12, color: T.muted, marginBottom: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Client</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["existing", "new"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "6px 14px", borderRadius: 6, border: "1px solid",
            borderColor: tab === t ? T.accent : T.border,
            background: tab === t ? T.accentDim : "transparent",
            color: tab === t ? T.accent : T.muted,
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
            fontSize: 13, cursor: "pointer", textTransform: "capitalize",
          }}>
            {t === "existing" ? "Existing Client" : "New Client"}
          </button>
        ))}
      </div>

      {tab === "existing" ? (
        <Select label="Select Client" required value={form.clientId} onChange={v => set("clientId", v)}
          options={clients.map(c => ({ value: c.id, label: `${c.name} — ${c.phone}` }))} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <Input label="Full Name" required value={newClient.name} onChange={v => setNC("name", v)} placeholder="Client full name" />
          </div>
          <Input label="Phone" required value={newClient.phone} onChange={v => setNC("phone", v)} placeholder="+92-300-0000000" />
          <Input label="Email" value={newClient.email} onChange={v => setNC("email", v)} placeholder="email@example.com" />
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!validCar || !validClient} onClick={() => onSave({ car: form, tab, newClient })}>
          Register Vehicle
        </Btn>
      </div>
    </Modal>
  );
}

// ─── ADD APPOINTMENT MODAL ────────────────────────────────────────────────────
function AddApptModal({ data, prefillPlate = "", onSave, onClose }) {
  const [form, setForm] = useState({
    plate: prefillPlate, clientId: "", date: "", time: "09:00 AM", type: "", status: "Scheduled",
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (form.plate) {
      const car = data.cars.find(c => c.plate === form.plate);
      if (car) set("clientId", car.clientId);
    }
  }, [form.plate]);

  const valid = form.plate && form.date && form.type;
  const times = ["08:00 AM","09:00 AM","10:00 AM","11:00 AM","12:00 PM","01:00 PM","02:00 PM","03:00 PM","04:00 PM","05:00 PM"];

  return (
    <Modal title="Book Appointment" onClose={onClose} width={520}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <Select label="Vehicle Plate" required value={form.plate}
            onChange={v => set("plate", v)}
            options={data.cars.map(c => ({ value: c.plate, label: `${c.plate} — ${c.make} ${c.model}` }))} />
        </div>
        {form.clientId && (() => {
          const cl = data.clients.find(c => c.id === form.clientId);
          return cl ? (
            <div style={{ gridColumn: "1/-1", background: T.successDim, border: `1px solid ${T.success}33`, borderRadius: 7, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <User size={16} color={T.success} />
              <span style={{ fontSize: 13, color: T.success, fontWeight: 600 }}>{cl.name} — {cl.phone}</span>
            </div>
          ) : null;
        })()}
        <Input label="Date" required type="date" value={form.date} onChange={v => set("date", v)} />
        <Select label="Time" required value={form.time} onChange={v => set("time", v)} options={times} />
        <div style={{ gridColumn: "1/-1" }}>
          <Select label="Service Type" required value={form.type} onChange={v => set("type", v)} options={SERVICE_TYPES} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!valid} onClick={() => valid && onSave({ ...form, id: "a" + uid() })}>
          Book Appointment
        </Btn>
      </div>
    </Modal>
  );
}

// ─── DASHBOARD VIEW ───────────────────────────────────────────────────────────
function DashboardView({ data, navigate }) {
  const alerts = data.services.filter(s => alertLevel(s.nextDue) !== "ok");
  const today = new Date().toISOString().split("T")[0];
  const todayAppts = data.appointments.filter(a => a.date === today);
  
  const currMonth = new Date().toISOString().slice(0, 7);
  const prevDate = new Date();
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonth = prevDate.toISOString().slice(0, 7);
  
  const monthRevenue = data.services.reduce((sum, s) => {
    return s.date?.slice(0, 7) === currMonth ? sum + (s.cost || 0) : sum;
  }, 0);
  
  const prevMonthRevenue = data.services.reduce((sum, s) => {
    return s.date?.slice(0, 7) === prevMonth ? sum + (s.cost || 0) : sum;
  }, 0);

  const revenueGrowth = prevMonthRevenue > 0 ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 100;

  // Analytics: Top Service Types
  const serviceCounts = data.services.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {});
  const topServices = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Analytics: Most Serviced Brands
  const brandCounts = data.services.reduce((acc, s) => {
    const car = data.cars.find(c => c.plate === s.plate);
    if (car) {
      acc[car.make] = (acc[car.make] || 0) + 1;
    }
    return acc;
  }, {});
  const topBrands = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const stats = [
    { icon: <Car size={20} />, label: "Registered Vehicles", value: data.cars.length, sub: `${data.clients.length} clients`, color: T.info },
    { icon: <AlertTriangle size={20} />, label: "Active Alerts", value: alerts.length, sub: `${alerts.filter(a => alertLevel(a.nextDue) === "overdue").length} overdue`, color: T.danger },
    { icon: <CalendarDays size={20} />, label: "Today's Appointments", value: todayAppts.length, sub: "scheduled", color: T.accent },
    { 
      icon: <TrendingUp size={20} />, 
      label: "Revenue This Month", 
      value: `₨${(monthRevenue / 1000).toFixed(0)}k`, 
      sub: `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(0)}% from last month`, 
      color: T.success 
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: T.textBright, marginBottom: 4 }}>
          Good morning 👋
        </h1>
        <p style={{ color: T.muted, fontSize: 14 }}>
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 26 }}>
        {stats.map((s, i) => (
          <Card key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ padding: 9, borderRadius: 8, background: s.color + "18", color: s.color }}>{s.icon}</div>
              <span style={{ fontSize: 11, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.sub}</span>
            </div>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 800, color: T.textBright, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Alerts & Schedule */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Alerts */}
          <Card style={{ padding: 0 }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: T.textBright, display: "flex", alignItems: "center", gap: 8 }}>
                <Bell size={16} color={T.accent} /> Maintenance Alerts
              </span>
              <Btn size="sm" variant="ghost" onClick={() => navigate("alerts")}>View All <ChevronRight size={12} /></Btn>
            </div>
            <div style={{ padding: "8px 0" }}>
              {alerts.length === 0 ? (
                <div style={{ padding: "24px 20px", color: T.muted, fontSize: 13, textAlign: "center" }}>
                  <CheckCircle2 size={32} style={{ display: "block", margin: "0 auto 8px", color: T.success, opacity: 0.5 }} />
                  All vehicles are up to date
                </div>
              ) : alerts.slice(0, 5).map(s => {
                const car = data.cars.find(c => c.plate === s.plate);
                const lvl = alertLevel(s.nextDue);
                const cfg = ALERT_CONFIG[lvl];
                const d = daysUntil(s.nextDue);
                return (
                  <div key={s.id} onClick={() => navigate("car", s.plate)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 20px",
                    cursor: "pointer", borderBottom: `1px solid ${T.border}`,
                    transition: "background 0.1s",
                  }}>
                    <div style={{ width: 3, height: 32, borderRadius: 2, background: cfg.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <Plate plate={s.plate} size="sm" />
                        <span style={{ fontSize: 12, color: T.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.type}</span>
                      </div>
                      <span style={{ fontSize: 11, color: T.muted }}>{car?.make} {car?.model}</span>
                    </div>
                    <Badge level={lvl} />
                    <span style={{ fontSize: 11, color: cfg.color, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {d < 0 ? `${Math.abs(d)}d ago` : d === 0 ? "Today" : `${d}d left`}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Today's Schedule */}
          <Card style={{ padding: 0 }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: T.textBright, display: "flex", alignItems: "center", gap: 8 }}>
                <CalendarDays size={16} color={T.accent} /> Today's Schedule
              </span>
              <Btn size="sm" variant="ghost" onClick={() => navigate("schedule")}>View All <ChevronRight size={12} /></Btn>
            </div>
            <div>
              {todayAppts.length === 0 ? (
                <div style={{ padding: "24px 20px", color: T.muted, fontSize: 13, textAlign: "center" }}>
                  <Clock size={32} style={{ display: "block", margin: "0 auto 8px", opacity: 0.3 }} />
                  No appointments today
                </div>
              ) : todayAppts.map(a => {
                const car = data.cars.find(c => c.plate === a.plate);
                const client = data.clients.find(c => c.id === a.clientId);
                return (
                  <div key={a.id} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "12px 20px",
                    borderBottom: `1px solid ${T.border}`,
                  }}>
                    <div style={{ textAlign: "center", minWidth: 50 }}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, color: T.accent }}>{a.time}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <Plate plate={a.plate} size="sm" />
                      </div>
                      <div style={{ fontSize: 12, color: T.text, marginBottom: 1 }}>{a.type}</div>
                      <div style={{ fontSize: 11, color: T.muted }}>{client?.name || "Walk-in"}</div>
                    </div>
                    <Badge level="ok" custom={a.status} />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Analytics Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Zap size={16} color={T.warning} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: T.textBright }}>Popular Services</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {topServices.map(([type, count]) => (
                <div key={type}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: T.text }}>{type}</span>
                    <span style={{ color: T.muted }}>{count}</span>
                  </div>
                  <div style={{ height: 6, background: T.borderLight, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${(count / data.services.length) * 100}%`, height: "100%", background: T.accent }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Car size={16} color={T.info} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: T.textBright }}>Top Car Brands</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {topBrands.map(([brand, count], i) => (
                <div key={brand} style={{ 
                  flex: 1, minWidth: 80, padding: "12px 10px", borderRadius: 8, 
                  background: i === 0 ? T.infoDim : T.cardHover, 
                  border: `1px solid ${i === 0 ? T.info + '33' : T.border}`,
                  textAlign: "center"
                }}>
                  <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>{brand}</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 800, color: i === 0 ? T.info : T.textBright }}>{count}</div>
                  <div style={{ fontSize: 10, color: T.muted }}>Services</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── LOOKUP VIEW ──────────────────────────────────────────────────────────────
function LookupView({ data, navigate, onAddCar }) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);

  const q = query.trim().toUpperCase();
  const found = q ? data.cars.filter(c => c.plate.includes(q) || `${c.make} ${c.model}`.toUpperCase().includes(q)) : [];

  return (
    <div>
      <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: T.textBright, marginBottom: 6 }}>
        Vehicle Lookup
      </h1>
      <p style={{ color: T.muted, marginBottom: 30, fontSize: 14 }}>Search by plate number or vehicle name</p>

      <div style={{ position: "relative", maxWidth: 560, marginBottom: 30 }}>
        <Search size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
        <input
          value={query} onChange={e => { setQuery(e.target.value); setSearched(true); }}
          placeholder="Type plate number or car model…"
          autoFocus
          style={{
            width: "100%", background: T.card, border: `2px solid ${query ? T.accent : T.border}`,
            borderRadius: 10, padding: "14px 16px 14px 46px",
            color: T.textBright, fontSize: 16, fontFamily: "'Courier New', monospace",
            letterSpacing: query ? 2 : 0, transition: "all 0.15s",
          }}
        />
      </div>

      {searched && q.length > 0 && found.length === 0 && (
        <Card style={{ maxWidth: 560, textAlign: "center", padding: 36 }}>
          <Car size={40} style={{ display: "block", margin: "0 auto 12px", color: T.muted }} />
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.textBright, marginBottom: 6 }}>
            No vehicle found for "{q}"
          </p>
          <p style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>
            This vehicle isn't in the system yet. Register it to begin tracking maintenance.
          </p>
          <Btn icon={<Plus size={16} />} onClick={() => onAddCar(q)} size="lg">
            Register "{q}"
          </Btn>
        </Card>
      )}

      {found.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 700 }}>
          {found.map(car => {
            const client = data.clients.find(c => c.id === car.clientId);
            const carServices = data.services.filter(s => s.plate === car.plate).sort((a, b) => b.date?.localeCompare(a.date));
            const latest = carServices[0];
            const lvl = latest ? alertLevel(latest.nextDue) : "ok";
            return (
              <Card key={car.plate} onClick={() => navigate("car", car.plate)} style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ background: T.accentDim, borderRadius: 8, padding: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Car size={28} color={T.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <Plate plate={car.plate} size="md" />
                    {latest && <Badge level={lvl} />}
                    <SyncIcon status={car._sync_status} />
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.textBright }}>
                    {car.year} {car.make} {car.model}
                    <span style={{ fontSize: 13, fontWeight: 400, color: T.muted, marginLeft: 8 }}>{car.color}</span>
                  </div>
                  {client && (
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                      <User size={11} /> {client.name} · {client.phone}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>Last Service</div>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{latest ? latest.type : "No records"}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{latest ? fmt(latest.date) : "—"}</div>
                </div>
                <ChevronRight size={18} color={T.muted} />
              </Card>
            );
          })}
        </div>
      )}

      {!searched && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14 }}>Recent Vehicles</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.cars.slice(0, 5).map(car => {
              const client = data.clients.find(c => c.id === car.clientId);
              const latest = data.services.filter(s => s.plate === car.plate).sort((a, b) => b.date?.localeCompare(a.date))[0];
              return (
                <Card key={car.plate} onClick={() => navigate("car", car.plate)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
                  <Plate plate={car.plate} size="sm" />
                  <span style={{ flex: 1, color: T.text, fontSize: 14 }}>{car.year} {car.make} {car.model}</span>
                  <span style={{ fontSize: 12, color: T.muted }}>{client?.name}</span>
                  {latest && <Badge level={alertLevel(latest.nextDue)} />}
                  <ChevronRight size={16} color={T.muted} />
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EDIT CAR MODAL ───────────────────────────────────────────────────────────
function EditCarModal({ car, onSave, onClose }) {
  const [form, setForm] = useState({ ...car });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const valid = form.plate && form.make && form.model && form.year;

  return (
    <Modal title={`Edit Vehicle — ${car.plate}`} onClose={onClose} width={520}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <Input label="Number Plate" required value={form.plate} onChange={v => set("plate", v.toUpperCase())} />
        </div>
        <Input label="Make" required value={form.make} onChange={v => set("make", v)} />
        <Input label="Model" required value={form.model} onChange={v => set("model", v)} />
        <Input label="Year" required type="number" value={form.year} onChange={v => set("year", Number(v))} />
        <Input label="Color" value={form.color} onChange={v => set("color", v)} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!valid} onClick={() => valid && onSave(form)}>Save Changes</Btn>
      </div>
    </Modal>
  );
}

// ─── CAR DETAIL VIEW ──────────────────────────────────────────────────────────
function CarDetailView({ data, plate, onBack, onAddService, onSchedule, navigate, isAdmin, onEditCar, onDeleteCar }) {
  const car = data.cars.find(c => c.plate === plate);
  const client = car ? data.clients.find(c => c.id === car.clientId) : null;
  const services = data.services.filter(s => s.plate === plate).sort((a, b) => b.date?.localeCompare(a.date));
  const upcomingAppts = data.appointments.filter(a => a.plate === plate && a.date >= new Date().toISOString().split("T")[0]);

  if (!car) return (
    <div style={{ textAlign: "center", paddingTop: 80 }}>
      <Car size={48} style={{ color: T.muted, display: "block", margin: "0 auto 16px" }} />
      <p style={{ color: T.muted, fontSize: 18, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>Vehicle not found</p>
      <Btn variant="ghost" onClick={onBack} style={{ marginTop: 16 }} icon={<ArrowLeft size={14} />}>Go Back</Btn>
    </div>
  );

  const latestService = services[0];
  const lvl = latestService ? alertLevel(latestService.nextDue) : "ok";

  const statusColors = {
    "Completed": T.success, "In Progress": T.accent,
    "Received": T.info, "Waiting for Parts": T.danger,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 16, padding: 0 }}>
          <ArrowLeft size={14} /> Back to Lookup
        </button>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <Plate plate={car.plate} size="lg" />
              <Badge level={lvl} />
              <SyncIcon status={car._sync_status} size={18} />
              {car._sync_status === SYNC_STATUS.CONFLICT && (
                <div style={{ 
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: T.dangerDim, color: T.danger, border: `1px solid ${T.danger}44`,
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                  fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5
                }}>
                  <AlertTriangle size={12} /> SYNC CONFLICT
                </div>
              )}
            </div>
            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 800, color: T.textBright, marginBottom: 4 }}>
              {car.year} {car.make} {car.model}
            </h1>
            <p style={{ color: T.muted, fontSize: 14 }}>{car.color}</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            {isAdmin && (
              <>
                <Btn variant="ghost" icon={<FileText size={14} />} onClick={onEditCar}>Edit Car</Btn>
                <Btn variant="danger" icon={<X size={14} />} onClick={onDeleteCar}>Delete Car</Btn>
              </>
            )}
            {client && <Btn variant="ghost" icon={<CalendarDays size={14} />} onClick={onSchedule}>Book Appointment</Btn>}
            <Btn icon={<Plus size={14} />} onClick={onAddService}>Add Service</Btn>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>
        {/* Left Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Client Card */}
          {client ? (
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Registered Owner</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.accentDim, display: "flex", alignItems: "center", justifyContent: "center", color: T.accent, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18 }}>
                  {client.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: T.textBright, fontSize: 15 }}>{client.name}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>Since {fmt(client.since)}</div>
                </div>
              </div>
              {[{ icon: <Phone size={12} />, val: client.phone }, { icon: <Mail size={12} />, val: client.email }].map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.text, marginBottom: 6 }}>
                  <span style={{ color: T.muted }}>{r.icon}</span> {r.val}
                </div>
              ))}
            </Card>
          ) : (
            <Card style={{ textAlign: "center", padding: 24 }}>
              <User size={28} style={{ color: T.muted, display: "block", margin: "0 auto 8px" }} />
              <p style={{ color: T.muted, fontSize: 13 }}>No client linked</p>
            </Card>
          )}

          {/* Next Service Due */}
          {latestService && (
            <Card style={{ background: ALERT_CONFIG[lvl].dim, borderColor: ALERT_CONFIG[lvl].color + "44" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Next Service Due</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, color: ALERT_CONFIG[lvl].color, marginBottom: 2 }}>
                {fmt(latestService.nextDue)}
              </div>
              <div style={{ fontSize: 13, color: T.text }}>{latestService.type}</div>
              <div style={{ marginTop: 8 }}>
                {(() => {
                  const d = daysUntil(latestService.nextDue);
                  return (
                    <Badge level={lvl} custom={d < 0 ? `${Math.abs(d)} days overdue` : d === 0 ? "Due today!" : `${d} days remaining`} />
                  );
                })()}
              </div>
            </Card>
          )}

          {/* Upcoming Appointments */}
          {upcomingAppts.length > 0 && (
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Upcoming</div>
              {upcomingAppts.map(a => (
                <div key={a.id} style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{a.type}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{fmt(a.date)} at {a.time}</div>
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* Service History */}
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.textBright, marginBottom: 16 }}>
            Service History ({services.length})
          </div>
          {services.length === 0 ? (
            <Card style={{ textAlign: "center", padding: 40 }}>
              <Wrench size={36} style={{ display: "block", margin: "0 auto 12px", color: T.muted }} />
              <p style={{ color: T.muted, fontSize: 15, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}>No service records yet</p>
              <p style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>Click "Add Service" to log the first maintenance record</p>
            </Card>
          ) : (
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 19, top: 0, bottom: 0, width: 2, background: T.border, borderRadius: 1 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {services.map((s, i) => {
                  const sc = statusColors[s.status] || T.muted;
                  return (
                    <div key={s.id} style={{ display: "flex", gap: 16, paddingBottom: 16, position: "relative" }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                        background: i === 0 ? T.accent : T.card,
                        border: `2px solid ${i === 0 ? T.accent : T.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 1,
                      }}>
                        <Wrench size={16} color={i === 0 ? "#0A0C10" : T.muted} />
                      </div>
                      <Card style={{ flex: 1, padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                          <div>
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: T.textBright }}>{s.type}</span>
                            {i === 0 && <span style={{ marginLeft: 8, fontSize: 10, color: T.accent, fontWeight: 700 }}>LATEST</span>}
                            <span style={{ marginLeft: 8 }}><SyncIcon status={s._sync_status} size={12} /></span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: T.accent }}>
                              ₨{s.cost?.toLocaleString()}
                            </span>
                            {isAdmin && (
                              <button 
                                onClick={() => navigate("editService", s.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 4 }}
                                title="Edit Record"
                              >
                                <FileText size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 16, marginBottom: s.notes ? 8 : 0, flexWrap: "wrap" }}>
                          {[
                            { icon: <Clock size={11} />, val: fmt(s.date) },
                            { icon: <RefreshCw size={11} />, val: `Next: ${fmt(s.nextDue)}` },
                            { icon: <User size={11} />, val: s.tech },
                          ].map((m, j) => (
                            <span key={j} style={{ fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 5 }}>
                              {m.icon} {m.val}
                            </span>
                          ))}
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: sc + "18", color: sc, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            {s.status}
                          </span>
                        </div>
                        {s.notes && <p style={{ fontSize: 12, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>{s.notes}</p>}
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ALERTS VIEW ──────────────────────────────────────────────────────────────
function AlertsView({ data, navigate }) {
  const [filter, setFilter] = useState("all");
  const alerts = data.services
    .filter(s => alertLevel(s.nextDue) !== "ok")
    .sort((a, b) => daysUntil(a.nextDue) - daysUntil(b.nextDue));

  const filtered = filter === "all" ? alerts : alerts.filter(a => alertLevel(a.nextDue) === filter);

  const counts = {
    overdue: alerts.filter(a => alertLevel(a.nextDue) === "overdue").length,
    warning: alerts.filter(a => alertLevel(a.nextDue) === "warning").length,
    upcoming: alerts.filter(a => alertLevel(a.nextDue) === "upcoming").length,
  };

  return (
    <div>
      <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: T.textBright, marginBottom: 6 }}>
        Maintenance Alerts
      </h1>
      <p style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>Vehicles requiring attention based on service schedules</p>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {[
          { key: "all", label: `All (${alerts.length})`, color: T.text },
          { key: "overdue", label: `Overdue (${counts.overdue})`, color: T.danger },
          { key: "warning", label: `Due Soon (${counts.warning})`, color: T.warning },
          { key: "upcoming", label: `Upcoming (${counts.upcoming})`, color: T.info },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
            padding: "7px 16px", borderRadius: 7, border: "1px solid",
            borderColor: filter === tab.key ? tab.color : T.border,
            background: filter === tab.key ? tab.color + "18" : "transparent",
            color: filter === tab.key ? tab.color : T.muted,
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
            fontSize: 13, cursor: "pointer",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <CheckCircle2 size={48} style={{ display: "block", margin: "0 auto 12px", color: T.success }} />
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.textBright }}>
            All clear in this category
          </p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(s => {
            const car = data.cars.find(c => c.plate === s.plate);
            const client = data.clients.find(c => c.id === car?.clientId);
            const lvl = alertLevel(s.nextDue);
            const cfg = ALERT_CONFIG[lvl];
            const d = daysUntil(s.nextDue);
            return (
              <Card key={s.id} onClick={() => navigate("car", s.plate)} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 4, height: 50, borderRadius: 2, background: cfg.color, flexShrink: 0 }} />
                <div style={{ background: cfg.dim, border: `1px solid ${cfg.color}33`, borderRadius: 8, padding: "10px 14px", textAlign: "center", minWidth: 80 }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>
                    {Math.abs(d)}
                  </div>
                  <div style={{ fontSize: 10, color: cfg.color, fontWeight: 700 }}>
                    {d < 0 ? "DAYS AGO" : "DAYS LEFT"}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <Plate plate={s.plate} size="sm" />
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: T.textBright }}>{s.type}</span>
                    <Badge level={lvl} />
                    <SyncIcon status={s._sync_status} />
                  </div>
                  <div style={{ fontSize: 12, color: T.muted }}>
                    {car?.year} {car?.make} {car?.model} · {client?.name || "No client"} · Due: {fmt(s.nextDue)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {client && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                      <div style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 5 }}>
                        <Phone size={10} /> {client.phone}
                      </div>
                    </div>
                  )}
                  <ChevronRight size={16} color={T.muted} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SCHEDULE VIEW ────────────────────────────────────────────────────────────
function ScheduleView({ data, onAddAppt }) {
  const [filter, setFilter] = useState("upcoming");
  const today = new Date().toISOString().split("T")[0];
  const sorted = [...data.appointments].sort((a, b) => a.date.localeCompare(b.date));
  const shown = filter === "upcoming"
    ? sorted.filter(a => a.date >= today)
    : sorted.filter(a => a.date < today);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: T.textBright, marginBottom: 4 }}>Appointments</h1>
          <p style={{ color: T.muted, fontSize: 14 }}>Manage service bookings for registered clients</p>
        </div>
        <Btn icon={<Plus size={16} />} size="lg" onClick={onAddAppt}>Book Appointment</Btn>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {["upcoming", "past"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 16px", borderRadius: 7, border: "1px solid",
            borderColor: filter === f ? T.accent : T.border,
            background: filter === f ? T.accentDim : "transparent",
            color: filter === f ? T.accent : T.muted,
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer",
            textTransform: "capitalize",
          }}>
            {f === "upcoming" ? `Upcoming (${sorted.filter(a => a.date >= today).length})` : `Past (${sorted.filter(a => a.date < today).length})`}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <CalendarDays size={40} style={{ display: "block", margin: "0 auto 12px", color: T.muted }} />
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: T.muted, fontWeight: 700 }}>No {filter} appointments</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map(a => {
            const car = data.cars.find(c => c.plate === a.plate);
            const client = data.clients.find(c => c.id === a.clientId);
            const sc = a.status === "Confirmed" ? T.success : a.status === "Pending" ? T.warning : T.muted;
            return (
              <Card key={a.id} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ minWidth: 90, textAlign: "center" }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, color: T.accent }}>{fmt(a.date)}</div>
                  <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>{a.time}</div>
                </div>
                <div style={{ width: 1, height: 44, background: T.border, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <Plate plate={a.plate} size="sm" />
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: T.textBright }}>{a.type}</span>
                  </div>
                  <div style={{ fontSize: 12, color: T.muted }}>
                    {car?.make} {car?.model} · {client?.name || "Walk-in"}
                    {client && <span> · <Phone size={10} style={{ verticalAlign: "middle" }} /> {client.phone}</span>}
                  </div>
                </div>
                <span style={{ padding: "4px 12px", borderRadius: 5, fontSize: 12, fontWeight: 700, background: sc + "18", color: sc, border: `1px solid ${sc}33`, letterSpacing: 0.3 }}>
                  {a.status}
                </span>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CLIENTS VIEW ─────────────────────────────────────────────────────────────
function ClientsView({ data, navigate }) {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();
  const filtered = data.clients.filter(c =>
    c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q)
  );

  return (
    <div>
      <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: T.textBright, marginBottom: 6 }}>Clients</h1>
      <p style={{ color: T.muted, fontSize: 14, marginBottom: 20 }}>All registered customers and their vehicles</p>

      <div style={{ position: "relative", maxWidth: 420, marginBottom: 20 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone…"
          style={{
            width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: "9px 12px 9px 34px", color: T.textBright, fontSize: 14,
          }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {filtered.map(client => {
          const cars = data.cars.filter(c => c.clientId === client.id);
          const allServices = data.services.filter(s => cars.some(c => c.plate === s.plate));
          const alerts = allServices.filter(s => alertLevel(s.nextDue) !== "ok");
          const totalSpend = allServices.reduce((sum, s) => sum + (s.cost || 0), 0);
          return (
            <Card key={client.id} style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: "50%", background: T.accentDim, border: `2px solid ${T.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", color: T.accent, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20 }}>
                  {client.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.textBright }}>{client.name}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>Client since {fmt(client.since)}</div>
                </div>
                {alerts.length > 0 && <Badge level="warning" custom={`${alerts.length} alert${alerts.length > 1 ? "s" : ""}`} />}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
                {[{ icon: <Phone size={11} />, val: client.phone }, { icon: <Mail size={11} />, val: client.email }].map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 7 }}>
                    {r.icon} {r.val}
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: T.border, marginBottom: 12 }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {cars.map(car => (
                  <div key={car.plate} onClick={() => navigate("car", car.plate)} style={{ cursor: "pointer" }}>
                    <Plate plate={car.plate} size="sm" />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                <span style={{ fontSize: 11, color: T.muted }}>{allServices.length} services</span>
                <span style={{ fontSize: 12, color: T.success, fontWeight: 700 }}>₨{totalSpend.toLocaleString()}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ active, navigate, alertCount, isAdmin, setIsAdmin, lastSync }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);

    const checkPending = async () => {
      try {
        const ops = await localDatabase.getQueuedOperations();
        setPendingCount(ops.length);
      } catch (e) {}
    };

    const interval = setInterval(checkPending, 5000);
    checkPending();

    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
      clearInterval(interval);
    };
  }, []);

  const nav = [
    { key: "dashboard", icon: <LayoutDashboard size={18} />, label: "Dashboard" },
    { key: "lookup", icon: <Search size={18} />, label: "Vehicle Lookup" },
    { key: "alerts", icon: <Bell size={18} />, label: "Alerts", badge: alertCount },
    { key: "schedule", icon: <CalendarDays size={18} />, label: "Schedule" },
    { key: "clients", icon: <Users size={18} />, label: "Clients" },
  ];

  return (
    <div style={{ width: 220, background: T.sidebar, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", height: "100vh", position: "fixed", left: 0, top: 0 }}>
      {/* Logo */}
      <div style={{ padding: "22px 20px 18px", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Wrench size={18} color="#0A0C10" />
          </div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, color: "#FFFFFF", letterSpacing: 0.5 }}>AutoShift</div>
            <div style={{ fontSize: 10, color: "#FFFFFF", opacity: 0.7, fontWeight: 600, letterSpacing: 0.5 }}>SHOWROOM MANAGER</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "14px 10px" }}>
        {/* Status Indicator */}
        <div style={{
          padding: "10px 12px", marginBottom: "16px", borderRadius: "8px",
          background: isOnline ? T.successDim : T.dangerDim,
          border: `1px solid ${isOnline ? T.success : T.danger}33`,
          display: "flex", flexDirection: "column", gap: "4px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: isOnline ? T.success : T.danger }} />
            <span style={{ fontSize: "12px", fontWeight: "bold", color: isOnline ? T.success : T.danger, fontFamily: "'Barlow Condensed'" }}>
              {isOnline ? "SYSTEM ONLINE" : "SYSTEM OFFLINE"}
            </span>
          </div>
          <div style={{ fontSize: "10px", color: T.muted, display: "flex", alignItems: "center", gap: "5px", marginTop: 2 }}>
            <Cloud size={10} /> Last synced: {formatLastSynced(lastSync)}
          </div>
          {pendingCount > 0 && (
            <div style={{ fontSize: "11px", color: T.textBright, display: "flex", alignItems: "center", gap: "6px", marginTop: 4 }}>
              <RefreshCw size={10} style={{ animation: "spin 2s linear infinite" }} />
              {pendingCount} item{pendingCount !== 1 ? 's' : ''} syncing...
            </div>
          )}
        </div>

        {nav.map(item => {
          const isActive = active === item.key || (active === "car" && item.key === "lookup");
          return (
            <button key={item.key} onClick={() => navigate(item.key)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 8, marginBottom: 2,
              background: isActive ? T.accent : "transparent",
              boxShadow: isActive ? `0 4px 12px rgba(0,0,0,0.3)` : "none",
              border: isActive ? `1px solid ${T.accent}` : "1px solid transparent",
              color: "#FFFFFF",
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: isActive ? 700 : 500,
              fontSize: 14, cursor: "pointer", textAlign: "left", position: "relative",
              transition: "all 0.15s",
            }}>
              {item.icon}
              {item.label}
              {item.badge > 0 && (
                <span style={{
                  marginLeft: "auto", background: T.danger, color: "#fff",
                  fontSize: 10, fontWeight: 800, borderRadius: 10,
                  padding: "1px 6px", minWidth: 18, textAlign: "center",
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "14px 16px", borderTop: `1px solid ${T.border}` }}>
        <button 
          onClick={() => {
            if (isAdmin) {
              setIsAdmin(false);
            } else {
              const pin = window.prompt("Enter Admin PIN to enable owner actions:");
              if (pin && process.env.REACT_APP_ADMIN_PIN && pin.trim() === process.env.REACT_APP_ADMIN_PIN.trim()) {
                setIsAdmin(true);
              } else {
                alert("Incorrect Admin PIN.");
              }
            }
          }}
          style={{
            width: "100%", padding: "6px", marginBottom: "10px",
            background: isAdmin ? T.accentDim : T.card,
            color: isAdmin ? T.accent : T.muted,
            border: `1px solid ${isAdmin ? T.accent : T.border}33`,
            borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6
          }}
        >
          <Shield size={12} /> {isAdmin ? "ADMIN MODE: ON" : "SWITCH TO ADMIN"}
        </button>

        {isAdmin && (
          <button 
            onClick={() => navigate("manageTechs")}
            style={{
              width: "100%", padding: "6px", marginBottom: "10px",
              background: T.infoDim, color: T.info,
              border: `1px solid ${T.info}33`,
              borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6
            }}
          >
            <Users size={12} /> MANAGE STAFF
          </button>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button 
            onClick={async () => {
              try {
                const blob = await localDatabase.backup();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `autoshift-backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) {
                alert("Backup failed: " + e.message);
              }
            }}
            style={{
              flex: 1, padding: "8px", background: T.infoDim, color: T.info, 
              border: `1px solid ${T.info}33`, borderRadius: "6px", cursor: "pointer", 
              fontSize: "10px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: 5
            }}
            title="Export Data"
          >
            <Download size={12} /> EXPORT
          </button>
          <button 
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json';
              input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (event) => {
                  try {
                    const data = JSON.parse(event.target.result);
                    if (window.confirm("Restore from backup? This will merge with existing local data.")) {
                      await databaseManager.importData(data);
                      alert("Data imported successfully!");
                      window.location.reload();
                    }
                  } catch (err) {
                    alert("Import failed: " + err.message);
                  }
                };
                reader.readAsText(file);
              };
              input.click();
            }}
            style={{
              flex: 1, padding: "8px", background: T.successDim, color: T.success, 
              border: `1px solid ${T.success}33`, borderRadius: "6px", cursor: "pointer", 
              fontSize: "10px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: 5
            }}
            title="Import Data"
          >
            <Upload size={12} /> IMPORT
          </button>
        </div>

        <button 
          disabled={!isOnline}
          onClick={async () => {
            if (window.confirm("Clear local cache and re-sync from remote?")) {
              await databaseManager.clearAll();
              showToast("Local data cleared. Re-syncing...");
              triggerSyncAndRefresh(true);
            }
          }}
          style={{
            width: "100%", padding: "6px", marginBottom: "10px",
            background: isOnline ? T.dangerDim : T.muted + "22", 
            color: isOnline ? "#FFFFFF" : T.muted, 
            border: `1px solid ${T.danger}33`,
            borderRadius: "6px", cursor: isOnline ? "pointer" : "not-allowed", 
            fontSize: "11px", fontWeight: "bold",
            opacity: isOnline ? 1 : 0.5
          }}
        >
          {isOnline ? "CLEAR LOCAL CACHE" : "CANNOT CLEAR CACHE OFFLINE"}
        </button>
        <button 
          onClick={() => {
            sessionStorage.removeItem('autoshift_unlocked');
            window.location.reload();
          }}
          style={{
            width: "100%", padding: "6px", marginBottom: "10px",
            background: T.sidebar, color: "#FFFFFF",
            border: `1px solid ${T.border}33`,
            borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6
          }}
        >
          LOCK SYSTEM
        </button>

        <div style={{ fontSize: 11, color: "#FFFFFF", opacity: 0.8 }}>AutoShift MVP v1.0</div>
        <div style={{ fontSize: 10, color: "#FFFFFF", opacity: 0.6, marginTop: 2 }}>
          {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(null);
  const [view, setView] = useState("dashboard");
  const [selectedPlate, setSelectedPlate] = useState(null);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [modal, setModal] = useState(null); // "addService" | "addCar" | "addAppt" | "editCar" | "manageTechs" | "editService"
  const [techs, setTechs] = useState(DEFAULT_TECHNICIANS);
  const [pendingPlate, setPendingPlate] = useState("");
  const [toast, setToast] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [validation, setValidation] = useState({ status: VALIDATION_STATUS.PENDING, error: null });
  const [isUnlocked, setIsUnlocked] = useState(sessionStorage.getItem('autoshift_unlocked') === 'true');

  // Initialize and load data
  useEffect(() => {
    let syncInterval;

    async function initAndLoad() {
      try {
        // 1. Validate Environment/Supabase first
        const valResult = await validateEnvironment();
        setValidation(valResult);

        if (valResult.status === VALIDATION_STATUS.FAILED) {
          console.warn("Environmental validation failed, but proceeding with local data.");
        }

        await databaseManager.initialize();

        // Load last sync metadata
        const metadata = await localDatabase.read('sync_metadata', { table_name: 'global_last_sync' });
        if (metadata.length > 0) {
          setLastSync(metadata[0].last_sync);
        }

        // Load initial state from local database immediately (Offline-First)
        const [clients, cars, services, appointments] = await Promise.all([
          databaseManager.getClients(),
          databaseManager.getCars(),
          databaseManager.getServices(),
          databaseManager.getAppointments()
        ]);

        if (clients.length > 0 || cars.length > 0) {
          setData({ clients, cars, services, appointments });
        } else {
          setData(SEED); // Fallback if local is empty
        }

        // Background sync to fetch remote changes if validation succeeded
        if (valResult.status === VALIDATION_STATUS.SUCCESS) {
          triggerSyncAndRefresh();

          // Setup periodic sync
          syncInterval = setInterval(() => {
            triggerSyncAndRefresh();
          }, 30000); // More frequent sync (30s)
        }

      } catch (error) {
        console.error("Initialization failed:", error);
        setData(SEED);
      }
    }

    initAndLoad();

    const handleOnline = () => {
      showToast("System Online. Syncing...");
      triggerSyncAndRefresh();
    };
    
    window.addEventListener('online', handleOnline);
    return () => {
      if (syncInterval) clearInterval(syncInterval);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const triggerSyncAndRefresh = async (forceRefresh = false) => {
    const hasNewRemoteData = await databaseManager.syncWithSupabase();
    
    // Always refresh lastSync from metadata after a sync attempt
    const metadata = await localDatabase.read('sync_metadata', { table_name: 'global_last_sync' });
    if (metadata.length > 0) {
      setLastSync(metadata[0].last_sync);
    }

    if (hasNewRemoteData || forceRefresh) {
      const [uClients, uCars, uServices, uAppointments] = await Promise.all([
        databaseManager.getClients(),
        databaseManager.getCars(),
        databaseManager.getServices(),
        databaseManager.getAppointments()
      ]);
      setData({ 
        clients: uClients, 
        cars: uCars, 
        services: uServices, 
        appointments: uAppointments 
      });
    }
  };

  const navigate = (v, id) => {
    if (v === "editService") {
      setSelectedServiceId(id);
      setModal("editService");
      return;
    }
    if (v === "manageTechs") {
      setModal("manageTechs");
      return;
    }
    setView(v);
    if (id) setSelectedPlate(id);
  };

  const showToast = (msg) => setToast(msg);

  const handleUpdateCar = async (updatedCar) => {
    try {
      await databaseManager.update('cars', updatedCar.id, updatedCar);
      setModal(null);
      showToast("Vehicle updated successfully");
      triggerSyncAndRefresh(true);
    } catch (error) {
      console.error("Error updating car:", error);
      showToast("Error updating vehicle");
    }
  };

  const handleDeleteCar = async (carId) => {
    if (!window.confirm("Are you sure you want to delete this vehicle? This will also remove its service history.")) return;
    try {
      await databaseManager.delete('cars', carId);
      setView("lookup");
      showToast("Vehicle removed successfully");
      triggerSyncAndRefresh(true);
    } catch (error) {
      console.error("Error deleting car:", error);
      showToast("Error removing vehicle");
    }
  };

  const handleUpdateService = async (updated) => {
    try {
      await databaseManager.update('services', updated.id, updated);
      setModal(null);
      showToast("Service record updated");
      triggerSyncAndRefresh(true);
    } catch (error) {
      console.error("Error updating service:", error);
      showToast("Error updating record");
    }
  };

  const handleAddService = async (record) => {
    try {
      await databaseManager.create('services', record);
      setModal(null);
      showToast("Service record saved");
      triggerSyncAndRefresh(true);
    } catch (error) {
      console.error("Error saving service:", error);
      showToast("Error saving service record");
    }
  };

  const handleAddCar = async ({ car, tab, newClient }) => {
    let clientId = car.clientId;
    let addedClient = null;

    try {
      if (tab === "new") {
        addedClient = await databaseManager.create('clients', { 
          name: newClient.name, 
          phone: newClient.phone, 
          email: newClient.email,
          since: new Date().toISOString().split("T")[0]
        });
        clientId = addedClient.id;
      }

      const insertedCar = await databaseManager.create('cars', {
        plate: car.plate, 
        make: car.make, 
        model: car.model,
        year: car.year, 
        color: car.color, 
        clientId: clientId
      });

      setModal(null);
      setSelectedPlate(insertedCar.plate);
      setView("car");
      showToast(`${insertedCar.plate} registered successfully`);
      triggerSyncAndRefresh(true);

    } catch (error) {
      console.error("Error saving car:", error);
      showToast("Error registering vehicle");
    }
  };

  const handleAddAppt = async (appt) => {
    try {
      await databaseManager.create('appointments', appt);
      setModal(null);
      showToast("Appointment booked successfully");
      triggerSyncAndRefresh(true);
    } catch (error) {
      console.error("Error saving appointment:", error);
      showToast("Error booking appointment");
    }
  };

  if (!isUnlocked) {
    return <PinGate onUnlock={() => {
      setIsUnlocked(true);
      sessionStorage.setItem('autoshift_unlocked', 'true');
    }} />;
  }

  if (!data) {
    return (
      <div style={{ background: T.bg, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: 20 }}>
          {validation.status === VALIDATION_STATUS.FAILED && !navigator.onLine ? (
            <>
              <CloudOff size={48} style={{ color: T.warning, display: "block", margin: "0 auto 16px" }} />
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: T.textBright, fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Working Offline</div>
              <div style={{ color: T.muted, fontSize: 14, lineHeight: 1.5 }}>We couldn't reach the cloud, but don't worry. You can continue managing your showroom locally. We'll sync everything once you're back online.</div>
              <Btn onClick={() => setData(SEED)} style={{ marginTop: 24 }}>Continue to Dashboard</Btn>
            </>
          ) : validation.status === VALIDATION_STATUS.FAILED ? (
            <>
              <AlertTriangle size={48} style={{ color: T.danger, display: "block", margin: "0 auto 16px" }} />
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: T.textBright, fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Connection Failed</div>
              <div style={{ color: T.muted, fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>{validation.error}</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <Btn variant="ghost" onClick={() => window.location.reload()}>Retry Connection</Btn>
                <Btn onClick={() => setData(SEED)}>Work Offline</Btn>
              </div>
            </>
          ) : (
            <>
              <Wrench size={36} style={{ color: T.accent, display: "block", margin: "0 auto 14px", animation: "spin 1s linear infinite" }} />
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: T.muted, fontSize: 16, fontWeight: 600 }}>Loading AutoShift…</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>{validation.status === VALIDATION_STATUS.PENDING ? "Verifying cloud connection..." : "Initializing local database..."}</div>
            </>
          )}
        </div>
      </div>
    );
  }

  const alertCount = data.services.filter(s => alertLevel(s.nextDue) !== "ok").length;

  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "'Barlow', sans-serif" }}>
      <OfflineBanner />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Barlow:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${T.bg}; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${T.bg}; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
        input, select, textarea { outline: none; }
        input:focus, select:focus, textarea:focus { border-color: ${T.accent} !important; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <Sidebar active={view} navigate={navigate} alertCount={alertCount} isAdmin={isAdmin} setIsAdmin={setIsAdmin} lastSync={lastSync} />

      {/* Main */}
      <div style={{ marginLeft: 220, padding: "32px 36px", minHeight: "100vh", maxWidth: 1200 }}>
        {view === "dashboard" && <DashboardView data={data} navigate={navigate} />}
        {view === "lookup" && (
          <LookupView
            data={data}
            navigate={navigate}
            onAddCar={(plate) => { setPendingPlate(plate); setModal("addCar"); }}
          />
        )}
        {view === "car" && (
          <CarDetailView
            data={data}
            plate={selectedPlate}
            onBack={() => setView("lookup")}
            onAddService={() => setModal("addService")}
            onSchedule={() => setModal("addAppt")}
            navigate={navigate}
            isAdmin={isAdmin}
            onEditCar={() => setModal("editCar")}
            onDeleteCar={() => handleDeleteCar(data.cars.find(c => c.plate === selectedPlate)?.id)}
          />
        )}
        {view === "alerts" && <AlertsView data={data} navigate={navigate} />}
        {view === "schedule" && <ScheduleView data={data} onAddAppt={() => setModal("addAppt")} />}
        {view === "clients" && <ClientsView data={data} navigate={navigate} />}
      </div>

      {/* Modals */}
      {modal === "addService" && selectedPlate && (
        <AddServiceModal plate={selectedPlate} techs={techs} onSave={handleAddService} onClose={() => setModal(null)} />
      )}
      {modal === "addCar" && (
        <AddCarModal prefillPlate={pendingPlate} clients={data.clients} onSave={handleAddCar} onClose={() => setModal(null)} />
      )}
      {modal === "addAppt" && (
        <AddApptModal data={data} prefillPlate={view === "car" ? selectedPlate : ""} onSave={handleAddAppt} onClose={() => setModal(null)} />
      )}
      {modal === "editCar" && selectedPlate && (
        <EditCarModal 
          car={data.cars.find(c => c.plate === selectedPlate)} 
          onSave={handleUpdateCar} 
          onClose={() => setModal(null)} 
        />
      )}
      {modal === "manageTechs" && (
        <ManageTechsModal techs={techs} onSave={(newList) => { setTechs(newList); setModal(null); showToast("Staff list updated"); }} onClose={() => setModal(null)} />
      )}
      {modal === "editService" && selectedServiceId && (
        <EditServiceModal 
          service={data.services.find(s => s.id === selectedServiceId)} 
          techs={techs} 
          onSave={handleUpdateService} 
          onClose={() => setModal(null)} 
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </div>
  );
}