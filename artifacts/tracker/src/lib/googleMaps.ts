import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

export const GOOGLE_MAPS_API_KEY =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
  "AIzaSyAm1SX3n0O31_v6OpWyf4hWfk9XviUhibk";

export const TESLA_DARK_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#121316" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#121316" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#747b8c" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d1d5db" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#525969" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#17181d" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#101614" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#3d5747" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#22242b" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#18191f" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2d303a" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1e2027" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#e5e7eb" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1b1c23" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#818898" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#08090d" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#374151" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#08090d" }] },
];

export interface GoogleDirectionsResult {
  summary: string;
  distanceText: string;
  distanceMeters: number;
  durationText: string;
  durationSeconds: number;
  overviewPath: [number, number][];
  steps: GoogleNavStep[];
  status: string;
}

export interface GoogleNavStep {
  id: string;
  instructions: string; // Plain text stripped of HTML
  rawHtml: string;
  distanceText: string;
  distanceMeters: number;
  durationText: string;
  durationSeconds: number;
  maneuver: string;
  startLocation: [number, number];
  endLocation: [number, number];
  path: [number, number][];
}

let initPromise: Promise<any> | null = null;

export function loadGoogleMaps(): Promise<any> {
  if (typeof window !== "undefined" && (window as any).google?.maps?.Map) {
    return Promise.resolve((window as any).google);
  }

  if (!initPromise) {
    initPromise = (async () => {
      try {
        setOptions({
          key: GOOGLE_MAPS_API_KEY,
          v: "weekly",
        });
      } catch (err) {
        console.warn("Google Maps setOptions notice:", err);
      }

      await importLibrary("maps");
      await importLibrary("marker");
      try {
        await importLibrary("routes");
      } catch (err) {
        console.info("Google Maps routes library loaded via standard namespace", err);
      }
      try {
        await importLibrary("geometry");
      } catch {
        // Optional
      }

      return (window as any).google;
    })();
  }

  return initPromise;
}

/**
 * Strips HTML tags from Google Maps instructions (e.g., "Turn <b>left</b> onto <b>Main St</b>")
 */
export function stripHtmlInstructions(html: string): string {
  if (!html) return "";
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

/**
 * Request real driving directions from Google Maps DirectionsService
 */
export async function fetchGoogleMapsDrivingRoute(
  origin: string | [number, number],
  destination: string | [number, number]
): Promise<GoogleDirectionsResult | null> {
  try {
    const g = await loadGoogleMaps();
    if (!g?.maps?.DirectionsService) return null;

    const directionsService = new g.maps.DirectionsService();

    const originParam =
      typeof origin === "string"
        ? origin
        : new g.maps.LatLng(origin[0], origin[1]);

    const destParam =
      typeof destination === "string"
        ? destination
        : new g.maps.LatLng(destination[0], destination[1]);

    return new Promise((resolve) => {
      directionsService.route(
        {
          origin: originParam,
          destination: destParam,
          travelMode: g.maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
        },
        (response: any, status: any) => {
          if (status === g.maps.DirectionsStatus.OK && response?.routes?.[0]?.legs?.[0]) {
            const route = response.routes[0];
            const leg = route.legs[0];

            const overviewPath: [number, number][] = (route.overview_path || []).map((latLng: any) => [
              latLng.lat(),
              latLng.lng(),
            ]);

            const steps: GoogleNavStep[] = (leg.steps || []).map((step: any, idx: number) => {
              const stepPath: [number, number][] = (step.path || []).map((pt: any) => [
                pt.lat(),
                pt.lng(),
              ]);

              return {
                id: `gstep-${idx}`,
                instructions: stripHtmlInstructions(step.instructions || ""),
                rawHtml: step.instructions || "",
                distanceText: step.distance?.text || "",
                distanceMeters: step.distance?.value || 0,
                durationText: step.duration?.text || "",
                durationSeconds: step.duration?.value || 0,
                maneuver: step.maneuver || (idx === (leg.steps.length - 1) ? "arrive" : "straight"),
                startLocation: [step.start_location.lat(), step.start_location.lng()],
                endLocation: [step.end_location.lat(), step.end_location.lng()],
                path: stepPath,
              };
            });

            resolve({
              summary: route.summary || `${leg.start_address} to ${leg.end_address}`,
              distanceText: leg.distance?.text || "",
              distanceMeters: leg.distance?.value || 0,
              durationText: leg.duration?.text || "",
              durationSeconds: leg.duration?.value || 0,
              overviewPath,
              steps,
              status: "OK",
            });
          } else {
            console.warn("Google Maps Directions request notice:", status);
            resolve(null);
          }
        }
      );
    });
  } catch (err) {
    console.warn("Failed to query Google Maps Directions:", err);
    return null;
  }
}

/**
 * Build deep link URL to open native Google Maps Turn-by-Turn GPS navigation
 */
export function buildGoogleMapsNavigationUrl(
  destination: string | [number, number],
  origin?: string | [number, number]
): string {
  const destStr =
    typeof destination === "string"
      ? encodeURIComponent(destination)
      : `${destination[0]},${destination[1]}`;

  let url = `https://www.google.com/maps/dir/?api=1&destination=${destStr}&travelmode=driving&dir_action=navigate`;
  if (origin) {
    const origStr =
      typeof origin === "string"
        ? encodeURIComponent(origin)
        : `${origin[0]},${origin[1]}`;
    url += `&origin=${origStr}`;
  }
  return url;
}
