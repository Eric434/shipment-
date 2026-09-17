import { Router, type IRouter } from "express";
import pool from "../lib/db";

const router: IRouter = Router();

// ─── Subscribe ────────────────────────────────────────────────────────────────

router.post("/notify/subscribe", async (req, res) => {
  const { email, trackingCode } = req.body as {
    email: string; trackingCode: string; status?: string; eta?: string; from?: string; to?: string;
  };

  if (!email || !email.includes("@")) { res.status(400).json({ error: "Invalid email address" }); return; }
  if (!trackingCode) { res.status(400).json({ error: "Tracking code is required" }); return; }

  try {
    // Store subscriber (ignore duplicate)
    await pool.query(
      `INSERT INTO subscribers (email, code) VALUES ($1, $2) ON CONFLICT (email, code) DO NOTHING`,
      [email.toLowerCase(), trackingCode.toUpperCase()]
    );

    console.log(`[Alerts] Subscribed ${email} for shipment ${trackingCode}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Delivered notification (called when package reaches 100%) ────────────────

router.post("/notify/delivered", async (req, res) => {
  const { trackingCode } = req.body as { trackingCode: string };
  if (!trackingCode) { res.status(400).json({ error: "trackingCode required" }); return; }

  const code = trackingCode.toUpperCase();

  try {
    // Get package info
    const pkgRes = await pool.query("SELECT * FROM packages WHERE code = $1", [code]);
    if (pkgRes.rowCount === 0) { res.status(404).json({ error: "Package not found" }); return; }

    // Get all subscribers for this package
    const subsRes = await pool.query("SELECT email FROM subscribers WHERE code = $1", [code]);
    const sent = subsRes.rowCount ?? 0;
    console.log(`[Alerts] Shipment ${code} delivered, notified ${sent} subscriber(s)`);

    // Update package status to Delivered in DB and mark all events as complete
    await pool.query("UPDATE packages SET status='Delivered', updated_at=NOW() WHERE code=$1", [code]);
    await pool.query("UPDATE package_events SET done=TRUE WHERE code=$1", [code]);

    res.json({ success: true, sent });
  } catch (err) {
    console.error("Delivered notify error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
