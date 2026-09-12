import { Router, type IRouter } from "express";
import pool from "../lib/db";
import { requireAdmin } from "../lib/adminAuth";

const router: IRouter = Router();

const NEW_FIELDS = [
  "sender_name","sender_email","sender_phone","sender_address",
  "receiver_name","receiver_email","receiver_phone","receiver_address",
  "delivery_method","shipping_cost","customs_status","customs_fee",
];

function pkgRow(pkg: Record<string, unknown>) {
  return {
    code: pkg.code,
    status: pkg.status,
    eta: pkg.eta,
    origin: pkg.origin,
    destination: pkg.destination,
    carrier: pkg.carrier,
    weight: pkg.weight,
    speed_kph: pkg.speed_kph,
    start_progress: parseFloat(pkg.start_progress as string),
    route: pkg.route,
    sender_name: pkg.sender_name ?? "",
    sender_email: pkg.sender_email ?? "",
    sender_phone: pkg.sender_phone ?? "",
    sender_address: pkg.sender_address ?? "",
    receiver_name: pkg.receiver_name ?? "",
    receiver_email: pkg.receiver_email ?? "",
    receiver_phone: pkg.receiver_phone ?? "",
    receiver_address: pkg.receiver_address ?? "",
    delivery_method: pkg.delivery_method ?? "Standard",
    shipping_cost: parseFloat((pkg.shipping_cost as string) ?? "0"),
    customs_status: pkg.customs_status ?? "Pending",
    customs_fee: parseFloat((pkg.customs_fee as string) ?? "0"),
    created_at: pkg.created_at,
  };
}

// ─── Public: get one package ──────────────────────────────────────────────────

router.get("/packages/:code", async (req, res) => {
  const code = req.params.code.toUpperCase();
  try {
    const pkgResult = await pool.query("SELECT * FROM packages WHERE code = $1", [code]);
    if (pkgResult.rowCount === 0) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    const pkg = pkgResult.rows[0];
    const eventsResult = await pool.query(
      "SELECT * FROM package_events WHERE code = $1 ORDER BY sort_order ASC",
      [code]
    );
    res.json({
      ...pkgRow(pkg),
      events: eventsResult.rows.map((e) => ({
        time_label: e.time_label,
        label: e.label,
        location: e.location,
        done: e.done,
        sort_order: e.sort_order,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Admin: list all packages ─────────────────────────────────────────────────

router.get("/admin/packages", requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, COUNT(s.id) AS subscriber_count
       FROM packages p
       LEFT JOIN subscribers s ON s.code = p.code
       GROUP BY p.code
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows.map((r) => ({ ...pkgRow(r), subscriber_count: Number(r.subscriber_count) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Admin: create package ────────────────────────────────────────────────────

router.post("/admin/packages", requireAdmin, async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const {
    code, status, eta, origin, destination, carrier, weight,
    speed_kph, start_progress, route, events,
    sender_name, sender_email, sender_phone, sender_address,
    receiver_name, receiver_email, receiver_phone, receiver_address,
    delivery_method, shipping_cost, customs_status, customs_fee,
  } = b as {
    code: string; status: string; eta: string; origin: string; destination: string;
    carrier: string; weight: string; speed_kph: number; start_progress: number;
    route: [number, number][];
    events: { time_label: string; label: string; location: string; done: boolean; sort_order: number }[];
    sender_name?: string; sender_email?: string; sender_phone?: string; sender_address?: string;
    receiver_name?: string; receiver_email?: string; receiver_phone?: string; receiver_address?: string;
    delivery_method?: string; shipping_cost?: number; customs_status?: string; customs_fee?: number;
  };

  if (!code || !origin || !destination || !route || !Array.isArray(route)) {
    res.status(400).json({ error: "code, origin, destination and route are required" });
    return;
  }

  const upperCode = code.trim().toUpperCase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO packages (
        code, status, eta, origin, destination, carrier, weight, speed_kph, start_progress, route,
        sender_name, sender_email, sender_phone, sender_address,
        receiver_name, receiver_email, receiver_phone, receiver_address,
        delivery_method, shipping_cost, customs_status, customs_fee
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        upperCode, status ?? "Processing", eta ?? "Estimating…", origin, destination,
        carrier ?? "Tesla Express", weight ?? "—", speed_kph ?? 80, start_progress ?? 0.05,
        JSON.stringify(route),
        sender_name ?? "", sender_email ?? "", sender_phone ?? "", sender_address ?? "",
        receiver_name ?? "", receiver_email ?? "", receiver_phone ?? "", receiver_address ?? "",
        delivery_method ?? "Standard", shipping_cost ?? 0, customs_status ?? "Pending", customs_fee ?? 0,
      ]
    );
    if (events && events.length > 0) {
      for (const ev of events) {
        await client.query(
          `INSERT INTO package_events (code, time_label, label, location, done, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [upperCode, ev.time_label ?? "", ev.label, ev.location ?? "", ev.done ?? false, ev.sort_order ?? 0]
        );
      }
    }
    await client.query("COMMIT");
    res.status(201).json({ code: upperCode });
  } catch (err: unknown) {
    await client.query("ROLLBACK");
    console.error(err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("duplicate key")) res.status(409).json({ error: "Tracking code already exists" });
    else res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// ─── Admin: update package ────────────────────────────────────────────────────

router.put("/admin/packages/:code", requireAdmin, async (req, res) => {
  const code = (req.params.code as string).toUpperCase();
  const {
    status, eta, carrier, weight, speed_kph, start_progress, events,
    sender_name, sender_email, sender_phone, sender_address,
    receiver_name, receiver_email, receiver_phone, receiver_address,
    delivery_method, shipping_cost, customs_status, customs_fee,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE packages SET
        status=$1, eta=$2, carrier=$3, weight=$4, speed_kph=$5, start_progress=$6,
        sender_name=$7, sender_email=$8, sender_phone=$9, sender_address=$10,
        receiver_name=$11, receiver_email=$12, receiver_phone=$13, receiver_address=$14,
        delivery_method=$15, shipping_cost=$16, customs_status=$17, customs_fee=$18,
        updated_at=NOW()
       WHERE code=$19`,
      [
        status, eta, carrier, weight, speed_kph, start_progress,
        sender_name ?? "", sender_email ?? "", sender_phone ?? "", sender_address ?? "",
        receiver_name ?? "", receiver_email ?? "", receiver_phone ?? "", receiver_address ?? "",
        delivery_method ?? "Standard", shipping_cost ?? 0, customs_status ?? "Pending", customs_fee ?? 0,
        code,
      ]
    );
    if (events && Array.isArray(events)) {
      await client.query("DELETE FROM package_events WHERE code = $1", [code]);
      for (const ev of events) {
        await client.query(
          `INSERT INTO package_events (code, time_label, label, location, done, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [code, ev.time_label ?? "", ev.label, ev.location ?? "", ev.done ?? false, ev.sort_order ?? 0]
        );
      }
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// ─── Admin: delete package ────────────────────────────────────────────────────

router.delete("/admin/packages/:code", requireAdmin, async (req, res) => {
  const code = (req.params.code as string).toUpperCase();
  try {
    await pool.query("DELETE FROM packages WHERE code = $1", [code]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
