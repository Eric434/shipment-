const API = "/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PackageEvent {
  time_label: string;
  label: string;
  location: string;
  done: boolean;
  sort_order: number;
}

export interface Package {
  code: string;
  status: string;
  eta: string;
  origin: string;
  destination: string;
  carrier: string;
  weight: string;
  speed_kph: number;
  start_progress: number;
  route: [number, number][];
  events: PackageEvent[];
  created_at: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string;
  sender_address: string;
  receiver_name: string;
  receiver_email: string;
  receiver_phone: string;
  receiver_address: string;
  delivery_method: string;
  shipping_cost: number;
  customs_status: string;
  customs_fee: number;
  subscriber_count?: number;
}

// ─── Public ───────────────────────────────────────────────────────────────────

export type FetchPackageResult =
  | { ok: true; pkg: Package }
  | { ok: false; reason: "not_found" | "server_error" | "network_error" };

export async function fetchPackage(code: string): Promise<FetchPackageResult> {
  try {
    const res = await fetch(`${API}/packages/${encodeURIComponent(code.trim().toUpperCase())}`);
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (!res.ok) return { ok: false, reason: "server_error" };
    return { ok: true, pkg: await res.json() };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

export async function notifyDelivered(trackingCode: string): Promise<void> {
  try {
    await fetch(`${API}/notify/delivered`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingCode }),
    });
  } catch {
    // fire-and-forget
  }
}

export async function subscribeToAlerts(payload: {
  email: string;
  trackingCode: string;
  status: string;
  eta: string;
  from: string;
  to: string;
}): Promise<{ success: boolean; error?: string; emailSent?: boolean; smtpConfigured?: boolean }> {
  try {
    const res = await fetch(`${API}/notify/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error ?? "Request failed" };
    return { success: true, emailSent: data.emailSent, smtpConfigured: data.smtpConfigured };
  } catch {
    return { success: false, error: "Network error — please try again" };
  }
}

export async function checkSmtpStatus(): Promise<{
  configured: boolean;
  user: string | null;
  verified?: boolean;
  message?: string;
}> {
  try {
    const res = await fetch(`${API}/notify/smtp-status`);
    if (!res.ok) return { configured: false, user: null };
    return await res.json();
  } catch {
    return { configured: false, user: null };
  }
}

export async function sendTestSmtpEmail(to: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch(`${API}/notify/smtp-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || "Failed to send test email" };
    return { success: true, messageId: data.messageId };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

export interface EmailTemplateMeta {
  id: string;
  name: string;
  description: string;
  category: "order" | "transit" | "out_for_delivery" | "delivered" | "customs";
  defaultSubject: string;
  badge: { label: string; bg: string; color: string; border: string };
}

export interface RenderedTemplate {
  template: EmailTemplateMeta;
  rendered: { subject: string; html: string; text: string };
}

export async function fetchEmailTemplates(): Promise<EmailTemplateMeta[]> {
  try {
    const res = await fetch(`${API}/notify/templates`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.templates || [];
  } catch {
    return [];
  }
}

export async function previewEmailTemplate(
  templateId: string,
  data?: Record<string, any>
): Promise<RenderedTemplate | null> {
  try {
    const res = await fetch(`${API}/notify/templates/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, data }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function sendEmailTemplate(params: {
  to: string;
  templateId: string;
  data?: Record<string, any>;
  customSubject?: string;
}): Promise<{ success: boolean; messageId?: string; simulated?: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${API}/notify/templates/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || "Failed to dispatch email template" };
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

// ─── Google Maps Grounding & Place Intelligence ──────────────────────────────

export interface MapsGroundingPlace {
  title: string;
  uri: string;
  reviewSnippets?: string[];
  source: string;
}

export interface MapsGroundingResult {
  text: string;
  places: MapsGroundingPlace[];
  groundingChunks?: any[];
  searchQueries?: string[];
  isRateLimited?: boolean;
  rateLimitReason?: string;
}

export async function queryMapsGrounding(payload: {
  prompt: string;
  location?: { latitude: number; longitude: number };
  destinationAddress?: string;
  trackingCode?: string;
}): Promise<{ ok: true; data: MapsGroundingResult } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API}/maps/grounding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || "Failed to retrieve Google Maps data" };
    }
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Network connection error" };
  }
}


// ─── Admin ────────────────────────────────────────────────────────────────────

function adminHeaders(token: string) {
  return { "Content-Type": "application/json", "x-admin-token": token };
}

export async function adminLogin(password: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function adminListPackages(token: string): Promise<Package[]> {
  try {
    const res = await fetch(`${API}/admin/packages`, {
      headers: adminHeaders(token),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function adminCreatePackage(
  token: string,
  data: Omit<Package, "created_at">
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API}/admin/packages`, {
      method: "POST",
      headers: adminHeaders(token),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error ?? "Failed" };
    return { success: true };
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function adminUpdatePackage(
  token: string,
  code: string,
  data: Partial<Omit<Package, "code" | "created_at">>
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API}/admin/packages/${encodeURIComponent(code)}`, {
      method: "PUT",
      headers: adminHeaders(token),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error ?? "Failed" };
    return { success: true };
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function adminDeletePackage(
  token: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API}/admin/packages/${encodeURIComponent(code)}`, {
      method: "DELETE",
      headers: adminHeaders(token),
    });
    if (!res.ok) {
      const json = await res.json();
      return { success: false, error: json.error ?? "Failed" };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Network error" };
  }
}

export interface AiQuickTrackingPayload {
  code: string;
  status: string;
  eta: string;
  origin: string;
  destination: string;
  carrier: string;
  weight: string;
  speed_kph: number;
  start_progress: number;
  delivery_method: string;
  shipping_cost: number;
  customs_status: string;
  customs_fee: number;
  sender_name: string;
  sender_email: string;
  sender_phone: string;
  sender_address: string;
  receiver_name: string;
  receiver_email: string;
  receiver_phone: string;
  receiver_address: string;
  route: [number, number][];
  events: PackageEvent[];
  ai_insights?: string;
}

export async function adminAiQuickGenerate(
  token: string,
  payload: { prompt?: string; preset?: string }
): Promise<{ ok: boolean; tracking?: AiQuickTrackingPayload; isAiGenerated?: boolean; reason?: string; error?: string }> {
  try {
    const res = await fetch(`${API}/admin/ai/quick-track-generate`, {
      method: "POST",
      headers: adminHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || "Failed to generate tracking" };
    return data;
  } catch (err: any) {
    return { ok: false, error: err?.message || "Network error" };
  }
}

export async function adminAiQuickCreate(
  token: string,
  tracking: AiQuickTrackingPayload
): Promise<{ ok: boolean; code?: string; message?: string; error?: string }> {
  try {
    const res = await fetch(`${API}/admin/ai/quick-track-create`, {
      method: "POST",
      headers: adminHeaders(token),
      body: JSON.stringify({ tracking }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || "Failed to create shipment" };
    return data;
  } catch (err: any) {
    return { ok: false, error: err?.message || "Network error" };
  }
}

export async function adminAiQuickAssist(
  token: string,
  question: string
): Promise<{ ok: boolean; answer?: string; error?: string }> {
  try {
    const res = await fetch(`${API}/admin/ai/quick-track-assist`, {
      method: "POST",
      headers: adminHeaders(token),
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || "Failed to query AI" };
    return data;
  } catch (err: any) {
    return { ok: false, error: err?.message || "Network error" };
  }
}

// ─── Basemaps API Catalog & Fallbacks ─────────────────────────────────────────

export interface BasemapConfig {
  id: string;
  name: string;
  provider: "OpenStreetMap" | "Esri" | "OpenTopoMap" | "CARTO" | "Stadia" | "Stadia Maps" | "Custom";
  category: "navigation" | "dark" | "light" | "satellite" | "topo" | "custom";
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

export interface BasemapCategory {
  id: string;
  label: string;
  count: number;
  description: string;
}

export interface FetchBasemapsResponse {
  ok: boolean;
  total: number;
  basemaps: BasemapConfig[];
  api: string;
}

export interface ValidateBasemapResponse {
  ok: boolean;
  valid: boolean;
  testUrl?: string;
  contentType?: string;
  status?: number;
  message?: string;
  error?: string;
}

export const DEFAULT_BASEMAPS: BasemapConfig[] = [
  {
    id: "stadia_alidade_dark",
    name: "Stadia Alidade Dark",
    provider: "Stadia Maps",
    category: "dark",
    badge: "Permanent Default",
    description: "Sleek, low-glare dark cartography engineered for precision logistics and route tracking",
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
    maxZoom: 20,
    attribution: '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    previewBg: "#121417",
    previewBorder: "#ef4444",
    supportsRetina: true,
    isPopular: true,
  },
  {
    id: "osm_standard",
    name: "OpenStreetMap Standard",
    provider: "OpenStreetMap",
    category: "light",
    badge: "Official OSM",
    description: "The gold-standard global open cartography. Reliable, clean, and zero watermarks",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    previewBg: "#e5e7eb",
    previewBorder: "#10b981",
    supportsRetina: false,
    isPopular: true,
  },
  {
    id: "esri_street",
    name: "Esri World Navigation",
    provider: "Esri",
    category: "navigation",
    badge: "Esri Clean",
    description: "Crystal-clear road and highway geometry powered by Esri & NAVTEQ",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    attribution: 'Tiles © <a href="https://www.esri.com" target="_blank">Esri</a>, NAVTEQ, TomTom',
    previewBg: "#f8f9fa",
    previewBorder: "#3b82f6",
    supportsRetina: false,
    isPopular: true,
  },
  {
    id: "osm_hot",
    name: "OSM Navigation (HOT)",
    provider: "OpenStreetMap",
    category: "navigation",
    badge: "High Contrast",
    description: "Vibrant high-contrast navigation cartography with road priority & zero watermarks",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    subdomains: "abc",
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors, Tiles by <a href="https://www.hotosm.org/" target="_blank">HOT</a>',
    previewBg: "#f2efe9",
    previewBorder: "#10b981",
    supportsRetina: false,
    isPopular: true,
  },
  {
    id: "esri_satellite",
    name: "Esri World Satellite HD",
    provider: "Esri",
    category: "satellite",
    badge: "HD Satellite",
    description: "High-resolution satellite and aerial photography with terrain context",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    attribution: 'Source: <a href="https://www.esri.com" target="_blank">Esri</a>, Maxar, Earthstar Geographics',
    previewBg: "#111827",
    previewBorder: "#06b6d4",
    supportsRetina: false,
    isPopular: true,
  },
  {
    id: "osm_dark",
    name: "Tactical Night OLED",
    provider: "OpenStreetMap",
    category: "dark",
    badge: "Night OLED",
    description: "Deep OLED dark mode with high-visibility vehicle tracking & neon routes",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    filterPreset: "invert(100%) hue-rotate(180deg) brightness(0.82) contrast(1.22) saturate(0.8)",
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    previewBg: "#090a0f",
    previewBorder: "#ef4444",
    supportsRetina: false,
    isPopular: true,
  },
  {
    id: "osm_standard",
    name: "OpenStreetMap Standard",
    provider: "OpenStreetMap",
    category: "light",
    badge: "Global OSM",
    description: "Standard open-source worldwide road, building, and address cartography",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    previewBg: "#e5e7eb",
    previewBorder: "#64748b",
    supportsRetina: false,
  },
  {
    id: "esri_topo",
    name: "Esri Topographic",
    provider: "Esri",
    category: "topo",
    badge: "Topography",
    description: "Elevation contours, hillshading, landmarks, and geographic features",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    attribution: 'Tiles © <a href="https://www.esri.com" target="_blank">Esri</a>, USGS',
    previewBg: "#e2e8f0",
    previewBorder: "#f59e0b",
    supportsRetina: false,
  },
  {
    id: "opentopomap",
    name: "OpenTopoMap Contour",
    provider: "OpenTopoMap",
    category: "topo",
    badge: "Contours",
    description: "Detailed topographic map with contour lines and mountain reliefs",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    maxZoom: 17,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>, SRTM | <a href="https://opentopomap.org" target="_blank">OpenTopoMap</a>',
    previewBg: "#ede8d0",
    previewBorder: "#10b981",
    supportsRetina: false,
  },
  // Legacy aliases mapped to clean watermark-free endpoints
  {
    id: "carto_voyager",
    name: "OSM Voyager Clean",
    provider: "OpenStreetMap",
    category: "navigation",
    badge: "Clean Nav",
    description: "Smooth navigation basemap with clean road hierarchy & zero watermarks",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    subdomains: "abc",
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    previewBg: "#dce7e9",
    previewBorder: "#10b981",
    supportsRetina: false,
  },
  {
    id: "carto_dark",
    name: "OSM Tactical Dark",
    provider: "OpenStreetMap",
    category: "dark",
    badge: "Night",
    description: "Clean dark night mode with zero watermarks",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    filterPreset: "invert(100%) hue-rotate(180deg) brightness(0.85) contrast(1.2)",
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    previewBg: "#0f1115",
    previewBorder: "#dc2626",
    supportsRetina: false,
  },
];

export const DEFAULT_BASEMAP_CATEGORIES: BasemapCategory[] = [
  { id: "navigation", label: "Navigation", count: 3, description: "Optimized for route tracking & turns" },
  { id: "dark", label: "Night / OLED", count: 2, description: "Low-light & night driving modes" },
  { id: "light", label: "Daylight", count: 1, description: "High contrast clean daylight styles" },
  { id: "satellite", label: "Satellite HD", count: 1, description: "True-color aerial imagery" },
  { id: "topo", label: "Topography", count: 2, description: "Contour lines & terrain elevation" },
];

export async function fetchBasemaps(query?: { category?: string; provider?: string }): Promise<BasemapConfig[]> {
  try {
    const params = new URLSearchParams();
    if (query?.category && query.category !== "all") params.set("category", query.category);
    if (query?.provider) params.set("provider", query.provider);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API}/basemaps${qs}`);
    if (res.ok) {
      const data: FetchBasemapsResponse = await res.json();
      if (data.basemaps && data.basemaps.length > 0) return data.basemaps;
    }
  } catch {
    // Fall back to built-in clean catalog
  }

  // Filter default basemaps
  return DEFAULT_BASEMAPS.filter((b) => {
    if (query?.category && query.category !== "all" && b.category !== query.category) return false;
    if (query?.provider && b.provider !== query.provider) return false;
    return true;
  });
}

export async function fetchBasemapCategories(): Promise<BasemapCategory[]> {
  try {
    const res = await fetch(`${API}/basemaps/categories`);
    if (res.ok) {
      const data = await res.json();
      if (data.categories && data.categories.length > 0) return data.categories;
    }
  } catch {
    // Fall back to default categories
  }
  return DEFAULT_BASEMAP_CATEGORIES;
}

export async function validateBasemapUrl(urlTemplate: string): Promise<ValidateBasemapResponse> {
  // Test if URL has required parameters
  if (!urlTemplate.includes("{z}") || !urlTemplate.includes("{x}") || !urlTemplate.includes("{y}")) {
    return {
      ok: true,
      valid: false,
      error: "Tile URL must contain {z}, {x}, and {y} coordinate placeholders (e.g. https://.../{z}/{x}/{y}.png)",
    };
  }

  // Generate test tile URL for Austin, TX (zoom 12, x 950, y 1667)
  const testUrl = urlTemplate
    .replace("{s}", "a")
    .replace("{z}", "12")
    .replace("{x}", "950")
    .replace("{y}", "1667")
    .replace("{r}", "");

  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      resolve({
        ok: true,
        valid: false,
        testUrl,
        error: "Tile request timed out after 5 seconds",
      });
    }, 5000);

    img.onload = () => {
      clearTimeout(timer);
      resolve({
        ok: true,
        valid: true,
        testUrl,
        message: "Tile server verified successfully! Images load cleanly.",
      });
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve({
        ok: true,
        valid: false,
        testUrl,
        error: "Unable to load map tile from the specified URL. Please check CORS or URL format.",
      });
    };

    img.src = testUrl;
  });
}

