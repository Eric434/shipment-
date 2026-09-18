import { Router, type IRouter } from "express";
import nodemailer from "nodemailer";
import pool from "../lib/db";

const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_SMTP_USER,
    pass: process.env.GMAIL_SMTP_APP_PASSWORD,
  },
});

function formatShipmentDetails(pkg: Record<string, unknown>) {
  const details = [
    ["Tracking code", pkg.code],
    ["Status", "Delivered"],
    ["Origin", pkg.from],
    ["Destination", pkg.to],
    ["Estimated delivery", pkg.eta],
  ].filter(([, value]) => value != null && value !== "");

  return details.map(([label, value]) => `${label}: ${value}`).join("\n");
}

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
    const subscribers = subsRes.rows as Array<{ email: string }>;
    let sent = 0;

    if (subscribers.length > 0) {
      if (!process.env.GMAIL_SMTP_USER || !process.env.GMAIL_SMTP_APP_PASSWORD) {
        throw new Error("Gmail SMTP credentials are not configured");
      }

      const details = formatShipmentDetails(pkgRes.rows[0] as Record<string, unknown>);
      const results = await Promise.allSettled(
        subscribers.map(({ email }) =>
          mailer.sendMail({
            from: `Shipment Alerts <${process.env.GMAIL_SMTP_USER}>`,
            to: email,
            subject: `Shipment ${code} has been delivered`,
            text: `Your shipment has been delivered.\\n\\n${details}\\n\\nThank you for using Shipment Alerts.`,
          })
        )
      );
      sent = results.filter((result) => result.status === "fulfilled").length;
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`[Alerts] Failed to notify ${subscribers[index].email}:`, result.reason);
        }
      });
    }

    console.log(`[Alerts] Shipment ${code} delivered, notified ${sent}/${subscribers.length} subscriber(s)`);

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
