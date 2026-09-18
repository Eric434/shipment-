import { useEffect, useRef, useState } from "react";
import { TeslaLogo, TeslaT } from "@/components/TeslaLogo";
import {
  Battery,
  Wifi,
  MapPin,
  Gauge,
  Thermometer,
  Lock,
  Unlock,
  Navigation,
  Clock,
  AlertTriangle,
  ChevronRight,
  Activity,
  Shield,
  Loader2,
} from "lucide-react";
import { loadGoogleMaps, TESLA_DARK_MAP_STYLES } from "@/lib/googleMaps";

declare const google: any;

const VEHICLES = [
  {
    id: 1,
    name: "Model S Plaid",
    plate: "TSL-001",
    lat: 37.7749,
    lng: -122.4194,
    speed: 68,
    battery: 87,
    range: 312,
    temp: 72,
    status: "Moving",
    locked: true,
    driver: "Alex Morgan",
    odometer: 14302,
    color: "#dc2626",
    lastUpdate: "Just now",
    location: "Market St, San Francisco",
    trips: 3,
    alerts: 0,
  },
  {
    id: 2,
    name: "Model 3 LR",
    plate: "TSL-002",
    lat: 37.8044,
    lng: -122.2712,
    speed: 0,
    battery: 62,
    range: 218,
    temp: 69,
    status: "Parked",
    locked: true,
    driver: "Sam Rivera",
    odometer: 8741,
    color: "#c0c0c0",
    lastUpdate: "4 min ago",
    location: "Oakland, CA",
    trips: 1,
    alerts: 0,
  },
  {
    id: 3,
    name: "Model X AWD",
    plate: "TSL-003",
    lat: 37.3382,
    lng: -121.8863,
    speed: 42,
    battery: 23,
    range: 78,
    temp: 75,
    status: "Moving",
    locked: false,
    driver: "Jordan Lee",
    odometer: 22155,
    color: "#1a1a2e",
    lastUpdate: "Just now",
    location: "San Jose, CA",
    trips: 5,
    alerts: 1,
  },
  {
    id: 4,
    name: "Cybertruck",
    plate: "TSL-004",
    lat: 37.6879,
    lng: -122.4702,
    speed: 0,
    battery: 94,
    range: 381,
    temp: 68,
    status: "Charging",
    locked: true,
    driver: "Chris Park",
    odometer: 3281,
    color: "#8a8a8a",
    lastUpdate: "2 min ago",
    location: "South SF Supercharger",
    trips: 0,
    alerts: 0,
  },
];

function getMarkerIcon(g: any, vehicle: (typeof VEHICLES)[0], isSelected: boolean) {
  const batteryLow = vehicle.battery < 25;
  const color = batteryLow ? "#f59e0b" : isSelected ? "#dc2626" : "#e5e5e5";
  return {
    path: g.maps.SymbolPath.CIRCLE,
    scale: isSelected ? 9 : 6.5,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: isSelected ? "#ef4444" : "#27272a",
    strokeWeight: isSelected ? 3 : 2,
  };
}

export default function TrackingDashboard() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const googleRef = useRef<any>(null);
  const markersRef = useRef<Record<number, any>>({});
  const [mapLoading, setMapLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState(VEHICLES[0]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sidebarTab, setSidebarTab] = useState<"fleet" | "alerts">("fleet");
  const [controlFeedback, setControlFeedback] = useState<string | null>(null);

  const triggerControl = (label: string) => {
    setControlFeedback(label);
    setTimeout(() => setControlFeedback(null), 2000);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    let isMounted = true;

    loadGoogleMaps().then((g) => {
      if (!isMounted || !mapRef.current) return;
      googleRef.current = g;

      const map = new g.maps.Map(mapRef.current, {
        center: { lat: 37.6, lng: -122.1 },
        zoom: 10,
        disableDefaultUI: true,
        styles: TESLA_DARK_MAP_STYLES,
        backgroundColor: "#080808",
      });

      VEHICLES.forEach((vehicle) => {
        const marker = new g.maps.Marker({
          position: { lat: vehicle.lat, lng: vehicle.lng },
          map,
          title: `${vehicle.name} (${vehicle.plate})`,
          icon: getMarkerIcon(g, vehicle, vehicle.id === selectedVehicle.id),
        });

        marker.addListener("click", () => {
          setSelectedVehicle(vehicle);
        });

        markersRef.current[vehicle.id] = marker;
      });

      mapInstanceRef.current = map;
      setMapLoading(false);
    }).catch((err) => {
      console.error("Dashboard Google Maps failed to load:", err);
      if (isMounted) setMapLoading(false);
    });

    return () => {
      isMounted = false;
      Object.values(markersRef.current).forEach((m: any) => m.setMap?.(null));
      markersRef.current = {};
      mapInstanceRef.current = null;
      googleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!googleRef.current) return;
    const g = googleRef.current;
    VEHICLES.forEach((vehicle) => {
      const marker = markersRef.current[vehicle.id];
      if (marker) {
        marker.setIcon(getMarkerIcon(g, vehicle, vehicle.id === selectedVehicle.id));
      }
    });

    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo({
        lat: selectedVehicle.lat,
        lng: selectedVehicle.lng,
      });
    }
  }, [selectedVehicle]);

  const getBatteryColor = (battery: number) => {
    if (battery > 60) return "#22c55e";
    if (battery > 25) return "#f59e0b";
    return "#dc2626";
  };

  const getStatusColor = (status: string) => {
    if (status === "Moving") return "text-green-400";
    if (status === "Charging") return "text-blue-400";
    return "text-gray-400";
  };

  const getStatusDot = (status: string) => {
    if (status === "Moving") return "bg-green-400";
    if (status === "Charging") return "bg-blue-400";
    return "bg-gray-500";
  };

  const totalAlerts = VEHICLES.reduce((sum, v) => sum + v.alerts, 0);
  const movingCount = VEHICLES.filter((v) => v.status === "Moving").length;

  return (
    <div className="flex flex-col h-dvh bg-black text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/8 bg-black/95 backdrop-blur-sm z-20 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 text-red-600">
              <TeslaT className="w-full h-full text-red-600" />
            </div>
            <TeslaLogo className="h-4 text-white" />
          </div>
          <div className="w-px h-5 bg-white/10" />
          <span className="text-xs tracking-[0.3em] text-white/40 uppercase font-medium">
            Fleet Tracker
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-xs text-white/40">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span>
              {movingCount} / {VEHICLES.length} Active
            </span>
          </div>
          {totalAlerts > 0 && (
            <div className="flex items-center gap-1.5 bg-red-600/10 border border-red-600/30 rounded px-2.5 py-1">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span className="text-xs text-red-400">{totalAlerts} Alert</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Wifi className="w-3.5 h-3.5 text-green-400" />
            <span>Live</span>
          </div>
          <div className="text-xs text-white/30 font-mono">
            {currentTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-72 bg-black border-r border-white/8 flex flex-col flex-shrink-0 z-10">
          {/* Tabs */}
          <div className="flex border-b border-white/8">
            <button
              onClick={() => setSidebarTab("fleet")}
              className={`flex-1 py-3 text-xs tracking-widest uppercase transition-colors ${
                sidebarTab === "fleet"
                  ? "text-red-500 border-b-2 border-red-600"
                  : "text-white/30 hover:text-white/60"
              }`}
            >
              Fleet
            </button>
            <button
              onClick={() => setSidebarTab("alerts")}
              className={`flex-1 py-3 text-xs tracking-widest uppercase transition-colors relative ${
                sidebarTab === "alerts"
                  ? "text-red-500 border-b-2 border-red-600"
                  : "text-white/30 hover:text-white/60"
              }`}
            >
              Alerts
              {totalAlerts > 0 && (
                <span className="absolute top-2 right-6 w-4 h-4 text-[9px] flex items-center justify-center bg-red-600 rounded-full text-white">
                  {totalAlerts}
                </span>
              )}
            </button>
          </div>

          {/* Vehicle list */}
          {sidebarTab === "fleet" && (
            <div className="flex-1 overflow-y-auto">
              {VEHICLES.map((vehicle) => (
                <button
                  key={vehicle.id}
                  onClick={() => setSelectedVehicle(vehicle)}
                  className={`w-full text-left px-4 py-3.5 border-b border-white/5 transition-all ${
                    selectedVehicle.id === vehicle.id
                      ? "bg-red-600/8 border-l-2 border-l-red-600"
                      : "hover:bg-white/3"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${getStatusDot(vehicle.status)}`} />
                      <span className="text-xs font-medium text-white/90">{vehicle.name}</span>
                    </div>
                    <ChevronRight
                      className={`w-3.5 h-3.5 transition-opacity ${
                        selectedVehicle.id === vehicle.id ? "text-red-500 opacity-100" : "opacity-0"
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between ml-3.5">
                    <span className={`text-[10px] ${getStatusColor(vehicle.status)}`}>
                      {vehicle.status}
                      {vehicle.status === "Moving" && ` · ${vehicle.speed} mph`}
                    </span>
                    <div className="flex items-center gap-1">
                      <Battery
                        className="w-3 h-3"
                        style={{ color: getBatteryColor(vehicle.battery) }}
                      />
                      <span
                        className="text-[10px] font-mono"
                        style={{ color: getBatteryColor(vehicle.battery) }}
                      >
                        {vehicle.battery}%
                      </span>
                    </div>
                  </div>
                  <div className="ml-3.5 mt-1">
                    <div className="text-[9px] text-white/25">{vehicle.plate}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {sidebarTab === "alerts" && (
            <div className="flex-1 overflow-y-auto p-4">
              {VEHICLES.filter((v) => v.alerts > 0).map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="mb-3 bg-red-600/10 border border-red-600/25 rounded-lg p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs font-medium text-red-400">{vehicle.name}</span>
                  </div>
                  <p className="text-[10px] text-white/50">
                    Low battery warning — {vehicle.battery}% remaining ({vehicle.range} mi range)
                  </p>
                </div>
              ))}
              {totalAlerts === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-white/20">
                  <Shield className="w-8 h-8 mb-2" />
                  <p className="text-xs">All clear</p>
                </div>
              )}
            </div>
          )}

          {/* Fleet summary */}
          <div className="border-t border-white/8 p-4 grid grid-cols-2 gap-2">
            {[
              { label: "Fleet Size", value: VEHICLES.length },
              {
                label: "Moving",
                value: VEHICLES.filter((v) => v.status === "Moving").length,
              },
              {
                label: "Parked",
                value: VEHICLES.filter((v) => v.status === "Parked").length,
              },
              {
                label: "Charging",
                value: VEHICLES.filter((v) => v.status === "Charging").length,
              },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/3 rounded p-2">
                <div className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">
                  {stat.label}
                </div>
                <div className="text-sm font-light text-white/80">{stat.value}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* Map */}
        <div className="flex-1 relative bg-[#080808]">
          <div ref={mapRef} className="w-full h-full" />

          {mapLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#080808]/85 backdrop-blur-sm z-10 pointer-events-none gap-2">
              <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
              <span className="text-[10px] font-mono text-white/50 tracking-wider">LOADING FLEET MAP...</span>
            </div>
          )}

          {/* Google Maps Platform Badge */}
          <div className="absolute top-4 right-4 z-10 pointer-events-none">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/80 border border-white/10 text-[9px] text-white/40 shadow-lg backdrop-blur-sm">
              <MapPin className="w-2.5 h-2.5 text-red-500" />
              <span>Google Maps Platform</span>
            </div>
          </div>

          {/* Map overlay: vehicle info */}
          <div className="absolute bottom-5 left-5 right-5 z-10 pointer-events-none">
            <div className="max-w-sm bg-black/85 backdrop-blur-md border border-white/10 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${getStatusDot(selectedVehicle.status)}`} />
                    <span className={`text-[11px] ${getStatusColor(selectedVehicle.status)}`}>
                      {selectedVehicle.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-white">{selectedVehicle.name}</h3>
                  <p className="text-[10px] text-white/40 mt-0.5">{selectedVehicle.plate}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {selectedVehicle.locked ? (
                    <Lock className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5 text-red-400" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <Gauge className="w-3.5 h-3.5 text-white/40 mx-auto mb-1" />
                  <div className="text-xs font-light text-white/80">{selectedVehicle.speed}</div>
                  <div className="text-[9px] text-white/25">mph</div>
                </div>
                <div className="text-center">
                  <Battery
                    className="w-3.5 h-3.5 mx-auto mb-1"
                    style={{ color: getBatteryColor(selectedVehicle.battery) }}
                  />
                  <div className="text-xs font-light" style={{ color: getBatteryColor(selectedVehicle.battery) }}>
                    {selectedVehicle.battery}%
                  </div>
                  <div className="text-[9px] text-white/25">{selectedVehicle.range} mi</div>
                </div>
                <div className="text-center">
                  <Thermometer className="w-3.5 h-3.5 text-white/40 mx-auto mb-1" />
                  <div className="text-xs font-light text-white/80">{selectedVehicle.temp}°</div>
                  <div className="text-[9px] text-white/25">cabin</div>
                </div>
                <div className="text-center">
                  <Activity className="w-3.5 h-3.5 text-white/40 mx-auto mb-1" />
                  <div className="text-xs font-light text-white/80">{selectedVehicle.trips}</div>
                  <div className="text-[9px] text-white/25">trips</div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-white/6 flex items-center gap-1.5">
                <MapPin className="w-2.5 h-2.5 text-red-500 flex-shrink-0" />
                <span className="text-[10px] text-white/40 truncate">{selectedVehicle.location}</span>
                <span className="text-[10px] text-white/20 ml-auto flex-shrink-0 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {selectedVehicle.lastUpdate}
                </span>
              </div>
            </div>
          </div>

          {/* Top left overlay */}
          <div className="absolute top-4 left-4 z-10">
            <div className="bg-black/90 border border-white/8 rounded-lg px-3 py-2 flex items-center gap-2">
              <Navigation className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs text-white/60">
                {selectedVehicle.name} · {selectedVehicle.location}
              </span>
            </div>
          </div>

          {/* Driver info - top right */}
          <div className="absolute top-4 right-4 z-10">
            <div className="bg-black/90 border border-white/8 rounded-lg px-3 py-2">
              <div className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">Driver</div>
              <div className="text-xs text-white/70">{selectedVehicle.driver}</div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <aside className="w-56 bg-black border-l border-white/8 flex flex-col flex-shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-white/8">
            <div className="text-[9px] text-white/30 uppercase tracking-widest mb-3">
              Vehicle Details
            </div>

            {/* Battery bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] text-white/40">Battery</span>
                <span
                  className="text-[10px] font-mono"
                  style={{ color: getBatteryColor(selectedVehicle.battery) }}
                >
                  {selectedVehicle.battery}%
                </span>
              </div>
              <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${selectedVehicle.battery}%`,
                    background: getBatteryColor(selectedVehicle.battery),
                  }}
                />
              </div>
              <div className="text-[9px] text-white/25 mt-1">{selectedVehicle.range} mi range</div>
            </div>

            {[
              {
                label: "Speed",
                value: `${selectedVehicle.speed} mph`,
                icon: Gauge,
              },
              {
                label: "Cabin Temp",
                value: `${selectedVehicle.temp}°F`,
                icon: Thermometer,
              },
              {
                label: "Odometer",
                value: `${selectedVehicle.odometer.toLocaleString()} mi`,
                icon: Activity,
              },
              {
                label: "Locked",
                value: selectedVehicle.locked ? "Yes" : "No",
                icon: selectedVehicle.locked ? Lock : Unlock,
                valueColor: selectedVehicle.locked ? "text-green-400" : "text-red-400",
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/4">
                <div className="flex items-center gap-1.5">
                  <item.icon className="w-3 h-3 text-white/25" />
                  <span className="text-[10px] text-white/40">{item.label}</span>
                </div>
                <span className={`text-[10px] font-mono ${item.valueColor ?? "text-white/70"}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* Quick controls */}
          <div className="p-4">
            <div className="text-[9px] text-white/30 uppercase tracking-widest mb-3">
              Quick Controls
            </div>
            {controlFeedback && (
              <div className="mb-2 px-3 py-1.5 bg-green-600/15 border border-green-500/30 rounded-lg text-[10px] text-green-300 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                {controlFeedback} — Command sent
              </div>
            )}
            <div className="space-y-2">
              {[
                { label: "Flash Lights", icon: "⚡" },
                { label: "Horn", icon: "📣" },
                { label: "Climate On", icon: "❄️" },
                { label: "Open Frunk", icon: "🔓" },
              ].map((ctrl) => (
                <button
                  key={ctrl.label}
                  onClick={() => triggerControl(ctrl.label)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 border rounded-lg transition-all text-left group ${
                    controlFeedback === ctrl.label
                      ? "bg-green-600/10 border-green-500/30 text-green-300"
                      : "bg-white/4 hover:bg-white/8 border-white/6 hover:border-red-600/30"
                  }`}
                >
                  <span className="text-sm">{ctrl.icon}</span>
                  <span className={`text-[10px] transition-colors ${
                    controlFeedback === ctrl.label ? "text-green-300" : "text-white/50 group-hover:text-white/80"
                  }`}>
                    {ctrl.label}
                  </span>
                  {controlFeedback === ctrl.label && (
                    <span className="ml-auto text-[8px] text-green-400">✓ Sent</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div className="p-4 border-t border-white/8 mt-auto">
            <div className="text-[9px] text-white/30 uppercase tracking-widest mb-2">
              Activity
            </div>
            <div className="space-y-2">
              {[
                { time: "09:14", event: "Engine on" },
                { time: "08:52", event: "Charged to 87%" },
                { time: "Yesterday", event: "Trip ended" },
              ].map((log) => (
                <div key={log.time} className="flex items-center gap-2">
                  <span className="text-[8px] text-white/20 font-mono w-14 flex-shrink-0">
                    {log.time}
                  </span>
                  <span className="text-[9px] text-white/40 truncate">{log.event}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
