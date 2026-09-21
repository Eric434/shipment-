import { Router, type IRouter } from "express";
import pool from "../lib/db";
import {
  isEmailConfigured,
  verifySmtpConnection,
  sendSubscriptionEmail,
  sendDeliveryCompleteEmail,
  sendRegistrationEmail,
  generateRegistrationEmailHtml,
  sendEmail,
} from "../lib/mailer";

const router: IRouter = Router();

// ─── SMTP Diagnostics & Status ────────────────────────────────────────────────

router.get("/notify/smtp-status", async (_req, res) => {
  const configured = isEmailConfigured();
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER || null;
  const maskedUser = gmailUser
    ? gmailUser.replace(/(.{2})(.*)(@.*)/, (_match, p1, p2, p3) => `${p1}${"*".repeat(p2.length)}${p3}`)
    : null;

  if (!configured) {
    res.json({
      configured: false,
      user: null,
      message: "Gmail SMTP credentials (GMAIL_USER and GMAIL_APP_PASSWORD) not set.",
    });
    return;
  }

  const verification = await verifySmtpConnection();
  res.json({
    configured: true,
    user: maskedUser,
    verified: verification.ok,
    message: verification.message,
  });
});

router.post("/notify/smtp-test", async (req, res) => {
  const { to } = req.body as { to: string };
  if (!to || !to.includes("@")) {
    res.status(400).json({ error: "A valid 'to' recipient email is required." });
    return;
  }

  if (!isEmailConfigured()) {
    res.status(400).json({
      error: "Gmail SMTP credentials (GMAIL_USER and GMAIL_APP_PASSWORD) are not set in environment.",
    });
    return;
  }

  const result = await sendEmail({
    to: to.trim(),
    subject: "Test Email from Tesla Track (Gmail SMTP)",
    text: "This is a test notification verifying that Gmail SMTP is properly configured and operational.",
    html: `
      <div style="font-family: sans-serif; background: #111; color: #fff; padding: 24px; border-radius: 12px; max-width: 480px;">
        <h2 style="color: #dc2626; margin-top: 0;">Gmail SMTP Verified</h2>
        <p>Your Gmail SMTP configuration is operational and successfully delivering delivery tracking notifications.</p>
        <p style="font-size: 12px; color: #888;">Dispatched at ${new Date().toISOString()}</p>
      </div>
    `,
  });

  if (result.success) {
    res.json({ success: true, messageId: result.messageId });
  } else {
    res.status(500).json({ error: result.error });
  }
});

router.get("/notify/registration-preview", (req, res) => {
  const code = (req.query.code as string || "TSL-7824-SF").toUpperCase();
  const html = generateRegistrationEmailHtml({
    code,
    recipientEmail: (req.query.to as string) || "recipient@example.com",
    recipientName: (req.query.name as string) || "Alexander Vance",
    role: (req.query.role as "receiver" | "sender") || "receiver",
    origin: (req.query.origin as string) || "Fremont Gigafactory, CA",
    destination: (req.query.destination as string) || "San Francisco Hub, CA",
    eta: (req.query.eta as string) || "Today, 5:30 PM",
    carrier: "Tesla Semi Precision Fleet",
    weight: "3.6 kg (Precision Autonomous Package)",
    delivery_method: "Priority Autonomous Express",
    shipping_cost: 49.99,
    customs_status: "Pre-Cleared",
    customs_fee: 0,
    sender_name: "Tesla Logistics Dispatch",
    receiver_name: (req.query.name as string) || "Alexander Vance",
  });

  if (req.query.raw === "true") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
    return;
  }

  res.json({ code, html });
});

router.post("/notify/test-registration-email", async (req, res) => {
  const { to, code = "TSL-9281-EX", name = "Consignee Client", role = "receiver" } = req.body as {
    to: string; code?: string; name?: string; role?: "receiver" | "sender";
  };

  if (!to || !to.includes("@")) {
    res.status(400).json({ error: "A valid recipient email is required." });
    return;
  }

  if (!isEmailConfigured()) {
    res.status(400).json({
      error: "Gmail SMTP credentials (GMAIL_USER and GMAIL_APP_PASSWORD) not configured in environment.",
    });
    return;
  }

  const result = await sendRegistrationEmail({
    code: code.toUpperCase(),
    recipientEmail: to.trim(),
    recipientName: name,
    role,
    origin: "Tesla Factory Dispatch, Austin TX",
    destination: "Client Residence, Los Angeles CA",
    eta: "Tomorrow, 2:15 PM PST",
    carrier: "Tesla Express Precision Fleet",
    weight: "4.2 kg",
    delivery_method: "Priority Direct Express",
    shipping_cost: 59.00,
    customs_status: "Verified",
    customs_fee: 0,
    sender_name: "Tesla Logistics Ops",
    receiver_name: name,
  });

  if (result.success) {
    res.json({ success: true, messageId: result.messageId, to: to.trim(), code });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// ─── Subscribe ────────────────────────────────────────────────────────────────

router.post("/notify/subscribe", async (req, res) => {
  const { email, trackingCode, status, eta, from, to } = req.body as {
    email: string; trackingCode: string; status?: string; eta?: string; from?: string; to?: string;
  };

  if (!email || !email.includes("@")) { res.status(400).json({ error: "Invalid email address" }); return; }
  if (!trackingCode) { res.status(400).json({ error: "Tracking code is required" }); return; }

  const cleanEmail = email.toLowerCase().trim();
  const code = trackingCode.toUpperCase().trim();

  try {
    // Store subscriber (ignore duplicate)
    await pool.query(
      `INSERT INTO subscribers (email, code) VALUES ($1, $2) ON CONFLICT (email, code) DO NOTHING`,
      [cleanEmail, code]
    );

    console.log(`[Alerts] Subscribed ${cleanEmail} for shipment ${code}`);

    // Fetch package details for richer email content if not fully provided
    let pkgDetails = { destination: to, origin: from, eta, status };
    if (!pkgDetails.destination || !pkgDetails.status) {
      const pkgRes = await pool.query("SELECT * FROM packages WHERE code = $1", [code]);
      if (pkgRes.rowCount && pkgRes.rowCount > 0) {
        const row = pkgRes.rows[0];
        pkgDetails = {
          destination: to || row.destination || row.receiver_address,
          origin: from || row.origin || row.sender_city,
          eta: eta || row.eta,
          status: status || row.status,
        };
      }
    }

    // Dispatch subscription email via Gmail SMTP if configured
    let emailSent = false;
    if (isEmailConfigured()) {
      const mailResult = await sendSubscriptionEmail(cleanEmail, code, pkgDetails);
      emailSent = mailResult.success;
    }

    res.json({ success: true, emailSent, smtpConfigured: isEmailConfigured() });
  } catch (err) {
    console.error("Subscribe error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Delivered notification (called when package reaches 100%) ────────────────

router.post("/notify/delivered", async (req, res) => {
  const { trackingCode } = req.body as { trackingCode: string };
  if (!trackingCode) { res.status(400).json({ error: "trackingCode required" }); return; }

  const code = trackingCode.toUpperCase().trim();

  try {
    // Get package info
    const pkgRes = await pool.query("SELECT * FROM packages WHERE code = $1", [code]);
    if (pkgRes.rowCount === 0) { res.status(404).json({ error: "Package not found" }); return; }

    const pkg = pkgRes.rows[0];

    // Get all subscribers for this package
    const subsRes = await pool.query("SELECT email FROM subscribers WHERE code = $1", [code]);
    const subscriberRows = subsRes.rows || [];
    const subscriberCount = subsRes.rowCount ?? 0;
    console.log(`[Alerts] Shipment ${code} delivered, notified ${subscriberCount} subscriber(s)`);

    // Update package status to Delivered in DB and mark all events as complete
    await pool.query("UPDATE packages SET status='Delivered', updated_at=NOW() WHERE code=$1", [code]);
    await pool.query("UPDATE package_events SET done=TRUE WHERE code=$1", [code]);

    // Dispatch delivery notification emails via Gmail SMTP to all subscribers
    let emailsDispatched = 0;
    if (isEmailConfigured() && subscriberRows.length > 0) {
      const emailPromises = subscriberRows.map(async (sub) => {
        try {
          const res = await sendDeliveryCompleteEmail(sub.email, code, {
            destination: pkg.receiver_address || pkg.destination,
            deliveredAt: new Date().toLocaleString(),
          });
          if (res.success) emailsDispatched++;
        } catch (err) {
          console.error(`Failed to send delivery email to ${sub.email}:`, err);
        }
      });
      await Promise.allSettled(emailPromises);
    }

    res.json({
      success: true,
      sent: subscriberCount,
      emailsDispatched,
      smtpConfigured: isEmailConfigured(),
    });
  } catch (err) {
    console.error("Delivered notify error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
