import { Router, type IRouter } from "express";
import pool from "../lib/db";
import {
  isEmailConfigured,
  verifySmtpConnection,
  sendSubscriptionEmail,
  sendDeliveryCompleteEmail,
  sendEmail,
} from "../lib/mailer";
import { EMAIL_TEMPLATES, type TrackingEmailData } from "../lib/trackingEmailTemplates";

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
    subject: "Test Email: Tesla Track Gmail SMTP Verified",
    text: "This is a test notification verifying that Gmail SMTP is properly configured and operational.",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #ffffff; color: #171a20; padding: 32px; border-radius: 8px; max-width: 520px; border: 1px solid #e5e7eb; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="https://img.icons8.com/?size=100&id=OinYGm0fZ470&format=png&color=000000" alt="Tesla" width="28" height="28" style="width: 28px; height: 28px; display: block;" />
            <span style="font-size: 14px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #171a20;">TESLA<span style="color: #e82127;">TRACK</span></span>
          </div>
          <span style="display: inline-block; padding: 4px 10px; border-radius: 4px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">SMTP ACTIVE</span>
        </div>
        <h2 style="font-size: 22px; font-weight: 600; color: #171a20; margin: 0 0 8px; letter-spacing: -0.02em;">Gmail SMTP Verified</h2>
        <p style="font-size: 14px; color: #393c41; line-height: 1.6; margin: 0 0 16px;">
          Your TeslaTrack Gmail SMTP relay connection has been verified. Automated live delivery tracking notices and courier dispatch alerts can now be delivered directly to customer inboxes.
        </p>
        <div style="background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; font-size: 12px; color: #5c5e62;">
          Dispatched: <strong>${new Date().toUTCString()}</strong>
        </div>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #8d9096; text-align: center;">
          Tesla Logistics Autonomous Dispatch System &bull; 1 Tesla Road, Austin, TX
        </div>
      </div>
    `,
  });

  if (result.success) {
    res.json({ success: true, messageId: result.messageId });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// ─── Tracking Mail Templates Endpoints ────────────────────────────────────────

router.get("/notify/templates", (_req, res) => {
  const templates = EMAIL_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    defaultSubject: t.defaultSubject,
    badge: t.badge,
  }));
  res.json({ templates });
});

router.post("/notify/templates/preview", (req, res) => {
  const { templateId, data } = req.body as {
    templateId: string;
    data?: Partial<TrackingEmailData>;
  };

  const template = EMAIL_TEMPLATES.find((t) => t.id === templateId) || EMAIL_TEMPLATES[0];

  // Default fallback sample data if fields missing
  const sampleData: TrackingEmailData = {
    trackingCode: data?.trackingCode || "TSL-4821-KM",
    recipientName: data?.recipientName || "Alex Morgan",
    recipientEmail: data?.recipientEmail || "alex.morgan@example.com",
    recipientAddress: data?.recipientAddress || "742 Evergreen Terrace, Palo Alto, CA 94301",
    senderName: data?.senderName || "Tesla Central Distribution Hub",
    origin: data?.origin || "Fremont Gigafactory Hub, CA",
    destination: data?.destination || "Palo Alto, CA",
    status: data?.status || "In Transit",
    carrier: data?.carrier || "Tesla Logistics Express Fleet",
    eta: data?.eta || "Today at 3:30 PM",
    speedKph: data?.speedKph || 88,
    deliveryMethod: data?.deliveryMethod || "Express Dedicated Ground",
    customNotes: data?.customNotes || "Autonomous vehicle escort in progress. Doorstep delivery requested.",
    appUrl: data?.appUrl || process.env.APP_URL || "https://teslatrack.io",
    vehicleModel: data?.vehicleModel || "Model 3",
    vin: data?.vin || "5YJ3E1EA7RF123456",
    deliveryDate: data?.deliveryDate || "Dec 27, 2025",
    deliveryLocation: data?.deliveryLocation || data?.destination || "Tesla Delivery Center",
    vehicleImageUrl: data?.vehicleImageUrl,
  };

  const rendered = template.render(sampleData);
  res.json({
    template: {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      badge: template.badge,
    },
    rendered,
  });
});

router.post("/notify/templates/send", async (req, res) => {
  const { to, templateId, data, customSubject } = req.body as {
    to: string;
    templateId: string;
    data?: Partial<TrackingEmailData>;
    customSubject?: string;
  };

  if (!to || !to.includes("@")) {
    res.status(400).json({ error: "A valid 'to' email address is required." });
    return;
  }

  const template = EMAIL_TEMPLATES.find((t) => t.id === templateId) || EMAIL_TEMPLATES[0];

  const fullData: TrackingEmailData = {
    trackingCode: data?.trackingCode || "TSL-XXXX-XX",
    recipientName: data?.recipientName || "Valued Customer",
    recipientEmail: to.trim(),
    recipientAddress: data?.recipientAddress || data?.destination,
    senderName: data?.senderName,
    origin: data?.origin,
    destination: data?.destination,
    status: data?.status,
    carrier: data?.carrier,
    eta: data?.eta,
    speedKph: data?.speedKph,
    deliveryMethod: data?.deliveryMethod,
    customNotes: data?.customNotes,
    appUrl: data?.appUrl || process.env.APP_URL,
    vehicleModel: data?.vehicleModel,
    vin: data?.vin,
    deliveryDate: data?.deliveryDate,
    deliveryLocation: data?.deliveryLocation,
    vehicleImageUrl: data?.vehicleImageUrl,
  };

  const rendered = template.render(fullData);
  const subject = customSubject?.trim() || rendered.subject;

  if (!isEmailConfigured()) {
    console.warn(`[Gmail SMTP] Send-template requested to ${to}, but SMTP credentials are not set.`);
    res.json({
      success: true,
      simulated: true,
      message: "Template generated successfully. To dispatch live emails, configure GMAIL_USER and GMAIL_APP_PASSWORD in settings.",
      subject,
    });
    return;
  }

  const sendResult = await sendEmail({
    to: to.trim(),
    subject,
    text: rendered.text,
    html: rendered.html,
  });

  if (sendResult.success) {
    res.json({
      success: true,
      messageId: sendResult.messageId,
      subject,
      recipient: to.trim(),
    });
  } else {
    res.status(500).json({ error: sendResult.error || "Failed to dispatch email via Gmail SMTP." });
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
