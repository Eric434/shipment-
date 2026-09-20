import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

export function isEmailConfigured(): boolean {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || process.env.GMAIL_PASS;
  return Boolean(user && pass);
}

export function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || process.env.GMAIL_PASS;

  if (!user || !pass) {
    return null;
  }

  // Gmail standard SMTP configuration
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: user.trim(),
      pass: pass.trim().replace(/\s+/g, ""), // App passwords often copied with spaces
    },
  });

  return transporter;
}

export async function verifySmtpConnection(): Promise<{ ok: boolean; message: string; configured: boolean }> {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      configured: false,
      message: "Gmail SMTP credentials (GMAIL_USER and GMAIL_APP_PASSWORD) are not set in environment.",
    };
  }

  const transport = getTransporter();
  if (!transport) {
    return { ok: false, configured: false, message: "Could not initialize Gmail SMTP transporter." };
  }

  try {
    await transport.verify();
    return {
      ok: true,
      configured: true,
      message: `Successfully connected to Gmail SMTP as ${process.env.GMAIL_USER || process.env.SMTP_USER}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      configured: true,
      message: `Gmail SMTP verification failed: ${err?.message || err}`,
    };
  }
}

export interface SendMailOptions {
  to: string;
  subject: string;
  text?: string;
  html: string;
}

export async function sendEmail(options: SendMailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const transport = getTransporter();

  if (!transport || !user) {
    console.warn(`[Gmail SMTP] Email not sent to ${options.to}: GMAIL_USER or GMAIL_APP_PASSWORD not configured.`);
    return {
      success: false,
      error: "Gmail SMTP credentials not configured in environment.",
    };
  }

  try {
    const info = await transport.sendMail({
      from: `"Tesla Delivery Tracking" <${user.trim()}>`,
      to: options.to,
      subject: options.subject,
      text: options.text || options.subject,
      html: options.html,
    });

    console.log(`[Gmail SMTP] Email dispatched to ${options.to} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`[Gmail SMTP] Failed to send email to ${options.to}:`, err);
    return {
      success: false,
      error: err?.message || "Failed to send email via Gmail SMTP.",
    };
  }
}

// ─── Email Templates ─────────────────────────────────────────────────────────

export async function sendSubscriptionEmail(
  to: string,
  trackingCode: string,
  pkgDetails?: { destination?: string; origin?: string; eta?: string; status?: string }
) {
  const code = trackingCode.toUpperCase();
  const subject = `Tracking Alert Activated: ${code}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0c10; color: #ffffff; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background: #15171e; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 32px; box-shadow: 0 12px 36px rgba(0,0,0,0.5); }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; background: rgba(220,38,38,0.15); color: #f87171; border: 1px solid rgba(220,38,38,0.3); font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
    .title { font-size: 20px; font-weight: 700; margin: 16px 0 8px; color: #ffffff; letter-spacing: -0.02em; }
    .tracking-code { font-family: monospace; font-size: 26px; font-weight: 700; color: #f87171; letter-spacing: 0.08em; margin: 12px 0; }
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; }
    .details-table td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); }
    .details-table td strong { color: #ffffff; }
    .btn { display: inline-block; padding: 12px 24px; background: #dc2626; color: #ffffff !important; text-decoration: none; border-radius: 10px; font-size: 13px; font-weight: 600; text-align: center; margin-top: 16px; letter-spacing: 0.02em; }
    .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: rgba(255,255,255,0.4); text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Live Telemetry Alert</div>
    <div class="title">You are subscribed to tracking alerts</div>
    <div class="tracking-code">${code}</div>
    <p style="font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.6;">
      Real-time automated status and arrival notifications will be sent directly to your inbox as this shipment progresses.
    </p>

    <table class="details-table">
      ${pkgDetails?.status ? `<tr><td>Status</td><td><strong>${pkgDetails.status}</strong></td></tr>` : ""}
      ${pkgDetails?.origin ? `<tr><td>Origin Hub</td><td><strong>${pkgDetails.origin}</strong></td></tr>` : ""}
      ${pkgDetails?.destination ? `<tr><td>Destination</td><td><strong>${pkgDetails.destination}</strong></td></tr>` : ""}
      ${pkgDetails?.eta ? `<tr><td>Estimated Arrival</td><td><strong>${pkgDetails.eta}</strong></td></tr>` : ""}
    </table>

    <div class="footer">
      Sent automatically via Tesla Track Logistics &bull; Powered by Google Maps Platform &bull; Gmail SMTP Relay
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to,
    subject,
    text: `You are subscribed to delivery updates for shipment ${code}. Current Status: ${pkgDetails?.status || "In Transit"}`,
    html,
  });
}

export async function sendDeliveryCompleteEmail(
  to: string,
  trackingCode: string,
  pkgDetails?: { destination?: string; deliveredAt?: string }
) {
  const code = trackingCode.toUpperCase();
  const subject = `Package Delivered: ${code}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0c10; color: #ffffff; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background: #15171e; border: 1px solid rgba(16,185,129,0.3); border-radius: 16px; padding: 32px; box-shadow: 0 12px 36px rgba(0,0,0,0.5); }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
    .title { font-size: 22px; font-weight: 700; margin: 16px 0 8px; color: #ffffff; letter-spacing: -0.02em; }
    .tracking-code { font-family: monospace; font-size: 26px; font-weight: 700; color: #34d399; letter-spacing: 0.08em; margin: 12px 0; }
    .delivery-box { background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.2); border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; line-height: 1.6; color: rgba(255,255,255,0.85); }
    .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: rgba(255,255,255,0.4); text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">&check; Delivery Completed</div>
    <div class="title">Your shipment has arrived</div>
    <div class="tracking-code">${code}</div>

    <div class="delivery-box">
      <strong>Delivered to:</strong> ${pkgDetails?.destination || "Destination Address"}<br>
      <strong>Delivered timestamp:</strong> ${pkgDetails?.deliveredAt || new Date().toLocaleString()}<br>
      <strong>Verification:</strong> Completed via carrier drop-off confirmation.
    </div>

    <p style="font-size: 12px; color: rgba(255,255,255,0.6); line-height: 1.5;">
      Thank you for using Tesla Track Live Logistics. If you have questions regarding this dropoff, please contact dispatch.
    </p>

    <div class="footer">
      Tesla Track Logistics &bull; Dispatched via Gmail SMTP
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to,
    subject,
    text: `Your shipment ${code} has been delivered successfully to ${pkgDetails?.destination || "destination"}.`,
    html,
  });
}
