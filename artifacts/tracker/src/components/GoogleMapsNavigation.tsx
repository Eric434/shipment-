import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Volume2, VolumeX, Navigation as NavIcon, Compass, MapPin,
  ChevronRight, Check, AlertTriangle, Play, Pause, RotateCcw,
  Maximize2, Minimize2, ListOrdered, X, Settings2, ShieldAlert,
  Gauge, FastForward, ExternalLink, Phone, CheckCircle2,
  Car, Compass as CompassIcon, Layers, FileCheck
} from "lucide-react";
import {
  type GoogleNavStep,
  type GoogleDirectionsResult,
  buildGoogleMapsNavigationUrl
} from "@/lib/googleMaps";

// ─── Maneuver Types ──────────────────────────────────────────────────────────

export type ManeuverType =
  | "depart"
  | "straight"
  | "slight-right"
  | "turn-right"
  | "sharp-right"
  | "slight-left"
  | "turn-left"
  | "sharp-left"
  | "keep-right"
  | "keep-left"
  | "merge"
  | "fork"
  | "ramp-right"
  | "ramp-left"
  | "roundabout"
  | "uturn"
  | "arrive";

export interface NavigationStep {
  id: string;
  type: ManeuverType;
  instruction: string;
  rawHtml?: string;
  streetName: string;
  distanceMeters: number;
  remainingMetersAtStart: number;
  coordinate: [number, number];
  speedLimitKph: number;
}

// ─── Maneuver SVG Icons ──────────────────────────────────────────────────────

export function ManeuverIcon({ type, className = "w-6 h-6" }: { type: ManeuverType; className?: string }) {
  switch (type) {
    case "turn-left":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M19 20V9a4 4 0 0 0-4-4H5" />
          <polyline points="9 1 5 5 9 9" />
        </svg>
      );
    case "turn-right":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M5 20V9a4 4 0 0 1 4-4h10" />
          <polyline points="15 1 19 5 15 9" />
        </svg>
      );
    case "slight-left":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M16 20V12a4 4 0 0 0-2-3.46L7 4" />
          <polyline points="12 4 7 4 7 9" />
        </svg>
      );
    case "slight-right":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M8 20V12a4 4 0 0 1 2-3.46L17 4" />
          <polyline points="12 4 17 4 17 9" />
        </svg>
      );
    case "sharp-left":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M18 20v-5a4 4 0 0 0-4-4H7l3-3" />
          <polyline points="7 14 4 11 7 8" />
        </svg>
      );
    case "sharp-right":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M6 20v-5a4 4 0 0 1 4-4h7l-3-3" />
          <polyline points="17 14 20 11 17 8" />
        </svg>
      );
    case "keep-left":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M16 21V10a3 3 0 0 0-3-3H7" />
          <polyline points="10 4 6 7 10 10" />
          <path d="M16 10l3 3" opacity="0.35" />
        </svg>
      );
    case "keep-right":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M8 21V10a3 3 0 0 1 3-3h6" />
          <polyline points="14 4 18 7 14 10" />
          <path d="M8 10l-3 3" opacity="0.35" />
        </svg>
      );
    case "merge":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 21V3" />
          <path d="M4 16l8-8" />
          <polyline points="8 3 12 3 12 7" />
        </svg>
      );
    case "fork":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 21v-8l-6-6" />
          <path d="M12 13l6-6" />
          <polyline points="4 7 6 7 6 9" />
          <polyline points="20 7 18 7 18 9" />
        </svg>
      );
    case "ramp-right":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M7 21v-8a4 4 0 0 1 4-4h7" />
          <polyline points="15 6 18 9 15 12" />
        </svg>
      );
    case "ramp-left":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M17 21v-8a4 4 0 0 0-4-4H6" />
          <polyline points="9 6 6 9 9 12" />
        </svg>
      );
    case "roundabout":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="12" cy="12" r="6" />
          <polyline points="12 6 15 6 15 9" />
          <path d="M12 21v-3" />
        </svg>
      );
    case "uturn":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M18 20V9a5 5 0 0 0-10 0v11" />
          <polyline points="5 17 8 20 11 17" />
        </svg>
      );
    case "arrive":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "depart":
    case "straight":
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      );
  }
}

// ─── Formatters ──────────────────────────────────────────────────────────────

export function formatNavDistance(meters: number): string {
  if (meters <= 0) return "Now";
  if (meters < 1000) {
    const rounded = Math.round(meters / 10) * 10;
    return `${rounded} m`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${km} km`;
}

export function formatNavDuration(seconds: number): string {
  if (seconds <= 0) return "0 min";
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs} hr ${remMins > 0 ? `${remMins} min` : ""}`;
}

// ─── Convert Google Maneuver String to Typed Maneuver ─────────────────────────

function parseGoogleManeuver(maneuverStr?: string): ManeuverType {
  if (!maneuverStr) return "straight";
  const m = maneuverStr.toLowerCase();
  if (m.includes("uturn")) return "uturn";
  if (m.includes("sharp-left")) return "sharp-left";
  if (m.includes("sharp-right")) return "sharp-right";
  if (m.includes("slight-left") || m.includes("turn-slight-left")) return "slight-left";
  if (m.includes("slight-right") || m.includes("turn-slight-right")) return "slight-right";
  if (m.includes("left")) return "turn-left";
  if (m.includes("right")) return "turn-right";
  if (m.includes("keep-left")) return "keep-left";
  if (m.includes("keep-right")) return "keep-right";
  if (m.includes("merge")) return "merge";
  if (m.includes("fork")) return "fork";
  if (m.includes("ramp-left")) return "ramp-left";
  if (m.includes("ramp-right") || m.includes("ramp")) return "ramp-right";
  if (m.includes("roundabout") || m.includes("rotary")) return "roundabout";
  if (m.includes("arrive") || m.includes("destination")) return "arrive";
  return "straight";
}

// ─── Navigation Steps Generator (Fallback if Directions API unavailable) ──────

const DEFAULT_HIGHWAYS = [
  "I-880 North Express",
  "US-101 North Highway",
  "CA-237 East Freeway",
  "Interstate 80 East",
  "Grand Boulevard Logistics Way",
  "Metropolitan Corridor Freeway",
  "Commercial Hub Access Road",
  "Terminal Delivery Way",
];

export function generateFallbackNavigationSteps(
  fullPath: [number, number][],
  origin: string,
  destination: string
): NavigationStep[] {
  if (!fullPath || fullPath.length < 2) {
    return [
      {
        id: "step-0",
        type: "depart",
        instruction: `Depart from ${origin}`,
        streetName: origin,
        distanceMeters: 500,
        remainingMetersAtStart: 500,
        coordinate: [0, 0],
        speedLimitKph: 50,
      },
      {
        id: "step-1",
        type: "arrive",
        instruction: `Arrive at ${destination}`,
        streetName: destination,
        distanceMeters: 0,
        remainingMetersAtStart: 0,
        coordinate: [0, 0],
        speedLimitKph: 50,
      },
    ];
  }

  const distances: number[] = [0];
  for (let i = 1; i < fullPath.length; i++) {
    const [lat1, lon1] = fullPath[i - 1];
    const [lat2, lon2] = fullPath[i];
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    distances.push(distances[i - 1] + R * c);
  }

  const totalDistance = distances[distances.length - 1];
  const steps: NavigationStep[] = [];

  steps.push({
    id: "step-0",
    type: "depart",
    instruction: `Head out from ${origin} onto ${DEFAULT_HIGHWAYS[0]}`,
    streetName: DEFAULT_HIGHWAYS[0],
    distanceMeters: Math.round(totalDistance * 0.12),
    remainingMetersAtStart: Math.round(totalDistance),
    coordinate: fullPath[0],
    speedLimitKph: 60,
  });

  const numSteps = Math.min(Math.max(Math.floor(fullPath.length / 25), 4), 8);
  for (let i = 1; i <= numSteps; i++) {
    const idx = Math.min(Math.floor((i / (numSteps + 1)) * (fullPath.length - 1)), fullPath.length - 2);
    const coord = fullPath[idx];
    const prevCoord = fullPath[Math.max(idx - 2, 0)];
    const nextCoord = fullPath[Math.min(idx + 2, fullPath.length - 1)];

    const b1 = ((Math.atan2(coord[1] - prevCoord[1], coord[0] - prevCoord[0]) * 180) / Math.PI + 360) % 360;
    const b2 = ((Math.atan2(nextCoord[1] - coord[1], nextCoord[0] - coord[0]) * 180) / Math.PI + 360) % 360;
    let diff = ((b2 - b1 + 540) % 360) - 180;

    let type: ManeuverType = "straight";
    if (diff > 50) type = "turn-right";
    else if (diff > 20) type = "slight-right";
    else if (diff < -50) type = "turn-left";
    else if (diff < -20) type = "slight-left";
    else if (i === 2) type = "merge";
    else if (i === 3) type = "keep-right";

    const road = DEFAULT_HIGHWAYS[i % DEFAULT_HIGHWAYS.length];
    const remMeters = Math.round(totalDistance - distances[idx]);
    const stepDist = Math.round(totalDistance / (numSteps + 1));

    let instruction = `Continue on ${road}`;
    if (type === "turn-right") instruction = `Turn right onto ${road}`;
    else if (type === "turn-left") instruction = `Turn left onto ${road}`;
    else if (type === "slight-right") instruction = `Take slight right / ramp onto ${road}`;
    else if (type === "slight-left") instruction = `Keep left onto ${road}`;
    else if (type === "merge") instruction = `Merge onto ${road}`;
    else if (type === "keep-right") instruction = `Keep right to stay on ${road}`;

    steps.push({
      id: `step-${i}`,
      type,
      instruction,
      streetName: road,
      distanceMeters: stepDist,
      remainingMetersAtStart: remMeters,
      coordinate: coord,
      speedLimitKph: i % 2 === 0 ? 100 : 80,
    });
  }

  steps.push({
    id: `step-${numSteps + 1}`,
    type: "arrive",
    instruction: `Arrive at delivery destination: ${destination}`,
    streetName: destination,
    distanceMeters: 0,
    remainingMetersAtStart: 0,
    coordinate: fullPath[fullPath.length - 1],
    speedLimitKph: 45,
  });

  return steps;
}

// ─── Component Props ─────────────────────────────────────────────────────────

export interface GoogleMapsNavigationHUDProps {
  currentCoord?: [number, number];
  destinationCoord?: [number, number];
  fullPath: [number, number][];
  currentPosIdx: number;
  origin: string;
  destination: string;
  currentSpeedKph: number;
  bearing: number;
  isDelivered: boolean;
  etaString: string;
  onRecenterCamera: () => void;
  onToggleOverview: () => void;
  isCameraFollowing: boolean;
  onCloseNav?: () => void;
  // Delivery details
  deliveryInfo?: {
    recipientName?: string;
    recipientPhone?: string;
    recipientAddress?: string;
    trackingCode?: string;
    weight?: string;
  };
  onMarkDelivered?: () => void;
  googleDirections?: GoogleDirectionsResult | null;
  onToggleTraffic?: () => void;
  isTrafficEnabled?: boolean;
}

export function GoogleMapsNavigationHUD({
  currentCoord,
  destinationCoord,
  fullPath,
  currentPosIdx,
  origin,
  destination,
  currentSpeedKph,
  bearing,
  isDelivered,
  etaString,
  onRecenterCamera,
  onToggleOverview,
  isCameraFollowing,
  onCloseNav,
  deliveryInfo,
  onMarkDelivered,
  googleDirections,
  onToggleTraffic,
  isTrafficEnabled,
}: GoogleMapsNavigationHUDProps) {
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [showStepsSheet, setShowStepsSheet] = useState<boolean>(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState<boolean>(false);
  const [lastAnnouncedStep, setLastAnnouncedStep] = useState<string>("");
  const [isCompact, setIsCompact] = useState<boolean>(false);

  // Convert Google Directions steps if provided, otherwise use fallback generator
  const steps: NavigationStep[] = useMemo(() => {
    if (googleDirections?.steps && googleDirections.steps.length > 0) {
      let cumulative = 0;
      const totalDist = googleDirections.distanceMeters || 10000;
      return googleDirections.steps.map((gStep: GoogleNavStep, idx: number) => {
        const type = parseGoogleManeuver(gStep.maneuver);
        const rem = Math.max(totalDist - cumulative, 0);
        cumulative += gStep.distanceMeters;
        return {
          id: gStep.id || `gstep-${idx}`,
          type,
          instruction: gStep.instructions || "Continue on route",
          rawHtml: gStep.rawHtml,
          streetName: gStep.instructions.split(" onto ")[1] || gStep.instructions.split(" on ")[1] || "Delivery Route",
          distanceMeters: gStep.distanceMeters || 400,
          remainingMetersAtStart: rem,
          coordinate: gStep.startLocation || [0, 0],
          speedLimitKph: idx % 2 === 0 ? 90 : 65,
        };
      });
    }
    return generateFallbackNavigationSteps(fullPath, origin, destination);
  }, [googleDirections, fullPath, origin, destination]);

  // Determine current active maneuver step based on vehicle progress along route
  const totalPoints = Math.max(fullPath.length, 1);
  const progressRatio = currentPosIdx / (totalPoints - 1);
  const currentStepIdx = useMemo(() => {
    if (isDelivered || currentPosIdx >= totalPoints - 1) return steps.length - 1;
    const idx = Math.min(Math.floor(progressRatio * (steps.length - 1)), steps.length - 2);
    return Math.max(0, idx);
  }, [currentPosIdx, totalPoints, steps.length, isDelivered, progressRatio]);

  const currentStep = steps[currentStepIdx] || steps[0];
  const nextStep = steps[currentStepIdx + 1] || null;

  // Approximate remaining distance to the next upcoming maneuver
  const stepRatio = (progressRatio * (steps.length - 1)) % 1;
  const distanceToManeuver = isDelivered
    ? 0
    : Math.max(Math.round(currentStep.distanceMeters * (1 - stepRatio)), 20);

  const speedLimit = currentStep.speedLimitKph || 80;
  const isOverSpeed = currentSpeedKph > speedLimit + 10;

  // Voice Announcement synthesis (Web Speech API)
  useEffect(() => {
    if (!voiceEnabled || isDelivered) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (currentStep.id !== lastAnnouncedStep) {
      setLastAnnouncedStep(currentStep.id);
      try {
        window.speechSynthesis.cancel();
        const text =
          currentStep.type === "arrive"
            ? `You have arrived at delivery destination: ${destination}.`
            : `In ${formatNavDistance(distanceToManeuver)}, ${currentStep.instruction}.`;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.02;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("SpeechSynthesis notification:", err);
      }
    }
  }, [currentStep.id, currentStep.instruction, currentStep.type, destination, distanceToManeuver, isDelivered, lastAnnouncedStep, voiceEnabled]);

  // Native Google Maps navigation deep link URL
  const googleMapsAppUrl = useMemo(() => {
    const dest = destinationCoord || destination;
    const orig = currentCoord || origin;
    return buildGoogleMapsNavigationUrl(dest, orig);
  }, [destinationCoord, destination, currentCoord, origin]);

  return (
    <>
      {/* ══ TOP GOOGLE MAPS DELIVERY NAVIGATION BANNER ══════════════════════════ */}
      <div className="absolute top-14 sm:top-16 left-3 right-3 sm:left-6 sm:right-auto sm:w-[440px] z-30 pointer-events-auto select-none">
        <div className="bg-[#121316]/95 backdrop-blur-xl border border-white/15 rounded-3xl shadow-[0_16px_50px_rgba(0,0,0,0.85)] overflow-hidden transition-all duration-300">
          
          {/* Header Bar with Google Maps & Delivery Mode Indicator */}
          <div className="px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-white/8 bg-gradient-to-r from-emerald-950/40 via-transparent to-transparent">
            <div className="flex items-center gap-2.5">
              {/* Google Maps Pin Emblem */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold tracking-wide uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Google Maps • Delivery Nav</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Open in Google Maps App Deep Link */}
              <a
                href={googleMapsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-[10px] font-semibold flex items-center gap-1 transition-all"
                title="Launch Turn-by-Turn Navigation in Google Maps app"
              >
                <span>Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              {/* Compact Toggle */}
              <button
                onClick={() => setIsCompact((c) => !c)}
                className="p-1.5 rounded-lg bg-white/4 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all"
                title={isCompact ? "Expand Navigation HUD" : "Minimize Navigation HUD"}
              >
                {isCompact ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>

              {/* Voice guidance button */}
              <button
                onClick={() => {
                  setVoiceEnabled((v) => !v);
                  if (voiceEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
                    window.speechSynthesis.cancel();
                  }
                }}
                className={`p-1.5 rounded-lg border transition-all ${
                  voiceEnabled
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                    : "bg-white/4 text-white/30 border-white/10 hover:text-white/60"
                }`}
                title={voiceEnabled ? "Mute Google Voice Navigation" : "Unmute Google Voice Navigation"}
              >
                {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {/* Steps sheet toggle */}
              <button
                onClick={() => setShowStepsSheet(true)}
                className="p-1.5 rounded-lg bg-white/4 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all"
                title="View All Turn-by-Turn Directions"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>

              {onCloseNav && (
                <button
                  onClick={onCloseNav}
                  className="p-1.5 rounded-lg bg-white/4 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white/80 transition-all"
                  title="Close Navigation HUD"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Primary Turn Maneuver Card */}
          {!isCompact ? (
            <div className="p-4 flex items-start gap-4">
              {/* Maneuver Graphic Icon (Google Maps Navigation Style Green) */}
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                isDelivered
                  ? "bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
                  : "bg-emerald-600 border border-emerald-400/40 text-white shadow-[0_4px_16px_rgba(5,150,105,0.4)]"
              }`}>
                {isDelivered ? (
                  <Check className="w-8 h-8 text-emerald-300" />
                ) : (
                  <ManeuverIcon type={currentStep.type} className="w-8 h-8 text-white stroke-[3]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-2xl font-black tracking-tight text-white font-mono">
                    {isDelivered ? "0 m" : formatNavDistance(distanceToManeuver)}
                  </span>
                  <span className={`text-[11px] font-mono uppercase tracking-wider font-semibold ${
                    isDelivered ? "text-emerald-400" : "text-white/50"
                  }`}>
                    {isDelivered ? "At Customer Address" : "to next turn"}
                  </span>
                </div>

                <div className="text-sm font-semibold text-white leading-snug line-clamp-2">
                  {isDelivered ? `Package delivered to ${destination}` : currentStep.instruction}
                </div>

                {/* Sub-step: upcoming next maneuver preview */}
                {nextStep && !isDelivered && (
                  <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-white/50 pt-2 border-t border-white/8">
                    <span className="text-white/35 text-[9px] uppercase font-bold tracking-wider">Then</span>
                    <ManeuverIcon type={nextStep.type} className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="truncate text-white/80">{nextStep.instruction}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                  {isDelivered ? <Check className="w-4 h-4" /> : <ManeuverIcon type={currentStep.type} className="w-4 h-4 stroke-[3]" />}
                </div>
                <div className="truncate">
                  <span className="text-xs font-bold text-white font-mono mr-2">
                    {isDelivered ? "Delivered" : formatNavDistance(distanceToManeuver)}
                  </span>
                  <span className="text-xs text-white/85 truncate">
                    {isDelivered ? `Arrived at ${destination}` : currentStep.instruction}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Dispatch Quick Bar */}
          <div className="px-4 py-2 bg-black/40 border-t border-white/6 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 text-white/60 truncate">
              <MapPin className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span className="truncate max-w-[200px] text-white/80">
                {deliveryInfo?.recipientName ? `${deliveryInfo.recipientName} · ` : ""}{destination}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {deliveryInfo?.recipientPhone && (
                <a
                  href={`tel:${deliveryInfo.recipientPhone}`}
                  className="px-2 py-0.5 rounded-md bg-white/6 hover:bg-white/12 text-white/80 text-[10px] flex items-center gap-1 transition-colors"
                  title="Call Customer"
                >
                  <Phone className="w-3 h-3 text-emerald-400" />
                  <span>Call</span>
                </a>
              )}

              {onMarkDelivered && !isDelivered && (
                <button
                  onClick={() => setShowDeliveryModal(true)}
                  className="px-2 py-0.5 rounded-md bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 text-[10px] font-medium flex items-center gap-1 transition-colors"
                >
                  <FileCheck className="w-3 h-3" />
                  <span>Proof of Delivery</span>
                </button>
              )}
            </div>
          </div>

          {/* Maneuver Progress bar */}
          <div className="w-full bg-white/5 h-1">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${isDelivered ? 100 : Math.min(Math.max((1 - stepRatio) * 100, 5), 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ══ SPEED LIMIT & VEHICLE SPEED HUD (Google Maps Navigation Style) ═════ */}
      <div className="absolute top-64 left-3 z-30 pointer-events-auto flex flex-col gap-2">
        {/* MUTCD Style Speed Limit Sign */}
        <div className="bg-white border-2 border-black rounded-lg w-12 h-14 flex flex-col items-center justify-center shadow-2xl">
          <span className="text-[6px] font-black text-black tracking-tighter leading-none uppercase">
            SPEED
          </span>
          <span className="text-[6px] font-black text-black tracking-tighter leading-none uppercase mb-0.5">
            LIMIT
          </span>
          <span className="text-base font-extrabold text-black font-mono leading-none">
            {speedLimit}
          </span>
        </div>

        {/* Real-time Vehicle Speed */}
        <div
          className={`px-2.5 py-2 rounded-xl border backdrop-blur-md shadow-xl flex flex-col items-center justify-center transition-all ${
            isOverSpeed
              ? "bg-red-500/20 border-red-500/50 text-red-300"
              : "bg-black/85 border-white/12 text-white"
          }`}
        >
          <span className="text-[8px] font-mono text-white/40 uppercase">Speed</span>
          <div className="text-sm font-bold font-mono tracking-tight flex items-baseline gap-0.5">
            <span>{currentSpeedKph}</span>
            <span className="text-[9px] font-normal text-white/40">km/h</span>
          </div>
        </div>

        {/* Traffic Layer toggle if provided */}
        {onToggleTraffic && (
          <button
            id="hud-traffic-toggle-btn"
            onClick={onToggleTraffic}
            className={`p-2 rounded-xl border shadow-xl flex items-center justify-center transition-all ${
              isTrafficEnabled
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                : "bg-black/85 text-white/40 hover:text-white/80 border-white/12"
            }`}
            title={isTrafficEnabled ? "Real-Time Traffic: Enabled (Click to Hide)" : "Real-Time Traffic: Disabled (Click to Show)"}
          >
            <Layers className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ══ ALL GOOGLE MAPS DIRECTIONS DRAWER / MODAL ══════════════════════════ */}
      {showStepsSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121316] border border-white/15 rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <NavIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Google Maps Delivery Directions</h3>
                  <p className="text-[10px] text-white/40">{origin} → {destination}</p>
                </div>
              </div>
              <button
                onClick={() => setShowStepsSheet(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Action: Open in Official Google Maps Navigation */}
            <div className="px-4 py-2.5 bg-emerald-950/40 border-b border-emerald-500/20 flex items-center justify-between">
              <span className="text-[11px] text-emerald-300">Live Turn-by-Turn GPS:</span>
              <a
                href={googleMapsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
              >
                <span>Open in Google Maps App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* List of Steps */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-white/6">
              {steps.map((step, idx) => {
                const isPassed = idx < currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                return (
                  <div
                    key={step.id}
                    className={`pt-3 first:pt-0 flex items-start gap-3.5 transition-all ${
                      isCurrent ? "text-white font-medium" : isPassed ? "text-white/35" : "text-white/70"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isCurrent
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                        : isPassed
                        ? "bg-white/5 text-white/30"
                        : "bg-white/8 text-white/60"
                    }`}>
                      {isPassed ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ManeuverIcon type={step.type} className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs leading-snug">{step.instruction}</span>
                        <span className="text-[10px] font-mono text-white/40 flex-shrink-0">
                          {formatNavDistance(step.distanceMeters)}
                        </span>
                      </div>
                      <div className="text-[10px] text-white/30 mt-0.5 truncate">
                        {step.streetName}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-white/50">
              <span>Total Est: {etaString}</span>
              <button
                onClick={() => setShowStepsSheet(false)}
                className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ PROOF OF DELIVERY / CONFIRMATION MODAL ═════════════════════════════ */}
      {showDeliveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121316] border border-white/15 rounded-3xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Proof of Delivery</h4>
                  <p className="text-[10px] text-white/40">Complete shipment delivery</p>
                </div>
              </div>
              <button onClick={() => setShowDeliveryModal(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white/4 rounded-xl p-3 text-xs space-y-1.5 border border-white/6">
              <div className="flex justify-between text-white/50">
                <span>Destination:</span>
                <span className="text-white font-medium truncate max-w-[180px]">{destination}</span>
              </div>
              <div className="flex justify-between text-white/50">
                <span>Recipient:</span>
                <span className="text-white font-medium">{deliveryInfo?.recipientName || "Authorized Receiver"}</span>
              </div>
              <div className="flex justify-between text-white/50">
                <span>Tracking Code:</span>
                <span className="text-emerald-400 font-mono font-medium">{deliveryInfo?.trackingCode || "TSL-SHIPMENT"}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowDeliveryModal(false)}
                className="flex-1 py-2 rounded-xl bg-white/6 hover:bg-white/10 text-white/70 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeliveryModal(false);
                  onMarkDelivered?.();
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-emerald-600/30"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm Delivery</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
