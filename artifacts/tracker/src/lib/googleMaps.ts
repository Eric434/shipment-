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

      return (window as any).google;
    })();
  }

  return initPromise;
}
