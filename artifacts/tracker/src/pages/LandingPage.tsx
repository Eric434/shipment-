import { useRef, useState } from "react";
import {
  Search, MapPin, Bell, TrendingUp, ArrowUp,
  ChevronRight, Zap, Clock, Shield, ExternalLink,
  Plane, Ship, Truck, Train, Package, Warehouse,
} from "lucide-react";

import heroCarImg from "@assets/ModelS_79_1778546529014.jpg";
import modelSRoadImg from "@assets/ModelS_81_1778546529000.jpg";
import modelXImg from "@assets/model-x-white_1778546528816.webp";
import modelSInteriorImg from "@assets/model-s-interior_1778546528789.webp";
import aboutImg from "@assets/about_1778546528984.jpg";
import carouselImg from "@assets/carousel-2_1778546528968.jpg";
import svc1 from "@assets/service-1_1778546528932.jpg";
import svc2 from "@assets/service-2_1778546528950.jpg";
import svc3 from "@assets/service-3_1778546528913.jpg";
import svc4 from "@assets/service-4_1778546528891.jpg";
import svc5 from "@assets/service-5_1778546528861.jpg";
import svc6 from "@assets/service-6_1778546528838.jpg";

const FEATURES = [
  {
    icon: MapPin,
    title: "Live Satellite Map",
    desc: "Real-time vehicle positioning updated every 15 seconds on a high-resolution satellite map layer.",
    color: "from-blue-600/20 to-blue-800/5",
    border: "border-blue-600/20",
    iconBg: "bg-blue-600/15",
    iconColor: "text-blue-400",
    tag: "Powered by OpenStreetMap",
  },
  {
    icon: TrendingUp,
    title: "Real-Time Progress",
    desc: "Full event timeline from dispatch to delivery, with ETA predictions and live status updates.",
    color: "from-red-600/15 to-red-900/5",
    border: "border-red-600/20",
    iconBg: "bg-red-600/15",
    iconColor: "text-red-400",
    tag: "15s refresh rate",
  },
  {
    icon: Bell,
    title: "Email Alerts",
    desc: "Instant notifications at every milestone — departed, in transit, out for delivery, and delivered.",
    color: "from-violet-600/15 to-violet-900/5",
    border: "border-violet-600/20",
    iconBg: "bg-violet-600/15",
    iconColor: "text-violet-400",
    tag: "< 5s delivery",
  },
];

const STEPS = [
  { n: "01", title: "Enter your code", desc: "Paste the tracking number from your confirmation email into the search bar above." },
  { n: "02", title: "See live location", desc: "The map loads instantly with your shipment's current position and route path." },
  { n: "03", title: "Track every event", desc: "A full timeline shows every scan, transfer, and status update in real time." },
  { n: "04", title: "Get notified", desc: "Enter your email and receive alerts the moment your package status changes." },
];

const TRANSPORT = [
  { img: svc1, icon: Plane,     label: "Air Freight",      desc: "Express air delivery worldwide" },
  { img: svc2, icon: Ship,      label: "Ocean Freight",    desc: "Full container & bulk shipping" },
  { img: svc3, icon: Truck,     label: "Road Freight",     desc: "Long-haul & last-mile trucking" },
  { img: svc4, icon: Train,     label: "Rail Freight",     desc: "Cost-efficient overland rail" },
  { img: svc5, icon: Package,   label: "Port Logistics",   desc: "Container yard management" },
  { img: svc6, icon: Warehouse, label: "Warehousing",      desc: "Fulfilment & storage hubs" },
];

const TESLA_GALLERY = [
  { img: modelSRoadImg,    label: "Model S — open road" },
  { img: modelXImg,        label: "Model X — cargo ready" },
  { img: modelSInteriorImg,label: "Autopilot cockpit" },
];

interface Props { onTrack: (code: string) => void; onAdmin: () => void; }

export default function LandingPage({ onTrack, onAdmin }: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const handleSubmit = () => { const v = query.trim().toUpperCase(); if (v) onTrack(v); };

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white" ref={topRef}>

      {/* ─── NAV ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 py-3 md:py-4 border-b border-white/6 bg-[#0a0a0a]/92 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <img src="/tesla-logo.png" alt="TeslaTrack" className="logo-spin w-10 h-10 object-contain" />
          <span className="text-sm font-semibold tracking-widest uppercase text-white/90">
            Tesla<span className="text-red-500">Track</span>
          </span>
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          <a href="#features" className="hidden sm:block text-xs text-white/40 hover:text-white/70 transition-colors">Features</a>
          <a href="#how-it-works" className="hidden sm:block text-xs text-white/40 hover:text-white/70 transition-colors">How it works</a>
          <button onClick={onAdmin}
            className="text-xs px-3 md:px-4 py-1.5 border border-white/10 rounded-full text-white/50 hover:text-white hover:border-white/30 transition-all whitespace-nowrap">
            Admin
          </button>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative flex flex-col items-center justify-center min-h-dvh px-4 pt-24 pb-16 overflow-hidden">
        {/* Hero background car image */}
        <div className="absolute inset-0 z-0">
          <img src={heroCarImg} alt="" className="w-full h-full object-cover opacity-20"
            style={{ maskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 70%, transparent 100%)" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/80 via-transparent to-[#0a0a0a]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-transparent to-[#0a0a0a]" />
        </div>

        <div className="hero-glow w-[700px] h-[500px] bg-blue-600/10 animate-glow-blue top-20 left-1/2 -translate-x-1/2 z-0" />

        {/* Big spinning hero logo */}
        <div className="relative z-10 mb-6 animate-slide-up">
          <img src="/tesla-logo.png" alt="TeslaTrack" className="logo-spin w-24 h-24 md:w-28 md:h-28 object-contain drop-shadow-[0_0_24px_rgba(220,38,38,0.5)]" />
        </div>

        {/* Live badge */}
        <div className="relative z-10 flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-blue-500/25 bg-blue-500/6 backdrop-blur-sm animate-slide-up">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"
              style={{ animation: "ping-live 1.4s cubic-bezier(0,0,0.2,1) infinite" }} />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
          </span>
          <span className="text-[11px] text-blue-300 tracking-widest uppercase font-medium">Live Tracking Active</span>
        </div>

        <h1 className="relative z-10 text-center font-bold leading-[1.1] mb-6 animate-slide-up"
          style={{ animationDelay: "0.1s", fontSize: "clamp(2.5rem, 6vw, 5rem)" }}>
          <span className="gradient-text">Know exactly where</span>
          <br />
          <span className="text-white/90">your shipment is.</span>
        </h1>

        <p className="relative z-10 text-center text-white/40 max-w-md mb-10 text-sm leading-relaxed animate-slide-up"
          style={{ animationDelay: "0.2s" }}>
          Precision tracking with live satellite maps, real-time status updates, and
          instant email alerts — from dispatch to your doorstep.
        </p>

        {/* Search bar */}
        <div className="relative z-10 w-full max-w-xl animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <div className={`flex items-center gap-3 bg-[#111]/90 border rounded-xl px-4 py-3.5 transition-all duration-300 backdrop-blur ${
            focused ? "border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.12)]" : "border-white/10"
          }`}>
            <Search className="w-4 h-4 text-white/30 flex-shrink-0" />
            <input type="text" value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Enter your tracking code"
              className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none font-mono" />
            <button onClick={handleSubmit} disabled={!query.trim()}
              className="flex-shrink-0 px-5 py-2 rounded-lg text-sm font-medium transition-all bg-red-600 hover:bg-red-500 text-white disabled:opacity-30 disabled:cursor-not-allowed">
              Track
            </button>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 animate-pulse-live">
          <span className="text-[9px] text-white/20 tracking-widest uppercase">Scroll</span>
          <div className="w-px h-10 bg-gradient-to-b from-white/20 to-transparent" />
        </div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="border-y border-white/6 bg-[#0d0d0d]">
        <div className="max-w-4xl mx-auto px-4 py-4 md:py-6 grid grid-cols-3 divide-x divide-white/6">
          {[
            { icon: Zap, value: "99.9%", label: "Uptime SLA" },
            { icon: Clock, value: "15s", label: "Refresh Rate" },
            { icon: Shield, value: "24/7", label: "Live Support" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 px-2 sm:px-6">
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500/70" />
              <div className="text-center sm:text-left">
                <div className="text-base sm:text-lg font-semibold text-white/90">{value}</div>
                <div className="text-[8px] sm:text-[10px] text-white/30 uppercase tracking-wider">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── TRANSPORT NETWORK ─── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] text-red-500/70 tracking-[0.3em] uppercase mb-3">Coverage</p>
            <h2 className="text-3xl font-bold text-white/90">Every mode. Every route.</h2>
            <p className="text-white/35 text-sm mt-3 max-w-md mx-auto">
              Air, sea, road, and rail — all tracked in one place with the same live precision.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {TRANSPORT.map(({ img, icon: Icon, label, desc }) => (
              <div key={label} className="group relative rounded-2xl overflow-hidden border border-white/8 aspect-[4/3] cursor-default">
                <img src={img} alt={label} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-white/90">{label}</span>
                  </div>
                  <p className="text-[10px] text-white/45">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-24 px-6 bg-[#0d0d0d] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] text-red-500/70 tracking-[0.3em] uppercase mb-3">Capabilities</p>
            <h2 className="text-3xl font-bold text-white/90">Everything you need to track.</h2>
            <p className="text-white/35 text-sm mt-3 max-w-md mx-auto">
              Built for precision. Designed for clarity. Delivered in real time.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc, color, border, iconBg, iconColor, tag }) => (
              <div key={title}
                className={`feature-card relative rounded-2xl border ${border} bg-gradient-to-b ${color} p-6 overflow-hidden`}>
                <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center mb-5`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <h3 className="text-sm font-semibold text-white/90 mb-2">{title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
                <div className="mt-5 inline-flex items-center gap-1.5 text-[9px] text-white/20 border border-white/6 rounded-full px-2.5 py-1">
                  <span className="w-1 h-1 rounded-full bg-green-400" /> {tag}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] text-blue-400/60 tracking-[0.3em] uppercase mb-3">Process</p>
            <h2 className="text-3xl font-bold text-white/90">Simple as four steps.</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-3">
              {STEPS.map(({ n, title, desc }) => (
                <div key={n} className="step-card flex gap-4 p-5 rounded-xl border border-white/6 bg-white/2">
                  <span className="text-2xl font-bold text-white/8 font-mono flex-shrink-0 w-10 text-right leading-tight">{n}</span>
                  <div>
                    <h4 className="text-sm font-semibold text-white/80 mb-1">{title}</h4>
                    <p className="text-xs text-white/35 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Package photo card */}
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl aspect-[4/3]">
              <img src={aboutImg} alt="Package handoff" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
                <div>
                  <p className="text-sm font-semibold text-white/90 mb-1">Track your shipment</p>
                  <p className="text-[10px] text-white/45">Enter your code above to see live location</p>
                </div>
                <button onClick={() => {
                    topRef.current?.scrollIntoView({ behavior: "smooth" });
                    setTimeout(() => topRef.current?.querySelector<HTMLInputElement>("input")?.focus(), 400);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-all group flex-shrink-0 ml-4">
                  Track now <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TESLA FLEET GALLERY ─── */}
      <section className="py-16 px-6 bg-[#0d0d0d] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[10px] text-red-500/70 tracking-[0.3em] uppercase mb-3">Our Fleet</p>
            <h2 className="text-2xl font-bold text-white/90">Tesla-powered logistics.</h2>
            <p className="text-white/35 text-sm mt-2 max-w-sm mx-auto">
              Every vehicle in our network runs on Tesla technology — zero-emission, always-connected.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TESLA_GALLERY.map(({ img, label }) => (
              <div key={label} className="group relative rounded-2xl overflow-hidden border border-white/8 aspect-video">
                <img src={img} alt={label} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-4">
                  <span className="text-[10px] text-white/60 font-medium">{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA BANNER with fleet background ─── */}
      <section className="relative py-28 px-6 overflow-hidden">
        <img src={carouselImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/60 to-[#0a0a0a]" />
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">
            <span className="gradient-text">Start tracking now.</span>
          </h2>
          <p className="text-white/35 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
            Enter your tracking code and get instant, real-time results.
          </p>
          <button onClick={() => {
              topRef.current?.scrollIntoView({ behavior: "smooth" });
              topRef.current?.querySelector<HTMLInputElement>("input")?.focus();
            }}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-all shadow-lg shadow-red-900/30 group">
            <ArrowUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
            Enter a tracking code
          </button>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/6 bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/tesla-logo.png" alt="TeslaTrack" className="logo-spin w-8 h-8 object-contain opacity-70" />
            <span className="text-xs font-semibold tracking-widest uppercase text-white/50">
              Tesla<span className="text-red-500/70">Track</span>
            </span>
            <span className="text-[10px] text-white/20 ml-2">© 2026 · All rights reserved</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-[10px] text-white/25 hover:text-white/50 transition-colors">Features</a>
            <a href="#how-it-works" className="text-[10px] text-white/25 hover:text-white/50 transition-colors">How it works</a>
            <button onClick={onAdmin}
              className="flex items-center gap-1.5 text-[10px] text-white/25 hover:text-white/50 transition-colors">
              Admin Portal <ExternalLink className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
