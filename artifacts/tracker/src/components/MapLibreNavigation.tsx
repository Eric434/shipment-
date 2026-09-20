import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Volume2, VolumeX, Navigation as NavIcon, Compass, MapPin,
  ChevronRight, Check, AlertTriangle, Play, Pause, RotateCcw,
  Maximize2, Minimize2, ListOrdered, X, Settings2, ShieldAlert,
  Gauge, FastForward
} from "lucide-react";

// ─── Maneuver Types & Definitions ─────────────────────────────────────────────

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
  | "roundabout"
  | "arrive";

export interface NavigationStep {
  id: string;
  type: ManeuverType;
  instruction: string;
  streetName: string;
  distanceMeters: number;
  remainingMetersAtStart: number;
  coordinate: [number, number];
  speedLimitKph: number;
}

// ─── Maneuver Icons ───────────────────────────────────────────────────────────

export function ManeuverIcon({ type, className = "w-6 h-6" }: { type: ManeuverType; className?: string }) {
  switch (type) {
    case "turn-left":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M19 20V9a4 4 0 0 0-4-4H5" />
          <polyline points="9 1 5 5 9 9" />
        </svg>
      );
    case "turn-right":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M5 20V9a4 4 0 0 1 4-4h10" />
          <polyline points="15 1 19 5 15 9" />
        </svg>
      );
    case "slight-left":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M16 20V12a4 4 0 0 0-2-3.46L7 4" />
          <polyline points="12 4 7 4 7 9" />
        </svg>
      );
    case "slight-right":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M8 20V12a4 4 0 0 1 2-3.46L17 4" />
          <polyline points="12 4 17 4 17 9" />
        </svg>
      );
    case "sharp-left":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M18 20v-5a4 4 0 0 0-4-4H7l3-3" />
          <polyline points="7 14 4 11 7 8" />
        </svg>
      );
    case "sharp-right":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M6 20v-5a4 4 0 0 1 4-4h7l-3-3" />
          <polyline points="17 14 20 11 17 8" />
        </svg>
      );
    case "keep-left":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M16 21V10a3 3 0 0 0-3-3H7" />
          <polyline points="10 4 6 7 10 10" />
          <path d="M16 10l3 3" opacity="0.35" />
        </svg>
      );
    case "keep-right":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M8 21V10a3 3 0 0 1 3-3h6" />
          <polyline points="14 4 18 7 14 10" />
          <path d="M8 10l-3 3" opacity="0.35" />
        </svg>
      );
    case "merge":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 21V3" />
          <path d="M4 16l8-8" />
          <polyline points="8 3 12 3 12 7" />
        </svg>
      );
    case "fork":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 21v-8l-6-6" />
          <path d="M12 13l6-6" />
          <polyline points="4 7 6 7 6 9" />
          <polyline points="20 7 18 7 18 9" />
        </svg>
      );
    case "roundabout":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="12" cy="12" r="6" />
          <polyline points="12 6 15 6 15 9" />
          <path d="M12 21v-3" />
        </svg>
      );
    case "arrive":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "depart":
    case "straight":
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      );
  }
}

// ─── Helpers: Format Distance & Speed ─────────────────────────────────────────

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

// ─── Maneuver Step Generator from Path ────────────────────────────────────────

const ROAD_NAMES = [
  "Interstate 80 East Express",
  "Highway 101 Northbound",
  "Grand Corridor Parkway",
  "Silicon Valley Expressway",
  "Metropolitan Beltway (I-280)",
  "Central Logistics Freight Boulevard",
  "Pacific Coast Highway (Route 1)",
  "Airport Connector Way",
  "Commerce Center Outer Loop",
  "Harbor Transport Access Road",
  "Distribution Park Avenue",
];

export function generateNavigationSteps(
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

  // Calculate cumulative distances
  const distances: number[] = [0];
  for (let i = 1; i < fullPath.length; i++) {
    const [lat1, lon1] = fullPath[i - 1];
    const [lat2, lon2] = fullPath[i];
    const R = 6371000; // meters
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

  // Step 0: Depart
  steps.push({
    id: "step-0",
    type: "depart",
    instruction: `Head out from ${origin} onto ${ROAD_NAMES[0]}`,
    streetName: ROAD_NAMES[0],
    distanceMeters: Math.round(totalDistance * 0.12),
    remainingMetersAtStart: Math.round(totalDistance),
    coordinate: fullPath[0],
    speedLimitKph: 60,
  });

  // Intermediate turns at segments of route
  const numSteps = Math.min(Math.max(Math.floor(fullPath.length / 25), 4), 8);
  for (let i = 1; i <= numSteps; i++) {
    const idx = Math.min(Math.floor((i / (numSteps + 1)) * (fullPath.length - 1)), fullPath.length - 2);
    const coord = fullPath[idx];
    const prevCoord = fullPath[Math.max(idx - 2, 0)];
    const nextCoord = fullPath[Math.min(idx + 2, fullPath.length - 1)];

    // Calculate heading change
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

    const road = ROAD_NAMES[i % ROAD_NAMES.length];
    const remMeters = Math.round(totalDistance - distances[idx]);
    const stepDist = Math.round(totalDistance / (numSteps + 1));

    let instruction = `Continue on ${road}`;
    if (type === "turn-right") instruction = `Turn right onto ${road}`;
    else if (type === "turn-left") instruction = `Turn left onto ${road}`;
    else if (type === "slight-right") instruction = `Take the ramp / slight right onto ${road}`;
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

  // Final Step: Arrive
  steps.push({
    id: `step-${numSteps + 1}`,
    type: "arrive",
    instruction: `Arrive at destination: ${destination}`,
    streetName: destination,
    distanceMeters: 0,
    remainingMetersAtStart: 0,
    coordinate: fullPath[fullPath.length - 1],
    speedLimitKph: 45,
  });

  return steps;
}

// ─── MapLibre Navigation iOS HUD Component ────────────────────────────────────

export interface MapLibreNavProps {
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
}

export function MapLibreNavigationHUD({
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
}: MapLibreNavProps) {
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [showStepsSheet, setShowStepsSheet] = useState<boolean>(false);
  const [lastAnnouncedStep, setLastAnnouncedStep] = useState<string>("");

  // Generate Navigation Steps from route
  const steps = useMemo(() => {
    return generateNavigationSteps(fullPath, origin, destination);
  }, [fullPath, origin, destination]);

  // Determine current active step based on progress
  const totalPoints = Math.max(fullPath.length, 1);
  const progressRatio = currentPosIdx / (totalPoints - 1);
  const currentStepIdx = useMemo(() => {
    if (isDelivered || currentPosIdx >= totalPoints - 1) return steps.length - 1;
    const idx = Math.min(Math.floor(progressRatio * (steps.length - 1)), steps.length - 2);
    return Math.max(0, idx);
  }, [currentPosIdx, totalPoints, steps.length, isDelivered, progressRatio]);

  const currentStep = steps[currentStepIdx] || steps[0];
  const nextStep = steps[currentStepIdx + 1] || null;

  // Approximate remaining distance to current maneuver
  const stepRatio = ((progressRatio * (steps.length - 1)) % 1);
  const distanceToManeuver = isDelivered
    ? 0
    : Math.max(Math.round(currentStep.distanceMeters * (1 - stepRatio)), 20);

  // Speed Limit for current step
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
            ? `You will arrive at ${destination} on your right.`
            : `In ${formatNavDistance(distanceToManeuver)}, ${currentStep.instruction}.`;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("SpeechSynthesis error:", err);
      }
    }
  }, [currentStep.id, currentStep.instruction, currentStep.type, destination, distanceToManeuver, isDelivered, lastAnnouncedStep, voiceEnabled]);

  const [isCompact, setIsCompact] = useState<boolean>(false);

  return (
    <>
      {/* ══ TOP iOS MAPLIBRE NAVIGATION BANNER ═════════════════════════════════ */}
      <div className="absolute top-14 sm:top-16 left-3 right-3 sm:left-6 sm:right-auto sm:w-[420px] z-30 pointer-events-auto select-none">
        <div className="bg-[#18191c]/95 backdrop-blur-xl border border-white/15 rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.7)] overflow-hidden transition-all duration-300">
          
          {/* Header Bar */}
          <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-white/8">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold tracking-wide text-white uppercase flex items-center gap-1.5 font-sans">
                <NavIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isDelivered ? "Navigation • Arrived" : "Always-On Navigation"}</span>
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Compact Toggle */}
              <button
                onClick={() => setIsCompact((c) => !c)}
                className="p-1.5 rounded-lg bg-white/4 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all"
                title={isCompact ? "Expand Navigation" : "Minimize Navigation"}
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
                    ? "bg-white/10 text-emerald-400 border-emerald-500/30"
                    : "bg-white/4 text-white/30 border-white/10 hover:text-white/60"
                }`}
                title={voiceEnabled ? "Mute Voice Guidance" : "Unmute Voice Guidance"}
              >
                {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {/* Steps sheet toggle */}
              <button
                onClick={() => setShowStepsSheet(true)}
                className="p-1.5 rounded-lg bg-white/4 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all"
                title="View Step-by-Step Directions"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>

              {onCloseNav && (
                <button
                  onClick={onCloseNav}
                  className="p-1.5 rounded-lg bg-white/4 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white/80 transition-all"
                  title="Close Navigation"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Primary Maneuver Card (Expanded or Compact) */}
          {!isCompact ? (
            <div className="p-3.5 sm:p-4 flex items-start gap-3.5 sm:gap-4">
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner ${
                isDelivered
                  ? "bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
              }`}>
                {isDelivered ? (
                  <Check className="w-7 h-7 sm:w-8 sm:h-8" />
                ) : (
                  <ManeuverIcon type={currentStep.type} className="w-7 h-7 sm:w-8 sm:h-8" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
                    {isDelivered ? "0 m" : formatNavDistance(distanceToManeuver)}
                  </span>
                  <span className={`text-[10px] sm:text-[11px] font-mono uppercase tracking-wider font-semibold ${
                    isDelivered ? "text-emerald-400" : "text-white/45"
                  }`}>
                    {isDelivered ? "Delivered at Destination" : "to next maneuver"}
                  </span>
                </div>

                <div className="text-xs sm:text-sm font-semibold text-white/95 leading-snug line-clamp-2">
                  {isDelivered ? `Package delivered to ${destination}` : currentStep.instruction}
                </div>

                {/* Next turn sub-step preview */}
                {nextStep && !isDelivered && (
                  <div className="flex items-center gap-1.5 mt-2 text-[11px] text-white/50 pt-1.5 border-t border-white/6">
                    <span className="text-white/30 text-[9px] uppercase font-bold">Then</span>
                    <ManeuverIcon type={nextStep.type} className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                    <span className="truncate text-white/70">{nextStep.instruction}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  {isDelivered ? <Check className="w-4 h-4" /> : <ManeuverIcon type={currentStep.type} className="w-4 h-4" />}
                </div>
                <div className="truncate">
                  <span className="text-xs font-bold text-white font-mono mr-2">
                    {isDelivered ? "Delivered" : formatNavDistance(distanceToManeuver)}
                  </span>
                  <span className="text-xs text-white/75 truncate">
                    {isDelivered ? `Arrived at ${destination}` : currentStep.instruction}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar to next turn */}
          <div className="w-full bg-white/5 h-1">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${isDelivered ? 100 : Math.min(Math.max((1 - stepRatio) * 100, 5), 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ══ iOS SPEED LIMIT & CURRENT SPEED HUD ════════════════════════════════ */}
      <div className="absolute top-64 left-3 z-30 pointer-events-auto flex flex-col gap-2">
        {/* MUTCD / iOS Speed Limit Sign */}
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

        {/* Real-time Vehicle Speed Gauge */}
        <div
          className={`px-2.5 py-2 rounded-xl border backdrop-blur-md shadow-xl flex flex-col items-center justify-center transition-all ${
            isOverSpeed
              ? "bg-red-500/20 border-red-500/50 text-red-300"
              : "bg-black/85 border-white/12 text-white"
          }`}
        >
          <span className="text-[9px] font-mono text-white/40 uppercase">Speed</span>
          <div className="text-sm font-bold font-mono tracking-tight flex items-baseline gap-0.5">
            <span>{currentSpeedKph}</span>
            <span className="text-[8px] text-white/40 font-normal">km/h</span>
          </div>
        </div>
      </div>

      {/* ══ iOS CAMERA CONTROLS (Follow / Overview / Re-Center) ════════════════ */}
      <div className="absolute right-3 top-36 z-30 pointer-events-auto flex flex-col gap-2">
        {/* Re-center / Follow Mode Button */}
        <button
          onClick={onRecenterCamera}
          className={`w-10 h-10 rounded-2xl flex items-center justify-center backdrop-blur-xl border shadow-2xl transition-all ${
            isCameraFollowing
              ? "bg-emerald-500 text-black border-emerald-400 font-bold shadow-emerald-500/30 shadow-lg"
              : "bg-black/85 text-white/70 hover:text-white border-white/12 hover:bg-black"
          }`}
          title={isCameraFollowing ? "Following Vehicle (Locked)" : "Re-Center on Vehicle"}
        >
          <NavIcon className={`w-4 h-4 ${isCameraFollowing ? "fill-current" : ""}`} />
        </button>

        {/* Route Overview Toggle Button */}
        <button
          onClick={onToggleOverview}
          className="w-10 h-10 rounded-2xl bg-black/85 hover:bg-black text-white/70 hover:text-white border border-white/12 flex items-center justify-center backdrop-blur-xl shadow-2xl transition-all"
          title="Fit Full Route Overview"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>

      {/* ══ STEP-BY-STEP DIRECTIONS SHEET (iOS MapLibre Style) ══════════════════ */}
      {showStepsSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#141518] border border-white/15 rounded-3xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            
            {/* Sheet Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ListOrdered className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Route Guidance Steps</h3>
                  <p className="text-xs text-white/40">MapLibre Turn-by-Turn Navigation</p>
                </div>
              </div>
              <button
                onClick={() => setShowStepsSheet(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Steps List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {steps.map((step, idx) => {
                const isPassed = idx < currentStepIdx;
                const isCurrent = idx === currentStepIdx;

                return (
                  <div
                    key={step.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3.5 ${
                      isCurrent
                        ? "bg-emerald-500/10 border-emerald-500/40 text-white shadow-lg"
                        : isPassed
                        ? "bg-white/[0.02] border-white/5 text-white/35 opacity-70"
                        : "bg-white/[0.04] border-white/8 text-white/80"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                        isCurrent
                          ? "bg-emerald-500 text-black border-emerald-400 font-bold"
                          : isPassed
                          ? "bg-white/5 text-white/30 border-white/10"
                          : "bg-white/8 text-white/70 border-white/12"
                      }`}
                    >
                      {isPassed ? <Check className="w-4 h-4" /> : <ManeuverIcon type={step.type} className="w-4 h-4" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold font-mono text-white/50">
                          Step {idx + 1}
                        </span>
                        <span className="text-xs font-mono font-bold text-white/90">
                          {formatNavDistance(step.distanceMeters)}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-snug">
                        {step.instruction}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-white/40">
                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/8 font-mono">
                          {step.streetName}
                        </span>
                        <span>•</span>
                        <span>Speed limit {step.speedLimitKph} km/h</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sheet Footer */}
            <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
              <span className="text-xs text-white/40">
                Total Steps: {steps.length}
              </span>
              <button
                onClick={() => setShowStepsSheet(false)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { GoogleMapsNavigationHUD } from "./GoogleMapsNavigation";

