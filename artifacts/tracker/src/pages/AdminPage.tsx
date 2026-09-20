import { useState, useEffect, useCallback, useRef } from "react";
import {
  Lock, Plus, Trash2, LogOut, Package, ChevronRight, Loader2, AlertCircle,
  CheckCircle2, RefreshCw, X, Eye, LayoutDashboard, CreditCard, FileText,
  MessageSquare, Settings, Truck, User, MapPin, Phone, Mail, Scale,
  DollarSign, Shield, Globe, Zap, Bell, Clock, TrendingUp, BarChart3,
  Download, ChevronDown, ChevronUp, Send, HelpCircle,
  Wifi, Star, QrCode, Languages, Search,
} from "lucide-react";
import {
  adminLogin, adminListPackages, adminCreatePackage,
  adminDeletePackage, adminUpdatePackage, checkSmtpStatus, sendTestSmtpEmail, type Package as Pkg,
} from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminTab = "dashboard" | "shipments" | "payments" | "customs" | "support" | "settings";

// ─── Route presets ────────────────────────────────────────────────────────────

const ROUTE_PRESETS: Record<string, { label: string; route: [number, number][]; origin: string; destination: string }> = {
  sj_sf: {
    label: "San Jose → San Francisco",
    origin: "San Jose, CA",
    destination: "San Francisco, CA",
    route: [[37.3382,-121.8863],[37.4,-121.92],[37.45,-121.95],[37.51,-121.97],[37.55,-121.98],[37.59,-122.05],[37.63,-122.12],[37.68,-122.19],[37.72,-122.27],[37.75,-122.35],[37.7749,-122.4194]],
  },
  la_sf: {
    label: "Los Angeles → San Francisco",
    origin: "Los Angeles, CA",
    destination: "San Francisco, CA",
    route: [[34.0522,-118.2437],[34.6,-118.6],[35.2,-119.0],[35.65,-119.3],[35.9,-119.5],[36.3,-119.8],[36.7,-120.1],[37.1,-120.6],[37.4,-121.1],[37.6,-121.9],[37.7749,-122.4194]],
  },
  portland_sf: {
    label: "Portland → San Francisco",
    origin: "Portland, OR",
    destination: "San Francisco, CA",
    route: [[45.5051,-122.675],[44.0,-122.3],[42.8,-122.0],[41.5,-122.15],[40.3,-122.3],[39.2,-122.4],[38.5,-122.5],[38.0,-122.48],[37.7749,-122.4194]],
  },
  seattle_la: {
    label: "Seattle → Los Angeles",
    origin: "Seattle, WA",
    destination: "Los Angeles, CA",
    route: [[47.6062,-122.3321],[46.2,-122.0],[44.5,-121.5],[42.5,-121.0],[40.5,-120.5],[38.5,-119.8],[36.5,-119.0],[35.0,-118.5],[34.0522,-118.2437]],
  },
  ny_la: {
    label: "New York → Los Angeles",
    origin: "New York, NY",
    destination: "Los Angeles, CA",
    route: [[40.7128,-74.006],[39.9,-76.5],[38.5,-79.0],[36.5,-82.0],[35.2,-86.0],[33.5,-89.5],[32.0,-93.5],[31.5,-97.5],[32.0,-101.5],[33.0,-106.0],[34.0522,-118.2437]],
  },
  miami_chicago: {
    label: "Miami → Chicago",
    origin: "Miami, FL",
    destination: "Chicago, IL",
    route: [[25.7617,-80.1918],[27.5,-81.5],[29.5,-82.0],[31.5,-83.0],[33.5,-84.4],[35.5,-85.5],[37.0,-86.5],[39.0,-87.5],[41.8781,-87.6298]],
  },
};

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "0123456789";
  const r = (s: string, n: number) => Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join("");
  return `TSL-${r(nums, 4)}-${r(chars, 2)}`;
}

function blankForm() {
  return {
    code: generateCode(),
    status: "Processing",
    eta: "",
    origin: "",
    destination: "",
    carrier: "Tesla Express",
    weight: "",
    speed_kph: 85,
    start_progress: 0.05,
    delivery_method: "Standard",
    shipping_cost: 49.99,
    customs_status: "Pending",
    customs_fee: 0,
    sender_name: "",
    sender_email: "",
    sender_phone: "",
    sender_address: "",
    receiver_name: "",
    receiver_email: "",
    receiver_phone: "",
    receiver_address: "",
    routePreset: "sj_sf",
    events: [
      { time_label: "", label: "Order Received", location: "Merchant", done: true, sort_order: 0 },
      { time_label: "", label: "Processing", location: "Warehouse", done: false, sort_order: 1 },
      { time_label: "", label: "In Transit", location: "", done: false, sort_order: 2 },
      { time_label: "", label: "Customs Clearance", location: "Port of Entry", done: false, sort_order: 3 },
      { time_label: "", label: "Out for Delivery", location: "", done: false, sort_order: 4 },
      { time_label: "", label: "Delivered", location: "", done: false, sort_order: 5 },
    ],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s === "delivered" ? "text-green-400 bg-green-500/10 border-green-500/25" :
    s === "out for delivery" ? "text-orange-400 bg-orange-500/10 border-orange-500/25" :
    s === "in transit" ? "text-blue-400 bg-blue-500/10 border-blue-500/25" :
    s === "customs clearance" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/25" :
    "text-white/40 bg-white/5 border-white/10";
  return (
    <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      {status}
    </span>
  );
}

function CustomsBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s === "cleared" ? "text-green-400 bg-green-500/10 border-green-500/25" :
    s === "held" ? "text-red-400 bg-red-500/10 border-red-500/25" :
    s === "in review" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/25" :
    "text-white/35 bg-white/4 border-white/8";
  return (
    <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border ${cls}`}>
      {status}
    </span>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: string; icon?: React.FC<{ className?: string }> }) {
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-white/4 last:border-0">
      {Icon && <Icon className="w-3.5 h-3.5 text-white/20 mt-0.5 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-[9px] text-white/25 uppercase tracking-wider mb-0.5">{label}</div>
        <div className="text-xs text-white/70 truncate">{value || "—"}</div>
      </div>
    </div>
  );
}

// ─── Login screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!pw) return;
    setLoading(true); setError("");
    const ok = await adminLogin(pw);
    setLoading(false);
    if (ok) onLogin(pw);
    else setError("Invalid password");
  };

  return (
    <div className="min-h-dvh bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center gap-3 mb-6">
            <img src="/tesla-logo.png" alt="TeslaTrack" className="logo-spin w-16 h-16 object-contain drop-shadow-[0_0_16px_rgba(220,38,38,0.45)]" />
            <span className="text-sm font-semibold tracking-widest uppercase">
              Tesla<span className="text-red-500">Track</span>
            </span>
          </div>
          <h1 className="text-xl font-semibold text-white/90 mb-1">Admin Portal</h1>
          <p className="text-xs text-white/30">Secure access — enter your admin password</p>
        </div>
        <div className="bg-[#111] border border-white/8 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-[10px] text-green-400/70 bg-green-500/8 border border-green-500/15 rounded-lg px-3 py-2">
            <Shield className="w-3 h-3 flex-shrink-0" /> SSL Encrypted · Secure Login
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
            <input type="password" value={pw}
              onChange={(e) => { setPw(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Admin password"
              className="w-full bg-white/3 border border-white/8 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-red-600/40" />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </div>
          )}
          <button onClick={handleSubmit} disabled={!pw || loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white text-sm font-medium transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-center text-[10px] text-white/15">
            Protected by admin authentication
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Shipment Detail Modal ────────────────────────────────────────────────────

function ShipmentDetailModal({ pkg, onClose, onTrack }: { pkg: Pkg; onClose: () => void; onTrack: (c: string) => void }) {
  const STATUS_STEPS = ["Order Received","Processing","In Transit","Customs Clearance","Out for Delivery","Delivered"];
  const currentStep = STATUS_STEPS.findIndex((s) => s.toLowerCase() === pkg.status.toLowerCase());
  const activeIdx = currentStep >= 0 ? currentStep : 2;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/8 sticky top-0 bg-[#0f0f0f] z-10">
          <div className="flex items-center gap-3">
            <Package className="w-4 h-4 text-red-500" />
            <code className="text-sm font-mono text-white/80">{pkg.code}</code>
            <StatusBadge status={pkg.status} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onTrack(pkg.code)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/25 transition-all">
              <Eye className="w-3 h-3" /> Live Track
            </button>
            <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Sender */}
          <div className="bg-white/3 rounded-xl border border-white/6 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <User className="w-3 h-3 text-blue-400" />
              </div>
              <span className="text-xs font-semibold text-white/70">Sender Information</span>
            </div>
            <InfoRow label="Name" value={pkg.sender_name} icon={User} />
            <InfoRow label="Email" value={pkg.sender_email} icon={Mail} />
            <InfoRow label="Phone" value={pkg.sender_phone} icon={Phone} />
            <InfoRow label="Address" value={pkg.sender_address} icon={MapPin} />
            <InfoRow label="Origin City" value={pkg.origin} icon={MapPin} />
          </div>

          {/* Receiver */}
          <div className="bg-white/3 rounded-xl border border-white/6 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-green-500/15 flex items-center justify-center">
                <User className="w-3 h-3 text-green-400" />
              </div>
              <span className="text-xs font-semibold text-white/70">Receiver Information</span>
            </div>
            <InfoRow label="Name" value={pkg.receiver_name} icon={User} />
            <InfoRow label="Email" value={pkg.receiver_email} icon={Mail} />
            <InfoRow label="Phone" value={pkg.receiver_phone} icon={Phone} />
            <InfoRow label="Address" value={pkg.receiver_address} icon={MapPin} />
            <InfoRow label="Destination City" value={pkg.destination} icon={MapPin} />
          </div>

          {/* Package Details */}
          <div className="bg-white/3 rounded-xl border border-white/6 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-red-500/15 flex items-center justify-center">
                <Package className="w-3 h-3 text-red-400" />
              </div>
              <span className="text-xs font-semibold text-white/70">Package Details</span>
            </div>
            <InfoRow label="Tracking Number" value={pkg.code} icon={QrCode} />
            <InfoRow label="Weight" value={pkg.weight} icon={Scale} />
            <InfoRow label="Carrier" value={pkg.carrier} icon={Truck} />
            <InfoRow label="Delivery Method" value={pkg.delivery_method || "Standard"} icon={Zap} />
            <InfoRow label="ETA" value={pkg.eta} icon={Clock} />
            <InfoRow label="Shipping Cost" value={`$${Number(pkg.shipping_cost || 0).toFixed(2)}`} icon={DollarSign} />
          </div>

          {/* Status Timeline */}
          <div className="bg-white/3 rounded-xl border border-white/6 p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg bg-purple-500/15 flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-purple-400" />
              </div>
              <span className="text-xs font-semibold text-white/70">Status Timeline</span>
            </div>
            <div className="space-y-0">
              {STATUS_STEPS.map((step, i) => {
                const done = i < activeIdx;
                const active = i === activeIdx;
                return (
                  <div key={i} className="flex gap-3 relative">
                    {i < STATUS_STEPS.length - 1 && (
                      <div className={`absolute left-[9px] top-5 w-0.5 h-5 ${done ? "bg-green-500/50" : "bg-white/8"}`} />
                    )}
                    <div className={`w-[18px] h-[18px] rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
                      done ? "bg-green-500/20 border border-green-500/40" :
                      active ? "bg-red-500/20 border border-red-500/60" :
                      "bg-white/4 border border-white/10"
                    }`}>
                      {done ? <CheckCircle2 className="w-2.5 h-2.5 text-green-400" /> :
                       active ? <div className="w-1.5 h-1.5 rounded-full bg-red-400" style={{ animation: "pulse-live 1.5s infinite" }} /> :
                       <div className="w-1.5 h-1.5 rounded-full bg-white/15" />}
                    </div>
                    <div className="pb-4">
                      <div className={`text-[11px] font-medium ${done ? "text-green-300/70" : active ? "text-white/90" : "text-white/25"}`}>{step}</div>
                      {active && <div className="text-[9px] text-red-400/70 mt-0.5">Current Status</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Events log */}
          {pkg.events && pkg.events.length > 0 && (
            <div className="md:col-span-2 bg-white/3 rounded-xl border border-white/6 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-yellow-500/15 flex items-center justify-center">
                  <Clock className="w-3 h-3 text-yellow-400" />
                </div>
                <span className="text-xs font-semibold text-white/70">Event Log</span>
              </div>
              <div className="space-y-2">
                {pkg.events.map((ev, i) => (
                  <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg ${ev.done ? "bg-green-500/6 border border-green-500/12" : "bg-white/2 border border-white/5"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${ev.done ? "bg-green-400" : "bg-white/20"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-medium ${ev.done ? "text-white/75" : "text-white/35"}`}>{ev.label}</span>
                        {ev.time_label && <span className="text-[9px] text-white/25 font-mono flex-shrink-0">{ev.time_label}</span>}
                      </div>
                      {ev.location && <div className="text-[10px] text-white/30 mt-0.5">{ev.location}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create/Edit Modal ────────────────────────────────────────────────────────

function CreateModal({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState(blankForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalTab, setModalTab] = useState<"basic" | "sender" | "receiver" | "events">("basic");

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const preset = ROUTE_PRESETS[form.routePreset];

  const handleCreate = async () => {
    if (!form.code || !form.eta) { setError("Tracking code and ETA are required"); return; }
    setLoading(true); setError("");
    const result = await adminCreatePackage(token, {
      code: form.code, status: form.status, eta: form.eta,
      origin: form.origin || preset.origin,
      destination: form.destination || preset.destination,
      carrier: form.carrier, weight: form.weight || "—",
      speed_kph: Number(form.speed_kph), start_progress: Number(form.start_progress),
      route: preset.route,
      delivery_method: form.delivery_method, shipping_cost: Number(form.shipping_cost),
      customs_status: form.customs_status, customs_fee: Number(form.customs_fee),
      sender_name: form.sender_name, sender_email: form.sender_email,
      sender_phone: form.sender_phone, sender_address: form.sender_address,
      receiver_name: form.receiver_name, receiver_email: form.receiver_email,
      receiver_phone: form.receiver_phone, receiver_address: form.receiver_address,
      events: form.events.map((e, i) => ({ ...e, sort_order: i })),
    } as Parameters<typeof adminCreatePackage>[1]);
    setLoading(false);
    if (result.success) onCreated();
    else setError(result.error ?? "Failed to create");
  };

  const TABS = [
    { id: "basic" as const, label: "Basic Info" },
    { id: "sender" as const, label: "Sender" },
    { id: "receiver" as const, label: "Receiver" },
    { id: "events" as const, label: "Events" },
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-white/90">New Shipment</span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {/* Modal tabs */}
        <div className="flex border-b border-white/8 px-5 flex-shrink-0">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setModalTab(t.id)}
              className={`text-[11px] py-2.5 px-3 border-b-2 transition-all -mb-px ${
                modalTab === t.id ? "border-red-500 text-white/90" : "border-transparent text-white/30 hover:text-white/60"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {modalTab === "basic" && <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Tracking Code</label>
                <div className="flex gap-2">
                  <input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())}
                    className="field-input font-mono flex-1" placeholder="TSL-0000-XX" />
                  <button onClick={() => set("code", generateCode())}
                    className="px-2.5 rounded-lg border border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 transition-all text-[10px]">
                    Gen
                  </button>
                </div>
              </div>
              <div>
                <label className="field-label">Status</label>
                <select value={form.status} onChange={(e) => set("status", e.target.value)} className="field-input">
                  {["Processing","In Transit","Customs Clearance","Out for Delivery","Delivered"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">ETA</label>
                <input value={form.eta} onChange={(e) => set("eta", e.target.value)}
                  className="field-input" placeholder="Today, 4–7 PM" />
              </div>
              <div>
                <label className="field-label">Weight</label>
                <input value={form.weight} onChange={(e) => set("weight", e.target.value)}
                  className="field-input" placeholder="2.4 kg" />
              </div>
            </div>
            <div>
              <label className="field-label">Route Preset</label>
              <select value={form.routePreset} onChange={(e) => {
                set("routePreset", e.target.value);
                const p = ROUTE_PRESETS[e.target.value];
                set("origin", p.origin); set("destination", p.destination);
              }} className="field-input">
                {Object.entries(ROUTE_PRESETS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-white/20 mt-1">{preset.origin} → {preset.destination}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Delivery Method</label>
                <select value={form.delivery_method} onChange={(e) => set("delivery_method", e.target.value)} className="field-input">
                  {["Standard","Express","Priority","Same-Day","Economy"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Shipping Cost ($)</label>
                <input type="number" step="0.01" value={form.shipping_cost}
                  onChange={(e) => set("shipping_cost", e.target.value)} className="field-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Customs Status</label>
                <select value={form.customs_status} onChange={(e) => set("customs_status", e.target.value)} className="field-input">
                  {["Pending","In Review","Cleared","Held"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Customs Fee ($)</label>
                <input type="number" step="0.01" min="0" value={form.customs_fee}
                  onChange={(e) => set("customs_fee", e.target.value)} className="field-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Speed (km/h)</label>
                <input type="number" value={form.speed_kph}
                  onChange={(e) => set("speed_kph", e.target.value)} className="field-input" />
              </div>
              <div>
                <label className="field-label">Start Progress (0–1)</label>
                <input type="number" step="0.01" min="0" max="1" value={form.start_progress}
                  onChange={(e) => set("start_progress", e.target.value)} className="field-input" />
              </div>
            </div>
            <div>
              <label className="field-label">Carrier</label>
              <input value={form.carrier} onChange={(e) => set("carrier", e.target.value)} className="field-input" />
            </div>
          </>}

          {modalTab === "sender" && <>
            <p className="text-[10px] text-white/30">Who is sending this shipment?</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Full Name</label>
                <input value={form.sender_name} onChange={(e) => set("sender_name", e.target.value)}
                  className="field-input" placeholder="John Smith" />
              </div>
              <div>
                <label className="field-label">Email</label>
                <input type="email" value={form.sender_email} onChange={(e) => set("sender_email", e.target.value)}
                  className="field-input" placeholder="john@example.com" />
              </div>
            </div>
            <div>
              <label className="field-label">Phone</label>
              <input value={form.sender_phone} onChange={(e) => set("sender_phone", e.target.value)}
                className="field-input" placeholder="+1 (555) 000-0000" />
            </div>
            <div>
              <label className="field-label">Full Address</label>
              <input value={form.sender_address} onChange={(e) => set("sender_address", e.target.value)}
                className="field-input" placeholder="123 Main St, City, State ZIP" />
            </div>
          </>}

          {modalTab === "receiver" && <>
            <p className="text-[10px] text-white/30">Who will receive this shipment?</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Full Name</label>
                <input value={form.receiver_name} onChange={(e) => set("receiver_name", e.target.value)}
                  className="field-input" placeholder="Jane Doe" />
              </div>
              <div>
                <label className="field-label">Email</label>
                <input type="email" value={form.receiver_email} onChange={(e) => set("receiver_email", e.target.value)}
                  className="field-input" placeholder="jane@example.com" />
              </div>
            </div>
            <div>
              <label className="field-label">Phone</label>
              <input value={form.receiver_phone} onChange={(e) => set("receiver_phone", e.target.value)}
                className="field-input" placeholder="+1 (555) 000-0000" />
            </div>
            <div>
              <label className="field-label">Delivery Address</label>
              <input value={form.receiver_address} onChange={(e) => set("receiver_address", e.target.value)}
                className="field-input" placeholder="456 Oak Ave, City, State ZIP" />
            </div>
          </>}

          {modalTab === "events" && <>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-white/30">Status updates shown on the tracking timeline</p>
              <button onClick={() => set("events", [...form.events, { time_label: "", label: "", location: "", done: false, sort_order: form.events.length }])}
                className="text-[10px] text-white/30 hover:text-white/60 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {form.events.map((ev, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="checkbox" checked={ev.done}
                    onChange={(e) => { const evs = [...form.events]; evs[i] = { ...evs[i], done: e.target.checked }; set("events", evs); }}
                    className="flex-shrink-0 accent-red-600" />
                  <input value={ev.label}
                    onChange={(e) => { const evs = [...form.events]; evs[i] = { ...evs[i], label: e.target.value }; set("events", evs); }}
                    placeholder="Event label" className="field-input flex-1 text-[11px] py-1.5" />
                  <input value={ev.location}
                    onChange={(e) => { const evs = [...form.events]; evs[i] = { ...evs[i], location: e.target.value }; set("events", evs); }}
                    placeholder="Location" className="field-input w-28 text-[11px] py-1.5" />
                  <input value={ev.time_label}
                    onChange={(e) => { const evs = [...form.events]; evs[i] = { ...evs[i], time_label: e.target.value }; set("events", evs); }}
                    placeholder="Time" className="field-input w-20 text-[11px] py-1.5" />
                  <button onClick={() => set("events", form.events.filter((_, j) => j !== i))}
                    className="text-white/15 hover:text-red-400 transition-colors flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>}

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-white/8 flex items-center justify-between flex-shrink-0">
          <div className="flex gap-2">
            {TABS.map((t, i) => (
              <button key={t.id} onClick={() => setModalTab(t.id)}
                className={`w-2 h-2 rounded-full transition-all ${modalTab === t.id ? "bg-red-500" : "bg-white/15"}`} />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-xs text-white/40 hover:text-white/70 transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-medium transition-all">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {loading ? "Creating…" : "Create Shipment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ packages, onCreateNew, onRefresh, loading, onNavigate }: {
  packages: Pkg[]; onCreateNew: () => void; onRefresh: () => void; loading: boolean;
  onNavigate: (tab: AdminTab) => void;
}) {
  const total = packages.length;
  const inTransit = packages.filter((p) => p.status === "In Transit").length;
  const delivered = packages.filter((p) => p.status === "Delivered").length;
  const revenue = packages.reduce((s, p) => s + Number(p.shipping_cost || 0), 0);
  const pending = packages.filter((p) => !["Delivered"].includes(p.status)).length;

  const STATS = [
    { label: "Total Shipments", value: total, icon: Package, color: "text-white/70", bg: "bg-white/5 border-white/8" },
    { label: "In Transit", value: inTransit, icon: Truck, color: "text-blue-400", bg: "bg-blue-500/8 border-blue-500/15" },
    { label: "Delivered", value: delivered, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/8 border-green-500/15" },
    { label: "Active", value: pending, icon: Clock, color: "text-orange-400", bg: "bg-orange-500/8 border-orange-500/15" },
    { label: "Total Revenue", value: `$${revenue.toFixed(2)}`, icon: DollarSign, color: "text-red-400", bg: "bg-red-500/8 border-red-500/15" },
  ];

  const DELIVERY_METHODS = ["Standard","Express","Priority","Same-Day","Economy"];
  const methodCounts = DELIVERY_METHODS.map((m) => ({
    method: m,
    count: packages.filter((p) => (p.delivery_method || "Standard") === m).length,
  }));
  const maxCount = Math.max(...methodCounts.map((m) => m.count), 1);

  const TECH = [
    { name: "React 19", color: "bg-blue-500/20 text-blue-300 border-blue-500/20" },
    { name: "Node.js 24", color: "bg-green-500/20 text-green-300 border-green-500/20" },
    { name: "PostgreSQL", color: "bg-blue-400/20 text-blue-200 border-blue-400/20" },
    { name: "TypeScript", color: "bg-blue-600/20 text-blue-200 border-blue-600/20" },
    { name: "Vite 7", color: "bg-purple-500/20 text-purple-300 border-purple-500/20" },
    { name: "Leaflet", color: "bg-green-400/20 text-green-200 border-green-400/20" },
    { name: "Tailwind CSS", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/20" },
    { name: "Express 5", color: "bg-gray-500/20 text-gray-300 border-gray-500/20" },
    { name: "Alerts Service", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/20" },
    { name: "Real-time GPS", color: "bg-red-500/20 text-red-300 border-red-500/20" },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {STATS.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-xl border p-4 ${bg}`}>
            <Icon className={`w-4 h-4 mb-2 ${color}`} />
            <div className={`text-2xl font-bold mb-0.5 ${color}`}>{value}</div>
            <div className="text-[9px] text-white/25 uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Delivery method breakdown */}
        <div className="bg-[#111] border border-white/6 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-white/30" />
            <span className="text-sm font-medium text-white/70">Delivery Statistics</span>
          </div>
          {total === 0 ? (
            <p className="text-xs text-white/20 py-4 text-center">No shipments yet</p>
          ) : (
            <div className="space-y-3">
              {methodCounts.map(({ method, count }) => (
                <div key={method} className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/40">{method}</span>
                    <span className="text-white/25 font-mono">{count}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-red-600/60 rounded-full transition-all duration-700"
                      style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-[#111] border border-white/6 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-white/30" />
            <span className="text-sm font-medium text-white/70">Recent Activity</span>
          </div>
          {packages.length === 0 ? (
            <p className="text-xs text-white/20 py-4 text-center">No recent activity</p>
          ) : (
            <div className="space-y-2.5 max-h-48 overflow-y-auto">
              {packages.slice(0, 6).map((pkg) => (
                <div key={pkg.code} className="flex items-center gap-3 py-1.5 border-b border-white/4 last:border-0">
                  <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <Package className="w-3.5 h-3.5 text-red-400/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-mono text-white/60 truncate">{pkg.code}</div>
                    <div className="text-[9px] text-white/25">{pkg.origin} → {pkg.destination}</div>
                  </div>
                  <StatusBadge status={pkg.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-[#111] border border-white/6 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-white/30" />
          <span className="text-sm font-medium text-white/70">Notifications</span>
        </div>
        <div className="space-y-2">
          {packages.filter((p) => p.status === "Out for Delivery").length > 0 && (
            <div className="flex items-start gap-3 p-3 bg-orange-500/8 border border-orange-500/15 rounded-lg">
              <Truck className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-medium text-orange-300">Deliveries In Progress</div>
                <div className="text-[10px] text-orange-400/60">{packages.filter((p) => p.status === "Out for Delivery").length} shipment(s) out for delivery</div>
              </div>
            </div>
          )}
          {packages.filter((p) => p.customs_status === "Held").length > 0 && (
            <div className="flex items-start gap-3 p-3 bg-red-500/8 border border-red-500/15 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-medium text-red-300">Customs Alert</div>
                <div className="text-[10px] text-red-400/60">{packages.filter((p) => p.customs_status === "Held").length} shipment(s) held at customs</div>
              </div>
            </div>
          )}
          {packages.filter((p) => p.customs_status === "In Review").length > 0 && (
            <div className="flex items-start gap-3 p-3 bg-yellow-500/8 border border-yellow-500/15 rounded-lg">
              <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-medium text-yellow-300">Customs Review</div>
                <div className="text-[10px] text-yellow-400/60">{packages.filter((p) => p.customs_status === "In Review").length} shipment(s) under customs review</div>
              </div>
            </div>
          )}
          {packages.length === 0 && (
            <div className="text-xs text-white/20 text-center py-3">No notifications</div>
          )}
          {packages.length > 0 && packages.every((p) => p.status === "Delivered") && (
            <div className="flex items-start gap-3 p-3 bg-green-500/8 border border-green-500/15 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-medium text-green-300">All Delivered</div>
                <div className="text-[10px] text-green-400/60">All shipments have been delivered</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Technology stack */}
      <div className="bg-[#111] border border-white/6 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-white/30" />
          <span className="text-sm font-medium text-white/70">Technology Stack</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {TECH.map(({ name, color }) => (
            <span key={name} className={`text-[10px] px-2.5 py-1 rounded-full border font-medium ${color}`}>{name}</span>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "New Shipment", icon: Plus, action: onCreateNew, primary: true },
          { label: "Refresh Data", icon: RefreshCw, action: onRefresh, primary: false },
          { label: "GPS Tracking", icon: Globe, action: () => onNavigate("shipments"), primary: false },
          { label: "Notifications", icon: Bell, action: () => onNavigate("support"), primary: false },
        ].map(({ label, icon: Icon, action, primary }) => (
          <button key={label} onClick={action}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-medium transition-all ${
              primary ? "bg-red-600 hover:bg-red-500 border-red-500 text-white" : "bg-white/3 hover:bg-white/6 border-white/8 text-white/50 hover:text-white/80"
            }`}>
            <Icon className={`w-3.5 h-3.5 ${loading && label === "Refresh Data" ? "animate-spin" : ""}`} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Shipments Tab ────────────────────────────────────────────────────────────

function ShipmentsTab({ packages, token, loading, onRefresh, onTrack, onCreateNew, showToast }: {
  packages: Pkg[]; token: string; loading: boolean;
  onRefresh: () => void; onTrack: (c: string) => void;
  onCreateNew: () => void; showToast: (msg: string, type?: "ok" | "err") => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [viewPkg, setViewPkg] = useState<Pkg | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  const filtered = packages.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.code.toLowerCase().includes(q) || (p.sender_name || "").toLowerCase().includes(q) || (p.receiver_name || "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "All" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleDelete = async (code: string) => {
    if (!confirm(`Delete ${code}? This cannot be undone.`)) return;
    setDeletingCode(code);
    const result = await adminDeletePackage(token, code);
    setDeletingCode(null);
    if (result.success) { showToast(`${code} deleted`); onRefresh(); }
    else showToast(result.error ?? "Delete failed", "err");
  };

  const handleStatusChange = async (code: string, status: string) => {
    await adminUpdatePackage(token, code, { status } as Parameters<typeof adminUpdatePackage>[2]);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, sender, receiver…"
              className="w-full bg-white/4 border border-white/8 rounded-lg pl-8 pr-3 py-2 text-xs text-white/70 placeholder-white/20 outline-none focus:border-white/20" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/4 border border-white/8 rounded-lg px-3 py-2 text-xs text-white/50 outline-none">
            {["All","Processing","In Transit","Customs Clearance","Out for Delivery","Delivered"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-all">
            <Plus className="w-3.5 h-3.5" /> New Shipment
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#111] border border-white/6 rounded-2xl overflow-hidden">
        {loading && packages.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-white/20">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="w-8 h-8 text-white/8 mb-3" />
            <p className="text-sm text-white/25">{packages.length === 0 ? "No shipments yet" : "No results"}</p>
            {packages.length === 0 && (
              <button onClick={onCreateNew}
                className="mt-4 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Create first shipment
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {["Tracking #","Status","Route","Sender","Receiver","Method","Cost","Subscribers","Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[9px] text-white/20 uppercase tracking-widest font-normal whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {filtered.map((pkg) => (
                  <tr key={pkg.code} className="hover:bg-white/2 transition-colors group">
                    <td className="px-4 py-3.5">
                      <code className="text-xs font-mono text-white/70">{pkg.code}</code>
                    </td>
                    <td className="px-4 py-3.5">
                      <select value={pkg.status} onChange={(e) => handleStatusChange(pkg.code, e.target.value)}
                        className="bg-transparent text-[10px] text-white/50 border border-white/8 rounded-md px-2 py-1 outline-none hover:border-white/20 cursor-pointer">
                        {["Processing","In Transit","Customs Clearance","Out for Delivery","Delivered"].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-white/35">{pkg.origin} → {pkg.destination}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs text-white/50">{pkg.sender_name || "—"}</div>
                      {pkg.sender_email && <div className="text-[9px] text-white/25">{pkg.sender_email}</div>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs text-white/50">{pkg.receiver_name || "—"}</div>
                      {pkg.receiver_email && <div className="text-[9px] text-white/25">{pkg.receiver_email}</div>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-[10px] text-white/35">{pkg.delivery_method || "Standard"}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-white/50 font-mono">${Number(pkg.shipping_cost || 0).toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-white/30">{pkg.subscriber_count ?? 0}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setViewPkg(pkg)}
                          className="flex items-center gap-1 text-[10px] text-white/30 hover:text-purple-400 transition-colors">
                          <Eye className="w-3 h-3" /> View
                        </button>
                        <button onClick={() => onTrack(pkg.code)}
                          className="flex items-center gap-1 text-[10px] text-white/30 hover:text-blue-400 transition-colors">
                          <Globe className="w-3 h-3" /> Track
                        </button>
                        <button onClick={() => handleDelete(pkg.code)} disabled={deletingCode === pkg.code}
                          className="flex items-center gap-1 text-[10px] text-white/30 hover:text-red-400 transition-colors disabled:opacity-50">
                          {deletingCode === pkg.code ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewPkg && <ShipmentDetailModal pkg={viewPkg} onClose={() => setViewPkg(null)} onTrack={(c) => { setViewPkg(null); onTrack(c); }} />}
    </div>
  );
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────

function printInvoice(pkg: Pkg, invNum: string, isPaid: boolean) {
  const amount = Number(pkg.shipping_cost || 0).toFixed(2);
  const html = `<!DOCTYPE html><html><head><title>${invNum}</title>
  <style>body{font-family:Arial,sans-serif;color:#111;padding:40px;max-width:700px;margin:0 auto}
  h1{font-size:28px;font-weight:700;margin-bottom:4px}
  .sub{color:#666;font-size:14px;margin-bottom:32px}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;font-size:14px}
  .label{color:#666}.value{font-weight:600}
  .badge{display:inline-block;padding:4px 12px;border-radius:100px;font-size:12px;font-weight:600;
    background:${isPaid ? "#dcfce7" : "#fef9c3"};color:${isPaid ? "#15803d" : "#a16207"}}
  .total{font-size:22px;font-weight:700;color:#111;margin-top:24px}
  .footer{color:#999;font-size:11px;margin-top:48px;border-top:1px solid #eee;padding-top:16px}
  @media print{button{display:none}}</style></head>
  <body>
  <h1>TeslaTrack</h1>
  <div class="sub">Shipping Invoice</div>
  <div style="display:flex;justify-content:space-between;margin-bottom:24px">
    <div><div style="font-size:20px;font-weight:700">${invNum}</div><div style="color:#666;font-size:13px">Ref: ${pkg.code}</div></div>
    <div class="badge">${isPaid ? "PAID" : "PENDING"}</div>
  </div>
  <div class="row"><span class="label">Tracking Code</span><span class="value" style="font-family:monospace">${pkg.code}</span></div>
  <div class="row"><span class="label">From</span><span class="value">${pkg.origin}</span></div>
  <div class="row"><span class="label">To</span><span class="value">${pkg.destination}</span></div>
  ${pkg.sender_name ? `<div class="row"><span class="label">Sender</span><span class="value">${pkg.sender_name}</span></div>` : ""}
  ${pkg.receiver_name ? `<div class="row"><span class="label">Recipient</span><span class="value">${pkg.receiver_name}</span></div>` : ""}
  <div class="row"><span class="label">Delivery Method</span><span class="value">${pkg.delivery_method || "Standard"}</span></div>
  <div class="row"><span class="label">Status</span><span class="value">${pkg.status}</span></div>
  <div class="row"><span class="label">ETA</span><span class="value">${pkg.eta || "—"}</span></div>
  <div class="total">Total: $${amount}</div>
  <div style="margin-top:8px"><button onclick="window.print()" style="padding:10px 24px;background:#111;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer">Print / Save PDF</button></div>
  <div class="footer">TeslaTrack Logistics · Generated ${new Date().toLocaleDateString()}</div>
  </body></html>`;

  try {
    const win = window.open("", "_blank", "width=800,height=600");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 400);
      return;
    }
  } catch {}

  const printIframe = document.createElement("iframe");
  printIframe.style.position = "fixed";
  printIframe.style.right = "0";
  printIframe.style.bottom = "0";
  printIframe.style.width = "0";
  printIframe.style.height = "0";
  printIframe.style.border = "0";
  document.body.appendChild(printIframe);
  const docObj = printIframe.contentWindow?.document;
  if (docObj) {
    docObj.open();
    docObj.write(html);
    docObj.close();
    printIframe.contentWindow?.focus();
    setTimeout(() => {
      printIframe.contentWindow?.print();
      setTimeout(() => { if (document.body.contains(printIframe)) document.body.removeChild(printIframe); }, 1000);
    }, 500);
  }
}

function PaymentsTab({ packages }: { packages: Pkg[] }) {
  const total = packages.reduce((s, p) => s + Number(p.shipping_cost || 0), 0);
  const paid = packages.filter((p) => p.status === "Delivered").reduce((s, p) => s + Number(p.shipping_cost || 0), 0);
  const pending = total - paid;

  const PAYMENT_METHODS = [
    { name: "Credit Card", icon: CreditCard, desc: "Visa, Mastercard, Amex", status: "Active" },
    { name: "Bank Transfer", icon: DollarSign, desc: "ACH / Wire transfer", status: "Active" },
    { name: "PayPal", icon: Globe, desc: "PayPal account", status: "Active" },
    { name: "Crypto", icon: Zap, desc: "Bitcoin, Ethereum", status: "Coming soon" },
  ];

  return (
    <div className="space-y-5">
      {/* Revenue summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Revenue", value: `$${total.toFixed(2)}`, color: "text-white/80", bg: "bg-white/4 border-white/8" },
          { label: "Collected", value: `$${paid.toFixed(2)}`, color: "text-green-400", bg: "bg-green-500/8 border-green-500/15" },
          { label: "Pending", value: `$${pending.toFixed(2)}`, color: "text-yellow-400", bg: "bg-yellow-500/8 border-yellow-500/15" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-xl border p-4 ${bg}`}>
            <div className={`text-2xl font-bold mb-1 ${color}`}>{value}</div>
            <div className="text-[9px] text-white/25 uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </div>

      {/* Invoices */}
      <div className="bg-[#111] border border-white/6 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-white/30" />
          <span className="text-sm font-medium text-white/70">Invoices</span>
          <span className="text-xs text-white/20">({packages.length})</span>
        </div>
        {packages.length === 0 ? (
          <div className="py-12 text-center text-xs text-white/20">No invoices yet</div>
        ) : (
          <div className="divide-y divide-white/4">
            {packages.map((pkg, i) => {
              const isPaid = pkg.status === "Delivered";
              const invNum = `INV-${String(i + 1001).padStart(4, "0")}`;
              return (
                <div key={pkg.code} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-white/2 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white/4 border border-white/8 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-3.5 h-3.5 text-white/30" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-white/60">{invNum}</div>
                      <div className="text-[10px] text-white/30 truncate">{pkg.code} · {pkg.receiver_name || pkg.destination}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="text-sm font-semibold text-white/70 font-mono">${Number(pkg.shipping_cost || 0).toFixed(2)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${isPaid ? "text-green-400 bg-green-500/10 border-green-500/25" : "text-yellow-400 bg-yellow-500/10 border-yellow-500/25"}`}>
                      {isPaid ? "Paid" : "Pending"}
                    </span>
                    <button
                      onClick={() => printInvoice(pkg, invNum, isPaid)}
                      className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/60 transition-colors">
                      <Download className="w-3 h-3" /> PDF
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment methods */}
      <div className="bg-[#111] border border-white/6 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-white/30" />
          <span className="text-sm font-medium text-white/70">Payment Methods</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PAYMENT_METHODS.map(({ name, icon: Icon, desc, status }) => (
            <div key={name} className="flex items-center gap-3 p-3 bg-white/3 rounded-xl border border-white/6">
              <div className="w-8 h-8 rounded-lg bg-white/6 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-white/40" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-white/60 font-medium">{name}</div>
                <div className="text-[9px] text-white/25">{desc}</div>
              </div>
              <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${status === "Active" ? "text-green-400 bg-green-500/10" : "text-white/25 bg-white/5"}`}>{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Customs Tab ──────────────────────────────────────────────────────────────

function CustomsTab({ packages }: { packages: Pkg[] }) {
  const cleared = packages.filter((p) => p.customs_status === "Cleared").length;
  const held = packages.filter((p) => p.customs_status === "Held").length;
  const inReview = packages.filter((p) => p.customs_status === "In Review").length;
  const pending = packages.filter((p) => p.customs_status === "Pending").length;
  const totalFees = packages.reduce((s, p) => s + Number(p.customs_fee || 0), 0);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDoc, setPendingDoc] = useState<string | null>(null);

  const handleUploadClick = (docName: string) => {
    setPendingDoc(docName);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingDoc) {
      setUploadedDocs((prev) => ({ ...prev, [pendingDoc]: file.name }));
    }
    e.target.value = "";
    setPendingDoc(null);
  };

  const DOCS = [
    { name: "Commercial Invoice", desc: "Value declaration form", required: true },
    { name: "Packing List", desc: "Contents itemization", required: true },
    { name: "Certificate of Origin", desc: "Country of manufacture", required: false },
    { name: "Bill of Lading", desc: "Transport document", required: true },
    { name: "Import License", desc: "If applicable", required: false },
  ];

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[
          { label: "Cleared", value: cleared, color: "text-green-400 bg-green-500/8 border-green-500/15" },
          { label: "In Review", value: inReview, color: "text-yellow-400 bg-yellow-500/8 border-yellow-500/15" },
          { label: "Held", value: held, color: "text-red-400 bg-red-500/8 border-red-500/15" },
          { label: "Pending", value: pending, color: "text-white/40 bg-white/4 border-white/8" },
          { label: "Total Fees", value: `$${totalFees.toFixed(2)}`, color: "text-orange-400 bg-orange-500/8 border-orange-500/15" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl border p-3.5 ${color.split(" ").slice(1).join(" ")}`}>
            <div className={`text-xl font-bold mb-0.5 ${color.split(" ")[0]}`}>{value}</div>
            <div className="text-[9px] text-white/25 uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </div>

      {/* Per-shipment customs */}
      <div className="bg-[#111] border border-white/6 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-white/30" />
          <span className="text-sm font-medium text-white/70">Clearance Status per Shipment</span>
        </div>
        {packages.length === 0 ? (
          <div className="py-12 text-center text-xs text-white/20">No shipments</div>
        ) : (
          <div className="divide-y divide-white/4">
            {packages.map((pkg) => (
              <div key={pkg.code} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <code className="text-xs font-mono text-white/60">{pkg.code}</code>
                  <div className="text-[10px] text-white/30 mt-0.5">{pkg.origin} → {pkg.destination}</div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-white/40 font-mono">${Number(pkg.customs_fee || 0).toFixed(2)}</div>
                    <div className="text-[9px] text-white/20">Fee</div>
                  </div>
                  <CustomsBadge status={pkg.customs_status || "Pending"} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Required documents */}
      <div className="bg-[#111] border border-white/6 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-white/30" />
          <span className="text-sm font-medium text-white/70">Required Customs Documents</span>
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.png" className="hidden" onChange={handleFileChange} />
        <div className="space-y-2">
          {DOCS.map(({ name, desc, required }) => (
            <div key={name} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
              uploadedDocs[name] ? "bg-green-500/5 border-green-500/20" : "bg-white/3 border-white/5"
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${uploadedDocs[name] ? "text-green-400" : "text-white/25"}`} />
                <div className="min-w-0">
                  <div className="text-xs text-white/60">{name}</div>
                  {uploadedDocs[name]
                    ? <div className="text-[9px] text-green-400/70 truncate max-w-[160px]">{uploadedDocs[name]}</div>
                    : <div className="text-[9px] text-white/25">{desc}</div>
                  }
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {required && !uploadedDocs[name] && <span className="text-[9px] text-red-400/70 bg-red-500/8 px-1.5 py-0.5 rounded-full">Required</span>}
                {uploadedDocs[name]
                  ? <span className="text-[9px] text-green-400 bg-green-500/10 border border-green-500/25 px-2 py-0.5 rounded-full">✓ Uploaded</span>
                  : <button
                      onClick={() => handleUploadClick(name)}
                      className="text-[10px] text-white/25 hover:text-white/60 border border-white/10 hover:border-white/25 rounded px-2 py-0.5 transition-colors">
                      Upload
                    </button>
                }
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Support Tab ──────────────────────────────────────────────────────────────

function SupportTab() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const FAQS = [
    { q: "How do I track my shipment?", a: "Enter your tracking code on the home page or use a direct URL like /?code=YOUR-CODE. Real-time updates appear on the live map." },
    { q: "How long until my package arrives?", a: "ETA is shown on your tracking page. Updates are made as the shipment progresses through each stage." },
    { q: "What do the status stages mean?", a: "Order Received → Processing → In Transit → Customs Clearance → Out for Delivery → Delivered. Each stage is updated in real time." },
    { q: "How do I get email alerts?", a: "On the tracking screen, open the side drawer and click the Alerts tab. Enter your email to receive delivery updates." },
    { q: "How are customs fees calculated?", a: "Customs fees depend on the shipment value, contents, and destination country regulations. They are set per shipment in the admin portal." },
    { q: "Can I change my delivery address?", a: "Contact support immediately with your tracking code. Changes may be possible if the shipment hasn't left the origin warehouse." },
  ];

  const CONTACTS = [
    { icon: Mail, label: "Email Support", value: "support@teslatrack.io", action: "mailto:support@teslatrack.io" },
    { icon: Phone, label: "Phone", value: "+1 (800) TESLA-01", action: "tel:+18008375201" },
    { icon: Globe, label: "Help Center", value: "help.teslatrack.io", action: "#" },
    { icon: MessageSquare, label: "Live Chat", value: "Available 24/7", action: "#" },
  ];

  return (
    <div className="space-y-5">
      {/* Contact options */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CONTACTS.map(({ icon: Icon, label, value, action }) => (
          <a key={label} href={action}
            className="flex flex-col items-center gap-2 p-4 bg-[#111] border border-white/6 rounded-2xl hover:border-white/15 transition-all text-center group">
            <div className="w-9 h-9 rounded-xl bg-red-500/12 flex items-center justify-center group-hover:bg-red-500/20 transition-all">
              <Icon className="w-4 h-4 text-red-400/70" />
            </div>
            <div className="text-xs font-medium text-white/60">{label}</div>
            <div className="text-[9px] text-white/30">{value}</div>
          </a>
        ))}
      </div>

      {/* FAQ */}
      <div className="bg-[#111] border border-white/6 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-white/30" />
          <span className="text-sm font-medium text-white/70">Frequently Asked Questions</span>
        </div>
        <div className="divide-y divide-white/4">
          {FAQS.map((faq, i) => (
            <div key={i}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/2 transition-colors">
                <span className="text-xs text-white/65 pr-4">{faq.q}</span>
                {openFaq === i ? <ChevronUp className="w-3.5 h-3.5 text-white/25 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />}
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4">
                  <p className="text-[11px] text-white/35 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contact form */}
      <div className="bg-[#111] border border-white/6 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Send className="w-4 h-4 text-white/30" />
          <span className="text-sm font-medium text-white/70">Send a Message</span>
        </div>
        {submitted ? (
          <div className="flex items-center gap-3 py-4 text-green-300">
            <CheckCircle2 className="w-5 h-5" />
            <div>
              <div className="text-sm font-medium">Message sent!</div>
              <div className="text-xs text-green-400/60">We'll respond within 24 hours.</div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Name</label>
                <input value={contactForm.name} onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Your name" className="field-input" />
              </div>
              <div>
                <label className="field-label">Email</label>
                <input type="email" value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="your@email.com" className="field-input" />
              </div>
            </div>
            <div>
              <label className="field-label">Message</label>
              <textarea value={contactForm.message} onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="How can we help?" rows={4}
                className="field-input resize-none" />
            </div>
            <button onClick={() => setSubmitted(true)} disabled={!contactForm.name || !contactForm.email || !contactForm.message}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white text-xs font-medium transition-all">
              <Send className="w-3.5 h-3.5" /> Send Message
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ onLogout }: { onLogout: () => void }) {
  const [smtpStatus, setSmtpStatus] = useState<{ configured: boolean; user: string | null; verified?: boolean; message?: string } | null>(null);
  const [checkingSmtp, setCheckingSmtp] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  const loadSmtp = useCallback(async () => {
    setCheckingSmtp(true);
    const res = await checkSmtpStatus();
    setSmtpStatus(res);
    setCheckingSmtp(false);
  }, []);

  useEffect(() => {
    loadSmtp();
  }, [loadSmtp]);

  const handleSendTest = async () => {
    if (!testEmail || !testEmail.includes("@")) return;
    setSendingTest(true);
    setTestResult(null);
    const res = await sendTestSmtpEmail(testEmail);
    setSendingTest(false);
    if (res.success) {
      setTestResult({ success: true, msg: `Test email sent successfully! (ID: ${res.messageId})` });
    } else {
      setTestResult({ success: false, msg: res.error || "Failed to dispatch test email." });
    }
  };

  const FEATURES = [
    { icon: Mail, label: "Gmail SMTP Relay", desc: "Automated shipment status and delivery completion emails via Gmail", status: smtpStatus?.configured ? "Active" : "Ready" },
    { icon: Shield, label: "Admin Authentication", desc: "Password-protected admin portal with session storage", status: "Active" },
    { icon: Lock, label: "SSL / HTTPS Encryption", desc: "All data transmitted over encrypted connections", status: "Active" },
    { icon: Wifi, label: "Real-time GPS Tracking", desc: "Live vehicle position simulation with bearing & speed", status: "Active" },
    { icon: Globe, label: "CARTO Maps & GIS API", desc: "CARTO GCP US-East1 endpoint integration (gcp-us-east1.api.carto.com)", status: "Active" },
    { icon: Bell, label: "Push Notifications", desc: "Automated subscriber alerts on delivery status milestones", status: "Active" },
    { icon: QrCode, label: "QR Code Tracking", desc: "Deep-link URLs for instant tracking access", status: "Active" },
    { icon: Globe, label: "Multi-language Support", desc: "Interface localization for global shipments", status: "Planned" },
    { icon: Star, label: "Delivery Proof Upload", desc: "Photo confirmation on successful delivery", status: "Planned" },
    { icon: Languages, label: "Dark Mode", desc: "Full dark-themed interface throughout", status: "Active" },
  ];

  const COMMON_PAGES = [
    { name: "Home / Tracker", path: "/", desc: "Public tracking search" },
    { name: "Live Tracking", path: "/?code=XXX", desc: "Real-time shipment map" },
    { name: "Admin Dashboard", path: "/admin", desc: "Shipment management" },
    { name: "About", path: "#", desc: "Company information" },
    { name: "Pricing", path: "#", desc: "Shipping rates" },
    { name: "Contact", path: "#", desc: "Get in touch" },
  ];

  return (
    <div className="space-y-5">
      {/* Security features */}
      <div className="bg-[#111] border border-white/6 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-white/30" />
          <span className="text-sm font-medium text-white/70">Security & Premium Features</span>
        </div>
        <div className="space-y-2">
          {FEATURES.map(({ icon: Icon, label, desc, status }) => (
            <div key={label} className="flex items-center gap-3 p-3 bg-white/2 rounded-xl border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-white/35" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white/65 font-medium">{label}</div>
                <div className="text-[9px] text-white/30">{desc}</div>
              </div>
              <span className={`text-[9px] px-2 py-0.5 rounded-full flex-shrink-0 ${status === "Active" ? "text-green-400 bg-green-500/10 border border-green-500/20" : "text-white/25 bg-white/5 border border-white/8"}`}>
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Gmail SMTP Relay Management */}
      <div className="bg-[#111] border border-white/6 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-white/90">Gmail SMTP Dispatch Relay</span>
          </div>
          <button
            onClick={loadSmtp}
            disabled={checkingSmtp}
            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/70 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${checkingSmtp ? "animate-spin" : ""}`} />
            <span>Re-check</span>
          </button>
        </div>

        <div className="p-3.5 bg-white/2 rounded-xl border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white/80">SMTP Connection Status</div>
              <div className="text-[10px] text-white/40 mt-0.5">
                {smtpStatus?.configured
                  ? `Configured via ${smtpStatus.user || "Gmail Account"}`
                  : "Not configured in environment variables"}
              </div>
            </div>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border ${
              smtpStatus?.configured
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                : "bg-amber-500/15 border-amber-500/30 text-amber-300"
            }`}>
              {smtpStatus?.configured ? "CONNECTED" : "CREDENTIALS PENDING"}
            </span>
          </div>

          {smtpStatus?.message && (
            <div className="text-[10px] p-2.5 rounded-lg bg-black/40 border border-white/5 text-white/50 font-mono">
              {smtpStatus.message}
            </div>
          )}

          {/* Test Email Dispatch */}
          <div className="pt-2 border-t border-white/6">
            <div className="text-[10px] text-white/50 mb-2 uppercase tracking-wider font-semibold">
              Dispatch Verification Test
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => {
                  setTestEmail(e.target.value);
                  setTestResult(null);
                }}
                placeholder="recipient@example.com"
                disabled={sendingTest || !smtpStatus?.configured}
                className="flex-1 bg-white/4 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/50 disabled:opacity-40"
              />
              <button
                onClick={handleSendTest}
                disabled={!testEmail.includes("@") || sendingTest || !smtpStatus?.configured}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white text-xs font-medium transition-all flex items-center gap-1.5"
              >
                {sendingTest ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                <span>Send Test</span>
              </button>
            </div>

            {testResult && (
              <div className={`mt-2 p-2 rounded-lg text-[10px] border flex items-center gap-1.5 ${
                testResult.success
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                  : "bg-red-500/10 border-red-500/25 text-red-300"
              }`}>
                {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                <span>{testResult.msg}</span>
              </div>
            )}

            {!smtpStatus?.configured && (
              <p className="text-[10px] text-white/35 mt-2 leading-relaxed">
                To activate Gmail SMTP for live shipment alerts, add <code className="text-red-400 bg-white/5 px-1 py-0.5 rounded">GMAIL_USER</code> (your Gmail address) and <code className="text-red-400 bg-white/5 px-1 py-0.5 rounded">GMAIL_APP_PASSWORD</code> (a 16-character Google App Password from your Google Account security settings) to the environment variables.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Site pages */}
      <div className="bg-[#111] border border-white/6 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-white/30" />
          <span className="text-sm font-medium text-white/70">Site Pages</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {COMMON_PAGES.map(({ name, path, desc }) => (
            <a key={name} href={path}
              className="p-3 bg-white/3 rounded-lg border border-white/5 hover:border-white/15 transition-all">
              <div className="text-xs text-white/60 font-medium">{name}</div>
              <div className="text-[9px] text-white/25 mt-0.5">{desc}</div>
            </a>
          ))}
        </div>
      </div>

      {/* Admin account */}
      <div className="bg-[#111] border border-white/6 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-white/30" />
          <span className="text-sm font-medium text-white/70">Admin Account</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-white/3 rounded-lg border border-white/5">
            <div>
              <div className="text-xs text-white/60">Session Status</div>
              <div className="text-[10px] text-green-400/70 mt-0.5">Authenticated · Session active</div>
            </div>
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
          <button onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-600/30 text-red-400 hover:bg-red-600/10 text-sm font-medium transition-all">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      {/* Footer info */}
      <div className="bg-[#0d0d0d] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[10px]">
          <div>
            <div className="text-white/25 mb-1.5 uppercase tracking-wider text-[9px]">Company</div>
            <div className="text-white/40">TeslaTrack Inc.</div>
            <div className="text-white/25">1 Tesla Road</div>
            <div className="text-white/25">Palo Alto, CA 94301</div>
          </div>
          <div>
            <div className="text-white/25 mb-1.5 uppercase tracking-wider text-[9px]">Legal</div>
            <a href="#" className="block text-white/35 hover:text-white/60 mb-1">Terms & Conditions</a>
            <a href="#" className="block text-white/35 hover:text-white/60 mb-1">Privacy Policy</a>
            <a href="#" className="block text-white/35 hover:text-white/60">Cookie Policy</a>
          </div>
          <div>
            <div className="text-white/25 mb-1.5 uppercase tracking-wider text-[9px]">Social</div>
            <a href="#" className="block text-white/35 hover:text-white/60 mb-1">Twitter / X</a>
            <a href="#" className="block text-white/35 hover:text-white/60 mb-1">LinkedIn</a>
            <a href="#" className="block text-white/35 hover:text-white/60">Instagram</a>
          </div>
          <div>
            <div className="text-white/25 mb-1.5 uppercase tracking-wider text-[9px]">Support</div>
            <div className="text-white/35">support@teslatrack.io</div>
            <div className="text-white/25 mt-1">Mon–Fri 9am–6pm PST</div>
            <div className="text-white/25">Emergency: 24/7</div>
          </div>
        </div>
        <div className="pt-3 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/tesla-logo.png" alt="TeslaTrack" className="logo-spin w-5 h-5 object-contain opacity-40" />
            <span className="text-[10px] text-white/25">Tesla<span className="text-red-500/50">Track</span> © 2026</span>
          </div>
          <span className="text-[9px] text-white/15">All rights reserved</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminPage({ onBack, onTrack }: { onBack: () => void; onTrack: (code: string) => void }) {
  const [token, setToken] = useState(() => sessionStorage.getItem("admin_token") ?? "");
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = (t: string) => { sessionStorage.setItem("admin_token", t); setToken(t); };
  const handleLogout = () => { sessionStorage.removeItem("admin_token"); setToken(""); };

  const loadPackages = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const list = await adminListPackages(token);
    setPackages(list);
    setLoading(false);
  }, [token]);

  useEffect(() => { loadPackages(); }, [loadPackages]);

  if (!token) return <LoginScreen onLogin={handleLogin} />;

  const NAV_ITEMS: { id: AdminTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "shipments", label: "Shipments", icon: Package },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "customs", label: "Customs", icon: Globe },
    { id: "support", label: "Support", icon: MessageSquare },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const TAB_LABELS: Record<AdminTab, string> = {
    dashboard: "Dashboard",
    shipments: "Shipments",
    payments: "Payments & Invoices",
    customs: "Customs & Clearance",
    support: "Support & FAQ",
    settings: "Settings & Security",
  };

  return (
    <div className="h-dvh bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-medium shadow-xl ${
          toast.type === "ok" ? "bg-green-600/15 border-green-500/30 text-green-300" : "bg-red-600/15 border-red-500/30 text-red-300"
        }`}>
          {toast.type === "ok" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {toast.msg}
        </div>
      )}

      {/* Top nav */}
      <nav className="border-b border-white/6 bg-[#0a0a0a] sticky top-0 z-40 flex-shrink-0">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1.5">
              ← Back
            </button>
            <div className="w-px h-4 bg-white/8" />
            <div className="flex items-center gap-2">
              <img src="/tesla-logo.png" alt="TeslaTrack" className="logo-spin w-8 h-8 object-contain" />
              <span className="text-xs font-semibold tracking-widest uppercase hidden sm:inline">
                Tesla<span className="text-red-500">Track</span>
                <span className="text-white/20 ml-2 font-normal">Admin</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:flex items-center gap-1.5 text-[10px] text-white/30">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {packages.length} shipments
            </span>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-all">
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Shipment</span>
            </button>
            <button onClick={handleLogout} className="text-white/25 hover:text-white/60 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <aside className="w-52 border-r border-white/6 bg-[#0d0d0d] flex-shrink-0 hidden md:flex flex-col py-4">
          <nav className="flex-1 px-2 space-y-0.5">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  tab === id ? "bg-red-600/15 text-red-300 border border-red-600/20" : "text-white/40 hover:text-white/70 hover:bg-white/4"
                }`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </nav>
          <div className="px-3 py-3 border-t border-white/6">
            <div className="flex items-center gap-2">
              <img src="/tesla-logo.png" alt="" className="logo-spin w-5 h-5 object-contain opacity-40" />
              <span className="text-[9px] text-white/20 uppercase tracking-widest">TeslaTrack</span>
            </div>
          </div>
        </aside>

        {/* Mobile bottom nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0d0d0d] border-t border-white/8 flex">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[9px] transition-all ${
                tab === id ? "text-red-400" : "text-white/30"
              }`}>
              <Icon className="w-4 h-4" />
              <span className="hidden">{label}</span>
            </button>
          ))}
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-lg font-semibold text-white/90">{TAB_LABELS[tab]}</h1>
                <p className="text-[10px] text-white/25 mt-0.5">
                  {tab === "dashboard" && "Overview of your logistics operations"}
                  {tab === "shipments" && `${packages.length} total shipments`}
                  {tab === "payments" && `$${packages.reduce((s, p) => s + Number(p.shipping_cost || 0), 0).toFixed(2)} total revenue`}
                  {tab === "customs" && `${packages.filter((p) => p.customs_status === "Held").length} held · ${packages.filter((p) => p.customs_status === "Cleared").length} cleared`}
                  {tab === "support" && "Help center and contact options"}
                  {tab === "settings" && "Security, features, and site pages"}
                </p>
              </div>
              <button onClick={loadPackages} disabled={loading} className="text-white/25 hover:text-white/60 transition-colors">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {tab === "dashboard" && (
              <DashboardTab packages={packages} onCreateNew={() => setShowCreate(true)} onRefresh={loadPackages} loading={loading} onNavigate={setTab} />
            )}
            {tab === "shipments" && (
              <ShipmentsTab packages={packages} token={token} loading={loading} onRefresh={loadPackages} onTrack={onTrack} onCreateNew={() => setShowCreate(true)} showToast={showToast} />
            )}
            {tab === "payments" && <PaymentsTab packages={packages} />}
            {tab === "customs" && <CustomsTab packages={packages} />}
            {tab === "support" && <SupportTab />}
            {tab === "settings" && <SettingsTab onLogout={handleLogout} />}
          </div>
        </main>
      </div>

      {showCreate && (
        <CreateModal token={token} onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); showToast("Shipment created!"); loadPackages(); }} />
      )}
    </div>
  );
}
