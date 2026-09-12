import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

export interface BasemapItem {
  id: string;
  name: string;
  provider: "CARTO" | "OpenStreetMap" | "Esri" | "Stadia" | "OpenTopoMap" | "NASA" | "Custom";
  category: "dark" | "light" | "satellite" | "navigation" | "topo" | "night_earth" | "custom";
  badge: string;
  description: string;
  url: string;
  subdomains?: string;
  maxZoom: number;
  minZoom?: number;
  attribution: string;
  previewBg: string;
  previewBorder: string;
  supportsRetina: boolean;
  filterPreset?: string;
  isPopular?: boolean;
}

export const BASEMAP_CATALOG: BasemapItem[] = [
  // ─── Default Permanent Basemap: Stadia Alidade Dark ─────────────────────────
  {
    id: "stadia_alidade_dark",
    name: "Stadia Alidade Dark",
    provider: "Stadia",
    category: "dark",
    badge: "Permanent Default",
    description: "Sleek slate-toned dark cartography engineered for precision logistics and route tracking",
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
    maxZoom: 20,
    attribution: '© <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>, © <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    previewBg: "#111417",
    previewBorder: "#ef4444",
    supportsRetina: true,
    filterPreset: "brightness(0.95)",
    isPopular: true,
  },
  // ─── CARTO Basemaps ────────────────────────────────────────────────────────
  {
    id: "carto_dark_matter",
    name: "CARTO Dark Matter",
    provider: "CARTO",
    category: "dark",
    badge: "Night Pro",
    description: "High-contrast dark theme with complete street, highway, and municipal labels",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    maxZoom: 20,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> © <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
    previewBg: "#0f1115",
    previewBorder: "#dc2626",
    supportsRetina: true,
    filterPreset: "brightness(0.92) saturate(0.85)",
    isPopular: true,
  },
  {
    id: "carto_dark_nolabels",
    name: "CARTO Dark (No Labels)",
    provider: "CARTO",
    category: "dark",
    badge: "Telemetry Focus",
    description: "Pure minimalist dark mode focused cleanly on live route vectors and vehicle telemetry",
    url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    maxZoom: 20,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> © <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
    previewBg: "#080808",
    previewBorder: "#52525b",
    supportsRetina: true,
    filterPreset: "brightness(0.92) saturate(0.85)",
  },
  {
    id: "carto_voyager",
    name: "CARTO Voyager",
    provider: "CARTO",
    category: "navigation",
    badge: "Navigation",
    description: "Vibrant, high-legibility road network and logistics corridor cartography",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    maxZoom: 20,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> © <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
    previewBg: "#dce7e9",
    previewBorder: "#10b981",
    supportsRetina: true,
    filterPreset: "saturate(1.08)",
    isPopular: true,
  },
  {
    id: "carto_voyager_nolabels",
    name: "CARTO Voyager (Clean)",
    provider: "CARTO",
    category: "navigation",
    badge: "Corridors",
    description: "Topographical terrain and highway corridors with minimal text annotations",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    maxZoom: 20,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> © <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
    previewBg: "#e2e8f0",
    previewBorder: "#059669",
    supportsRetina: true,
    filterPreset: "saturate(1.08)",
  },
  {
    id: "carto_positron",
    name: "CARTO Positron",
    provider: "CARTO",
    category: "light",
    badge: "Daylight",
    description: "Crisp, elegant light cartography engineered for clear contrast and daytime tracking",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    maxZoom: 20,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> © <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
    previewBg: "#e4e8ec",
    previewBorder: "#3b82f6",
    supportsRetina: true,
    filterPreset: "contrast(1.04)",
    isPopular: true,
  },
  {
    id: "carto_positron_nolabels",
    name: "CARTO Positron (Minimal)",
    provider: "CARTO",
    category: "light",
    badge: "Clean Day",
    description: "Minimalist daylight basemap without text overlays",
    url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    maxZoom: 20,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> © <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
    previewBg: "#f1f5f9",
    previewBorder: "#94a3b8",
    supportsRetina: true,
    filterPreset: "contrast(1.04)",
  },

  // ─── Esri Photogrammetry & Satellite ────────────────────────────────────────
  {
    id: "esri_world_imagery",
    name: "Esri Satellite Imagery",
    provider: "Esri",
    category: "satellite",
    badge: "High-Res Aerial",
    description: "High-resolution global satellite and aerial photography from World Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    attribution: 'Tiles © <a href="https://www.esri.com" target="_blank">Esri</a> — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    previewBg: "#1a2421",
    previewBorder: "#10b981",
    supportsRetina: false,
    filterPreset: "contrast(1.08) brightness(0.95)",
    isPopular: true,
  },
  {
    id: "esri_world_street",
    name: "Esri World Street Map",
    provider: "Esri",
    category: "navigation",
    badge: "Detailed Streets",
    description: "Comprehensive highway, highway interchange, and arterial road network",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    attribution: 'Tiles © <a href="https://www.esri.com" target="_blank">Esri</a>',
    previewBg: "#e8ecef",
    previewBorder: "#3b82f6",
    supportsRetina: false,
    filterPreset: "contrast(1.02)",
  },
  {
    id: "esri_world_topo",
    name: "Esri World Topographic",
    provider: "Esri",
    category: "topo",
    badge: "Topography",
    description: "Physical landforms, water bodies, relief shading, and elevation contours",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    attribution: 'Tiles © <a href="https://www.esri.com" target="_blank">Esri</a>',
    previewBg: "#dde5d4",
    previewBorder: "#84cc16",
    supportsRetina: false,
    filterPreset: "contrast(1.03)",
  },

  // ─── OpenStreetMap & Topo ───────────────────────────────────────────────────
  {
    id: "osm_standard",
    name: "OpenStreetMap Standard",
    provider: "OpenStreetMap",
    category: "navigation",
    badge: "Global Community",
    description: "Standard crowd-verified international street mapping from OpenStreetMap Foundation",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    previewBg: "#e5e3df",
    previewBorder: "#f59e0b",
    supportsRetina: false,
    filterPreset: "contrast(1.02)",
    isPopular: true,
  },
  {
    id: "osm_hot",
    name: "OSM Humanitarian (HOT)",
    provider: "OpenStreetMap",
    category: "navigation",
    badge: "High Clarity",
    description: "Humanitarian OpenStreetMap Team high-visibility layout with emphasized road classes",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    subdomains: "abc",
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">Humanitarian OpenStreetMap Team</a>',
    previewBg: "#eef2f5",
    previewBorder: "#ec4899",
    supportsRetina: false,
    filterPreset: "contrast(1.05)",
  },
  {
    id: "opentopomap",
    name: "OpenTopoMap",
    provider: "OpenTopoMap",
    category: "topo",
    badge: "Elevation Contours",
    description: "Topographical map with precise elevation contour lines and mountain hillshading",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    maxZoom: 17,
    attribution: 'Map data: © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org" target="_blank">SRTM</a> | Map style: © <a href="https://opentopomap.org" target="_blank">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">CC-BY-SA</a>)',
    previewBg: "#d9e2cb",
    previewBorder: "#10b981",
    supportsRetina: false,
    filterPreset: "contrast(1.06)",
  },

  // ─── Stadia / Stamen ────────────────────────────────────────────────────────
  {
    id: "stadia_alidade_smooth_dark",
    name: "Stadia Alidade Dark",
    provider: "Stadia",
    category: "dark",
    badge: "Obsidian",
    description: "Sleek slate-toned basemap with muted land cover and highlighted expressways",
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
    maxZoom: 20,
    attribution: '© <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>, © <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    previewBg: "#111417",
    previewBorder: "#6366f1",
    supportsRetina: true,
    filterPreset: "brightness(0.95)",
  },
  {
    id: "stadia_alidade_smooth",
    name: "Stadia Alidade Smooth",
    provider: "Stadia",
    category: "light",
    badge: "Paper",
    description: "Soft monochrome background allowing delivery markers and routes to stand out",
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
    maxZoom: 20,
    attribution: '© <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>, © <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    previewBg: "#f8fafc",
    previewBorder: "#94a3b8",
    supportsRetina: true,
    filterPreset: "contrast(1.02)",
  },

  // ─── NASA Earth Observation ─────────────────────────────────────────────────
  {
    id: "nasa_black_marble",
    name: "NASA Night Lights (VIIRS)",
    provider: "NASA",
    category: "night_earth",
    badge: "Orbital VIIRS",
    description: "NASA Black Marble imagery depicting global electric illumination and city lights at night",
    url: "https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg",
    maxZoom: 8,
    attribution: 'Imagery courtesy NASA EOSDIS GIBS / Earthdata',
    previewBg: "#020408",
    previewBorder: "#eab308",
    supportsRetina: false,
    filterPreset: "brightness(1.1) contrast(1.2)",
  },
];

// ─── GET /api/basemaps: List all Basemaps ──────────────────────────────────────

router.get("/basemaps", (req: Request, res: Response) => {
  const { category, provider } = req.query;

  let results = [...BASEMAP_CATALOG];

  if (category && typeof category === "string") {
    results = results.filter((bm) => bm.category.toLowerCase() === category.toLowerCase());
  }

  if (provider && typeof provider === "string") {
    results = results.filter((bm) => bm.provider.toLowerCase() === provider.toLowerCase());
  }

  res.json({
    ok: true,
    total: results.length,
    basemaps: results,
    timestamp: new Date().toISOString(),
    api: "Tesla Fleet Cartography Basemap API v1.2",
  });
});

// ─── GET /api/basemaps/categories: Category Summary ───────────────────────────

router.get("/basemaps/categories", (_req: Request, res: Response) => {
  const categories = [
    {
      id: "all",
      label: "All Basemaps",
      count: BASEMAP_CATALOG.length,
      description: "Full suite of all supported global cartographic and satellite basemaps",
    },
    {
      id: "dark",
      label: "Dark & Night",
      count: BASEMAP_CATALOG.filter((b) => b.category === "dark").length,
      description: "Low-light and obsidian styles optimized for night telemetry and OLED screens",
    },
    {
      id: "satellite",
      label: "Satellite & Aerial",
      count: BASEMAP_CATALOG.filter((b) => b.category === "satellite").length,
      description: "High-resolution orbital photogrammetry and aerial land reconnaissance",
    },
    {
      id: "navigation",
      label: "Navigation & Streets",
      count: BASEMAP_CATALOG.filter((b) => b.category === "navigation").length,
      description: "Turn-by-turn routing corridors, road networks, and highway interchanges",
    },
    {
      id: "light",
      label: "Daylight & Minimal",
      count: BASEMAP_CATALOG.filter((b) => b.category === "light").length,
      description: "Clean, high-visibility daylight cartography with high contrast",
    },
    {
      id: "topo",
      label: "Topography & Terrain",
      count: BASEMAP_CATALOG.filter((b) => b.category === "topo").length,
      description: "Elevation contour profiles, hillshading, and mountainous gradients",
    },
    {
      id: "night_earth",
      label: "Orbital Night Earth",
      count: BASEMAP_CATALOG.filter((b) => b.category === "night_earth").length,
      description: "NASA VIIRS city light sensors and satellite nocturnal imagery",
    },
  ];

  res.json({
    ok: true,
    categories,
    providers: ["CARTO", "Esri", "OpenStreetMap", "Stadia", "OpenTopoMap", "NASA"],
  });
});

// ─── GET /api/basemaps/:id: Get specific Basemap ──────────────────────────────

router.get("/basemaps/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const basemap = BASEMAP_CATALOG.find((b) => b.id === id);

  if (!basemap) {
    res.status(404).json({ ok: false, error: `Basemap '${id}' not found` });
    return;
  }

  res.json({
    ok: true,
    basemap,
  });
});

// ─── POST /api/basemaps/validate: Validate custom tile URL template ───────────

router.post("/basemaps/validate", async (req: Request, res: Response) => {
  const { urlTemplate } = req.body;

  if (!urlTemplate || typeof urlTemplate !== "string") {
    res.status(400).json({ ok: false, error: "Missing 'urlTemplate' string parameter" });
    return;
  }

  if (!urlTemplate.includes("{z}") || !urlTemplate.includes("{x}") || !urlTemplate.includes("{y}")) {
    res.status(400).json({
      ok: false,
      error: "Tile URL template must contain {z}, {x}, and {y} coordinate placeholders.",
    });
    return;
  }

  try {
    // Generate test tile URL at zoom level 1
    const testUrl = urlTemplate
      .replace("{s}", "a")
      .replace("{z}", "1")
      .replace("{x}", "0")
      .replace("{y}", "0")
      .replace("{r}", "");

    // Quick HEAD or GET probe with 4 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(testUrl, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "Tesla-Tracker-Basemap-Validator/1.0" },
    });
    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type") || "";
    const isImage = contentType.includes("image") || contentType.includes("octet-stream");

    if (response.ok && (isImage || response.status === 200)) {
      res.json({
        ok: true,
        valid: true,
        testUrl,
        contentType,
        status: response.status,
        message: "Basemap tile endpoint verified successfully!",
      });
    } else {
      res.json({
        ok: true,
        valid: false,
        testUrl,
        status: response.status,
        message: `Tile endpoint returned HTTP ${response.status} (${contentType})`,
      });
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Connection failed";
    res.json({
      ok: true,
      valid: false,
      error: errorMsg,
      message: `Failed to connect to tile URL: ${errorMsg}`,
    });
  }
});

export default router;
