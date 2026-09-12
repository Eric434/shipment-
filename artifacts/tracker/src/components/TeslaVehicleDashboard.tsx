import React, { useState, useMemo } from "react";
import {
  Battery, BatteryCharging, Zap, Compass, Gauge, ShieldCheck,
  Thermometer, Radio, ChevronUp, ChevronDown, Activity, Eye,
  Navigation2, Cpu, Car
} from "lucide-react";
import { TeslaLogo } from "./TeslaLogo";

export interface TeslaVehicleDashboardProps {
  currentSpeedKph: number;
  bearing: number;
  progressPercent: number;
  isLive: boolean;
  isDelivered: boolean;
  origin?: string;
  destination?: string;
  vehicleModel?: string;
}

export function TeslaVehicleDashboard({
  currentSpeedKph,
  bearing,
  progressPercent,
  isLive,
  isDelivered,
  origin,
  destination,
  vehicleModel = "Tesla Semi Fleet #042",
}: TeslaVehicleDashboardProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Dynamic Battery & Range calculation based on progress
  const batteryPct = useMemo(() => {
    if (isDelivered) return 38;
    const base = 94;
    const consumed = (progressPercent / 100) * 52;
    return Math.max(18, Math.round(base - consumed));
  }, [progressPercent, isDelivered]);

  const estimatedRangeKm = useMemo(() => {
    return Math.round(batteryPct * 5.2);
  }, [batteryPct]);

  // Cardinal direction helper
  const cardinal = useMemo(() => {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(((bearing % 360) + 360) % 360 / 45) % 8;
    return directions[index];
  }, [bearing]);

  // Instantaneous power draw / regenerative braking simulation
  const powerKw = useMemo(() => {
    if (!isLive || isDelivered || currentSpeedKph === 0) return 0;
    if (currentSpeedKph > 90) return Math.round(currentSpeedKph * 0.45 + (progressPercent % 7));
    if (currentSpeedKph > 50) return Math.round(currentSpeedKph * 0.32 + (progressPercent % 5));
    return Math.round(currentSpeedKph * 0.2);
  }, [currentSpeedKph, isLive, isDelivered, progressPercent]);

  // Battery bar color based on percentage
  const batteryColor =
    batteryPct > 50 ? "bg-emerald-500 text-emerald-400" :
    batteryPct > 25 ? "bg-amber-500 text-amber-400" :
    "bg-red-500 text-red-400";

  return (
    <div className="select-none pointer-events-auto transition-all duration-300">
      {/* ══ MINIMIZED PILL (When Collapsed) ═══════════════════════════════════ */}
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-[#0e1013]/95 hover:bg-[#14161a] border border-white/15 hover:border-red-500/40 rounded-2xl px-3.5 py-2 shadow-2xl backdrop-blur-xl flex items-center gap-3 text-white transition-all group"
          title="Expand Tesla Vehicle Telemetry"
        >
          <div className="w-5 h-5 flex items-center justify-center text-red-500">
            <TeslaLogo className="w-4 h-4" />
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            {/* Battery Pill */}
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
              <span className="font-semibold text-emerald-300">{batteryPct}%</span>
            </div>
            <span className="text-white/20">•</span>
            {/* Speed */}
            <div className="flex items-center gap-1">
              <span className="font-bold text-white">{currentSpeedKph}</span>
              <span className="text-[10px] text-white/40">km/h</span>
            </div>
            <span className="text-white/20">•</span>
            {/* Heading */}
            <div className="flex items-center gap-1 text-white/70">
              <Compass className="w-3 h-3 text-red-400" />
              <span>{cardinal} {Math.round(bearing)}°</span>
            </div>
          </div>

          <ChevronUp className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" />
        </button>
      ) : (
        /* ══ FULL TESLA TELEMETRY DASHBOARD CARD ═════════════════════════════ */
        <div className="w-[300px] sm:w-[320px] bg-[#0c0d10]/95 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-[0_16px_50px_rgba(0,0,0,0.8)] overflow-hidden transition-all animate-fade-in">
          
          {/* Top Bar: Tesla Branding & Controls */}
          <div className="px-4 py-3 bg-white/[0.03] border-b border-white/8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center text-red-500">
                <TeslaLogo className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold tracking-wider text-white uppercase flex items-center gap-1.5 font-sans">
                  <span>TESLA TELEMETRY</span>
                </div>
                <div className="text-[9px] font-mono text-white/40 leading-none truncate max-w-[150px]">
                  {vehicleModel}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Drive Mode PRND */}
              <div className="flex items-center bg-black/60 border border-white/10 rounded-lg px-1.5 py-0.5 text-[9px] font-mono font-bold tracking-widest gap-1">
                <span className="text-white/20">P</span>
                <span className="text-white/20">R</span>
                <span className="text-white/20">N</span>
                <span className={`px-1 rounded bg-red-600 text-white font-extrabold ${isLive && !isDelivered ? "animate-pulse" : ""}`}>
                  {isDelivered ? "P" : "D"}
                </span>
              </div>

              {/* Collapse Button */}
              <button
                onClick={() => setIsExpanded(false)}
                className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors"
                title="Minimize Dashboard"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-4 space-y-3.5">
            
            {/* Top Row: Speed & Heading Gauges */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Speedometer */}
              <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/8 flex flex-col justify-between">
                <div className="flex items-center justify-between text-white/40 mb-1">
                  <span className="text-[9px] uppercase font-mono tracking-wider">Speed</span>
                  <Gauge className="w-3.5 h-3.5 text-red-500" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold font-mono text-white tracking-tight">
                    {currentSpeedKph}
                  </span>
                  <span className="text-[10px] font-mono text-white/40">km/h</span>
                </div>
                <div className="text-[9px] text-white/30 font-mono mt-0.5">
                  {(currentSpeedKph * 0.621371).toFixed(0)} mph
                </div>
              </div>

              {/* Heading / Compass */}
              <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/8 flex flex-col justify-between">
                <div className="flex items-center justify-between text-white/40 mb-1">
                  <span className="text-[9px] uppercase font-mono tracking-wider">Heading</span>
                  <Compass className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold font-mono text-white tracking-tight">
                    {cardinal}
                  </span>
                  <span className="text-xs font-mono text-white/60 font-semibold">{Math.round(bearing)}°</span>
                </div>
                <div className="text-[9px] text-white/30 font-mono mt-0.5 flex items-center gap-1">
                  <Navigation2
                    className="w-2.5 h-2.5 text-red-500 transition-transform duration-300"
                    style={{ transform: `rotate(${bearing}deg)` }}
                  />
                  <span>Bearing Align</span>
                </div>
              </div>
            </div>

            {/* Middle Row: Battery & Range */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/8 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                  <span className="text-xs font-semibold text-white">Battery State</span>
                </div>
                <div className="flex items-baseline gap-1 font-mono">
                  <span className="text-sm font-bold text-white">{batteryPct}%</span>
                  <span className="text-[10px] text-white/40">({estimatedRangeKm} km est.)</span>
                </div>
              </div>

              {/* Graphical Tesla Battery Bar */}
              <div className="w-full bg-black/60 rounded-full h-2 p-0.5 border border-white/10 flex items-center">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    batteryPct > 50 ? "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                    batteryPct > 25 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                    "bg-gradient-to-r from-red-600 to-red-500 animate-pulse"
                  }`}
                  style={{ width: `${Math.min(Math.max(batteryPct, 5), 100)}%` }}
                />
              </div>

              {/* Energy Draw & Efficiency */}
              <div className="flex items-center justify-between text-[10px] text-white/40 pt-1 border-t border-white/6 font-mono">
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-red-400" />
                  <span>Output: <strong className="text-white/80">{powerKw} kW</strong></span>
                </span>
                <span>Eff: <strong className="text-white/80">164 Wh/km</strong></span>
              </div>
            </div>

            {/* Bottom Row: Autopilot & Cabin Environmental Stats */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              {/* Autopilot Status */}
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <div className="truncate">
                  <div className="font-bold text-[9px] uppercase tracking-wider text-blue-400">Autopilot</div>
                  <div className="text-white/80 truncate">FSD V12.5 Active</div>
                </div>
              </div>

              {/* Climate & Tire Status */}
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/8 text-white/70 flex items-center gap-2">
                <Thermometer className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <div>
                  <div className="font-bold text-[9px] uppercase tracking-wider text-white/40">Cabin / Tires</div>
                  <div className="text-white/90">21.5°C · 42 PSI</div>
                </div>
              </div>
            </div>

          </div>

          {/* Footer Security / Telemetry Link */}
          <div className="px-4 py-2 bg-white/[0.02] border-t border-white/6 flex items-center justify-between text-[9px] font-mono text-white/30">
            <span className="flex items-center gap-1">
              <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
              <span>Tesla Starlink Real-time</span>
            </span>
            <span className="text-white/40">4G LTE · 99.8%</span>
          </div>

        </div>
      )}
    </div>
  );
}
