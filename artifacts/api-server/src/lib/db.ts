import { Pool, type QueryResult, type PoolClient } from "pg";

// ─── Initial Seed Data ────────────────────────────────────────────────────────
interface StoredPackage {
  code: string;
  status: string;
  eta: string;
  origin: string;
  destination: string;
  carrier: string;
  weight: string;
  speed_kph: number;
  start_progress: string;
  route: [number, number][];
  sender_name: string;
  sender_email: string;
  sender_phone: string;
  sender_address: string;
  receiver_name: string;
  receiver_email: string;
  receiver_phone: string;
  receiver_address: string;
  delivery_method: string;
  shipping_cost: string;
  customs_status: string;
  customs_fee: string;
  created_at: string;
  updated_at: string;
}

interface StoredEvent {
  id?: number;
  code: string;
  time_label: string;
  label: string;
  location: string;
  done: boolean;
  sort_order: number;
}

interface StoredSubscriber {
  id: number;
  email: string;
  code: string;
}

const memoryPackages = new Map<string, StoredPackage>();
const memoryEvents: StoredEvent[] = [];
const memorySubscribers: StoredSubscriber[] = [];
let subscriberSeq = 1;

// Seed initial packages
const seed1: StoredPackage = {
  code: "TSL-2026-001",
  status: "In Transit",
  eta: "2h 45m",
  origin: "Fremont Factory, CA",
  destination: "Austin Gigafactory, TX",
  carrier: "Tesla Semi Fleet",
  weight: "1,450 kg",
  speed_kph: 88,
  start_progress: "0.62",
  route: [
    [37.4925, -121.9447],
    [36.7783, -119.4179],
    [34.0522, -118.2437],
    [33.4484, -112.074],
    [31.7619, -106.485],
    [30.2672, -97.7431],
  ],
  sender_name: "Tesla Logistics Hub #1",
  sender_email: "logistics@tesla.com",
  sender_phone: "+1 (800) 613-8840",
  sender_address: "45500 Fremont Blvd, Fremont, CA 94538",
  receiver_name: "Giga Texas Delivery Terminal",
  receiver_email: "receiving@gigatexas.tesla.com",
  receiver_phone: "+1 (512) 555-0199",
  receiver_address: "13101 Harold Green Rd, Austin, TX 78725",
  delivery_method: "Autonomous Heavy Freight",
  shipping_cost: "450.00",
  customs_status: "Cleared",
  customs_fee: "0.00",
  created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
  updated_at: new Date().toISOString(),
};

const seed2: StoredPackage = {
  code: "TSL-2026-002",
  status: "Out for Delivery",
  eta: "45 mins",
  origin: "Berlin Gigafactory, Germany",
  destination: "Amsterdam Delivery Hub, NL",
  carrier: "Tesla European Express",
  weight: "820 kg",
  speed_kph: 72,
  start_progress: "0.88",
  route: [
    [52.3989, 13.7914],
    [52.52, 13.405],
    [52.3759, 9.732],
    [52.2215, 6.8937],
    [52.3676, 4.9041],
  ],
  sender_name: "Giga Berlin Dispatch",
  sender_email: "berlin-shipping@tesla.com",
  sender_phone: "+49 30 555 0123",
  sender_address: "Tesla Str. 1, 15537 Grünheide, Germany",
  receiver_name: "Tesla Store Amsterdam",
  receiver_email: "delivery-ams@tesla.com",
  receiver_phone: "+31 20 555 0188",
  receiver_address: "Keizersgracht 450, 1016 GD Amsterdam, Netherlands",
  delivery_method: "Direct Express Courier",
  shipping_cost: "185.00",
  customs_status: "Cleared",
  customs_fee: "0.00",
  created_at: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
  updated_at: new Date().toISOString(),
};

memoryPackages.set(seed1.code, seed1);
memoryPackages.set(seed2.code, seed2);

memoryEvents.push(
  { code: "TSL-2026-001", time_label: "06:30 AM", label: "Dispatched from Fremont Hub", location: "Fremont, CA", done: true, sort_order: 1 },
  { code: "TSL-2026-001", time_label: "11:15 AM", label: "Supercharger Autopilot Stop", location: "Barstow, CA", done: true, sort_order: 2 },
  { code: "TSL-2026-001", time_label: "04:45 PM", label: "Crossed Arizona State Line", location: "Phoenix, AZ", done: true, sort_order: 3 },
  { code: "TSL-2026-001", time_label: "09:20 PM", label: "In Transit on I-10 East", location: "El Paso, TX", done: true, sort_order: 4 },
  { code: "TSL-2026-001", time_label: "Tomorrow", label: "Delivery at Giga Texas", location: "Austin, TX", done: false, sort_order: 5 },
  { code: "TSL-2026-002", time_label: "08:00 AM", label: "Order Packed & Loaded", location: "Berlin, Germany", done: true, sort_order: 1 },
  { code: "TSL-2026-002", time_label: "12:30 PM", label: "Departed Distribution Hub", location: "Hannover, Germany", done: true, sort_order: 2 },
  { code: "TSL-2026-002", time_label: "03:15 PM", label: "Customs Documentation Verified", location: "Enschede, Netherlands", done: true, sort_order: 3 },
  { code: "TSL-2026-002", time_label: "05:00 PM", label: "Final Mile Dispatch", location: "Amsterdam, Netherlands", done: true, sort_order: 4 },
  { code: "TSL-2026-002", time_label: "05:45 PM", label: "Delivering to Recipient", location: "Amsterdam, Netherlands", done: false, sort_order: 5 },
);

// ─── In-Memory Query Simulator ────────────────────────────────────────────────
function executeInMemoryQuery(sql: string, params: unknown[] = []): QueryResult<any> {
  const normalized = sql.trim().replace(/\s+/g, " ");

  // 1. SELECT * FROM packages WHERE code = $1
  if (/^SELECT \* FROM packages WHERE code = \$1/i.test(normalized)) {
    const code = (params[0] as string)?.toUpperCase();
    const pkg = memoryPackages.get(code);
    return {
      rows: pkg ? [pkg] : [],
      rowCount: pkg ? 1 : 0,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  // 2. SELECT * FROM package_events WHERE code = $1 ORDER BY sort_order ASC
  if (/^SELECT \* FROM package_events WHERE code = \$1/i.test(normalized)) {
    const code = (params[0] as string)?.toUpperCase();
    const rows = memoryEvents
      .filter((e) => e.code === code)
      .sort((a, b) => a.sort_order - b.sort_order);
    return {
      rows,
      rowCount: rows.length,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  // 3. SELECT p.*, COUNT(s.id) AS subscriber_count FROM packages p LEFT JOIN subscribers ...
  if (/^SELECT p\.\*, COUNT\(s\.id\) AS subscriber_count FROM packages p/i.test(normalized)) {
    const all = Array.from(memoryPackages.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const rows = all.map((p) => {
      const count = memorySubscribers.filter((s) => s.code === p.code).length;
      return { ...p, subscriber_count: count };
    });
    return {
      rows,
      rowCount: rows.length,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  // 4. INSERT INTO packages (...) VALUES (...)
  if (/^INSERT INTO packages/i.test(normalized)) {
    const [
      code, status, eta, origin, destination, carrier, weight, speed_kph, start_progress, routeJson,
      sender_name, sender_email, sender_phone, sender_address,
      receiver_name, receiver_email, receiver_phone, receiver_address,
      delivery_method, shipping_cost, customs_status, customs_fee,
    ] = params as any[];

    const upperCode = String(code).toUpperCase();
    if (memoryPackages.has(upperCode)) {
      throw new Error(`duplicate key value violates unique constraint "packages_pkey"`);
    }

    const route = typeof routeJson === "string" ? JSON.parse(routeJson) : routeJson;
    const now = new Date().toISOString();
    const newPkg: StoredPackage = {
      code: upperCode,
      status: status ?? "Processing",
      eta: eta ?? "Estimating…",
      origin: origin ?? "",
      destination: destination ?? "",
      carrier: carrier ?? "Tesla Express",
      weight: weight ?? "—",
      speed_kph: Number(speed_kph) || 80,
      start_progress: String(start_progress ?? 0.05),
      route: Array.isArray(route) ? route : [],
      sender_name: sender_name ?? "",
      sender_email: sender_email ?? "",
      sender_phone: sender_phone ?? "",
      sender_address: sender_address ?? "",
      receiver_name: receiver_name ?? "",
      receiver_email: receiver_email ?? "",
      receiver_phone: receiver_phone ?? "",
      receiver_address: receiver_address ?? "",
      delivery_method: delivery_method ?? "Standard",
      shipping_cost: String(shipping_cost ?? 0),
      customs_status: customs_status ?? "Pending",
      customs_fee: String(customs_fee ?? 0),
      created_at: now,
      updated_at: now,
    };
    memoryPackages.set(upperCode, newPkg);
    return { rows: [], rowCount: 1, command: "INSERT", oid: 0, fields: [] };
  }

  // 5. INSERT INTO package_events (code, time_label, label, location, done, sort_order) VALUES (...)
  if (/^INSERT INTO package_events/i.test(normalized)) {
    const [code, time_label, label, location, done, sort_order] = params as any[];
    memoryEvents.push({
      code: String(code).toUpperCase(),
      time_label: String(time_label ?? ""),
      label: String(label ?? ""),
      location: String(location ?? ""),
      done: Boolean(done),
      sort_order: Number(sort_order ?? 0),
    });
    return { rows: [], rowCount: 1, command: "INSERT", oid: 0, fields: [] };
  }

  // 6. UPDATE packages SET status=$1, eta=$2, ... WHERE code=$19
  if (/^UPDATE packages SET/i.test(normalized)) {
    if (normalized.includes("WHERE code=$19") || normalized.includes("WHERE code = $19")) {
      const [
        status, eta, carrier, weight, speed_kph, start_progress,
        sender_name, sender_email, sender_phone, sender_address,
        receiver_name, receiver_email, receiver_phone, receiver_address,
        delivery_method, shipping_cost, customs_status, customs_fee,
        code,
      ] = params as any[];
      const upper = String(code).toUpperCase();
      const existing = memoryPackages.get(upper);
      if (existing) {
        Object.assign(existing, {
          status: status ?? existing.status,
          eta: eta ?? existing.eta,
          carrier: carrier ?? existing.carrier,
          weight: weight ?? existing.weight,
          speed_kph: Number(speed_kph) || existing.speed_kph,
          start_progress: String(start_progress ?? existing.start_progress),
          sender_name: sender_name ?? existing.sender_name,
          sender_email: sender_email ?? existing.sender_email,
          sender_phone: sender_phone ?? existing.sender_phone,
          sender_address: sender_address ?? existing.sender_address,
          receiver_name: receiver_name ?? existing.receiver_name,
          receiver_email: receiver_email ?? existing.receiver_email,
          receiver_phone: receiver_phone ?? existing.receiver_phone,
          receiver_address: receiver_address ?? existing.receiver_address,
          delivery_method: delivery_method ?? existing.delivery_method,
          shipping_cost: String(shipping_cost ?? existing.shipping_cost),
          customs_status: customs_status ?? existing.customs_status,
          customs_fee: String(customs_fee ?? existing.customs_fee),
          updated_at: new Date().toISOString(),
        });
      }
      return { rows: [], rowCount: existing ? 1 : 0, command: "UPDATE", oid: 0, fields: [] };
    } else if (normalized.includes("status='Delivered'") || normalized.includes("status = 'Delivered'")) {
      const code = String(params[0]).toUpperCase();
      const existing = memoryPackages.get(code);
      if (existing) {
        existing.status = "Delivered";
        existing.updated_at = new Date().toISOString();
      }
      return { rows: [], rowCount: existing ? 1 : 0, command: "UPDATE", oid: 0, fields: [] };
    }
  }

  // 7. DELETE FROM package_events WHERE code = $1
  if (/^DELETE FROM package_events WHERE code = \$1/i.test(normalized)) {
    const code = String(params[0]).toUpperCase();
    for (let i = memoryEvents.length - 1; i >= 0; i--) {
      if (memoryEvents[i].code === code) memoryEvents.splice(i, 1);
    }
    return { rows: [], rowCount: 1, command: "DELETE", oid: 0, fields: [] };
  }

  // 8. DELETE FROM packages WHERE code = $1
  if (/^DELETE FROM packages WHERE code = \$1/i.test(normalized)) {
    const code = String(params[0]).toUpperCase();
    memoryPackages.delete(code);
    for (let i = memoryEvents.length - 1; i >= 0; i--) {
      if (memoryEvents[i].code === code) memoryEvents.splice(i, 1);
    }
    return { rows: [], rowCount: 1, command: "DELETE", oid: 0, fields: [] };
  }

  // 9. INSERT INTO subscribers (email, code) VALUES ($1, $2)
  if (/^INSERT INTO subscribers/i.test(normalized)) {
    const [email, code] = params as [string, string];
    const exists = memorySubscribers.some(
      (s) => s.email.toLowerCase() === email.toLowerCase() && s.code.toUpperCase() === code.toUpperCase()
    );
    if (!exists) {
      memorySubscribers.push({
        id: subscriberSeq++,
        email: email.toLowerCase(),
        code: code.toUpperCase(),
      });
    }
    return { rows: [], rowCount: 1, command: "INSERT", oid: 0, fields: [] };
  }

  // 10. SELECT email FROM subscribers WHERE code = $1
  if (/^SELECT email FROM subscribers WHERE code = \$1/i.test(normalized)) {
    const code = String(params[0]).toUpperCase();
    const rows = memorySubscribers.filter((s) => s.code === code).map((s) => ({ email: s.email }));
    return { rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] };
  }

  // Transactions
  if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(normalized)) {
    return { rows: [], rowCount: 0, command: normalized.toUpperCase(), oid: 0, fields: [] };
  }

  return { rows: [], rowCount: 0, command: "SELECT", oid: 0, fields: [] };
}

// ─── Real PG Pool with In-Memory Fallback ──────────────────────────────────────
let realPool: Pool | null = null;
let isPostgresAvailable = false;

function isValidDatabaseUrl(urlStr?: string): boolean {
  if (!urlStr || typeof urlStr !== "string") return false;
  const trimmed = urlStr.trim();
  if (trimmed === "" || trimmed === "base" || trimmed.startsWith("base")) return false;
  try {
    const parsed = new URL(trimmed);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) return false;
    if (!parsed.hostname || parsed.hostname === "base" || parsed.hostname === "localhost.invalid") return false;
    return true;
  } catch {
    return false;
  }
}

async function initPostgres() {
  const dbUrl = process.env.DATABASE_URL;
  if (!isValidDatabaseUrl(dbUrl)) {
    // In-memory store active by default
    return;
  }

  try {
    const candidatePool = new Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 2000,
      query_timeout: 3000,
    });

    candidatePool.on("error", (err) => {
      // Gracefully switch to in-memory store if connection drops
      if (isPostgresAvailable) {
        console.info("[DB] Postgres connection dropped, utilizing in-memory store.");
        isPostgresAvailable = false;
      }
    });

    // Test connection once on startup
    const client = await candidatePool.connect();
    try {
      await client.query("SELECT 1");
      realPool = candidatePool;
      isPostgresAvailable = true;
      console.info("[DB] Connected to PostgreSQL database successfully.");
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.info(`[DB] Using fast in-memory store (External DB not reachable: ${err?.code || err?.message || "unreachable"}).`);
    realPool = null;
    isPostgresAvailable = false;
  }
}

// Initialize database probe asynchronously
initPostgres().catch(() => {
  realPool = null;
  isPostgresAvailable = false;
});

const pool = {
  async query(text: string, params: unknown[] = []): Promise<QueryResult<any>> {
    if (isPostgresAvailable && realPool) {
      try {
        return await realPool.query(text, params);
      } catch (err: any) {
        // If query fails due to network/DNS/host issues, permanently disable realPool to prevent repeated delays
        if (err?.code === "ENOTFOUND" || err?.code === "EAI_AGAIN" || err?.code === "ECONNREFUSED") {
          isPostgresAvailable = false;
        }
      }
    }
    return executeInMemoryQuery(text, params);
  },

  async connect(): Promise<PoolClient> {
    if (isPostgresAvailable && realPool) {
      try {
        const client = await realPool.connect();
        return client;
      } catch (err: any) {
        if (err?.code === "ENOTFOUND" || err?.code === "EAI_AGAIN" || err?.code === "ECONNREFUSED") {
          isPostgresAvailable = false;
        }
      }
    }
    // Mock client
    const mockClient = {
      async query(text: string, params: unknown[] = []) {
        return executeInMemoryQuery(text, params);
      },
      release() {
        // no-op
      },
    } as unknown as PoolClient;
    return mockClient;
  },
};

export default pool;
