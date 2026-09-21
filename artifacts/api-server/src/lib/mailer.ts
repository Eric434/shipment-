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

export interface RegistrationEmailData {
  code: string;
  recipientEmail: string;
  recipientName?: string;
  role?: "receiver" | "sender" | "client";
  origin: string;
  destination: string;
  eta?: string;
  carrier?: string;
  weight?: string;
  delivery_method?: string;
  shipping_cost?: number;
  customs_status?: string;
  customs_fee?: number;
  sender_name?: string;
  sender_email?: string;
  sender_phone?: string;
  sender_address?: string;
  receiver_name?: string;
  receiver_email?: string;
  receiver_phone?: string;
  receiver_address?: string;
  trackingUrl?: string;
}

export function generateRegistrationEmailHtml(data: RegistrationEmailData): string {
  const code = (data.code || "TSL-SHIPMENT").toUpperCase();
  const recipient = data.recipientName?.trim() || (data.role === "sender" ? "Valued Consignor" : "Valued Consignee");
  const isSender = data.role === "sender";
  const roleHeadline = isSender
    ? "Shipment Registration & Dispatch Confirmation"
    : "Incoming Consignment & Tracking Registration";
  const carrier = data.carrier || "Tesla Express Precision Logistics";
  const eta = data.eta || "Pending Route Optimization";
  const weight = data.weight || "Standard Freight";
  const deliveryMethod = data.delivery_method || "Standard Dispatch";
  const shippingCost = typeof data.shipping_cost === "number" ? `$${data.shipping_cost.toFixed(2)}` : "$0.00";
  const customsStatus = data.customs_status || "Pending Verification";
  const customsFee = typeof data.customs_fee === "number" ? `$${data.customs_fee.toFixed(2)}` : "$0.00";
  const appBase = process.env.APP_URL || process.env.BASE_URL || "";
  const trackingUrl = data.trackingUrl || (appBase ? `${appBase.replace(/\/$/, "")}/?code=${code}` : `https://ais-dev-pnkhmm5ek5l4rj32dvvs2f-642787899128.europe-west2.run.app/?code=${code}`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Official Shipment Registration: ${code}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #08090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #ffffff;">
  <!-- Container Table -->
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #08090b; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #12141a; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.12); overflow: hidden; box-shadow: 0 20px 48px rgba(0, 0, 0, 0.8);">
          
          <!-- Top Accent Bar -->
          <tr>
            <td height="4" style="background: linear-gradient(90deg, #e82127 0%, #ff4d4d 50%, #e82127 100%); line-height: 4px; font-size: 4px;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 32px 36px 20px 36px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #e82127; margin-bottom: 6px;">
                      Tesla Precision Logistics &bull; Dispatch Service
                    </div>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em; line-height: 1.25;">
                      ${roleHeadline}
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Barcode & Code Strip -->
          <tr>
            <td style="padding: 0 36px 24px 36px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: rgba(255, 255, 255, 0.03); border: 1px dashed rgba(255, 255, 255, 0.18); border-radius: 12px; padding: 18px 24px;">
                <tr>
                  <td align="center">
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 11px; letter-spacing: 0.28em; color: rgba(255, 255, 255, 0.45); margin-bottom: 6px;">
                      ||| | |||| | ||| || |||| | || ||| |||| | ||
                    </div>
                    <div style="font-family: 'SF Mono', 'Courier New', Courier, monospace; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: 0.12em; text-shadow: 0 0 20px rgba(232, 33, 39, 0.35);">
                      ${code}
                    </div>
                    <div style="margin-top: 8px;">
                      <span style="display: inline-block; padding: 4px 12px; border-radius: 999px; background-color: rgba(16, 185, 129, 0.12); color: #34d399; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; border: 1px solid rgba(16, 185, 129, 0.25);">
                        &bull; Registered &amp; Active in Network
                      </span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting Body -->
          <tr>
            <td style="padding: 0 36px 24px 36px; font-size: 14px; line-height: 1.6; color: rgba(255, 255, 255, 0.78);">
              <p style="margin: 0 0 12px 0;">
                Dear <strong style="color: #ffffff;">${recipient}</strong>,
              </p>
              <p style="margin: 0;">
                ${isSender
                  ? `Your shipment consignment has been successfully logged and registered within the Tesla automated dispatch network. Precision telemetry tracking, waypoint surveillance, and Google Maps live navigation are active for this parcel.`
                  : `A new shipment consignment has been registered for delivery to you through the Tesla Precision Logistics network. Live telemetry, automated milestone notifications, and real-time carrier location tracking are now active.`}
              </p>
            </td>
          </tr>

          <!-- Route Card -->
          <tr>
            <td style="padding: 0 36px 24px 36px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: rgba(255, 255, 255, 0.025); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 18px 20px;">
                <tr>
                  <td width="46%" valign="top">
                    <div style="font-size: 10px; font-weight: 700; color: #ef4444; letter-spacing: 0.08em; text-transform: uppercase;">Origin Terminal</div>
                    <div style="font-size: 14px; font-weight: 600; color: #ffffff; margin-top: 4px; line-height: 1.3;">${data.origin}</div>
                    ${data.sender_name ? `<div style="font-size: 12px; color: rgba(255, 255, 255, 0.45); margin-top: 2px;">Sender: ${data.sender_name}</div>` : ""}
                  </td>
                  <td width="8%" align="center" valign="middle">
                    <div style="font-size: 18px; color: #e82127; font-weight: bold;">&rarr;</div>
                  </td>
                  <td width="46%" valign="top" align="right">
                    <div style="font-size: 10px; font-weight: 700; color: #10b981; letter-spacing: 0.08em; text-transform: uppercase;">Destination</div>
                    <div style="font-size: 14px; font-weight: 600; color: #ffffff; margin-top: 4px; line-height: 1.3;">${data.destination}</div>
                    ${data.receiver_name ? `<div style="font-size: 12px; color: rgba(255, 255, 255, 0.45); margin-top: 2px;">Recipient: ${data.receiver_name}</div>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Specifications Table -->
          <tr>
            <td style="padding: 0 36px 28px 36px;">
              <div style="font-size: 11px; font-weight: 700; color: rgba(255, 255, 255, 0.4); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px;">
                Consignment Specification
              </div>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 10px; overflow: hidden;">
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; color: rgba(255, 255, 255, 0.55);">Carrier Fleet</td>
                  <td align="right" style="padding: 10px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; font-weight: 600; color: #ffffff;">${carrier}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; color: rgba(255, 255, 255, 0.55);">Estimated Arrival</td>
                  <td align="right" style="padding: 10px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; font-weight: 600; color: #fca5a5;">${eta}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; color: rgba(255, 255, 255, 0.55);">Service Class</td>
                  <td align="right" style="padding: 10px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; font-weight: 600; color: #ffffff;">${deliveryMethod}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; color: rgba(255, 255, 255, 0.55);">Gross Weight</td>
                  <td align="right" style="padding: 10px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; font-weight: 600; color: #ffffff;">${weight}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; color: rgba(255, 255, 255, 0.55);">Customs Declaration</td>
                  <td align="right" style="padding: 10px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; font-weight: 600; color: #ffffff;">${customsStatus} (${customsFee})</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-size: 12px; color: rgba(255, 255, 255, 0.55);">Shipping Fee</td>
                  <td align="right" style="padding: 10px 16px; font-size: 12px; font-weight: 700; color: #ffffff;">${shippingCost}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Primary CTA Button -->
          <tr>
            <td align="center" style="padding: 0 36px 32px 36px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: #e82127; box-shadow: 0 6px 20px rgba(232, 33, 39, 0.45);">
                    <a href="${trackingUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 10px; letter-spacing: 0.02em;">
                      TRACK SHIPMENT LIVE ON GOOGLE MAPS &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <div style="margin-top: 14px; font-size: 11px; color: rgba(255, 255, 255, 0.35);">
                Direct telemetry link: <a href="${trackingUrl}" target="_blank" style="color: #f87171; text-decoration: none;">${trackingUrl}</a>
              </div>
            </td>
          </tr>

          <!-- Security & Dispatch Advisory -->
          <tr>
            <td style="padding: 24px 36px; background-color: rgba(0, 0, 0, 0.25); border-top: 1px solid rgba(255, 255, 255, 0.06);">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="font-size: 11px; line-height: 1.5; color: rgba(255, 255, 255, 0.35);">
                    <strong style="color: rgba(255, 255, 255, 0.6);">Automated Dispatch Telemetry Notice:</strong> This message was generated automatically upon consignment booking and registration. You will receive milestone notices when this package arrives at regional distribution hubs and enters final-mile delivery.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px 28px 36px; border-top: 1px solid rgba(255, 255, 255, 0.04); text-align: center; font-size: 10px; color: rgba(255, 255, 255, 0.25); line-height: 1.6;">
              Tesla Track Global Logistics &bull; Autonomous Fleet Routing &bull; Powered by Google Maps Platform<br>
              Official Receipt &bull; Dispatch Stamp: ${new Date().toISOString()}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function generateRegistrationEmailText(data: RegistrationEmailData): string {
  const code = (data.code || "TSL-SHIPMENT").toUpperCase();
  const recipient = data.recipientName?.trim() || (data.role === "sender" ? "Valued Consignor" : "Valued Consignee");
  const appBase = process.env.APP_URL || process.env.BASE_URL || "";
  const trackingUrl = data.trackingUrl || (appBase ? `${appBase.replace(/\/$/, "")}/?code=${code}` : `https://ais-dev-pnkhmm5ek5l4rj32dvvs2f-642787899128.europe-west2.run.app/?code=${code}`);

  return `TESLA PRECISION LOGISTICS - OFFICIAL SHIPMENT REGISTRATION
Tracking Identifier: ${code}

Dear ${recipient},

Your consignment has been successfully logged and registered within the Tesla automated dispatch network.

SHIPMENT DETAILS:
- Tracking Code: ${code}
- Carrier: ${data.carrier || "Tesla Express Precision Logistics"}
- Service Class: ${data.delivery_method || "Standard"}
- Origin: ${data.origin}
- Destination: ${data.destination}
- Estimated Arrival: ${data.eta || "Pending Route Optimization"}
- Weight: ${data.weight || "Standard Freight"}
- Customs Status: ${data.customs_status || "Pending"}
- Shipping Cost: $${Number(data.shipping_cost || 0).toFixed(2)}

Track your delivery live on Google Maps:
${trackingUrl}

Sent via Tesla Track Autonomous Dispatch Network.
`;
}

export async function sendRegistrationEmail(data: RegistrationEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const code = (data.code || "").toUpperCase();
  const recipientEmail = data.recipientEmail?.trim();
  if (!recipientEmail || !recipientEmail.includes("@")) {
    return { success: false, error: "Valid recipient email address is required." };
  }

  const isSender = data.role === "sender";
  const subject = isSender
    ? `Consignment Registered: Shipment ${code} Scheduled for Dispatch`
    : `Delivery Notice: Shipment ${code} Registered for Transit`;

  const html = generateRegistrationEmailHtml(data);
  const text = generateRegistrationEmailText(data);

  return sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
  });
}

// ─── Email Templates ─────────────────────────────────────────────────────────

const TESLA_LOGO_URL = "https://img.icons8.com/?size=100&id=OinYGm0fZ470&format=png&color=000000";

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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f6; color: #171a20; margin: 0; padding: 32px 16px; -webkit-font-smoothing: antialiased; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 32px 36px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; background: #f4f4f6; color: #171a20; border: 1px solid #e5e7eb; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .title { font-size: 24px; font-weight: 600; margin: 20px 0 6px; color: #171a20; letter-spacing: -0.02em; line-height: 1.25; }
    .tracking-box { background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 18px 0; text-align: center; }
    .tracking-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600; color: #5c5e62; margin-bottom: 4px; }
    .tracking-code { font-family: -apple-system, BlinkMacSystemFont, ui-monospace, monospace; font-size: 22px; font-weight: 700; color: #171a20; letter-spacing: 0.08em; }
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff; border-radius: 6px; border: 1px solid #e5e7eb; overflow: hidden; }
    .details-table td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #f0f0f2; color: #393c41; }
    .details-table tr:last-child td { border-bottom: none; }
    .details-table td.lbl { width: 38%; text-transform: uppercase; font-size: 10px; font-weight: 600; color: #5c5e62; letter-spacing: 0.06em; }
    .details-table td.val { color: #171a20; font-weight: 600; }
    .footer { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #5c5e62; text-align: center; line-height: 1.7; }
    .footer a { color: #171a20; text-decoration: underline; margin: 0 4px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <img src="${TESLA_LOGO_URL}" alt="Tesla" width="28" height="28" style="width: 28px; height: 28px; display: block;" />
        <span style="font-size: 14px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #171a20;">TESLA<span style="color: #e82127;">TRACK</span></span>
      </div>
      <div class="badge">TELEMETRY ACTIVATED</div>
    </div>

    <div class="title">You are subscribed to tracking alerts</div>
    <div class="tracking-box">
      <div class="tracking-label">Tracking Reference</div>
      <div class="tracking-code">${code}</div>
    </div>

    <p style="font-size: 13px; color: #393c41; line-height: 1.6; margin: 0 0 16px;">
      Real-time automated status and arrival notifications will be sent directly to your inbox as this shipment progresses through the autonomous logistics network.
    </p>

    <table class="details-table">
      ${pkgDetails?.status ? `<tr><td class="lbl">Status</td><td class="val">${pkgDetails.status}</td></tr>` : ""}
      ${pkgDetails?.origin ? `<tr><td class="lbl">Origin Hub</td><td class="val">${pkgDetails.origin}</td></tr>` : ""}
      ${pkgDetails?.destination ? `<tr><td class="lbl">Destination</td><td class="val">${pkgDetails.destination}</td></tr>` : ""}
      ${pkgDetails?.eta ? `<tr><td class="lbl">Estimated Arrival</td><td class="val">${pkgDetails.eta}</td></tr>` : ""}
    </table>

    <div class="footer">
      <div>Tesla Logistics Autonomous Transport Network</div>
      <div style="margin-top: 6px;">
        <a href="https://tesla.com/support">Support</a> &bull;
        <a href="https://tesla.com/legal/privacy">Privacy Policy</a>
      </div>
      <div style="margin-top: 10px; color: #8d9096; font-size: 10px;">Tesla, Inc. &copy; ${new Date().getFullYear()} &bull; 1 Tesla Road, Austin, TX 78725</div>
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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f6; color: #171a20; margin: 0; padding: 32px 16px; -webkit-font-smoothing: antialiased; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 32px 36px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .title { font-size: 24px; font-weight: 600; margin: 20px 0 6px; color: #171a20; letter-spacing: -0.02em; line-height: 1.25; }
    .tracking-box { background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 18px 0; text-align: center; }
    .tracking-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600; color: #5c5e62; margin-bottom: 4px; }
    .tracking-code { font-family: -apple-system, BlinkMacSystemFont, ui-monospace, monospace; font-size: 22px; font-weight: 700; color: #171a20; letter-spacing: 0.08em; }
    .delivery-box { background: #ecfdf5; border: 1px solid #d1fae5; border-radius: 6px; padding: 16px 18px; margin: 20px 0; font-size: 13px; line-height: 1.6; color: #171a20; }
    .footer { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #5c5e62; text-align: center; line-height: 1.7; }
    .footer a { color: #171a20; text-decoration: underline; margin: 0 4px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <img src="${TESLA_LOGO_URL}" alt="Tesla" width="28" height="28" style="width: 28px; height: 28px; display: block;" />
        <span style="font-size: 14px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #171a20;">TESLA<span style="color: #e82127;">TRACK</span></span>
      </div>
      <div class="badge">&check; DELIVERED</div>
    </div>

    <div class="title">Your shipment has arrived</div>
    <div class="tracking-box">
      <div class="tracking-label">Tracking Reference</div>
      <div class="tracking-code">${code}</div>
    </div>

    <div class="delivery-box">
      <strong>Delivered Location:</strong> ${pkgDetails?.destination || "Destination Address"}<br>
      <strong>Timestamp:</strong> ${pkgDetails?.deliveredAt || new Date().toLocaleString()}<br>
      <strong>Verification:</strong> Electronic drop-off verification confirmed.
    </div>

    <p style="font-size: 13px; color: #393c41; line-height: 1.6;">
      Thank you for choosing TeslaTrack Autonomous Logistics. If you have questions regarding this delivery, please reach out to fleet support.
    </p>

    <div class="footer">
      <div>Tesla Logistics Autonomous Transport Network</div>
      <div style="margin-top: 6px;">
        <a href="https://tesla.com/support">Support</a> &bull;
        <a href="https://tesla.com/legal/privacy">Privacy Policy</a>
      </div>
      <div style="margin-top: 10px; color: #8d9096; font-size: 10px;">Tesla, Inc. &copy; ${new Date().getFullYear()} &bull; 1 Tesla Road, Austin, TX 78725</div>
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
