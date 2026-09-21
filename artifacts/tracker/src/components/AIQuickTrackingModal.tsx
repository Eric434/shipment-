import { useState } from "react";
import {
  Sparkles, Bot, Loader2, CheckCircle2, AlertCircle, X, MapPin, Truck,
  Clock, DollarSign, ArrowRight, Eye, Mail, RefreshCw, Send,
  User, ShieldCheck, Zap, Scale, Compass, ChevronDown, ChevronUp
} from "lucide-react";
import {
  adminAiQuickGenerate,
  adminAiQuickCreate,
  adminAiQuickAssist,
  type AiQuickTrackingPayload,
} from "@/lib/api";

interface AIQuickTrackingModalProps {
  token: string;
  onClose: () => void;
  onCreated: (code: string) => void;
  onTrack: (code: string) => void;
  onComposeEmail?: (code: string) => void;
}

const PRESETS = [
  {
    id: "model_y_seattle",
    label: "Model Y Delivery to Seattle",
    icon: "🚗",
    prompt: "Deliver a new 2026 Tesla Model Y Performance from Fremont Gigafactory to Seattle Service Center for customer handover to Michael Vance arriving tomorrow",
    badge: "Vehicle Handover",
  },
  {
    id: "megapack_austin",
    label: "Megapack 4680 Battery Cells",
    icon: "🔋",
    prompt: "Heavy autonomous freight transport of 4680 Megapack battery modules from Sparks Nevada Gigafactory to Austin Texas with hazmat escort, express priority",
    badge: "Hazardous Materials",
  },
  {
    id: "supercharger_miami",
    label: "Supercharger V4 Pedestals to Miami",
    icon: "⚡",
    prompt: "Urgent dispatch of 8x Supercharger V4 charging pedestals from Buffalo NY to Miami FL delivery depot for new hub opening",
    badge: "Infrastructure Rush",
  },
  {
    id: "cybertruck_chicago",
    label: "Cybertruck Foundation Series",
    icon: "🛻",
    prompt: "Enclosed hauler delivery of Cybertruck Cyberbeast to Chicago Downtown Delivery Center for VIP customer handover, departing today",
    badge: "VIP Enclosed",
  },
  {
    id: "customs_international",
    label: "International Model 3 (Customs Held)",
    icon: "🛃",
    prompt: "International container shipment of Model 3 Highland units arriving at Long Beach Port with customs clearance under formal review and documentation inspection",
    badge: "Customs Clearance",
  },
];

export function AIQuickTrackingModal({
  token,
  onClose,
  onCreated,
  onTrack,
  onComposeEmail,
}: AIQuickTrackingModalProps) {
  const [activeTab, setActiveTab] = useState<"generator" | "assistant">("generator");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<AiQuickTrackingPayload | null>(null);
  const [isAiPowered, setIsAiPowered] = useState<boolean | null>(null);
  const [showAdvancedEdit, setShowAdvancedEdit] = useState(false);

  // Assistant state
  const [assistantQuery, setAssistantQuery] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantHistory, setAssistantHistory] = useState<Array<{ role: "user" | "ai"; text: string }>>([
    {
      role: "ai",
      text: "Hello, Administrator. I am your TeslaTrack AI Logistics Assistant. Ask me to query fleet status, find delayed packages, or draft operational updates.",
    },
  ]);

  const handleGenerate = async (presetPrompt?: string) => {
    const textToUse = presetPrompt || prompt;
    if (!textToUse.trim()) {
      setError("Please enter a description or pick a preset below.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await adminAiQuickGenerate(token, { prompt: textToUse });
      if (res.ok && res.tracking) {
        setGenerated(res.tracking);
        setIsAiPowered(res.isAiGenerated ?? true);
        if (presetPrompt) {
          setPrompt(presetPrompt);
        }
      } else {
        setError(res.error || "Failed to generate tracking manifest");
      }
    } catch (err: any) {
      setError(err?.message || "Generation encountered an error");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async (action: "track" | "email" | "save") => {
    if (!generated) return;
    setSaving(true);
    setError(null);

    try {
      const res = await adminAiQuickCreate(token, generated);
      if (res.ok && res.code) {
        const createdCode = res.code;
        onCreated(createdCode);

        if (action === "track") {
          onClose();
          onTrack(createdCode);
        } else if (action === "email" && onComposeEmail) {
          onClose();
          onComposeEmail(createdCode);
        } else {
          onClose();
        }
      } else {
        setError(res.error || "Failed to register shipment");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to commit shipment");
    } finally {
      setSaving(false);
    }
  };

  const handleAssistantSubmit = async () => {
    if (!assistantQuery.trim() || assistantLoading) return;
    const q = assistantQuery.trim();
    setAssistantQuery("");
    setAssistantHistory((prev) => [...prev, { role: "user", text: q }]);
    setAssistantLoading(true);

    try {
      const res = await adminAiQuickAssist(token, q);
      if (res.ok && res.answer) {
        setAssistantHistory((prev) => [...prev, { role: "ai", text: res.answer! }]);
      } else {
        setAssistantHistory((prev) => [
          ...prev,
          { role: "ai", text: res.error || "Unable to retrieve fleet response." },
        ]);
      }
    } catch {
      setAssistantHistory((prev) => [
        ...prev,
        { role: "ai", text: "Connection error while reaching AI dispatch." },
      ]);
    } finally {
      setAssistantLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6 animate-fadeIn">
      <div className="bg-[#0e0e11] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/8 bg-gradient-to-r from-red-950/30 via-[#121217] to-[#0e0e11] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.25)]">
              <Sparkles className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-wide">
                  Tesla AI Quick Tracking
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 font-mono flex items-center gap-1">
                  <Bot className="w-3 h-3" /> Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-xs text-white/40 mt-0.5">
                Generate complete GPS route corridors, telemetry, and milestone timelines in 1 click
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
              <button
                onClick={() => setActiveTab("generator")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  activeTab === "generator"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-white/40 hover:text-white"
                }`}
              >
                Quick Generator
              </button>
              <button
                onClick={() => setActiveTab("assistant")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  activeTab === "assistant"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-white/40 hover:text-white"
                }`}
              >
                Fleet AI Assistant
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeTab === "generator" && (
            <>
              {/* Natural language prompt box */}
              <div className="bg-white/3 border border-white/8 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-white/70 flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-red-400" />
                    <span>Describe Shipment or Paste Order Manifest</span>
                  </label>
                  <span className="text-[10px] text-white/35">Natural language & order notes supported</span>
                </div>

                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. Model Y Performance from Fremont Gigafactory to Seattle for Sarah Connor, priority express delivery, arriving in 2 days..."
                    rows={3}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/25 outline-none focus:border-red-500/50 resize-none transition-all"
                  />
                  <button
                    onClick={() => handleGenerate()}
                    disabled={loading || !prompt.trim()}
                    className="absolute right-3 bottom-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-medium transition-all shadow-md"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate with AI</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Preset Chips */}
                <div>
                  <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-semibold">
                    Instant Logistics Presets
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleGenerate(p.prompt)}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/4 hover:bg-white/8 border border-white/8 hover:border-red-500/40 text-xs text-white/75 hover:text-white transition-all text-left"
                      >
                        <span>{p.icon}</span>
                        <span className="font-medium">{p.label}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-white/40 border border-white/5">
                          {p.badge}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Generated Shipment Result Card */}
              {loading && (
                <div className="p-8 border border-white/8 rounded-2xl bg-white/2 flex flex-col items-center justify-center space-y-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-red-500/20 border-t-red-500 animate-spin" />
                    <Sparkles className="w-5 h-5 text-red-400 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-white/80">
                      Gemini is formulating shipment & telemetry…
                    </div>
                    <p className="text-[11px] text-white/35 mt-1">
                      Generating realistic GPS highway waypoints, ETA calculation, and milestone milestones
                    </p>
                  </div>
                </div>
              )}

              {generated && !loading && (
                <div className="bg-[#121217] border border-white/10 rounded-2xl overflow-hidden shadow-xl space-y-4">
                  {/* Generated Card Header */}
                  <div className="p-4 bg-white/3 border-b border-white/6 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                        <Truck className="w-4 h-4 text-red-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono font-bold text-white tracking-wider">
                            {generated.code}
                          </code>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-medium">
                            {generated.status}
                          </span>
                          {isAiPowered && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/15 text-red-300 border border-red-500/20 font-mono">
                              AI Generated
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-white/40 mt-0.5">
                          {generated.carrier} · {generated.delivery_method}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleGenerate()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white text-xs hover:bg-white/5 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" /> Regenerate
                      </button>
                      <button
                        onClick={() => setShowAdvancedEdit(!showAdvancedEdit)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white text-xs hover:bg-white/5 transition-colors"
                      >
                        <span>{showAdvancedEdit ? "Hide Fields" : "Edit Fields"}</span>
                        {showAdvancedEdit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* AI Insights Bar */}
                  {generated.ai_insights && (
                    <div className="mx-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-200 flex items-start gap-2.5">
                      <Zap className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-semibold text-red-300">AI Dispatch Analysis: </span>
                        {generated.ai_insights}
                      </div>
                    </div>
                  )}

                  {/* Route & Core Overview */}
                  <div className="px-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-white/2 border border-white/5 rounded-xl">
                      <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-blue-400" /> Origin
                      </div>
                      <div className="font-semibold text-white truncate">{generated.origin}</div>
                      <div className="text-[10px] text-white/40 truncate">{generated.sender_name || "Tesla Hub"}</div>
                    </div>

                    <div className="p-3 bg-white/2 border border-white/5 rounded-xl">
                      <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-400" /> Destination
                      </div>
                      <div className="font-semibold text-white truncate">{generated.destination}</div>
                      <div className="text-[10px] text-white/40 truncate">{generated.receiver_name || "Customer"}</div>
                    </div>

                    <div className="p-3 bg-white/2 border border-white/5 rounded-xl">
                      <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" /> Estimated Arrival
                      </div>
                      <div className="font-semibold text-white truncate">{generated.eta}</div>
                      <div className="text-[10px] text-white/40">{generated.speed_kph} km/h Autonomous Avg</div>
                    </div>

                    <div className="p-3 bg-white/2 border border-white/5 rounded-xl">
                      <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-green-400" /> Logistics Cost
                      </div>
                      <div className="font-semibold text-white">${Number(generated.shipping_cost || 0).toFixed(2)}</div>
                      <div className="text-[10px] text-white/40">{generated.weight || "—"}</div>
                    </div>
                  </div>

                  {/* Editable Fields Section (if opened) */}
                  {showAdvancedEdit && (
                    <div className="mx-4 p-4 rounded-xl bg-black/40 border border-white/8 space-y-4">
                      <div className="text-xs font-semibold text-white/80">Edit Generated Parameters</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] text-white/40 block mb-1">Tracking Code</label>
                          <input
                            type="text"
                            value={generated.code}
                            onChange={(e) => setGenerated({ ...generated, code: e.target.value.toUpperCase() })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/40 block mb-1">Status</label>
                          <select
                            value={generated.status}
                            onChange={(e) => setGenerated({ ...generated, status: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                          >
                            {["Processing", "In Transit", "Customs Clearance", "Out for Delivery", "Delivered"].map(
                              (s) => (
                                <option key={s} value={s} className="bg-[#111]">
                                  {s}
                                </option>
                              )
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-white/40 block mb-1">ETA</label>
                          <input
                            type="text"
                            value={generated.eta}
                            onChange={(e) => setGenerated({ ...generated, eta: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-white/40 block mb-1">Recipient Name</label>
                          <input
                            type="text"
                            value={generated.receiver_name}
                            onChange={(e) => setGenerated({ ...generated, receiver_name: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/40 block mb-1">Recipient Email</label>
                          <input
                            type="email"
                            value={generated.receiver_email}
                            onChange={(e) => setGenerated({ ...generated, receiver_email: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Milestones Preview */}
                  <div className="px-4 pb-4">
                    <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-semibold flex items-center justify-between">
                      <span>Telemetry Milestones ({generated.events.length})</span>
                      <span className="text-white/30 font-normal">
                        Route Corridor: {generated.route?.length || 0} GPS Waypoints
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {generated.events.map((ev, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-2 rounded-lg bg-white/2 border border-white/4 text-xs"
                        >
                          <div
                            className={`w-2 h-2 rounded-full ${
                              ev.done ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-white/20"
                            }`}
                          />
                          <span className="font-mono text-[10px] text-white/40 w-16 flex-shrink-0">
                            {ev.time_label || "—"}
                          </span>
                          <span className="text-white/80 font-medium flex-1 truncate">{ev.label}</span>
                          <span className="text-[10px] text-white/40 truncate max-w-xs">{ev.location}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Commit Actions Footer */}
                  <div className="p-4 bg-white/3 border-t border-white/8 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[11px] text-white/40">
                      Click below to register this shipment into the live fleet system.
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCommit("save")}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-white/8 hover:bg-white/12 text-white text-xs font-medium transition-all"
                      >
                        {saving ? "Saving…" : "Save to Fleet"}
                      </button>

                      {onComposeEmail && (
                        <button
                          onClick={() => handleCommit("email")}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-medium transition-all"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Save & Email Customer</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleCommit("track")}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-all shadow-lg"
                      >
                        {saving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                        <span>Deploy & Track Live</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "assistant" && (
            <div className="space-y-4">
              <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-xl text-xs text-white/70 flex items-center gap-2">
                <Bot className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>
                  Ask operational queries about your fleet (e.g. &ldquo;Which shipments are in customs?&rdquo;, &ldquo;Summarize Model Y deliveries&rdquo;, &ldquo;What should I notify customers about delays?&rdquo;).
                </span>
              </div>

              {/* Chat history */}
              <div className="h-64 overflow-y-auto space-y-3 p-4 bg-black/40 border border-white/8 rounded-2xl">
                {assistantHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 text-xs ${
                      item.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {item.role === "ai" && (
                      <div className="w-6 h-6 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-3.5 h-3.5 text-red-400" />
                      </div>
                    )}
                    <div
                      className={`p-3 rounded-xl max-w-lg leading-relaxed ${
                        item.role === "user"
                          ? "bg-red-600 text-white font-medium"
                          : "bg-white/5 border border-white/10 text-white/80"
                      }`}
                    >
                      {item.text}
                    </div>
                    {item.role === "user" && (
                      <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-white/60" />
                      </div>
                    )}
                  </div>
                ))}
                {assistantLoading && (
                  <div className="flex items-center gap-2 text-xs text-white/40 p-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                    <span>AI Assistant is analyzing fleet data…</span>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={assistantQuery}
                  onChange={(e) => setAssistantQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAssistantSubmit()}
                  placeholder="Ask a fleet or tracking question..."
                  className="flex-1 bg-white/4 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/25 outline-none focus:border-red-500/50"
                />
                <button
                  onClick={handleAssistantSubmit}
                  disabled={!assistantQuery.trim() || assistantLoading}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white text-xs font-medium transition-all flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Ask AI</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
