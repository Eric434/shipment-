import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Package, CheckCircle2, Circle, MapPin, Clock,
  Bell, BellOff, Play, Pause, RotateCcw, Navigation,
  Loader2, AlertCircle, Wifi, ChevronRight, Gauge,
  X, List, FileText, Download, Compass, Lock, CheckSquare,
  Calendar, CalendarDays, Crosshair, Map as MapIcon,
  Sun, Moon, Check, FastForward, Plus, Minus, Layers, Maximize2, Menu, Sparkles, Mail,
  Printer, QrCode,
} from "lucide-react";
import { fetchPackage, subscribeToAlerts, notifyDelivered, checkSmtpStatus, type Package as Pkg, type FetchPackageResult } from "@/lib/api";
import {
  saveNotificationEmailToFirestore,
  getNotificationEmailFromFirestore,
} from "@/lib/firebase";
import { GoogleMapsNavigationHUD } from "@/components/GoogleMapsNavigation";
import { TeslaVehicleDashboard } from "@/components/TeslaVehicleDashboard";
import { GoogleMapsGroundingPanel } from "@/components/GoogleMapsGroundingPanel";
import { PrintShippingLabelModal } from "@/components/PrintShippingLabelModal";
import { TrackingEmailTemplatesTab } from "@/components/TrackingEmailTemplatesTab";
import {
  loadGoogleMaps,
  TESLA_DARK_MAP_STYLES,
  fetchGoogleMapsDrivingRoute,
  type GoogleDirectionsResult,
} from "@/lib/googleMaps";

declare const google: any;

// ─── Route normalization + interpolation ──────────────────────────────────────

type WaypointRaw = [number, number] | { lat: number; lng: number } | unknown;

function normalizeRoute(route: unknown): [number, number][] {
  if (!Array.isArray(route) || route.length === 0) return [];
  return route.map((wp): [number, number] => {
    if (Array.isArray(wp) && wp.length >= 2) return [Number(wp[0]), Number(wp[1])];
    if (wp && typeof wp === "object" && "lat" in wp && "lng" in wp)
      return [Number((wp as { lat: unknown }).lat), Number((wp as { lng: unknown }).lng)];
    return [0, 0];
  });
}

function interpolateRoute(waypoints: [number, number][], n: number): [number, number][] {
  if (waypoints.length < 2) return waypoints.length === 1 ? [waypoints[0], waypoints[0]] : [[0, 0], [0, 0]];
  const dists: number[] = [0];
  for (let i = 1; i < waypoints.length; i++) {
    const [a, b] = waypoints[i - 1];
    const [c, d] = waypoints[i];
    dists.push(dists[i - 1] + Math.sqrt((c - a) ** 2 + (d - b) ** 2));
  }
  const total = dists[dists.length - 1];
  if (total === 0) return Array(n).fill(waypoints[0]) as [number, number][];
  return Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * total;
    let seg = 0;
    for (let j = 1; j < dists.length; j++) { if (dists[j] >= t) { seg = j - 1; break; } seg = j - 1; }
    const len = (dists[seg + 1] ?? dists[seg]) - dists[seg];
    const f = len > 0 ? (t - dists[seg]) / len : 0;
    const [a, b] = waypoints[seg];
    const [c, d] = waypoints[Math.min(seg + 1, waypoints.length - 1)];
    return [a + f * (c - a), b + f * (d - b)] as [number, number];
  });
}

function getBearing(from: [number, number], to: [number, number]): number {
  const dLng = to[1] - from[1];
  const dLat = to[0] - from[0];
  return ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
}

function bearingToCardinal(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// ─── Distance & Delivery Date Calculation ─────────────────────────────────────

function calculateHaversineDistanceKm([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateRemainingDistanceKm(fullPath: [number, number][], currentIdx: number): number {
  if (fullPath.length < 2 || currentIdx >= fullPath.length - 1) return 0;
  let dist = 0;
  for (let i = currentIdx; i < fullPath.length - 1; i++) {
    dist += calculateHaversineDistanceKm(fullPath[i], fullPath[i + 1]);
  }
  return Math.round(dist);
}

export interface DeliveryEstimate {
  formattedDate: string;
  formattedTime: string;
  fullEstimate: string;
  remainingDistanceKm: number;
  remainingHours: number;
  relativeTime: string;
  isToday: boolean;
  isTomorrow: boolean;
}

function calculateEstimatedDelivery(
  status: string,
  _currentCoord: [number, number] | undefined,
  _destCoord: [number, number] | undefined,
  remainingDistanceKm: number,
  speedKph: number,
  rawEta?: string
): DeliveryEstimate {
  const now = new Date();

  if (status === "Delivered") {
    return {
      formattedDate: "Delivered",
      formattedTime: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      fullEstimate: "Delivered",
      remainingDistanceKm: 0,
      remainingHours: 0,
      relativeTime: "Delivered",
      isToday: true,
      isTomorrow: false,
    };
  }

  // Determine estimated hours remaining based on coordinates distance + status factors
  let remainingHours = 0;
  const effectiveSpeed = Math.max(speedKph > 0 ? speedKph : 75, 45); // realistic speed

  if (remainingDistanceKm > 0) {
    // Driving transit time with 15% buffer for route topology / traffic
    remainingHours = (remainingDistanceKm / effectiveSpeed) * 1.15;
  }

  // Adjust for logistics status stage
  if (status === "Customs Clearance") {
    remainingHours += 4.0;
  } else if (status === "Booking Confirmed" || status === "Processing") {
    remainingHours += 12.0;
  } else if (status === "Picked Up" || status === "Dispatched") {
    remainingHours += 2.0;
  } else if (status === "Out for Delivery") {
    remainingHours = Math.min(Math.max(remainingHours, 0.5), 3.0);
  }

  // Parse raw ETA if provided
  if (rawEta) {
    const parsedDate = new Date(rawEta);
    if (!isNaN(parsedDate.getTime()) && parsedDate.getTime() > now.getTime()) {
      remainingHours = (parsedDate.getTime() - now.getTime()) / (3600 * 1000);
    } else {
      const daysMatch = rawEta.match(/(\d+)\s*(?:days?|d)/i);
      const hoursMatch = rawEta.match(/(\d+)\s*(?:hours?|hrs?|h)/i);
      const minsMatch = rawEta.match(/(\d+)\s*(?:mins?|minutes?|m)/i);
      if (daysMatch || hoursMatch || minsMatch) {
        let parsedHours = 0;
        if (daysMatch) parsedHours += parseInt(daysMatch[1], 10) * 24;
        if (hoursMatch) parsedHours += parseInt(hoursMatch[1], 10);
        if (minsMatch) parsedHours += parseInt(minsMatch[1], 10) / 60;
        if (parsedHours > 0) {
          remainingHours = remainingDistanceKm > 0 ? (remainingHours + parsedHours) / 2 : parsedHours;
        }
      }
    }
  }

  if (remainingHours <= 0) remainingHours = 1;

  const targetDate = new Date(now.getTime() + remainingHours * 3600 * 1000);

  const isToday = targetDate.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = targetDate.toDateString() === tomorrow.toDateString();

  const timeStr = targetDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  let datePrefix = targetDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (isToday) datePrefix = "Today";
  else if (isTomorrow) datePrefix = "Tomorrow";

  const remainingHoursInt = Math.floor(remainingHours);
  const remainingMinsInt = Math.round((remainingHours - remainingHoursInt) * 60);
  const relStr = remainingHours >= 24
    ? `${(remainingHours / 24).toFixed(1)} days`
    : remainingHoursInt > 0
    ? `${remainingHoursInt}h ${remainingMinsInt}m`
    : `${remainingMinsInt}m`;

  return {
    formattedDate: datePrefix,
    formattedTime: timeStr,
    fullEstimate: `${datePrefix}, ${timeStr}`,
    remainingDistanceKm,
    remainingHours,
    relativeTime: relStr,
    isToday,
    isTomorrow,
  };
}

function vehicleMarkerHtml(moving: boolean, bearing: number): string {
  const headlightBeam = moving
    ? `<div class="headlight-beam" style="position:absolute;top:-28px;left:-6px;width:40px;height:36px;background:radial-gradient(ellipse at 50% 100%, rgba(254,240,138,0.45) 0%, rgba(254,240,138,0.15) 50%, rgba(254,240,138,0) 100%);clip-path:polygon(25% 100%, 75% 100%, 100% 0%, 0% 0%);pointer-events:none;z-index:0;animation:headlight-flicker 2s infinite ease-in-out;"></div>`
    : "";

  const radarSweep = moving
    ? `<div class="radar-scan" style="position:absolute;inset:-16px;border-radius:50%;border:1px solid rgba(239,68,68,0.4);pointer-events:none;animation:radar-wave 1.8s cubic-bezier(0.1,0.7,0.1,1) infinite;"></div>
       <div class="vehicle-pulse-glow" style="position:absolute;inset:-10px;border-radius:50%;background:radial-gradient(circle, rgba(220,38,38,0.45) 0%, rgba(220,38,38,0) 72%);pointer-events:none;"></div>`
    : `<div style="position:absolute;inset:-4px;border-radius:50%;background:rgba(220,38,38,0.18);pointer-events:none;"></div>`;

  const headlightColor = moving ? "#fef08a" : "#fde047";
  const bodyColor = moving ? "#e11d48" : "#9f1239";
  const windshieldColor = moving ? "#38bdf8" : "#0284c7";

  return `<div class="vehicle-icon-wrapper" style="position:relative;width:32px;height:48px;transform:rotate(${bearing}deg);transform-origin:16px 24px;transition:transform 0.25s linear;will-change:transform;">
    ${radarSweep}
    ${headlightBeam}
    <svg viewBox="0 0 32 48" width="32" height="48" xmlns="http://www.w3.org/2000/svg" style="position:relative;z-index:2;filter:drop-shadow(0 4px 12px rgba(225,29,72,0.6));">
      <defs>
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fb7185" />
          <stop offset="45%" stop-color="${bodyColor}" />
          <stop offset="100%" stop-color="#881337" />
        </linearGradient>
        <linearGradient id="glassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${windshieldColor}" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#0369a1" stop-opacity="0.7" />
        </linearGradient>
        <filter id="laserGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Side Mirror Left & Right -->
      <path d="M 2 15 Q 1 13 4 13 L 5 15 Z" fill="#475569" />
      <path d="M 30 15 Q 31 13 28 13 L 27 15 Z" fill="#475569" />

      <!-- Aerodynamic Wheels (4 corner tires) -->
      <rect x="1.5" y="8" width="4.5" height="9" rx="2" fill="#09090b" stroke="#27272a" stroke-width="0.8" />
      <rect x="26" y="8" width="4.5" height="9" rx="2" fill="#09090b" stroke="#27272a" stroke-width="0.8" />
      <rect x="1.5" y="31" width="4.5" height="9" rx="2" fill="#09090b" stroke="#27272a" stroke-width="0.8" />
      <rect x="26" y="31" width="4.5" height="9" rx="2" fill="#09090b" stroke="#27272a" stroke-width="0.8" />

      <!-- Main Vehicle Chassis / Body Shell -->
      <path d="M 16 3 C 8 3 5 8 5 14 L 5 36 C 5 42 9 45 16 45 C 23 45 27 42 27 36 L 27 14 C 27 8 24 3 16 3 Z" fill="url(#bodyGrad)" stroke="#fda4af" stroke-width="0.75" />

      <!-- Contoured Roof Canopy -->
      <path d="M 16 11 C 9.5 11 8 15 8 21 L 8 32 C 8 37 10 39 16 39 C 22 39 24 37 24 32 L 24 21 C 24 15 22.5 11 16 11 Z" fill="#0f172a" />

      <!-- Front Windshield Curved Glass -->
      <path d="M 9.5 14 Q 16 12 22.5 14 L 21.5 19 Q 16 18 10.5 19 Z" fill="url(#glassGrad)" />

      <!-- Panoramic Glass Roof -->
      <rect x="11" y="21" width="10" height="7" rx="1.5" fill="#1e293b" opacity="0.9" />

      <!-- Rear Window Glass -->
      <path d="M 10.5 30 Q 16 29 21.5 30 L 22.5 34 Q 16 35 9.5 34 Z" fill="url(#glassGrad)" opacity="0.8" />

      <!-- Front LED Matrix Projectors / Headlights -->
      <ellipse cx="8.5" cy="5" rx="2.5" ry="1.2" fill="${headlightColor}" filter="url(#laserGlow)" />
      <ellipse cx="23.5" cy="5" rx="2.5" ry="1.2" fill="${headlightColor}" filter="url(#laserGlow)" />

      <!-- Signature Red Tail Light Lightbar -->
      <path d="M 8 43 Q 16 44 24 43" stroke="#ff2442" stroke-width="2" stroke-linecap="round" filter="url(#laserGlow)" />

      <!-- GPS Autopilot Navigation Pulse Dot -->
      <circle cx="16" cy="24" r="2.2" fill="#38bdf8" />
      <circle cx="16" cy="24" r="3.8" stroke="#38bdf8" stroke-width="0.75" opacity="0.6" />
    </svg>
  </div>`;
}

// ─── Milestone data ───────────────────────────────────────────────────────────

const MILESTONES = [
  { label: "Booking Confirmed", sub: "Shipment registered" },
  { label: "Picked Up", sub: "Carrier collected from origin" },
  { label: "In Transit", sub: "En route to destination" },
  { label: "Customs Clearance", sub: "Documentation verified" },
  { label: "Out for Delivery", sub: "Last-mile dispatch" },
  { label: "Delivered", sub: "Shipment complete" },
];

function getMilestoneIndex(status: string): number {
  if (status === "Delivered") return 5;
  if (status === "Out for Delivery") return 4;
  if (status === "Customs Clearance") return 3;
  if (status === "In Transit") return 2;
  if (status === "Picked Up" || status === "Dispatched") return 1;
  return 0;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL = 200;

/**
 * Derive a per-step interval (ms) from the package ETA so the car moves
 * proportionally to real remaining time.
 *
 * Strategy: compress real time by COMPRESSION (1 real second ≈ COMPRESSION
 * seconds of transit time) so the car is always visibly moving but much
 * slower when many days remain than when only hours remain.
 *
 * COMPRESSION = 200 means:
 *   3 days remaining  → ~12 s/step  (slow crawl)
 *   12 h remaining    → ~2.9 s/step
 *   2 h remaining     → 500 ms/step (capped minimum)
 */
function computeStepMs(eta: string, startProgress: number): number {
  const etaDate = new Date(eta);
  const now = new Date();
  const remainingMs = etaDate.getTime() - now.getTime();
  if (remainingMs <= 0) return 500;

  const startIdx = Math.floor(Math.min(startProgress, 0.999) * (TOTAL - 1));
  const remainingSteps = Math.max(TOTAL - 1 - startIdx, 1);

  const COMPRESSION = 200;
  const stepMs = remainingMs / COMPRESSION / remainingSteps;

  return Math.max(500, Math.min(30_000, stepMs));
}

type DrawerTab = "timeline" | "places" | "controls" | "map" | "alerts" | "templates" | "docs";
interface Props { code: string; onBack: () => void; }

// ─── Loading / Error screens ──────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex flex-col h-[100dvh] bg-[#080808] text-white items-center justify-center gap-4">
      <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
      <p className="text-xs text-white/30">Looking up tracking code…</p>
    </div>
  );
}

function NotFoundScreen({ code, onBack }: { code: string; onBack: () => void }) {
  return (
    <div className="flex flex-col h-[100dvh] bg-[#080808] text-white items-center justify-center gap-5 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
        <Package className="w-6 h-6 text-white/20" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white/70 mb-1">Tracking code not found</p>
        <code className="text-xs font-mono text-white/30">{code}</code>
        <p className="text-xs text-white/25 mt-2 max-w-xs">Check your confirmation email and try again.</p>
      </div>
      <button onClick={onBack}
        className="flex items-center gap-2 px-5 py-2 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white hover:border-white/25 transition-all">
        <ArrowLeft className="w-3.5 h-3.5" /> Go back
      </button>
    </div>
  );
}

function ErrorScreen({ code, reason, onBack, onRetry }: {
  code: string; reason: "server_error" | "network_error"; onBack: () => void; onRetry: () => void;
}) {
  const isNetwork = reason === "network_error";
  return (
    <div className="flex flex-col h-[100dvh] bg-[#080808] text-white items-center justify-center gap-5 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-500/8 border border-red-500/20 flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-red-400/60" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white/70 mb-1">
          {isNetwork ? "No connection" : "Server error"}
        </p>
        <code className="text-xs font-mono text-white/30">{code}</code>
        <p className="text-xs text-white/25 mt-2 max-w-xs">
          {isNetwork
            ? "Could not reach the tracking server. Check your connection and try again."
            : "Something went wrong on our end. Please try again in a moment."}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-2 px-5 py-2 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white hover:border-white/25 transition-all">
          <ArrowLeft className="w-3.5 h-3.5" /> Go back
        </button>
        <button onClick={onRetry}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-all">
          <RotateCcw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function TrackingResult({ code, onBack }: Props) {
  const [result, setResult] = useState<FetchPackageResult | "loading">("loading");

  const load = useCallback(() => {
    setResult("loading");
    fetchPackage(code).then(setResult);
  }, [code]);

  useEffect(() => { load(); }, [load]);

  if (result === "loading") return <LoadingScreen />;
  if (!result.ok && result.reason === "not_found") return <NotFoundScreen code={code} onBack={onBack} />;
  if (!result.ok) return <ErrorScreen code={code} reason={result.reason as "server_error" | "network_error"} onBack={onBack} onRetry={load} />;
  return <TrackingView pkg={result.pkg} code={code} onBack={onBack} />;
}

// ─── Milestone stepper panel ──────────────────────────────────────────────────

function TimelinePanel({
  pkg,
  code,
  progress,
  simSpeed,
  secsAgo,
  bearing,
  currentCoord,
  deliveryEstimate,
  getProgressGradient,
  onOpenPlaces,
}: {
  pkg: Pkg;
  code: string;
  progress: number;
  simSpeed: number;
  secsAgo: number;
  bearing: number;
  currentCoord?: [number, number];
  deliveryEstimate: DeliveryEstimate;
  getProgressGradient: () => string;
  onOpenPlaces?: () => void;
}) {
  const currentMilestone = getMilestoneIndex(pkg.status);

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Estimated Delivery Date & Coordinates Card */}
      <div className="p-5 border-b border-white/6 flex-shrink-0 bg-white/[0.02]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[9px] text-red-400 font-semibold uppercase tracking-widest">
            <CalendarDays className="w-3 h-3" />
            <span>Estimated Delivery</span>
          </div>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">
            {deliveryEstimate.relativeTime}
          </span>
        </div>

        <div className="text-base font-semibold text-white tracking-tight mb-1">
          {deliveryEstimate.fullEstimate}
        </div>

        <div className="flex items-center gap-3 text-[10px] text-white/45 mb-3 flex-wrap">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-red-400/80 flex-shrink-0" />
            <span>{deliveryEstimate.remainingDistanceKm > 0 ? `${deliveryEstimate.remainingDistanceKm} km remaining` : "At destination"}</span>
          </div>
          <span className="text-white/15">•</span>
          <div className="flex items-center gap-1 font-mono text-white/40">
            <Crosshair className="w-3 h-3 text-blue-400/70 flex-shrink-0" />
            <span>{currentCoord ? `${currentCoord[0].toFixed(3)}°, ${currentCoord[1].toFixed(3)}°` : "GPS Position Locked"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-white/35 mb-4 flex-wrap">
          <MapPin className="w-2.5 h-2.5 text-white/20 flex-shrink-0" />
          <span className="truncate max-w-[90px]">{pkg.origin}</span>
          <ChevronRight className="w-3 h-3 text-white/12 flex-shrink-0" />
          <MapPin className="w-2.5 h-2.5 text-blue-500/50 flex-shrink-0" />
          <span className="truncate max-w-[90px]">{pkg.destination}</span>
        </div>

        <div>
          <div className="flex justify-between text-[9px] text-white/25 mb-1.5">
            <span>Origin</span>
            <span className="text-white/50 font-mono font-medium">{progress}%</span>
            <span>Destination</span>
          </div>
          <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
            <div className={`h-full bg-gradient-to-r ${getProgressGradient()} rounded-full`}
              style={{ width: `${progress}%`, transition: "width 1.6s cubic-bezier(0.4,0,0.2,1)" }} />
          </div>
        </div>

        {/* Quick Google Maps Grounding Insight action */}
        {onOpenPlaces && (
          <button
            onClick={onOpenPlaces}
            className="w-full mt-3.5 py-2 px-3 rounded-xl bg-red-600/15 hover:bg-red-600/25 border border-red-500/30 text-red-300 hover:text-white flex items-center justify-between text-xs transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-red-500/20 text-red-400 group-hover:scale-105 transition-transform">
                <MapPin className="w-3 h-3" />
              </div>
              <span className="font-semibold text-[11px]">Google Maps Data & Places</span>
            </div>
            <span className="text-[10px] text-red-400/80 group-hover:text-red-300 flex items-center gap-0.5">
              <span>Explore</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </button>
        )}
      </div>

      {/* Live telemetry row */}
      <div className="px-5 py-3 border-b border-white/6 flex-shrink-0 grid grid-cols-4 gap-1">
        {[
          { icon: Gauge, val: `${simSpeed}`, sub: "km/h" },
          { icon: Clock, val: `${secsAgo}s`, sub: "ping" },
          { icon: Compass, val: bearingToCardinal(bearing), sub: "hdg" },
          { icon: Navigation, val: `${Math.round(bearing)}°`, sub: "bear" },
        ].map(({ icon: Icon, val, sub }) => (
          <div key={sub} className="text-center bg-white/3 rounded-lg py-2">
            <Icon className="w-2.5 h-2.5 text-white/20 mx-auto mb-0.5" />
            <div className="text-[10px] font-mono text-white/65 tabular-nums">{val}</div>
            <div className="text-[8px] text-white/20">{sub}</div>
          </div>
        ))}
      </div>

      {/* Milestone stepper */}
      <div className="p-5 border-b border-white/6 flex-shrink-0">
        <div className="text-[9px] text-white/25 uppercase tracking-widest mb-4">Logistics Milestones</div>
        <div className="relative">
          {MILESTONES.map((ms, i) => {
            const done = i < currentMilestone;
            const active = i === currentMilestone;
            const pending = i > currentMilestone;
            return (
              <div key={i} className="flex gap-3 relative">
                {/* Connector line */}
                {i < MILESTONES.length - 1 && (
                  <div className={`absolute left-[10px] top-5 w-0.5 h-full -mb-1 ${done ? "bg-green-500/40" : "bg-white/6"}`} />
                )}
                {/* Circle */}
                <div className="flex-shrink-0 z-10 mt-0.5">
                  {done ? (
                    <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center">
                      <CheckCircle2 className="w-3 h-3 text-green-400" />
                    </div>
                  ) : active ? (
                    <div className="w-5 h-5 rounded-full bg-red-600/25 border border-red-500/60 flex items-center justify-center"
                      style={{ boxShadow: "0 0 8px rgba(220,38,38,0.4)" }}>
                      <div className="w-2 h-2 rounded-full bg-red-500"
                        style={{ animation: "pulse-live 1.4s ease-in-out infinite" }} />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-white/4 border border-white/10 flex items-center justify-center">
                      <Circle className="w-2.5 h-2.5 text-white/15" />
                    </div>
                  )}
                </div>
                {/* Label */}
                <div className={`pb-4 min-w-0 ${i === MILESTONES.length - 1 ? "pb-0" : ""}`}>
                  <div className={`text-xs font-medium leading-tight ${
                    done ? "text-green-400/80" : active ? "text-white/90" : pending ? "text-white/25" : ""
                  }`}>
                    {ms.label}
                    {active && (
                      <span className="ml-2 text-[8px] text-red-400 bg-red-600/15 border border-red-600/25 rounded-full px-1.5 py-0.5">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className={`text-[9px] mt-0.5 ${
                    done ? "text-green-400/40" : active ? "text-white/35" : "text-white/15"
                  }`}>{ms.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Package info */}
      <div className="p-4 border-b border-white/6 flex-shrink-0 grid grid-cols-2 gap-3">
        {[
          { label: "Carrier", value: pkg.carrier },
          { label: "Code", value: code },
          { label: "Weight", value: pkg.weight },
          { label: "Status", value: pkg.status },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="text-[9px] text-white/20 uppercase tracking-wider mb-0.5">{label}</div>
            <div className="text-[10px] text-white/55 truncate">{value}</div>
          </div>
        ))}
      </div>

      {/* Event log */}
      <div className="flex-1 p-5">
        <div className="text-[9px] text-white/25 uppercase tracking-widest mb-4">Event Log</div>
        <div className="relative">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/6" />
          <div className="space-y-4">
            {pkg.events.map((ev, i) => (
              <div key={i} className="flex gap-4 relative">
                <div className="flex-shrink-0 mt-0.5">
                  {ev.done
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 bg-[#0c0c0c]" />
                    : <Circle className="w-3.5 h-3.5 text-white/12 bg-[#0c0c0c]" />}
                </div>
                <div className="min-w-0">
                  <div className={`text-xs mb-0.5 ${ev.done ? "text-white/65" : "text-white/18"}`}>{ev.label}</div>
                  <div className="text-[9px] text-white/22">{ev.location}</div>
                  {ev.time_label && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-2 h-2 text-white/15" />
                      <span className="text-[9px] font-mono text-white/20">{ev.time_label}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Notifications panel ──────────────────────────────────────────────────────

function NotificationsPanel({
  pkg,
  trackingCode,
  simSpeed,
  secsAgo,
  playing,
  externalEmail,
  isExternalSubscribed,
  onNotifyUpdated,
}: {
  pkg: Pkg;
  trackingCode: string;
  simSpeed: number;
  secsAgo: number;
  playing: boolean;
  externalEmail?: string;
  isExternalSubscribed?: boolean;
  onNotifyUpdated?: (email: string, subscribed: boolean, isUserAction?: boolean) => void;
}) {
  const [email, setEmail] = useState(externalEmail || pkg.receiver_email || "");
  const [notifyChecked, setNotifyChecked] = useState(Boolean(isExternalSubscribed));
  const [subscribed, setSubscribed] = useState(Boolean(isExternalSubscribed));
  const [showInput, setShowInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<{ configured: boolean; user: string | null } | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [firestoreSaved, setFirestoreSaved] = useState(false);

  useEffect(() => {
    checkSmtpStatus().then((status) => {
      setSmtpStatus(status);
    });

    // Check if Firestore document already has notification email saved
    getNotificationEmailFromFirestore(trackingCode).then((saved) => {
      if (saved) {
        setEmail(saved);
        setNotifyChecked(true);
        setSubscribed(true);
        setFirestoreSaved(true);
        onNotifyUpdated?.(saved, true, false);
      } else if (externalEmail) {
        setEmail(externalEmail);
        setNotifyChecked(Boolean(isExternalSubscribed));
        setSubscribed(Boolean(isExternalSubscribed));
      }
    });
  }, [trackingCode, externalEmail, isExternalSubscribed]);

  const handleSubscribe = async () => {
    if (!email.includes("@")) return;
    setLoading(true);
    setApiError(null);

    try {
      // 1. Save user's email to the Firestore document for future status updates
      await saveNotificationEmailToFirestore(trackingCode, email, pkg);
      setFirestoreSaved(true);

      // 2. Trigger notification service / SMTP if configured
      const result = await subscribeToAlerts({
        email,
        trackingCode,
        status: pkg.status,
        eta: pkg.eta,
        from: pkg.origin,
        to: pkg.destination,
      });

      setSubscribed(true);
      setNotifyChecked(true);
      setEmailSent(Boolean(result.emailSent));
      onNotifyUpdated?.(email, true, true);
    } catch (err: any) {
      console.error("Failed to save email notification to Firestore:", err);
      setApiError(err?.message || "Failed to save email to Firestore.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxToggle = (checked: boolean) => {
    setNotifyChecked(checked);
    if (!checked) {
      setSubscribed(false);
      setFirestoreSaved(false);
      onNotifyUpdated?.("", false, true);
    } else {
      setShowInput(true);
      if (email.includes("@")) {
        handleSubscribe();
      }
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-white/6 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[9px] text-white/25 uppercase tracking-widest">Email Notifications</div>
          {smtpStatus && (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-medium border ${
              smtpStatus.configured
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-white/5 border-white/10 text-white/40"
            }`}>
              <Mail className="w-2.5 h-2.5" />
              <span>{smtpStatus.configured ? "Gmail SMTP Active" : "Gmail SMTP Standby"}</span>
            </div>
          )}
        </div>

        {/* 'Notify me via email' Checkbox Card */}
        <div className="mb-4">
          <label className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all cursor-pointer select-none">
            <input
              type="checkbox"
              id="notify-email-checkbox"
              checked={notifyChecked}
              onChange={(e) => handleCheckboxToggle(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-red-600 focus:ring-red-500/40 focus:ring-offset-0 cursor-pointer accent-red-600 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white/90">Notify me via email</span>
                <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-500/30">
                  Firestore
                </span>
              </div>
              <p className="text-[10px] text-white/40 leading-relaxed mt-0.5">
                Save your email to the package Firestore document for future status updates and alerts.
              </p>
            </div>
          </label>
        </div>

        {!subscribed ? (
          <>
            {notifyChecked && (
              <div className="space-y-2 mt-2 animate-fade-in">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setApiError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubscribe()}
                  placeholder="Enter email address..."
                  disabled={loading}
                  className="w-full bg-white/4 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-red-600/40 disabled:opacity-50"
                />
                {apiError && (
                  <div className="flex items-start gap-1.5 text-[10px] text-red-400">
                    <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" /><span>{apiError}</span>
                  </div>
                )}
                <button
                  onClick={handleSubscribe}
                  disabled={!email.includes("@") || loading}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white text-xs font-medium transition-all shadow-md shadow-red-950/40"
                >
                  {loading ? <><Loader2 className="w-3 h-3 animate-spin" />Saving to Firestore…</> : "Save Email to Firestore"}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-3 bg-white/[0.02] border border-white/8 rounded-xl p-3">
            <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto mb-1.5" />
            <p className="text-[11px] text-green-400 font-semibold">Saved to Firestore Document!</p>
            <p className="text-[10px] text-white/70 mt-1 break-all font-mono">{email}</p>
            <p className="text-[9px] text-white/40 mt-1.5 leading-relaxed">
              Future status updates and arrival notifications will be dispatched to this address.
            </p>
            <button
              onClick={() => { setSubscribed(false); setNotifyChecked(false); setFirestoreSaved(false); onNotifyUpdated?.("", false); }}
              className="mt-3 flex items-center gap-1 text-[9px] text-white/30 hover:text-white/60 transition-colors mx-auto"
            >
              <BellOff className="w-2.5 h-2.5" /> Edit or unsubscribe
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="text-[9px] text-white/25 uppercase tracking-widest mb-3">Recent Events</div>
        <div className="space-y-2">
          {pkg.events.filter((e) => e.done).slice(0, 5).map((ev, i) => (
            <div key={i} className="p-2.5 rounded-lg bg-white/3 border border-white/5">
              <div className="text-[10px] text-white/55 mb-0.5">{ev.label}</div>
              <div className="text-[9px] text-white/22">{ev.location}{ev.time_label ? ` · ${ev.time_label}` : ""}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-white/6 flex-shrink-0">
        <div className="text-[9px] text-white/20 uppercase tracking-widest mb-3">Live Stats</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Gauge, label: "Speed", value: `${simSpeed} km/h` },
            { icon: Wifi, label: "Signal", value: playing ? "Live" : "Paused" },
            { icon: CheckSquare, label: "Completed", value: pkg.events.filter((e) => e.done).length.toString() },
            { icon: Clock, label: "Updated", value: `${secsAgo}s` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white/3 rounded-lg p-2 text-center">
              <Icon className="w-3 h-3 text-white/18 mx-auto mb-1" />
              <div className="text-[10px] font-mono text-white/55">{value}</div>
              <div className="text-[8px] text-white/20">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Document printing ────────────────────────────────────────────────────────

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 40px; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 28px; }
  .logo { font-size: 17px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
  .logo span { color: #dc2626; }
  .meta { text-align: right; font-size: 10px; color: #888; line-height: 1.8; }
  .meta strong { color: #111; font-size: 11px; display: block; margin-bottom: 2px; }
  .doc-title { font-size: 22px; font-weight: 300; letter-spacing: -0.01em; margin-bottom: 3px; }
  .doc-sub { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.12em; }
  .tcode { font-family: monospace; font-size: 20px; font-weight: 700; letter-spacing: 0.08em; border: 2px solid #111; display: inline-block; padding: 7px 18px; margin: 10px 0 0; }
  .sec { margin-bottom: 24px; }
  .sec-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.15em; color: #999; border-bottom: 1px solid #e5e5e5; padding-bottom: 5px; margin-bottom: 14px; }
  .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 36px; }
  .g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px 24px; }
  .g4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px 20px; }
  .fl { font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 3px; }
  .fv { font-size: 11px; color: #111; font-weight: 500; line-height: 1.4; }
  .fv-sm { font-size: 10px; color: #444; margin-top: 2px; line-height: 1.5; }
  .party-box { border: 1px solid #e5e5e5; border-radius: 6px; padding: 14px; }
  .party-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #dc2626; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 10.5px; }
  th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #888; border-bottom: 2px solid #e5e5e5; padding: 7px 8px; text-align: left; }
  td { padding: 8px 8px; border-bottom: 1px solid #f3f3f3; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .total-row td { border-top: 2px solid #111; font-weight: 700; font-size: 12px; padding-top: 10px; }
  .badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
  .b-green { background:#f0fdf4;border:1px solid #86efac;color:#15803d; }
  .b-blue  { background:#eff6ff;border:1px solid #93c5fd;color:#1d4ed8; }
  .b-yellow{ background:#fefce8;border:1px solid #fde047;color:#854d0e; }
  .b-gray  { background:#f9f9f9;border:1px solid #d4d4d4;color:#555; }
  .notice { background: #f9f9f9; border-left: 3px solid #dc2626; padding: 10px 14px; font-size: 10px; color: #555; line-height: 1.6; margin-top: 4px; }
  .sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; margin-top: 44px; }
  .sig-line { border-top: 1px solid #bbb; padding-top: 6px; font-size: 9px; color: #888; }
  .ftr { margin-top: 36px; border-top: 1px solid #e5e5e5; padding-top: 14px; display: flex; justify-content: space-between; font-size: 9px; color: #bbb; }
  @media print { body { padding: 24px; } }
`;

function docHeader(docName: string, refNo: string, now: string, pages: number) {
  return `<div class="hdr">
    <div>
      <div class="logo">Tesla<span>Track</span></div>
      <div style="font-size:9px;color:#888;margin-top:4px;letter-spacing:0.1em;">PRECISION FLEET LOGISTICS</div>
    </div>
    <div class="meta">
      <strong>${docName.toUpperCase()}</strong>
      Ref: ${refNo}<br/>Issued: ${now}<br/>Pages: ${pages}
    </div>
  </div>`;
}

function partyBlock(label: string, name: string, address: string, email: string, phone: string) {
  return `<div class="party-box">
    <div class="party-label">${label}</div>
    <div class="fv">${name || "—"}</div>
    ${address ? `<div class="fv-sm">${address}</div>` : ""}
    ${email   ? `<div class="fv-sm">${email}</div>` : ""}
    ${phone   ? `<div class="fv-sm">${phone}</div>` : ""}
  </div>`;
}

function docFooter(refNo: string, now: string) {
  return `<div class="ftr">
    <span>TeslaTrack · Precision Fleet Logistics · ${refNo}</span>
    <span>Generated ${now} · System-generated document — not a financial instrument</span>
  </div>`;
}

function buildBOL(pkg: Pkg, code: string, refNo: string, now: string): string {
  const carrier = pkg.carrier || "Tesla Express";
  const weight  = pkg.weight  || "—";
  return `
  <div class="sec" style="margin-bottom:8px;">
    <div class="doc-title">Bill of Lading</div>
    <div class="doc-sub">Master transport document issued by carrier</div>
    <div class="tcode">${code}</div>
  </div>

  <div class="sec">
    <div class="sec-title">Parties</div>
    <div class="g2">
      ${partyBlock("Shipper / Exporter", pkg.sender_name || "On File", pkg.sender_address || "", pkg.sender_email || "", pkg.sender_phone || "")}
      ${partyBlock("Consignee / Receiver", pkg.receiver_name || "On File", pkg.receiver_address || "", pkg.receiver_email || "", pkg.receiver_phone || "")}
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">Transport Details</div>
    <div class="g3">
      <div><div class="fl">Carrier</div><div class="fv">${carrier}</div></div>
      <div><div class="fl">Delivery Method</div><div class="fv">${pkg.delivery_method || "Standard"}</div></div>
      <div><div class="fl">Tracking Code</div><div class="fv" style="font-family:monospace">${code}</div></div>
      <div><div class="fl">Port of Loading</div><div class="fv">${pkg.origin}</div></div>
      <div><div class="fl">Port of Discharge</div><div class="fv">${pkg.destination}</div></div>
      <div><div class="fl">ETA</div><div class="fv">${pkg.eta}</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">Cargo Description</div>
    <table>
      <thead><tr><th>Marks &amp; Numbers</th><th>Description of Goods</th><th>Packages</th><th>Gross Weight</th><th>Measurement</th></tr></thead>
      <tbody>
        <tr><td style="font-family:monospace">${code}</td><td>General Cargo — As per Commercial Invoice ${refNo.replace("BOL","INV")}</td><td>1 PKG</td><td>${weight}</td><td>—</td></tr>
      </tbody>
    </table>
  </div>

  <div class="sec">
    <div class="sec-title">Freight &amp; Charges</div>
    <div class="g3">
      <div><div class="fl">Freight Charges</div><div class="fv">$${Number(pkg.shipping_cost || 0).toFixed(2)}</div></div>
      <div><div class="fl">Status</div><div class="fv"><span class="badge b-blue">${pkg.status}</span></div></div>
      <div><div class="fl">Customs</div><div class="fv"><span class="badge ${pkg.customs_status === "Cleared" ? "b-green" : "b-yellow"}">${pkg.customs_status || "Pending"}</span></div></div>
    </div>
  </div>

  <div class="notice">
  Received by the carrier from the shipper in apparent good order and condition unless otherwise noted herein, the goods described above. In accepting this Bill of Lading the shipper expressly accepts and agrees to all its terms and conditions whether printed, stamped or written, or otherwise incorporated. This Bill of Lading is non-negotiable unless consigned "to order".
  </div>

  <div class="sig-row">
    <div class="sig-line">Shipper Signature &amp; Date</div>
    <div class="sig-line">Carrier Authorized Agent</div>
    <div class="sig-line">Place &amp; Date of Issue</div>
  </div>`;
}

function buildINV(pkg: Pkg, code: string, refNo: string, now: string): string {
  const subtotal  = Number(pkg.shipping_cost || 0);
  const customs   = Number(pkg.customs_fee   || 0);
  const total     = subtotal + customs;
  return `
  <div class="sec" style="margin-bottom:8px;">
    <div class="doc-title">Commercial Invoice</div>
    <div class="doc-sub">Declared value and goods description</div>
    <div class="tcode">${code}</div>
  </div>

  <div class="sec">
    <div class="sec-title">Invoice Details</div>
    <div class="g3">
      <div><div class="fl">Invoice No.</div><div class="fv" style="font-family:monospace">${refNo}</div></div>
      <div><div class="fl">Invoice Date</div><div class="fv">${now}</div></div>
      <div><div class="fl">Payment Terms</div><div class="fv">Net 30</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">Parties</div>
    <div class="g2">
      ${partyBlock("Seller / Exporter", pkg.sender_name || "On File", pkg.sender_address || "", pkg.sender_email || "", pkg.sender_phone || "")}
      ${partyBlock("Buyer / Importer",  pkg.receiver_name || "On File", pkg.receiver_address || "", pkg.receiver_email || "", pkg.receiver_phone || "")}
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">Line Items</div>
    <table>
      <thead><tr><th>#</th><th>Description</th><th>HS Code</th><th>Origin</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
      <tbody>
        <tr><td>1</td><td>Shipment — ${code}<br/><span style="font-size:9px;color:#888">${pkg.origin} → ${pkg.destination}</span></td><td>8471.30</td><td>${pkg.origin.split(",").pop()?.trim() || pkg.origin}</td><td>1</td><td>$${subtotal.toFixed(2)}</td><td>$${subtotal.toFixed(2)}</td></tr>
        ${customs > 0 ? `<tr><td>2</td><td>Customs &amp; Import Duties</td><td>—</td><td>—</td><td>1</td><td>$${customs.toFixed(2)}</td><td>$${customs.toFixed(2)}</td></tr>` : ""}
      </tbody>
      <tfoot>
        <tr class="total-row"><td colspan="5"></td><td>TOTAL DUE</td><td>$${total.toFixed(2)} USD</td></tr>
      </tfoot>
    </table>
  </div>

  <div class="sec">
    <div class="sec-title">Declaration</div>
    <div class="notice">I hereby certify that the information on this invoice is true and correct and that the contents and value of this shipment are as stated above.</div>
  </div>

  <div class="sig-row">
    <div class="sig-line">Authorized Signature</div>
    <div class="sig-line">Title / Position</div>
    <div class="sig-line">Date</div>
  </div>`;
}

function buildCUST(pkg: Pkg, code: string, refNo: string, now: string): string {
  const declaredValue = Number(pkg.shipping_cost || 0) + Number(pkg.customs_fee || 0);
  return `
  <div class="sec" style="margin-bottom:8px;">
    <div class="doc-title">Customs Declaration</div>
    <div class="doc-sub">Import / Export Regulatory Filing</div>
    <div class="tcode">${code}</div>
  </div>

  <div class="sec">
    <div class="sec-title">Declaration Reference</div>
    <div class="g4">
      <div><div class="fl">Declaration No.</div><div class="fv" style="font-family:monospace">${refNo}</div></div>
      <div><div class="fl">Date Filed</div><div class="fv">${now}</div></div>
      <div><div class="fl">Type</div><div class="fv">${pkg.delivery_method === "Import" ? "Import" : "Export"}</div></div>
      <div><div class="fl">Status</div><div class="fv"><span class="badge ${pkg.customs_status === "Cleared" ? "b-green" : "b-yellow"}">${pkg.customs_status || "Pending"}</span></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">Declarant &amp; Parties</div>
    <div class="g2">
      ${partyBlock("Exporter / Consignor", pkg.sender_name || "On File", pkg.sender_address || "", pkg.sender_email || "", pkg.sender_phone || "")}
      ${partyBlock("Importer / Consignee", pkg.receiver_name || "On File", pkg.receiver_address || "", pkg.receiver_email || "", pkg.receiver_phone || "")}
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">Goods Classification</div>
    <table>
      <thead><tr><th>Item</th><th>Description</th><th>HS Code</th><th>Country of Origin</th><th>Gross Wt.</th><th>Declared Value</th></tr></thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>General Cargo<br/><span style="font-size:9px;color:#888">Ref: ${code}</span></td>
          <td>8471.30.0000</td>
          <td>${pkg.origin.split(",").pop()?.trim() || pkg.origin}</td>
          <td>${pkg.weight || "—"}</td>
          <td>$${declaredValue.toFixed(2)} USD</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="sec">
    <div class="sec-title">Tariff &amp; Duty Assessment</div>
    <div class="g3">
      <div><div class="fl">Declared Value</div><div class="fv">$${declaredValue.toFixed(2)} USD</div></div>
      <div><div class="fl">Customs Fee</div><div class="fv">$${Number(pkg.customs_fee || 0).toFixed(2)} USD</div></div>
      <div><div class="fl">Clearance Status</div><div class="fv"><span class="badge ${pkg.customs_status === "Cleared" ? "b-green" : "b-yellow"}">${pkg.customs_status || "Pending"}</span></div></div>
      <div><div class="fl">Port of Entry</div><div class="fv">${pkg.destination}</div></div>
      <div><div class="fl">Port of Exit</div><div class="fv">${pkg.origin}</div></div>
      <div><div class="fl">Carrier</div><div class="fv">${pkg.carrier || "Tesla Express"}</div></div>
    </div>
  </div>

  <div class="notice">
  I declare that the information provided herein is complete, true, and correct to the best of my knowledge and belief. I understand that any false or misleading statement may subject me to civil and criminal penalties.
  </div>

  <div class="sig-row">
    <div class="sig-line">Declarant Signature</div>
    <div class="sig-line">Customs Officer Stamp</div>
    <div class="sig-line">Date of Clearance</div>
  </div>`;
}

function buildPKL(pkg: Pkg, code: string, refNo: string, _now: string): string {
  return `
  <div class="sec" style="margin-bottom:8px;">
    <div class="doc-title">Packing List</div>
    <div class="doc-sub">Itemized list of shipment contents</div>
    <div class="tcode">${code}</div>
  </div>

  <div class="sec">
    <div class="sec-title">Shipment Summary</div>
    <div class="g4">
      <div><div class="fl">From</div><div class="fv">${pkg.origin}</div></div>
      <div><div class="fl">To</div><div class="fv">${pkg.destination}</div></div>
      <div><div class="fl">Carrier</div><div class="fv">${pkg.carrier || "Tesla Express"}</div></div>
      <div><div class="fl">Method</div><div class="fv">${pkg.delivery_method || "Standard"}</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">Parties</div>
    <div class="g2">
      ${partyBlock("Shipper", pkg.sender_name || "On File", pkg.sender_address || "", pkg.sender_email || "", pkg.sender_phone || "")}
      ${partyBlock("Consignee", pkg.receiver_name || "On File", pkg.receiver_address || "", pkg.receiver_email || "", pkg.receiver_phone || "")}
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">Package Contents</div>
    <table>
      <thead><tr><th>Pkg #</th><th>Description</th><th>Qty</th><th>Unit</th><th>Net Wt.</th><th>Gross Wt.</th><th>Dimensions (cm)</th><th>Marks</th></tr></thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>General Cargo<br/><span style="font-size:9px;color:#888">Tracking: ${code}</span></td>
          <td>1</td>
          <td>PKG</td>
          <td>${pkg.weight || "—"}</td>
          <td>${pkg.weight || "—"}</td>
          <td>—</td>
          <td style="font-family:monospace;font-size:10px">${code}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="total-row"><td colspan="4">Totals</td><td>${pkg.weight || "—"}</td><td>${pkg.weight || "—"}</td><td></td><td>1 Pkg</td></tr>
      </tfoot>
    </table>
  </div>

  <div class="sec">
    <div class="sec-title">Special Handling Instructions</div>
    <div class="notice">Handle with care. Keep upright. Do not stack more than 3 high. Protect from moisture. Reference packing list ref ${refNo} on all correspondence.</div>
  </div>

  <div class="sig-row">
    <div class="sig-line">Packed By</div>
    <div class="sig-line">Verified By</div>
    <div class="sig-line">Date Packed</div>
  </div>`;
}

function buildINS(pkg: Pkg, code: string, refNo: string, now: string): string {
  const insuredValue = (Number(pkg.shipping_cost || 0) + Number(pkg.customs_fee || 0)) * 1.1;
  const policyNo     = `TT-POL-${code.slice(-6)}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  return `
  <div class="sec" style="margin-bottom:8px;">
    <div class="doc-title">Insurance Certificate</div>
    <div class="doc-sub">Cargo insurance documentation</div>
    <div class="tcode">${code}</div>
  </div>

  <div class="sec">
    <div class="sec-title">Policy Details</div>
    <div class="g4">
      <div><div class="fl">Policy No.</div><div class="fv" style="font-family:monospace">${policyNo}</div></div>
      <div><div class="fl">Certificate No.</div><div class="fv" style="font-family:monospace">${refNo}</div></div>
      <div><div class="fl">Issue Date</div><div class="fv">${now}</div></div>
      <div><div class="fl">Coverage Type</div><div class="fv">All-Risk (ICC-A)</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">Insured &amp; Beneficiary</div>
    <div class="g2">
      ${partyBlock("Insured Party", pkg.sender_name || "TeslaTrack Client", pkg.sender_address || "", pkg.sender_email || "", pkg.sender_phone || "")}
      ${partyBlock("Loss Payable To", pkg.receiver_name || "Consignee on Record", pkg.receiver_address || "", pkg.receiver_email || "", pkg.receiver_phone || "")}
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">Coverage Details</div>
    <div class="g3">
      <div><div class="fl">Insured Value</div><div class="fv">$${insuredValue.toFixed(2)} USD</div></div>
      <div><div class="fl">Deductible</div><div class="fv">$250.00 USD</div></div>
      <div><div class="fl">Premium</div><div class="fv">$${(insuredValue * 0.008).toFixed(2)} USD</div></div>
      <div><div class="fl">Conveyance</div><div class="fv">${pkg.carrier || "Tesla Express"}</div></div>
      <div><div class="fl">From</div><div class="fv">${pkg.origin}</div></div>
      <div><div class="fl">To</div><div class="fv">${pkg.destination}</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">Covered Risks</div>
    <table>
      <thead><tr><th>Risk Category</th><th>Covered</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td>Physical Loss or Damage</td><td><span class="badge b-green">Yes</span></td><td>All-risk, ICC-A clause</td></tr>
        <tr><td>Theft &amp; Pilferage</td><td><span class="badge b-green">Yes</span></td><td>Subject to deductible</td></tr>
        <tr><td>Natural Perils</td><td><span class="badge b-green">Yes</span></td><td>Storm, flood, lightning</td></tr>
        <tr><td>War &amp; Strikes</td><td><span class="badge b-gray">Excluded</span></td><td>Available as endorsement</td></tr>
        <tr><td>Inherent Vice</td><td><span class="badge b-gray">Excluded</span></td><td>Standard exclusion</td></tr>
      </tbody>
    </table>
  </div>

  <div class="notice">
  To file a claim, contact TeslaTrack Cargo Insurance within 72 hours of discovery of loss or damage. Quote policy number <strong>${policyNo}</strong> and tracking reference <strong>${code}</strong>. This certificate is issued subject to the terms and conditions of the master policy.
  </div>

  <div class="sig-row">
    <div class="sig-line">Authorized Underwriter</div>
    <div class="sig-line">Policy Stamp</div>
    <div class="sig-line">Effective Date</div>
  </div>`;
}

function printDocument(doc: { name: string; ref: string; pages: number }, pkg: Pkg, code: string) {
  const now   = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const refNo = `${doc.ref}-${code.slice(-3)}-${Date.now().toString(36).toUpperCase().slice(-4)}`;

  const bodyMap: Record<string, string> = {
    BOL:  buildBOL (pkg, code, refNo, now),
    INV:  buildINV (pkg, code, refNo, now),
    CUST: buildCUST(pkg, code, refNo, now),
    PKL:  buildPKL (pkg, code, refNo, now),
    INS:  buildINS (pkg, code, refNo, now),
  };

  const body = bodyMap[doc.ref] ?? bodyMap["BOL"];

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>${doc.name} — ${code}</title>
  <style>${BASE_CSS}</style></head><body>
  ${docHeader(doc.name, refNo, now, doc.pages)}
  ${body}
  ${docFooter(refNo, now)}
  </body></html>`;

  try {
    const win = window.open("", "_blank", "width=860,height=1100");
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

// ─── Document Vault panel ─────────────────────────────────────────────────────

const DOCUMENTS = [
  { name: "Bill of Lading",       desc: "Master transport document issued by carrier", status: "available" as const, pages: 2, ref: "BOL"  },
  { name: "Commercial Invoice",   desc: "Declared value and goods description",         status: "available" as const, pages: 1, ref: "INV"  },
  { name: "Customs Declaration",  desc: "Import/export regulatory filing",              status: "available" as const, pages: 3, ref: "CUST" },
  { name: "Packing List",         desc: "Itemized list of shipment contents",           status: "available" as const, pages: 1, ref: "PKL"  },
  { name: "Insurance Certificate",desc: "Cargo insurance documentation",                status: "available" as const, pages: 2, ref: "INS"  },
];

function DocumentsPanel({
  code,
  pkg,
  onOpenPrintLabel,
  onOpenTemplates,
}: {
  code: string;
  pkg: Pkg;
  onOpenPrintLabel?: () => void;
  onOpenTemplates?: () => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-white/6 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[9px] text-white/25 uppercase tracking-widest font-semibold">Document Vault &amp; Labels</div>
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/10">
            TSL-{code.slice(-4).toUpperCase()}
          </span>
        </div>
        <p className="text-[10px] text-white/35 leading-relaxed">
          Official carrier manifests, shipping waybills, and email templates for <span className="font-mono text-white/55">{code}</span>.
        </p>
      </div>

      <div className="flex-1 p-3.5 space-y-2.5 overflow-y-auto">
        {/* Featured: Official Shipping Label & Carrier Waybill */}
        <div className="rounded-xl border border-red-500/30 bg-gradient-to-br from-red-600/10 via-red-950/10 to-transparent p-3.5 shadow-lg shadow-black/40 relative overflow-hidden">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center flex-shrink-0 text-red-400 mt-0.5">
                <Printer className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white">Shipping Waybill Label</span>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 uppercase">
                    Ready
                  </span>
                </div>
                <div className="text-[9px] text-white/40 mt-0.5 leading-snug">
                  4" × 6" standard thermal label with scan barcode, recipient address, and routing code.
                </div>
                <div className="text-[8px] text-white/20 mt-1 font-mono">
                  REF: LBL-{code.slice(-4)} · 1 PKG · {pkg.weight || "2.5 KG"}
                </div>
              </div>
            </div>

            <button
              id="docs-print-label-btn"
              onClick={onOpenPrintLabel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold transition-all shadow-md shadow-red-900/30 flex-shrink-0 cursor-pointer"
            >
              <Printer className="w-3 h-3" />
              <span>Print Label</span>
            </button>
          </div>
        </div>

        {/* Featured: Automated Tracking Email Templates */}
        <div className="rounded-xl border border-blue-500/25 bg-blue-600/[0.04] p-3 transition-all hover:border-blue-500/40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0 text-blue-400">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-white/90">Tracking Mail Templates</div>
                <div className="text-[9px] text-white/40 truncate">
                  Dispatched, In Transit, Out for Delivery, and Label templates
                </div>
              </div>
            </div>

            {onOpenTemplates && (
              <button
                onClick={onOpenTemplates}
                className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 font-medium px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all flex-shrink-0"
              >
                <span>View Templates</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="text-[8px] text-white/20 uppercase tracking-wider px-1 pt-1 font-semibold">
          Commercial &amp; Transport Documents
        </div>

        {DOCUMENTS.map((doc) => (
          <div key={doc.ref} className={`rounded-xl border p-3.5 transition-all ${
            doc.status === "available"
              ? "bg-white/3 border-white/8 hover:border-white/15"
              : doc.status === "pending"
              ? "bg-yellow-500/4 border-yellow-500/15"
              : "bg-white/2 border-white/5"
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  doc.status === "available" ? "bg-blue-600/15 border border-blue-600/20" :
                  doc.status === "pending"   ? "bg-yellow-500/15 border border-yellow-500/20" :
                                              "bg-white/5 border border-white/8"
                }`}>
                  <FileText className={`w-4 h-4 ${
                    doc.status === "available" ? "text-blue-400" :
                    doc.status === "pending"   ? "text-yellow-400" : "text-white/25"
                  }`} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white/80 truncate">{doc.name}</div>
                  <div className="text-[9px] text-white/30 mt-0.5 leading-relaxed">{doc.desc}</div>
                  <div className="text-[8px] text-white/18 mt-1 font-mono">{doc.pages}p · REF: {doc.ref}-{code.slice(-3)}</div>
                </div>
              </div>

              <div className="flex-shrink-0 flex flex-col items-end gap-2">
                <span className={`text-[8px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wide ${
                  doc.status === "available"  ? "text-green-400 border-green-500/30 bg-green-500/10" :
                  doc.status === "pending"    ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" :
                                               "text-white/25 border-white/10 bg-white/4"
                }`}>
                  {doc.status}
                </span>
                {doc.status === "available" ? (
                  <button
                    className="flex items-center gap-1 text-[9px] text-blue-400/70 hover:text-blue-400 transition-colors"
                    onClick={() => printDocument(doc, pkg, code)}>
                    <Download className="w-2.5 h-2.5" /> Print / PDF
                  </button>
                ) : (
                  <div className="flex items-center gap-1 text-[9px] text-white/18">
                    <Lock className="w-2.5 h-2.5" />
                    {doc.status === "pending" ? "Pending" : "Processing"}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-white/6 flex-shrink-0">
        <div className="flex items-center gap-2 text-[9px] text-white/18">
          <Lock className="w-3 h-3" />
          <span>Documents are encrypted and access-controlled per tracking code.</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main TrackingView ────────────────────────────────────────────────────────

function TrackingView({ pkg, code, onBack }: { pkg: Pkg; code: string; onBack: () => void }) {
  const route = normalizeRoute(pkg.route);
  const fullPath = interpolateRoute(route, TOTAL);
  const startIdx = Math.min(Math.floor(pkg.start_progress * (TOTAL - 1)), TOTAL - 1);

  const [posIdx, setPosIdx] = useState(startIdx);
  const [playing, setPlaying] = useState(pkg.status !== "Delivered");
  const [secsAgo, setSecsAgo] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [bearing, setBearing] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("timeline");
  const [isNavMode, setIsNavMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("navigation_hud_enabled");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });
  const [isCameraFollowing, setIsCameraFollowing] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const deliveryFiredRef = useRef(false);

  const [mapTheme, setMapTheme] = useState<"dark" | "satellite" | "roadmap">("dark");
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const googleRef = useRef<any>(null);
  const vehicleOverlayRef = useRef<any>(null);
  const donePolyRef = useRef<any>(null);
  const remainPolyRef = useRef<any>(null);
  const originMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);

  // Google Maps Driving Directions & Traffic Layer
  const [googleDirections, setGoogleDirections] = useState<GoogleDirectionsResult | null>(null);
  const [isTrafficEnabled, setIsTrafficEnabled] = useState<boolean>(false);
  const trafficLayerRef = useRef<any>(null);

  useEffect(() => {
    if (!pkg.origin || !pkg.destination) return;
    let isMounted = true;
    fetchGoogleMapsDrivingRoute(pkg.origin, pkg.destination).then((res) => {
      if (isMounted && res) {
        setGoogleDirections(res);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [pkg.origin, pkg.destination]);

  const handleToggleTraffic = useCallback(() => {
    if (!mapInstanceRef.current || !googleRef.current) return;
    if (!trafficLayerRef.current) {
      trafficLayerRef.current = new googleRef.current.maps.TrafficLayer();
    }
    const nextState = !isTrafficEnabled;
    trafficLayerRef.current.setMap(nextState ? mapInstanceRef.current : null);
    setIsTrafficEnabled(nextState);
  }, [isTrafficEnabled]);

  // Email Notification & Firestore persistence state
  const [notifyEmail, setNotifyEmail] = useState<string>(pkg.receiver_email || "");
  const [isNotifySubscribed, setIsNotifySubscribed] = useState<boolean>(false);
  const [showQuickNotifyInput, setShowQuickNotifyInput] = useState<boolean>(false);
  const [isSavingFirestore, setIsSavingFirestore] = useState<boolean>(false);

  // Print Shipping Label Modal state
  const [showPrintLabelModal, setShowPrintLabelModal] = useState<boolean>(false);

  // Success Toast Notification state & auto-dismiss handler
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [successToast, setSuccessToast] = useState<{
    title: string;
    description: string;
    email: string;
  } | null>(null);

  const triggerEmailSuccessToast = useCallback((email: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setSuccessToast({
      title: "Email Notifications Enabled",
      description: "Shipment status updates and arrival notifications will be sent to your inbox.",
      email,
    });
    toastTimerRef.current = setTimeout(() => {
      setSuccessToast(null);
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Check if Firestore document has saved email on mount
    getNotificationEmailFromFirestore(code).then((saved) => {
      if (saved) {
        setNotifyEmail(saved);
        setIsNotifySubscribed(true);
      }
    });
  }, [code]);

  const handleQuickNotifyToggle = async (checked: boolean) => {
    if (!checked) {
      setIsNotifySubscribed(false);
      setShowQuickNotifyInput(false);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setSuccessToast(null);
    } else {
      if (notifyEmail && notifyEmail.includes("@")) {
        setIsSavingFirestore(true);
        try {
          await saveNotificationEmailToFirestore(code, notifyEmail, pkg);
          await subscribeToAlerts({
            email: notifyEmail,
            trackingCode: code,
            status: pkg.status,
            eta: pkg.eta,
            from: pkg.origin,
            to: pkg.destination,
          });
          setIsNotifySubscribed(true);
          setShowQuickNotifyInput(false);
          triggerEmailSuccessToast(notifyEmail);
        } catch (err) {
          console.error("Failed to save email to Firestore:", err);
          setShowQuickNotifyInput(true);
        } finally {
          setIsSavingFirestore(false);
        }
      } else {
        setShowQuickNotifyInput(true);
      }
    }
  };

  const handleQuickSaveEmail = async () => {
    if (!notifyEmail || !notifyEmail.includes("@")) return;
    setIsSavingFirestore(true);
    try {
      await saveNotificationEmailToFirestore(code, notifyEmail, pkg);
      await subscribeToAlerts({
        email: notifyEmail,
        trackingCode: code,
        status: pkg.status,
        eta: pkg.eta,
        from: pkg.origin,
        to: pkg.destination,
      });
      setIsNotifySubscribed(true);
      setShowQuickNotifyInput(false);
      triggerEmailSuccessToast(notifyEmail);
    } catch (err) {
      console.error("Failed to save email to Firestore:", err);
    } finally {
      setIsSavingFirestore(false);
    }
  };

  useEffect(() => {
    const t = setInterval(() => { setCurrentTime(new Date()); setSecsAgo((s) => s + 1); }, 1000);
    return () => clearInterval(t);
  }, []);

  const baseStepMs = computeStepMs(pkg.eta, pkg.start_progress);
  const effectiveStepMs = Math.max(100, Math.round(baseStepMs / speedMultiplier));

  useEffect(() => {
    if (!playing || posIdx >= TOTAL - 1) return;
    const t = setInterval(() => {
      setPosIdx((i) => {
        const next = Math.min(i + 1, TOTAL - 1);
        if (next >= TOTAL - 1 && !deliveryFiredRef.current) {
          deliveryFiredRef.current = true;
          notifyDelivered(code);
        }
        return next;
      });
      setSecsAgo(0);
    }, effectiveStepMs);
    return () => clearInterval(t);
  }, [playing, posIdx, code, effectiveStepMs]);

  useEffect(() => {
    const pos = fullPath[posIdx];
    if (!pos || !googleRef.current) return;
    const next = fullPath[Math.min(posIdx + 1, TOTAL - 1)];
    const prev = fullPath[Math.max(posIdx - 1, 0)];
    const b = posIdx < TOTAL - 1 ? getBearing(pos, next) : getBearing(prev, pos);
    setBearing(b);
    const isMoving = playing && posIdx < TOTAL - 1;

    const latLng = new googleRef.current.maps.LatLng(pos[0], pos[1]);
    vehicleOverlayRef.current?.setPositionAndState(latLng, isMoving, b, effectiveStepMs);
    donePolyRef.current?.setPath(fullPath.slice(0, posIdx + 1).map((p) => ({ lat: p[0], lng: p[1] })));
    remainPolyRef.current?.setPath(fullPath.slice(posIdx).map((p) => ({ lat: p[0], lng: p[1] })));
  }, [posIdx, playing, effectiveStepMs]);

  // Smooth camera tracking when following is active
  useEffect(() => {
    if (!mapInstanceRef.current || !isCameraFollowing) return;
    const pos = fullPath[posIdx];
    if (pos) {
      mapInstanceRef.current.panTo({ lat: pos[0], lng: pos[1] });
    }
  }, [posIdx, isCameraFollowing]);

  useEffect(() => {
    if (mapInstanceRef.current && googleRef.current) {
      setTimeout(() => {
        if (mapInstanceRef.current && googleRef.current) {
          googleRef.current.maps.event.trigger(mapInstanceRef.current, "resize");
        }
      }, 300);
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (!mapRef.current) return;
    let isMounted = true;
    setMapLoading(true);
    setMapError(null);

    loadGoogleMaps().then((g) => {
      if (!isMounted || !mapRef.current) return;
      googleRef.current = g;

      const initPos = fullPath[startIdx];
      const map = new g.maps.Map(mapRef.current, {
        center: { lat: initPos[0], lng: initPos[1] },
        zoom: 12,
        disableDefaultUI: true,
        styles: TESLA_DARK_MAP_STYLES,
        backgroundColor: "#080808",
        gestureHandling: "greedy",
      });

      g.maps.event.addListener(map, "dragstart", () => {
        setIsCameraFollowing(false);
      });

      // Done polyline (Completed route - red)
      const donePoly = new g.maps.Polyline({
        path: fullPath.slice(0, startIdx + 1).map((p) => ({ lat: p[0], lng: p[1] })),
        geodesic: true,
        strokeColor: "#ef4444",
        strokeOpacity: 0.95,
        strokeWeight: 4,
        map,
      });
      donePolyRef.current = donePoly;

      // Remaining polyline (Remaining route - blue)
      const remainPoly = new g.maps.Polyline({
        path: fullPath.slice(startIdx).map((p) => ({ lat: p[0], lng: p[1] })),
        geodesic: true,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.7,
        strokeWeight: 3,
        map,
      });
      remainPolyRef.current = remainPoly;

      // Origin Marker
      const originMarker = new g.maps.Marker({
        position: { lat: fullPath[0][0], lng: fullPath[0][1] },
        map,
        title: `Origin: ${pkg.origin}`,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: "#71717a",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      originMarkerRef.current = originMarker;

      const originInfo = new g.maps.InfoWindow({
        content: `<div style="color:#09090b;padding:4px 6px;font-family:system-ui,-apple-system,sans-serif;"><div style="font-size:10px;font-weight:700;color:#ef4444;letter-spacing:0.05em;">ORIGIN HUB</div><div style="font-size:12px;font-weight:600;margin-top:2px;">${pkg.origin}</div></div>`,
      });
      originMarker.addListener("click", () => originInfo.open(map, originMarker));

      // Destination Marker
      const destMarker = new g.maps.Marker({
        position: { lat: fullPath[TOTAL - 1][0], lng: fullPath[TOTAL - 1][1] },
        map,
        title: `Destination: ${pkg.destination}`,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#10b981",
          fillOpacity: 1,
          strokeColor: "#34d399",
          strokeWeight: 2.5,
        },
      });
      destMarkerRef.current = destMarker;

      const destInfo = new g.maps.InfoWindow({
        content: `<div style="color:#09090b;padding:4px 6px;font-family:system-ui,-apple-system,sans-serif;"><div style="font-size:10px;font-weight:700;color:#10b981;letter-spacing:0.05em;">FINAL DESTINATION</div><div style="font-size:12px;font-weight:600;margin-top:2px;">${pkg.destination}</div></div>`,
      });
      destMarker.addListener("click", () => destInfo.open(map, destMarker));

      const initNext = fullPath[Math.min(startIdx + 1, TOTAL - 1)];
      const initBearing = startIdx < TOTAL - 1 ? getBearing(initPos, initNext) : 0;
      setBearing(initBearing);

      // Custom Vehicle Overlay with heading angle rotation
      class VehicleOverlay extends g.maps.OverlayView {
        private div: HTMLDivElement | null = null;
        private pos: any;
        private moving: boolean;
        private brg: number;

        constructor(pos: any, moving: boolean, brg: number) {
          super();
          this.pos = pos;
          this.moving = moving;
          this.brg = brg;
        }

        onAdd() {
          this.div = document.createElement("div");
          this.div.style.position = "absolute";
          this.div.style.cursor = "pointer";
          this.div.style.zIndex = "1000";
          this.div.className = "tesla-vehicle-marker";
          this.div.innerHTML = vehicleMarkerHtml(this.moving, this.brg);
          const panes = this.getPanes();
          panes?.overlayMouseTarget.appendChild(this.div);
        }

        setPositionAndState(pos: any, moving: boolean, brg: number, durationMs: number = 300) {
          this.pos = pos;
          this.moving = moving;
          this.brg = brg;
          if (this.div) {
            this.div.innerHTML = vehicleMarkerHtml(this.moving, this.brg);
            if (moving && durationMs > 50) {
              this.div.style.transition = `left ${durationMs}ms linear, top ${durationMs}ms linear`;
            } else {
              this.div.style.transition = "none";
            }
          }
          this.draw();
        }

        draw() {
          if (!this.div) return;
          const projection = this.getProjection();
          if (!projection) return;
          const point = projection.fromLatLngToDivPixel(this.pos);
          if (point) {
            this.div.style.left = `${point.x - 16}px`;
            this.div.style.top = `${point.y - 24}px`;
          }
        }

        onRemove() {
          if (this.div?.parentNode) {
            this.div.parentNode.removeChild(this.div);
            this.div = null;
          }
        }
      }

      const initLatLng = new g.maps.LatLng(initPos[0], initPos[1]);
      const vehicleOverlay = new VehicleOverlay(initLatLng, pkg.status !== "Delivered", initBearing);
      vehicleOverlay.setMap(map);
      vehicleOverlayRef.current = vehicleOverlay;

      mapInstanceRef.current = map;
      setMapLoading(false);
    }).catch((err) => {
      console.error("Google Maps Platform initialization failed:", err);
      if (isMounted) {
        setMapError("Unable to load Google Maps Platform. Please verify network connectivity.");
        setMapLoading(false);
      }
    });

    return () => {
      isMounted = false;
      trafficLayerRef.current?.setMap(null);
      trafficLayerRef.current = null;
      vehicleOverlayRef.current?.setMap(null);
      donePolyRef.current?.setMap(null);
      remainPolyRef.current?.setMap(null);
      originMarkerRef.current?.setMap(null);
      destMarkerRef.current?.setMap(null);
      mapInstanceRef.current = null;
      googleRef.current = null;
    };
  }, []);

  const handleRecenterCamera = useCallback(() => {
    setIsCameraFollowing(true);
    const pos = fullPath[posIdx];
    if (pos && mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: pos[0], lng: pos[1] });
      mapInstanceRef.current.setZoom(15);
      if (typeof mapInstanceRef.current.setHeading === "function") {
        try {
          mapInstanceRef.current.setHeading(bearing);
          mapInstanceRef.current.setTilt(45);
        } catch {}
      }
    }
  }, [fullPath, posIdx, bearing]);

  const handleToggleOverview = useCallback(() => {
    setIsCameraFollowing(false);
    if (mapInstanceRef.current && fullPath.length > 0 && googleRef.current) {
      try {
        if (typeof mapInstanceRef.current.setTilt === "function") {
          mapInstanceRef.current.setTilt(0);
        }
      } catch {}
      const bounds = new googleRef.current.maps.LatLngBounds();
      fullPath.forEach((p) => bounds.extend({ lat: p[0], lng: p[1] }));
      mapInstanceRef.current.fitBounds(bounds, 80);
    }
  }, [fullPath]);

  const handleSwitchMapTheme = (theme: "dark" | "satellite" | "roadmap") => {
    setMapTheme(theme);
    if (!mapInstanceRef.current) return;
    if (theme === "satellite") {
      mapInstanceRef.current.setMapTypeId("hybrid");
      mapInstanceRef.current.setOptions({ styles: [] });
    } else if (theme === "roadmap") {
      mapInstanceRef.current.setMapTypeId("roadmap");
      mapInstanceRef.current.setOptions({ styles: [] });
    } else {
      mapInstanceRef.current.setMapTypeId("roadmap");
      mapInstanceRef.current.setOptions({ styles: TESLA_DARK_MAP_STYLES });
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 12) + 1);
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 12) - 1);
    }
  };

  const handleReset = useCallback(() => {
    setPosIdx(startIdx); setSecsAgo(0); setPlaying(true);
    deliveryFiredRef.current = false;
    handleRecenterCamera();
  }, [startIdx, handleRecenterCamera]);

  const progress = Math.round((posIdx / (TOTAL - 1)) * 100);
  const isDelivered = posIdx >= TOTAL - 1 || pkg.status === "Delivered";
  const simSpeed = isDelivered ? 0 : playing ? pkg.speed_kph : 0;

  const currentCoord = fullPath[posIdx];
  const destCoord = fullPath[TOTAL - 1];
  const remainingDistanceKm = calculateRemainingDistanceKm(fullPath, posIdx);
  const deliveryEstimate = calculateEstimatedDelivery(
    isDelivered ? "Delivered" : pkg.status,
    currentCoord,
    destCoord,
    remainingDistanceKm,
    simSpeed || pkg.speed_kph,
    pkg.eta
  );

  const getStatusColor = () => {
    if (isDelivered) return "text-green-400 bg-green-500/10 border-green-500/20";
    if (pkg.status === "Out for Delivery") return "text-orange-400 bg-orange-500/10 border-orange-500/20";
    return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
  };
  const getProgressGradient = () => {
    if (isDelivered) return "from-green-600 to-green-400";
    if (pkg.status === "Out for Delivery") return "from-red-600 via-orange-500 to-blue-500";
    return "from-red-600 to-yellow-500";
  };

  return (
    <div className="relative bg-[#080808] text-white overflow-hidden animate-fade-in" style={{ height: "100dvh", width: "100vw" }}>

      {/* ══ FULL-SCREEN GOOGLE MAP ══════════════════════════════════════════════════ */}
      <div ref={mapRef} className="absolute inset-0 z-0 bg-[#080808]" />

      {/* Google Maps Loading State */}
      {mapLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#080808]/90 backdrop-blur-sm gap-3 pointer-events-none">
          <Loader2 className="w-7 h-7 text-red-500 animate-spin" />
          <span className="text-xs font-mono text-white/60 tracking-wider">LOADING GOOGLE MAPS PLATFORM...</span>
        </div>
      )}

      {/* Google Maps Error Banner */}
      {mapError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-red-950/90 border border-red-500/40 rounded-xl px-4 py-2.5 text-xs text-red-200 flex items-center gap-2 shadow-2xl backdrop-blur-md">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{mapError}</span>
        </div>
      )}

      {/* Google Maps Controls: Moved under unified menu Drawer ('Map' & 'Controls' tabs) */}

      {/* ══ FLOATING HEADER ═════════════════════════════════════════════════════ */}
      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
        <div className="mx-3 mt-3 pointer-events-auto">
          <div className="flex items-center justify-between bg-black/85 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2.5 shadow-2xl">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={onBack}
                className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors flex-shrink-0 group">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              </button>
              <div className="w-px h-4 bg-white/10 flex-shrink-0" />
              <img src="/tesla-logo.png" alt="TeslaTrack" className="logo-spin w-8 h-8 object-contain flex-shrink-0" />
              <code className="text-[11px] font-mono text-white/50 truncate max-w-[120px] sm:max-w-none">{code}</code>
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
              {/* Calculated Delivery Date badge */}
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/75">
                <CalendarDays className="w-3 h-3 text-red-400 flex-shrink-0" />
                <span>Est: <strong className="font-medium text-white/90">{deliveryEstimate.fullEstimate}</strong></span>
              </div>
              <div className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border ${getStatusColor()}`}>
                {!isDelivered && playing && (
                  <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0"
                    style={{ animation: "pulse-live 1.5s ease-in-out infinite" }} />
                )}
                <span>{isDelivered ? "Delivered" : pkg.status}</span>
              </div>
              <span className="text-[10px] font-mono text-white/30 tabular-nums hidden md:inline">
                {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>

              {/* 'Notify me via email' Checkbox Pill (Firestore Persistence) */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                  isNotifySubscribed
                    ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                    : "bg-white/5 hover:bg-white/10 border-white/10 text-white/80"
                }`}
              >
                <label
                  htmlFor="top-notify-email-checkbox"
                  className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] font-medium"
                >
                  <input
                    type="checkbox"
                    id="top-notify-email-checkbox"
                    checked={isNotifySubscribed}
                    onChange={(e) => handleQuickNotifyToggle(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-red-600 focus:ring-0 cursor-pointer accent-red-600"
                  />
                  <span>
                    {isNotifySubscribed ? "Email Alerts Active" : "Notify me via email"}
                  </span>
                </label>
                {isSavingFirestore && <Loader2 className="w-2.5 h-2.5 animate-spin text-red-400" />}
              </div>

              {/* 'Print Label' Quick Action Button */}
              <button
                id="header-print-label-btn"
                onClick={() => setShowPrintLabelModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/80 hover:text-white transition-all text-[10px] font-medium cursor-pointer"
                title="Print Official Shipping Label & Waybill"
              >
                <Printer className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="hidden sm:inline">Print Label</span>
                <span className="sm:hidden">Print</span>
              </button>

              <div className="w-px h-4 bg-white/10 flex-shrink-0" />
              <button
                id="header-menu-toggle-btn"
                onClick={() => setDrawerOpen((o) => !o)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                  drawerOpen
                    ? "bg-red-600/25 border-red-500/50 text-red-400 font-semibold"
                    : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white"
                }`}
                title="Open Unified Control Menu"
              >
                <Menu className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium hidden sm:inline">Menu</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══ FLOATING SIDE MENU BUTTON ════════════════════════════════════════════ */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 z-30 pointer-events-auto">
        <div className="flex flex-col gap-0 mr-0">
          <button
            onClick={() => setDrawerOpen((o) => !o)}
            className="group flex flex-col items-center justify-center gap-1.5 w-10 py-4 bg-black/85 backdrop-blur-md border border-white/10 border-r-0 rounded-tl-2xl shadow-xl transition-all hover:bg-black/95"
            title="Open Unified Delivery Menu"
          >
            {drawerOpen
              ? <X className="w-4 h-4 text-white/60 group-hover:text-white/90 transition-colors" />
              : <Menu className="w-4 h-4 text-white/60 group-hover:text-white/90 transition-colors" />
            }
          </button>

          {(["timeline", "places", "controls", "map", "alerts", "templates", "docs"] as DrawerTab[]).map((tab, i) => {
            const icons = { timeline: List, places: MapPin, controls: Navigation, map: Layers, alerts: Bell, templates: Mail, docs: FileText };
            const labels = { timeline: "Track", places: "Maps Data", controls: "Controls", map: "Map", alerts: "Alerts", templates: "Templates", docs: "Docs" };
            const Icon = icons[tab];
            const isLast = i === 6;
            return (
              <button key={tab}
                onClick={() => { setDrawerTab(tab); setDrawerOpen(true); }}
                className={`group flex flex-col items-center justify-center gap-1 w-10 py-3 backdrop-blur-md border border-white/10 border-r-0 border-t-0 shadow-xl transition-all ${
                  isLast ? "rounded-bl-2xl" : ""
                } ${
                  drawerOpen && drawerTab === tab
                    ? "bg-red-600/25 border-red-600/30 text-red-400"
                    : "bg-black/75 hover:bg-black/90 text-white/30 hover:text-white/70"
                }`}
                title={`Open ${labels[tab]}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[7px] tracking-wide"
                  style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>
                  {labels[tab]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ SLIDE-IN DRAWER ══════════════════════════════════════════════════════ */}
      {drawerOpen && (
        <div className="absolute inset-0 z-[25] bg-black/20 backdrop-blur-[1px]"
          onClick={() => setDrawerOpen(false)} />
      )}

      <div
        className={`absolute top-0 right-0 bottom-0 z-30 ${drawerTab === "templates" ? "w-[640px] max-w-[96vw]" : "w-80 max-w-[85vw]"} bg-[#0b0b0b] border-l border-white/8 flex flex-col shadow-2xl transition-all duration-300 ease-in-out`}
        style={{ transform: drawerOpen ? "translateX(0)" : "translateX(100%)" }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-1 bg-white/4 rounded-xl border border-white/8 p-0.5 overflow-x-auto scrollbar-none">
            {(["timeline", "places", "controls", "map", "alerts", "templates", "docs"] as DrawerTab[]).map((tab) => {
              const icons = { timeline: List, places: MapPin, controls: Navigation, map: Layers, alerts: Bell, templates: Mail, docs: FileText };
              const labels = { timeline: "Timeline", places: "Maps Data", controls: "Controls", map: "Map", alerts: "Alerts", templates: "Templates", docs: "Docs" };
              const Icon = icons[tab];
              return (
                <button key={tab} onClick={() => setDrawerTab(tab)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all whitespace-nowrap ${
                    drawerTab === tab
                      ? "bg-red-600/20 text-red-400 border border-red-600/30 font-semibold"
                      : "text-white/35 hover:text-white/60"
                  }`}>
                  <Icon className="w-3 h-3 flex-shrink-0" /> {labels[tab]}
                </button>
              );
            })}
          </div>
          <button onClick={() => setDrawerOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/4 hover:bg-white/10 border border-white/8 text-white/40 hover:text-white/70 transition-all flex-shrink-0 ml-1.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Drawer content */}
        <div className="flex-1 overflow-y-auto">
          {drawerTab === "timeline" && (
            <TimelinePanel
              pkg={pkg} code={code} progress={progress} simSpeed={simSpeed}
              secsAgo={secsAgo} bearing={bearing}
              currentCoord={currentCoord}
              deliveryEstimate={deliveryEstimate}
              getProgressGradient={getProgressGradient}
              onOpenPlaces={() => { setDrawerTab("places"); setDrawerOpen(true); }}
            />
          )}

          {/* Google Maps Grounding & Place Intelligence */}
          {drawerTab === "places" && (
            <GoogleMapsGroundingPanel pkg={pkg} trackingCode={code} />
          )}

          {/* Unified Controls & Navigation Tab */}
          {drawerTab === "controls" && (
            <div className="p-4 space-y-4">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 font-semibold">Navigation & HUD</span>
                <div className="mt-2 space-y-2">
                  <button
                    onClick={() => {
                      setIsNavMode((n) => {
                        const next = !n;
                        try {
                          localStorage.setItem("navigation_hud_enabled", String(next));
                        } catch {}
                        return next;
                      });
                      if (!isNavMode) handleRecenterCamera();
                    }}
                    className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isNavMode
                        ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-300"
                        : "bg-white/[0.03] border-white/8 hover:bg-white/[0.06] text-white/70"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${isNavMode ? "bg-emerald-500/20" : "bg-white/5"}`}>
                        <Navigation className={`w-4 h-4 ${isNavMode ? "text-emerald-400" : "text-white/50"}`} />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-semibold">Google Maps Turn-by-Turn HUD</div>
                        <div className="text-[10px] text-white/40">Real-time turn navigation overlay</div>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      isNavMode ? "bg-emerald-500/30 text-emerald-300" : "bg-white/10 text-white/40"
                    }`}>
                      {isNavMode ? "ACTIVE" : "OFF"}
                    </span>
                  </button>

                  <button
                    onClick={handleToggleTraffic}
                    className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isTrafficEnabled
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                        : "bg-white/[0.03] border-white/8 hover:bg-white/[0.06] text-white/70"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${isTrafficEnabled ? "bg-amber-500/20" : "bg-white/5"}`}>
                        <Layers className={`w-4 h-4 ${isTrafficEnabled ? "text-amber-400" : "text-white/50"}`} />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-semibold">Live Traffic Overlay</div>
                        <div className="text-[10px] text-white/40">Google congestion heatmap</div>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      isTrafficEnabled ? "bg-amber-500/30 text-amber-300" : "bg-white/10 text-white/40"
                    }`}>
                      {isTrafficEnabled ? "ENABLED" : "DISABLED"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Simulation Playback & Speed */}
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 font-semibold">Delivery Simulation</span>
                <div className="mt-2 p-3.5 rounded-xl bg-white/[0.03] border border-white/8 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-600"
                        style={{
                          boxShadow: playing && !isDelivered ? "0 0 8px rgba(220,38,38,0.9)" : "none",
                          animation: playing && !isDelivered ? "pulse-live 1.4s ease-in-out infinite" : "none",
                        }} />
                      <span className="text-xs font-medium text-white/80">
                        {isDelivered ? "Delivered" : playing ? `Live · ${simSpeed} km/h` : "Paused"}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-white/40">Est: {deliveryEstimate.shortEstimate}</span>
                  </div>

                  {!isDelivered && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setPlaying((p) => !p)}
                          className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 text-xs font-medium transition-all ${
                            playing
                              ? "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                              : "bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30"
                          }`}
                        >
                          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          {playing ? "Pause" : "Play"}
                        </button>
                        <button
                          onClick={handleReset}
                          className="py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-2 text-xs font-medium text-white/70 hover:text-white transition-all"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reset
                        </button>
                      </div>

                      <div>
                        <div className="text-[10px] text-white/50 mb-1.5 flex items-center justify-between">
                          <span>Playback Speed Multiplier</span>
                          <span className="text-red-400 font-mono font-bold">{speedMultiplier}x</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[1, 2, 5, 10].map((mult) => (
                            <button
                              key={mult}
                              onClick={() => setSpeedMultiplier(mult)}
                              className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
                                speedMultiplier === mult
                                  ? "bg-red-500/20 text-red-400 border-red-500/40"
                                  : "bg-white/5 border-white/5 text-white/40 hover:text-white/80 hover:bg-white/10"
                              }`}
                            >
                              {mult}x
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Unified Map & Camera Settings Tab */}
          {drawerTab === "map" && (
            <div className="p-4 space-y-4">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 font-semibold">Map Display Theme</span>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => handleSwitchMapTheme("dark")}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                      mapTheme === "dark"
                        ? "bg-red-600/20 text-red-400 border-red-600/40 font-semibold"
                        : "bg-white/[0.03] border-white/8 text-white/50 hover:text-white/80 hover:bg-white/[0.06]"
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    <span className="text-[10px]">Tesla Dark</span>
                  </button>
                  <button
                    onClick={() => handleSwitchMapTheme("satellite")}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                      mapTheme === "satellite"
                        ? "bg-red-600/20 text-red-400 border-red-600/40 font-semibold"
                        : "bg-white/[0.03] border-white/8 text-white/50 hover:text-white/80 hover:bg-white/[0.06]"
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span className="text-[10px]">Satellite</span>
                  </button>
                  <button
                    onClick={() => handleSwitchMapTheme("roadmap")}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                      mapTheme === "roadmap"
                        ? "bg-red-600/20 text-red-400 border-red-600/40 font-semibold"
                        : "bg-white/[0.03] border-white/8 text-white/50 hover:text-white/80 hover:bg-white/[0.06]"
                    }`}
                  >
                    <MapIcon className="w-4 h-4" />
                    <span className="text-[10px]">Roadmap</span>
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 font-semibold">Camera & Viewport</span>
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleRecenterCamera}
                      className={`p-3 rounded-xl border flex items-center gap-2 transition-all ${
                        isCameraFollowing
                          ? "bg-red-600/20 border-red-600/40 text-red-400"
                          : "bg-white/[0.03] border-white/8 text-white/70 hover:bg-white/[0.06]"
                      }`}
                    >
                      <Crosshair className="w-4 h-4" />
                      <div className="text-left">
                        <div className="text-xs font-medium">Recenter</div>
                        <div className="text-[9px] text-white/40">Follow Tesla</div>
                      </div>
                    </button>
                    <button
                      onClick={handleToggleOverview}
                      className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 text-white/70 hover:text-white flex items-center gap-2 transition-all"
                    >
                      <Maximize2 className="w-4 h-4" />
                      <div className="text-left">
                        <div className="text-xs font-medium">Full Route</div>
                        <div className="text-[9px] text-white/40">Fit Bounds</div>
                      </div>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/8 flex items-center justify-between">
                    <span className="text-xs text-white/70 font-medium">Zoom Controls</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleZoomIn}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                        title="Zoom In"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleZoomOut}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                        title="Zoom Out"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {drawerTab === "alerts" && (
            <NotificationsPanel
              pkg={pkg}
              trackingCode={code}
              simSpeed={simSpeed}
              secsAgo={secsAgo}
              playing={playing}
              externalEmail={notifyEmail}
              isExternalSubscribed={isNotifySubscribed}
              onNotifyUpdated={(newEmail, subscribed, isUserAction) => {
                setNotifyEmail(newEmail);
                setIsNotifySubscribed(subscribed);
                if (subscribed && isUserAction && newEmail) {
                  triggerEmailSuccessToast(newEmail);
                }
              }}
            />
          )}
          {drawerTab === "templates" && (
            <div className="h-full flex flex-col overflow-y-auto">
              <div className="p-4 border-b border-white/6 flex items-center justify-between flex-shrink-0 bg-white/[0.02]">
                <div>
                  <div className="text-[9px] text-white/30 uppercase tracking-widest font-semibold">Tracking Mail Templates</div>
                  <p className="text-[11px] text-white/50 mt-0.5">Automated carrier notification templates for <span className="font-mono text-white/80">{code}</span></p>
                </div>
                <button
                  id="templates-print-label-shortcut-btn"
                  onClick={() => setShowPrintLabelModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-medium transition-all cursor-pointer"
                  title="Print Shipping Label"
                >
                  <Printer className="w-3.5 h-3.5 text-red-400" />
                  <span>Print Label</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <TrackingEmailTemplatesTab
                  packages={[pkg]}
                  initialPackageCode={code}
                  onTrack={() => {}}
                />
              </div>
            </div>
          )}
          {drawerTab === "docs" && (
            <DocumentsPanel
              code={code}
              pkg={pkg}
              onOpenPrintLabel={() => setShowPrintLabelModal(true)}
              onOpenTemplates={() => setDrawerTab("templates")}
            />
          )}
        </div>

        <div className="px-5 py-3 border-t border-white/6 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/tesla-logo.png" alt="TeslaTrack" className="logo-spin w-6 h-6 object-contain opacity-50" />
            <span className="text-[9px] text-white/20 uppercase tracking-widest font-semibold">TeslaTrack</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-white/30">
            <MapPin className="w-2.5 h-2.5 text-red-500" />
            <span>Google Maps Platform</span>
          </div>
        </div>
      </div>

      {/* ══ MAP OVERLAYS ════════════════════════════════════════════════════════ */}

      {/* Google Maps Delivery Turn-by-Turn Navigation HUD */}
      {isNavMode && (
        <GoogleMapsNavigationHUD
          currentCoord={currentCoord}
          destinationCoord={destCoord}
          fullPath={fullPath}
          currentPosIdx={posIdx}
          origin={pkg.origin}
          destination={pkg.destination}
          currentSpeedKph={simSpeed}
          bearing={bearing}
          isDelivered={isDelivered}
          etaString={deliveryEstimate.fullEstimate}
          onRecenterCamera={handleRecenterCamera}
          onToggleOverview={handleToggleOverview}
          isCameraFollowing={isCameraFollowing}
          onCloseNav={() => setIsNavMode(false)}
          deliveryInfo={{
            recipientName: pkg.receiver_name,
            recipientPhone: pkg.receiver_phone,
            recipientAddress: pkg.receiver_address || pkg.destination,
            trackingCode: code,
            weight: pkg.weight,
          }}
          onMarkDelivered={() => {
            setPosIdx(TOTAL - 1);
            setPlaying(false);
            deliveryFiredRef.current = true;
            notifyDelivered(code);
          }}
          googleDirections={googleDirections}
          onToggleTraffic={handleToggleTraffic}
          isTrafficEnabled={isTrafficEnabled}
        />
      )}

      {/* Redundant floating controls moved cleanly into the Drawer 'Controls' & 'Map' tabs */}
      {/* Live status badge & delivery estimate date overlay */}
      {!isNavMode && (
        <div className="absolute top-16 sm:top-20 left-3 z-20 space-y-1.5 pointer-events-auto">
          <div className="bg-black/90 border border-white/8 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-lg">
            <div className="w-2 h-2 rounded-full bg-red-600 flex-shrink-0"
              style={{
                boxShadow: playing && !isDelivered ? "0 0 8px rgba(220,38,38,0.9)" : "none",
                animation: playing && !isDelivered ? "pulse-live 1.4s ease-in-out infinite" : "none",
              }} />
            <span className="text-xs text-white/70 font-medium">
              {isDelivered ? "Delivered" : playing ? `Live · ${simSpeed} km/h` : "Paused"}
            </span>
          </div>
          {!isDelivered && (
            <div className="bg-black/90 border border-white/8 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-lg text-[10px] text-white/60">
              <Calendar className="w-3 h-3 text-red-400 flex-shrink-0" />
              <span>Est. Date: <strong className="text-white/90 font-medium">{deliveryEstimate.fullEstimate}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Tesla-Style Vehicle Stats Dashboard Card — bottom right */}
      <div className="absolute bottom-20 sm:bottom-24 right-3 sm:right-4 z-20 pointer-events-auto">
        <TeslaVehicleDashboard
          currentSpeedKph={simSpeed}
          bearing={bearing}
          progressPercent={progress}
          isLive={playing && !isDelivered}
          isDelivered={isDelivered}
          origin={pkg.origin}
          destination={pkg.destination}
          vehicleModel={`Tesla Logistics Fleet #${(pkg?.code || "").replace(/\D/g, "").slice(0, 4) || "042"}`}
        />
      </div>

      {/* Route & Traffic legend */}
      <div className="absolute left-3 z-20 hidden sm:flex flex-col gap-1.5"
        style={{ top: isDelivered ? "5rem" : "15rem" }}>
        <div className="bg-black/90 border border-white/8 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 shadow-lg">
          <div className="w-4 h-0.5 bg-red-500 rounded" />
          <span className="text-[9px] text-white/30">Completed</span>
        </div>
        <div className="bg-black/90 border border-white/8 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 shadow-lg">
          <div className="w-4 h-0.5 rounded"
            style={{ backgroundImage: "repeating-linear-gradient(to right,#60a5fa 0,#60a5fa 4px,transparent 4px,transparent 8px)" }} />
          <span className="text-[9px] text-white/30">Remaining ({deliveryEstimate.remainingDistanceKm} km)</span>
        </div>

        {/* Dynamic Real-Time Google Traffic Congestion Legend */}
        {isTrafficEnabled && (
          <div className="bg-black/95 border border-amber-500/30 rounded-xl px-2.5 py-2 flex flex-col gap-1.5 shadow-xl backdrop-blur-md animate-fade-in">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span className="text-[9px] text-amber-300 font-semibold tracking-wider uppercase">Live Traffic</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-1.5 rounded-sm bg-emerald-500" title="Fast / No Delay" />
              <span className="w-3 h-1.5 rounded-sm bg-amber-500" title="Moderate Congestion" />
              <span className="w-3 h-1.5 rounded-sm bg-orange-600" title="Heavy Traffic" />
              <span className="w-3 h-1.5 rounded-sm bg-red-700" title="Severe Delay" />
              <span className="text-[8px] text-white/50 ml-1 font-mono">Fast → Slow</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom telemetry bar */}
      {!isDelivered && (
        <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center px-3">
          <div className="overflow-x-auto max-w-full rounded-2xl">
            <div className="bg-black/95 border border-white/10 rounded-2xl shadow-2xl flex items-center w-max">
              {/* Telemetry items with calculated delivery date and live GPS */}
              {[
                { label: "Est. Delivery", value: deliveryEstimate.fullEstimate, hi: true, mobile: true },
                { label: "Distance Left", value: `${deliveryEstimate.remainingDistanceKm} km`, hi: false, mobile: true },
                { label: "Speed", value: `${simSpeed} km/h`, hi: false, mobile: true },
                { label: "Heading", value: `${bearingToCardinal(bearing)} ${Math.round(bearing)}°`, hi: false, mobile: false },
                { label: "Progress", value: `${progress}%`, hi: false, mobile: false },
                { label: "GPS Pos", value: currentCoord ? `${currentCoord[0].toFixed(2)}°, ${currentCoord[1].toFixed(2)}°` : "—", hi: false, mobile: false },
              ].map(({ label, value, hi, mobile }, i, arr) => (
                <div
                  key={label}
                  className={`flex items-center gap-3 ${!mobile ? "hidden sm:flex" : "flex"}`}
                >
                  <div className="px-4 py-2.5 text-center">
                    <div className="text-[9px] text-white/25 mb-0.5 whitespace-nowrap">{label}</div>
                    <div className={`text-xs font-mono font-semibold whitespace-nowrap ${hi ? "text-red-400" : "text-white/75"}`}>{value}</div>
                  </div>
                  {i < arr.length - 1 && <div className="w-px h-5 bg-white/8 flex-shrink-0" />}
                </div>
              ))}
              <div className="w-px h-5 bg-white/8 flex-shrink-0" />
              <button
                id="bottom-print-label-btn"
                onClick={() => setShowPrintLabelModal(true)}
                className="px-3.5 py-2.5 flex items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/5 transition-all text-xs font-medium cursor-pointer"
                title="Print Shipping Label"
              >
                <Printer className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[10px] whitespace-nowrap">Print Label</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivered banner */}
      {isDelivered && (
        <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center px-3">
          <div className="bg-[#0d2010] border border-green-500/30 rounded-2xl px-5 py-3 flex items-center justify-between gap-4 shadow-2xl max-w-md w-full">
            <div className="flex items-center gap-3 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-green-300">Package Delivered</div>
                <div className="text-[10px] text-green-400/60">Delivered · Final Destination Reached</div>
              </div>
            </div>
            <button
              onClick={() => setShowPrintLabelModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/15 transition-all flex-shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-green-400" />
              <span>Print Label</span>
            </button>
          </div>
        </div>
      )}

      {/* 'Notify me via email' Quick Dialog */}
      {showQuickNotifyInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121215] border border-white/10 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 flex-shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Notify me via email</h3>
                  <p className="text-[10px] text-white/40">Saves to Firestore document for future updates</p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickNotifyInput(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-mono tracking-wider text-white/40">Email Address</label>
              <input
                type="email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="recipient@domain.com"
                autoFocus
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-red-500"
                onKeyDown={(e) => e.key === "Enter" && handleQuickSaveEmail()}
              />
              <p className="text-[10px] text-white/35 leading-tight pt-1">
                Saved directly to Firestore package document <span className="font-mono text-white/60">packages/{code.toUpperCase()}</span>.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowQuickNotifyInput(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickSaveEmail}
                disabled={!notifyEmail.includes("@") || isSavingFirestore}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-red-900/30"
              >
                {isSavingFirestore ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                ) : (
                  <><Check className="w-3.5 h-3.5" /> Save to Firestore</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast Notification */}
      {successToast && (
        <div
          id="email-notification-toast"
          role="status"
          aria-live="polite"
          className="fixed top-20 right-4 sm:right-6 z-50 animate-fade-in pointer-events-auto max-w-sm w-full"
        >
          <div className="flex items-start gap-3 bg-[#0d131a]/95 border border-emerald-500/40 backdrop-blur-xl px-4 py-3 rounded-2xl text-white shadow-2xl shadow-black/80 ring-1 ring-emerald-500/20 transition-all">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-white tracking-tight">{successToast.title}</h4>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                  Firestore Synced
                </span>
              </div>
              <p className="text-[11px] text-white/70 mt-1 leading-snug">
                {successToast.description}
              </p>
              {successToast.email && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-300 font-mono bg-white/[0.04] border border-white/8 rounded-lg px-2 py-1 w-fit max-w-full">
                  <Mail className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span className="truncate max-w-[210px]">{successToast.email}</span>
                </div>
              )}
            </div>
            <button
              id="dismiss-email-toast-btn"
              onClick={() => {
                if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                setSuccessToast(null);
              }}
              className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 flex-shrink-0"
              aria-label="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Print Shipping Label Modal */}
      {showPrintLabelModal && (
        <PrintShippingLabelModal
          pkg={pkg}
          code={code}
          deliveryEstimate={deliveryEstimate}
          onClose={() => setShowPrintLabelModal(false)}
          onOpenTemplates={() => {
            setDrawerTab("templates");
            setDrawerOpen(true);
          }}
        />
      )}
    </div>
  );
}
