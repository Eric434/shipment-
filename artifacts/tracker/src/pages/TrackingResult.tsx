import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Package, CheckCircle2, Circle, MapPin, Clock,
  Bell, BellOff, Play, Pause, RotateCcw, Navigation,
  Loader2, AlertCircle, Wifi, ChevronRight, Gauge,
  X, List, FileText, Download, Compass, Lock, CheckSquare,
  Calendar, CalendarDays, Crosshair, Map as MapIcon,
  Sun, Moon, Check, FastForward, Plus, Minus, Layers, Maximize2,
} from "lucide-react";
import { fetchPackage, subscribeToAlerts, notifyDelivered, type Package as Pkg, type FetchPackageResult } from "@/lib/api";
import { MapLibreNavigationHUD } from "@/components/MapLibreNavigation";
import { TeslaVehicleDashboard } from "@/components/TeslaVehicleDashboard";
import { loadGoogleMaps, TESLA_DARK_MAP_STYLES } from "@/lib/googleMaps";

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
  const glow = moving
    ? `<div class="vehicle-pulse-glow" style="position:absolute;inset:-8px;border-radius:50%;background:radial-gradient(circle, rgba(220,38,38,0.4) 0%, rgba(220,38,38,0) 70%);pointer-events:none;"></div>
       <div style="position:absolute;inset:-2px;border-radius:50%;background:rgba(220,38,38,0.15);pointer-events:none;"></div>`
    : "";
  const headlightOpacity = moving ? "1" : "0.35";
  const bodyColor = moving ? "#dc2626" : "#b91c1c";
  return `<div class="vehicle-icon-wrapper" style="position:relative;width:28px;height:44px;transform:rotate(${bearing}deg);transform-origin:14px 22px;transition:transform 0.45s cubic-bezier(0.25,1,0.5,1);will-change:transform;">
    ${glow}
    <svg viewBox="0 0 28 44" width="28" height="44" xmlns="http://www.w3.org/2000/svg" style="position:relative;z-index:1;filter:drop-shadow(0 3px 10px rgba(220,38,38,0.55));">
      <rect x="4" y="8" width="20" height="28" rx="5" fill="${bodyColor}"/>
      <rect x="7" y="14" width="14" height="13" rx="3" fill="#991b1b"/>
      <rect x="8" y="11" width="12" height="4" rx="1.5" fill="rgba(147,210,255,0.55)"/>
      <rect x="8" y="29" width="12" height="4" rx="1.5" fill="rgba(147,210,255,0.35)"/>
      <rect x="1" y="10" width="5" height="8" rx="2" fill="#111"/><rect x="2.5" y="11.5" width="2" height="5" rx="1" fill="#333"/>
      <rect x="22" y="10" width="5" height="8" rx="2" fill="#111"/><rect x="23.5" y="11.5" width="2" height="5" rx="1" fill="#333"/>
      <rect x="1" y="26" width="5" height="8" rx="2" fill="#111"/><rect x="2.5" y="27.5" width="2" height="5" rx="1" fill="#333"/>
      <rect x="22" y="26" width="5" height="8" rx="2" fill="#111"/><rect x="23.5" y="27.5" width="2" height="5" rx="1" fill="#333"/>
      <rect x="7" y="8" width="5" height="2.5" rx="1" fill="#fde68a" opacity="${headlightOpacity}"/>
      <rect x="16" y="8" width="5" height="2.5" rx="1" fill="#fde68a" opacity="${headlightOpacity}"/>
      <rect x="7" y="33" width="5" height="2.5" rx="1" fill="#ef4444" opacity="0.85"/>
      <rect x="16" y="33" width="5" height="2.5" rx="1" fill="#ef4444" opacity="0.85"/>
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

type DrawerTab = "timeline" | "alerts" | "docs";
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

function NotificationsPanel({ pkg, trackingCode, simSpeed, secsAgo, playing }: {
  pkg: Pkg; trackingCode: string; simSpeed: number; secsAgo: number; playing: boolean;
}) {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    if (!email.includes("@")) return;
    setLoading(true); setApiError(null);
    const result = await subscribeToAlerts({
      email, trackingCode, status: pkg.status, eta: pkg.eta, from: pkg.origin, to: pkg.destination,
    });
    setLoading(false);
    if (result.success) setSubscribed(true);
    else setApiError(result.error ?? "Something went wrong");
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-white/6 flex-shrink-0">
        <div className="text-[9px] text-white/25 uppercase tracking-widest mb-4">Email Notifications</div>
        {!subscribed ? (
          <>
            <p className="text-[10px] text-white/30 leading-relaxed mb-4">
              Get notified the moment your package status changes.
            </p>
            {!showInput ? (
              <button onClick={() => setShowInput(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600/90 hover:bg-red-500 text-white text-xs font-medium transition-all">
                <Bell className="w-3.5 h-3.5" /> Enable Alerts
              </button>
            ) : (
              <div className="space-y-2">
                <input type="email" value={email}
                  onChange={(e) => { setEmail(e.target.value); setApiError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubscribe()}
                  placeholder="your@email.com" disabled={loading}
                  className="w-full bg-white/4 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-red-600/40 disabled:opacity-50" />
                {apiError && (
                  <div className="flex items-start gap-1.5 text-[10px] text-red-400">
                    <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" /><span>{apiError}</span>
                  </div>
                )}
                <button onClick={handleSubscribe} disabled={!email.includes("@") || loading}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white text-xs font-medium transition-all">
                  {loading ? <><Loader2 className="w-3 h-3 animate-spin" />Sending…</> : "Subscribe"}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-1">
            <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-[10px] text-green-400 font-medium">Alerts enabled!</p>
            <p className="text-[9px] text-white/35 mt-1 break-all">{email}</p>
            <p className="text-[9px] text-white/20 mt-1">Confirmation email sent.</p>
            <button onClick={() => { setSubscribed(false); setShowInput(false); setEmail(""); setApiError(null); }}
              className="mt-3 flex items-center gap-1 text-[9px] text-white/18 hover:text-white/40 transition-colors mx-auto">
              <BellOff className="w-2.5 h-2.5" /> Unsubscribe
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

function DocumentsPanel({ code, pkg }: { code: string; pkg: Pkg }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-5 border-b border-white/6 flex-shrink-0">
        <div className="text-[9px] text-white/25 uppercase tracking-widest mb-1">Document Vault</div>
        <p className="text-[10px] text-white/30 leading-relaxed">
          Secure shipment documentation for tracking code <span className="font-mono text-white/45">{code}</span>.
        </p>
      </div>

      <div className="flex-1 p-4 space-y-2 overflow-y-auto">
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
    vehicleOverlayRef.current?.setPositionAndState(latLng, isMoving, b);
    donePolyRef.current?.setPath(fullPath.slice(0, posIdx + 1).map((p) => ({ lat: p[0], lng: p[1] })));
    remainPolyRef.current?.setPath(fullPath.slice(posIdx).map((p) => ({ lat: p[0], lng: p[1] })));
  }, [posIdx, playing]);

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

        setPositionAndState(pos: any, moving: boolean, brg: number) {
          this.pos = pos;
          this.moving = moving;
          this.brg = brg;
          if (this.div) {
            this.div.innerHTML = vehicleMarkerHtml(this.moving, this.brg);
          }
          this.draw();
        }

        draw() {
          if (!this.div) return;
          const projection = this.getProjection();
          if (!projection) return;
          const point = projection.fromLatLngToDivPixel(this.pos);
          if (point) {
            this.div.style.left = `${point.x - 14}px`;
            this.div.style.top = `${point.y - 22}px`;
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
      mapInstanceRef.current.setZoom(14);
    }
  }, [fullPath, posIdx]);

  const handleToggleOverview = useCallback(() => {
    setIsCameraFollowing(false);
    if (mapInstanceRef.current && fullPath.length > 0 && googleRef.current) {
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

      {/* Google Maps Controls (Map Type switcher, Zoom & Overview) */}
      <div className="absolute bottom-20 left-3 z-20 pointer-events-auto flex flex-col gap-2">
        {/* Map Type Switcher */}
        <div className="bg-black/90 backdrop-blur-md border border-white/10 rounded-xl p-1 flex items-center gap-1 shadow-xl">
          <button
            onClick={() => handleSwitchMapTheme("dark")}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1.5 transition-all ${
              mapTheme === "dark"
                ? "bg-red-600/25 text-red-400 border border-red-600/30 font-semibold"
                : "text-white/40 hover:text-white/80"
            }`}
            title="Tesla Dark Vector Map"
          >
            <Moon className="w-3 h-3" />
            <span>Dark</span>
          </button>
          <button
            onClick={() => handleSwitchMapTheme("satellite")}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1.5 transition-all ${
              mapTheme === "satellite"
                ? "bg-red-600/25 text-red-400 border border-red-600/30 font-semibold"
                : "text-white/40 hover:text-white/80"
            }`}
            title="Google Earth Satellite & Roads"
          >
            <Layers className="w-3 h-3" />
            <span>Satellite</span>
          </button>
          <button
            onClick={() => handleSwitchMapTheme("roadmap")}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1.5 transition-all ${
              mapTheme === "roadmap"
                ? "bg-red-600/25 text-red-400 border border-red-600/30 font-semibold"
                : "text-white/40 hover:text-white/80"
            }`}
            title="Google Maps Roadmap"
          >
            <MapIcon className="w-3 h-3" />
            <span>Roadmap</span>
          </button>
        </div>

        {/* Camera and Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <div className="bg-black/90 backdrop-blur-md border border-white/10 rounded-xl p-1 flex items-center gap-0.5 shadow-xl">
            <button
              onClick={handleZoomIn}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Zoom In"
            >
              <Plus className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-white/10" />
            <button
              onClick={handleZoomOut}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Zoom Out"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-black/90 backdrop-blur-md border border-white/10 rounded-xl p-1 flex items-center gap-0.5 shadow-xl">
            <button
              onClick={handleRecenterCamera}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                isCameraFollowing
                  ? "bg-red-600/20 text-red-400 border border-red-600/30"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
              title="Recenter to Vehicle"
            >
              <Crosshair className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-white/10" />
            <button
              onClick={handleToggleOverview}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Route Overview"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Google Maps Platform Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/80 border border-white/8 text-[9px] text-white/40 w-fit backdrop-blur-sm">
          <MapPin className="w-2.5 h-2.5 text-red-500" />
          <span>Google Maps Platform</span>
        </div>
      </div>

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
          >
            {drawerOpen
              ? <X className="w-4 h-4 text-white/60 group-hover:text-white/90 transition-colors" />
              : <List className="w-4 h-4 text-white/60 group-hover:text-white/90 transition-colors" />
            }
          </button>

          {(["timeline", "alerts", "docs"] as DrawerTab[]).map((tab, i) => {
            const icons = { timeline: List, alerts: Bell, docs: FileText };
            const labels = { timeline: "Track", alerts: "Alerts", docs: "Docs" };
            const Icon = icons[tab];
            const isLast = i === 2;
            return (
              <button key={tab}
                onClick={() => { setDrawerTab(tab); setDrawerOpen(true); }}
                className={`group flex flex-col items-center justify-center gap-1 w-10 py-3.5 backdrop-blur-md border border-white/10 border-r-0 border-t-0 shadow-xl transition-all ${
                  isLast ? "rounded-bl-2xl" : ""
                } ${
                  drawerOpen && drawerTab === tab
                    ? "bg-red-600/25 border-red-600/30 text-red-400"
                    : "bg-black/75 hover:bg-black/90 text-white/30 hover:text-white/70"
                }`}
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
        className="absolute top-0 right-0 bottom-0 z-30 w-80 max-w-[85vw] bg-[#0b0b0b] border-l border-white/8 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out"
        style={{ transform: drawerOpen ? "translateX(0)" : "translateX(100%)" }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-1 bg-white/4 rounded-xl border border-white/8 p-0.5">
            {(["timeline", "alerts", "docs"] as DrawerTab[]).map((tab) => {
              const icons = { timeline: List, alerts: Bell, docs: FileText };
              const labels = { timeline: "Timeline", alerts: "Alerts", docs: "Docs" };
              const Icon = icons[tab];
              return (
                <button key={tab} onClick={() => setDrawerTab(tab)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                    drawerTab === tab
                      ? "bg-red-600/20 text-red-400 border border-red-600/30"
                      : "text-white/35 hover:text-white/60"
                  }`}>
                  <Icon className="w-3 h-3" /> {labels[tab]}
                </button>
              );
            })}
          </div>
          <button onClick={() => setDrawerOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/4 hover:bg-white/10 border border-white/8 text-white/40 hover:text-white/70 transition-all">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Drawer content */}
        <div className="flex-1 overflow-hidden">
          {drawerTab === "timeline" && (
            <TimelinePanel
              pkg={pkg} code={code} progress={progress} simSpeed={simSpeed}
              secsAgo={secsAgo} bearing={bearing}
              currentCoord={currentCoord}
              deliveryEstimate={deliveryEstimate}
              getProgressGradient={getProgressGradient}
            />
          )}
          {drawerTab === "alerts" && (
            <NotificationsPanel
              pkg={pkg} trackingCode={code} simSpeed={simSpeed}
              secsAgo={secsAgo} playing={playing}
            />
          )}
          {drawerTab === "docs" && <DocumentsPanel code={code} pkg={pkg} />}
        </div>

        <div className="px-5 py-3 border-t border-white/6 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/tesla-logo.png" alt="TeslaTrack" className="logo-spin w-6 h-6 object-contain opacity-50" />
            <span className="text-[9px] text-white/20 uppercase tracking-widest font-semibold">TeslaTrack</span>
          </div>
        </div>
      </div>

      {/* ══ MAP OVERLAYS ════════════════════════════════════════════════════════ */}

      {/* MapLibre iOS Turn-by-Turn Navigation HUD */}
      {isNavMode && (
        <MapLibreNavigationHUD
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
        />
      )}

      {/* Navigation Mode — top right */}
      <div className="absolute top-16 right-3 sm:top-20 z-20 pointer-events-auto flex items-center gap-2">
        {/* Toggle Always-On MapLibre Navigation HUD button */}
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
          className={`border rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-xl transition-all ${
            isNavMode
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
              : "bg-black/90 hover:bg-black text-white/70 hover:text-white border-white/10 hover:border-white/20"
          }`}
          title={isNavMode ? "Always-On Turn-by-Turn Navigation Active" : "Enable Always-On Turn Navigation"}
        >
          <div className="relative flex items-center justify-center">
            <Navigation className={`w-3.5 h-3.5 ${isNavMode ? "text-emerald-400 fill-emerald-400" : "text-white/60"}`} />
            {isNavMode && (
              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <span className="text-xs font-semibold">
            {isNavMode ? "Always-On Nav" : "Enable Nav"}
          </span>
        </button>
      </div>

      {/* Non-nav live badge & simulation speed controls — top left when nav is off or collapsed */}
      {!isNavMode && (
        <div className="absolute top-20 left-3 z-20 space-y-1.5 pointer-events-auto">
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

      {/* Simulation Playback & Speed Fast Forward controls */}
      {!isDelivered && (
        <div className="absolute top-36 sm:top-40 left-3 z-20 pointer-events-auto">
          <div className="flex flex-col gap-0 bg-black/90 border border-white/10 rounded-2xl overflow-hidden shadow-xl backdrop-blur-md">
            <button onClick={() => setPlaying((p) => !p)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/8 transition-colors text-white/70 hover:text-white">
              {playing ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
              <span className="text-[10px] font-medium">{playing ? "Pause" : "Play"}</span>
            </button>
            <div className="h-px bg-white/8" />
            <button onClick={handleReset}
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/8 transition-colors text-white/50 hover:text-white/80">
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="text-[10px]">Reset</span>
            </button>
            <div className="h-px bg-white/8" />
            
            {/* Speed Multipliers */}
            <div className="flex items-center p-1 bg-white/[0.03] gap-0.5">
              {[1, 2, 5, 10].map((mult) => (
                <button
                  key={mult}
                  onClick={() => setSpeedMultiplier(mult)}
                  className={`px-1.5 py-1 rounded-lg text-[9px] font-mono font-bold transition-all ${
                    speedMultiplier === mult
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "text-white/30 hover:text-white/70 hover:bg-white/5"
                  }`}
                  title={`${mult}x Simulation Speed`}
                >
                  {mult}x
                </button>
              ))}
            </div>
          </div>
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

      {/* Route legend */}
      <div className="absolute left-3 z-20 hidden sm:flex flex-col gap-1.5"
        style={{ top: isDelivered ? "5rem" : "15rem" }}>
        <div className="bg-black/90 border border-white/8 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-red-500 rounded" />
          <span className="text-[9px] text-white/30">Completed</span>
        </div>
        <div className="bg-black/90 border border-white/8 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded"
            style={{ backgroundImage: "repeating-linear-gradient(to right,#60a5fa 0,#60a5fa 4px,transparent 4px,transparent 8px)" }} />
          <span className="text-[9px] text-white/30">Remaining ({deliveryEstimate.remainingDistanceKm} km)</span>
        </div>
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
            </div>
          </div>
        </div>
      )}

      {/* Delivered banner */}
      {isDelivered && (
        <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center px-3">
          <div className="bg-[#0d2010] border border-green-500/30 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-2xl">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-green-300">Package Delivered</div>
              <div className="text-[10px] text-green-400/60">Delivered · Final Destination Reached</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
