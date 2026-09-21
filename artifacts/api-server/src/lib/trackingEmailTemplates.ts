export interface TrackingEmailData {
  trackingCode: string;
  recipientName?: string;
  recipientEmail?: string;
  recipientAddress?: string;
  senderName?: string;
  origin?: string;
  destination?: string;
  status?: string;
  carrier?: string;
  eta?: string;
  speedKph?: number;
  progressPercent?: number;
  deliveryMethod?: string;
  customNotes?: string;
  appUrl?: string;
  // Vehicle delivery specific fields
  vehicleModel?: string;
  vin?: string;
  deliveryDate?: string;
  deliveryLocation?: string;
  vehicleImageUrl?: string;
}

export interface EmailTemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: "order" | "transit" | "out_for_delivery" | "delivered" | "customs";
  defaultSubject: string;
  badge: { label: string; bg: string; color: string; border: string };
  render: (data: TrackingEmailData) => { subject: string; html: string; text: string };
}

export const TESLA_LOGO_URL = "https://img.icons8.com/?size=100&id=OinYGm0fZ470&format=png&color=000000";

export const TESLA_WORDMARK_BLACK_SVG = `<svg viewBox="0 0 280 38" width="136" height="19" xmlns="http://www.w3.org/2000/svg" style="display: block;">
  <g fill="#171a20">
    <path d="m0 0.19c0.812 3.167 3.554 6.404 7.316 7.215h11.37l0.58 0.229v28.691h7.1v-28.691l0.645-0.229h11.38c3.804-0.98 6.487-4.048 7.285-7.215v-0.07h-45.676v0.07"/>
    <path d="m70.271 36.406h27.011c3.758-0.747 6.551-4.058 7.334-7.263h-41.679c0.778 3.206 3.612 6.516 7.334 7.263"/>
    <path d="m70.271 21.689h27.011c3.758-0.741 6.551-4.053 7.334-7.262h-41.679c0.778 3.21 3.612 6.521 7.334 7.262"/>
    <path d="m70.271 7.367h27.011c3.758-0.749 6.551-4.058 7.334-7.265h-41.679c0.778 3.207 3.612 6.516 7.334 7.265"/>
    <path d="m131.874 7.298h24.954c3.762-1.093 6.921-3.959 7.691-7.136h-39.64v21.415h32.444v7.515l-25.449 0.02c-3.988 1.112-7.37 3.79-9.057 7.327l2.062-0.038h39.415v-21.944h-32.42v-7.159"/>
    <path d="m216.795 36.41c3.543-1.502 5.449-4.1 6.179-7.14h-31.517l0.02-29.118-7.065 0.02v36.238h32.383"/>
    <path d="m244.321 7.396h27.02c3.753-0.746 6.544-4.058 7.331-7.262h-41.681c0.779 3.205 3.611 6.516 7.33 7.262"/>
    <path d="m238.077 14.484v21.912h7.027v-14.589h25.575v14.589h7.022v-21.874l-39.624-0.038"/>
  </g>
</svg>`;

export const TESLA_WORDMARK_RED_SVG = `<svg viewBox="0 0 280 38" width="76" height="11" xmlns="http://www.w3.org/2000/svg" style="display: block;">
  <g fill="#e82127">
    <path d="m0 0.19c0.812 3.167 3.554 6.404 7.316 7.215h11.37l0.58 0.229v28.691h7.1v-28.691l0.645-0.229h11.38c3.804-0.98 6.487-4.048 7.285-7.215v-0.07h-45.676v0.07"/>
    <path d="m70.271 36.406h27.011c3.758-0.747 6.551-4.058 7.334-7.263h-41.679c0.778 3.206 3.612 6.516 7.334 7.263"/>
    <path d="m70.271 21.689h27.011c3.758-0.741 6.551-4.053 7.334-7.262h-41.679c0.778 3.21 3.612 6.521 7.334 7.262"/>
    <path d="m70.271 7.367h27.011c3.758-0.749 6.551-4.058 7.334-7.265h-41.679c0.778 3.207 3.612 6.516 7.334 7.265"/>
    <path d="m131.874 7.298h24.954c3.762-1.093 6.921-3.959 7.691-7.136h-39.64v21.415h32.444v7.515l-25.449 0.02c-3.988 1.112-7.37 3.79-9.057 7.327l2.062-0.038h39.415v-21.944h-32.42v-7.159"/>
    <path d="m216.795 36.41c3.543-1.502 5.449-4.1 6.179-7.14h-31.517l0.02-29.118-7.065 0.02v36.238h32.383"/>
    <path d="m244.321 7.396h27.02c3.753-0.746 6.544-4.058 7.331-7.262h-41.681c0.779 3.205 3.611 6.516 7.33 7.262"/>
    <path d="m238.077 14.484v21.912h7.027v-14.589h25.575v14.589h7.022v-21.874l-39.624-0.038"/>
  </g>
</svg>`;

export const TESLA_EMBLEM_RED_SVG = `<svg viewBox="0 0 280 260" width="20" height="18" xmlns="http://www.w3.org/2000/svg" style="display: block;">
  <g fill="#e82127">
    <path d="m139.35 252.5 35.476-199.52c33.815 0 44.481 3.708 46.021 18.843 0 0 22.684-8.458 34.125-25.636-44.646-20.688-89.505-21.621-89.505-21.621l-26.176 31.882 0.059-0.004-26.176-31.883s-44.86 0.934-89.5 21.622c11.431 17.178 34.124 25.636 34.124 25.636 1.549-15.136 12.202-18.844 45.79-18.868l35.762 199.55"/>
    <path d="m139.336 15.36c36.09-0.276 77.399 5.583 119.687 24.014 5.652-10.173 7.105-14.669 7.105-14.669-46.227-18.289-89.518-24.548-126.797-24.705-37.277 0.157-80.566 6.417-126.787 24.705 0 0 2.062 5.538 7.1 14.669 42.28-18.431 83.596-24.29 119.687-24.014h0.005"/>
  </g>
</svg>`;

export const CAR_FRONT_ICON_SVG = `<svg width="34" height="28" viewBox="0 0 32 26" fill="#171a20" xmlns="http://www.w3.org/2000/svg" style="display: block;">
  <path d="M5.5 12.8L7.8 6.5C8.4 4.9 9.9 3.8 11.7 3.8H20.3C22.1 3.8 23.6 4.9 24.2 6.5L26.5 12.8C27.4 13.3 28 14.3 28 15.5V21C28 21.8 27.3 22.5 26.5 22.5H25C24.2 22.5 23.5 21.8 23.5 21V19.5H8.5V21C8.5 21.8 7.8 22.5 7 22.5H5.5C4.7 22.5 4 21.8 4 21V15.5C4 14.3 4.6 13.3 5.5 12.8ZM9.9 7.2L8.2 12H23.8L22.1 7.2C21.8 6.5 21.1 6 20.3 6H11.7C10.9 6 10.2 6.5 9.9 7.2ZM7.5 16.5C8.3 16.5 9 15.8 9 15C9 14.2 8.3 13.5 7.5 13.5C6.7 13.5 6 14.2 6 15C6 15.8 6.7 16.5 7.5 16.5ZM24.5 16.5C25.3 16.5 26 15.8 26 15C26 14.2 25.3 13.5 24.5 13.5C23.7 13.5 23 14.2 23 15C23 15.8 23.7 16.5 24.5 16.5Z"/>
</svg>`;

function getBaseStyles() {
  return `
    body { margin: 0; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f6; color: #171a20; -webkit-font-smoothing: antialiased; }
    .wrapper { max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .header { padding: 32px 36px 24px; border-bottom: 1px solid #f0f0f2; background: #ffffff; }
    .brand-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; }
    .brand-logo-wrap { display: flex; align-items: center; gap: 10px; text-decoration: none; }
    .brand-title { font-size: 14px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #171a20; margin: 0; }
    .brand-accent { color: #e82127; }
    .content { padding: 32px 36px; }
    .heading-title { font-size: 24px; font-weight: 600; color: #171a20; letter-spacing: -0.02em; margin: 0 0 6px 0; line-height: 1.25; }
    .heading-sub { font-size: 14px; color: #5c5e62; line-height: 1.5; margin: 0; }
    .code-box { background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 18px 20px; margin: 22px 0; text-align: center; }
    .code-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600; color: #5c5e62; margin-bottom: 6px; }
    .code-value { font-family: -apple-system, BlinkMacSystemFont, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 24px; font-weight: 700; color: #171a20; letter-spacing: 0.08em; }
    .info-table { width: 100%; border-collapse: collapse; margin: 22px 0; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    .info-table td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #f0f0f2; color: #393c41; vertical-align: middle; }
    .info-table tr:last-child td { border-bottom: none; }
    .info-table td.label { width: 36%; color: #5c5e62; text-transform: uppercase; font-size: 10px; letter-spacing: 0.08em; font-weight: 600; }
    .info-table td.value { color: #171a20; font-weight: 600; }
    .btn-track { display: block; width: fit-content; min-width: 220px; margin: 28px auto 0; padding: 14px 32px; background: #171a20; color: #ffffff !important; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 600; text-align: center; letter-spacing: 0.08em; text-transform: uppercase; box-sizing: border-box; }
    .btn-track-red { background: #e82127; }
    .footer { padding: 24px 36px; background: #f8f9fa; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #5c5e62; line-height: 1.7; }
    .footer a { color: #171a20; text-decoration: underline; margin: 0 6px; }
    .note-box { padding: 14px 18px; background: #f8f9fa; border-left: 3px solid #171a20; border-radius: 0 6px 6px 0; margin: 20px 0; font-size: 12px; color: #393c41; line-height: 1.5; }
    .status-pill { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  `;
}

export const EMAIL_TEMPLATES: EmailTemplateDefinition[] = [
  // 0. Official Tesla Vehicle Delivery Update (Exact match to Tesla Delivery Email)
  {
    id: "tesla_vehicle_delivered",
    name: "Tesla Vehicle Delivery Update",
    description: "Exact replica of official Tesla customer delivery email featuring Model 3 visuals, VIN, and delivery center details.",
    category: "delivered",
    defaultSubject: "Your Tesla Delivery Update",
    badge: { label: "Vehicle Delivered", bg: "rgba(23,26,32,0.06)", color: "#171a20", border: "#e5e7eb" },
    render: (data) => {
      const subject = "Your Tesla Delivery Update";
      const vehicleModel = data.vehicleModel || "Model 3";
      const vin = data.vin || "5YJ3E1EA7RF123456";
      const deliveryDate = data.deliveryDate || "Dec 27, 2025";
      const deliveryLocation = data.deliveryLocation || data.destination || "Tesla Delivery Center";
      const baseUrl = data.appUrl ? data.appUrl.replace(/\/$/, "") : "";
      const vehicleImage = data.vehicleImageUrl || (baseUrl ? `${baseUrl}/images/tesla_model_3_delivered.jpg` : "/images/tesla_model_3_delivered.jpg");

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 32px 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f4f4f6;
      color: #171a20;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .email-wrapper {
      max-width: 580px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 36px 36px 32px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
      box-sizing: border-box;
    }
    .tesla-wordmark-container {
      margin-bottom: 24px;
    }
    .eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #5c5e62;
      margin: 0 0 10px 0;
      line-height: 1;
    }
    .main-heading {
      font-size: 28px;
      font-weight: 700;
      color: #171a20;
      line-height: 1.2;
      letter-spacing: -0.025em;
      margin: 0 0 14px 0;
    }
    .lead-paragraph {
      font-size: 14px;
      line-height: 1.55;
      color: #393c41;
      margin: 0 0 22px 0;
    }
    .hero-image-wrap {
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 20px;
      background-color: #f4f4f6;
    }
    .hero-image {
      width: 100%;
      height: auto;
      display: block;
      border-radius: 8px;
      aspect-ratio: 16 / 9;
      object-fit: cover;
    }
    .vehicle-card {
      background-color: #f8f9fa;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px 20px;
      box-sizing: border-box;
    }
    .card-top {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .car-icon-col {
      flex-shrink: 0;
      padding-top: 3px;
    }
    .details-col {
      flex: 1;
    }
    .section-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #5c5e62;
      margin-bottom: 3px;
      line-height: 1.2;
    }
    .model-name {
      font-size: 16px;
      font-weight: 700;
      color: #171a20;
      line-height: 1.25;
      margin-bottom: 4px;
    }
    .detail-row {
      font-size: 12px;
      color: #5c5e62;
      line-height: 1.5;
      margin: 1px 0;
    }
    .card-divider {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 16px 0 14px;
      width: 100%;
    }
    .card-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .tesla-red-lockup {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .mission-statement {
      font-size: 8.5px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #5c5e62;
      text-align: right;
      max-width: 220px;
      line-height: 1.35;
      margin: 0;
    }
    @media (max-width: 520px) {
      body { padding: 12px 8px; }
      .email-wrapper { padding: 24px 18px 20px; }
      .main-heading { font-size: 24px; }
      .card-bottom { flex-direction: column; align-items: flex-start; gap: 10px; }
      .mission-statement { text-align: left; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <!-- Tesla Wordmark -->
    <div class="tesla-wordmark-container">
      ${TESLA_WORDMARK_BLACK_SVG}
    </div>

    <!-- Eyebrow -->
    <div class="eyebrow">ORDER UPDATE</div>

    <!-- Main Heading -->
    <h1 class="main-heading">Your Vehicle Has Been Delivered!</h1>

    <!-- Lead Text -->
    <p class="lead-paragraph">
      Great news! Your Tesla is now delivered and ready for you. Thank you for being a part of the Tesla family.
    </p>

    <!-- Hero Image -->
    <div class="hero-image-wrap">
      <img src="${vehicleImage}" alt="Tesla ${vehicleModel}" class="hero-image" />
    </div>

    <!-- Vehicle Details Card -->
    <div class="vehicle-card">
      <div class="card-top">
        <div class="car-icon-col">
          ${CAR_FRONT_ICON_SVG}
        </div>
        <div class="details-col">
          <div class="section-label">VEHICLE DETAILS</div>
          <div class="model-name">${vehicleModel}</div>
          <div class="detail-row">VIN: ${vin}</div>
          <div class="detail-row">Delivery Date: ${deliveryDate}</div>
          <div class="detail-row">Location: ${deliveryLocation}</div>
        </div>
      </div>

      <hr class="card-divider" />

      <div class="card-bottom">
        <div class="tesla-red-lockup">
          ${TESLA_EMBLEM_RED_SVG}
          ${TESLA_WORDMARK_RED_SVG}
        </div>
        <p class="mission-statement">
          ACCELERATING THE WORLD'S TRANSITION TO SUSTAINABLE ENERGY
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

      const text = `ORDER UPDATE\n\nYour Vehicle Has Been Delivered!\n\nGreat news! Your Tesla is now delivered and ready for you. Thank you for being a part of the Tesla family.\n\nVEHICLE DETAILS\nModel: ${vehicleModel}\nVIN: ${vin}\nDelivery Date: ${deliveryDate}\nLocation: ${deliveryLocation}\n\nTESLA - Accelerating the world's transition to sustainable energy.`;

      return { subject, html, text };
    },
  },

  // 1. Shipment Dispatched
  {
    id: "dispatched",
    name: "Shipment Dispatched / Order Initialized",
    description: "Sent when a tracking number is assigned and the package begins logistics processing.",
    category: "order",
    defaultSubject: "Shipment Confirmed: {{code}} is being processed",
    badge: { label: "Dispatched", bg: "rgba(23,26,32,0.06)", color: "#171a20", border: "#e5e7eb" },
    render: (data) => {
      const code = (data.trackingCode || "TSL-XXXX-XX").toUpperCase();
      const subject = `Shipment Confirmed: ${code} is being processed`;
      const trackUrl = data.appUrl ? `${data.appUrl.replace(/\/$/, "")}/track?code=${encodeURIComponent(code)}` : `https://teslatrack.io/track?code=${encodeURIComponent(code)}`;

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand-row">
        <div class="brand-logo-wrap">
          <img src="${TESLA_LOGO_URL}" alt="Tesla" width="28" height="28" style="width: 28px; height: 28px; display: block;" />
          <h1 class="brand-title">TESLA<span class="brand-accent">TRACK</span></h1>
        </div>
        <span class="status-pill" style="background: #f4f4f6; color: #171a20; border: 1px solid #e5e7eb;">MANIFEST CONFIRMED</span>
      </div>
      <h2 class="heading-title">Shipment Scheduled for Delivery</h2>
      <p class="heading-sub">Hello ${data.recipientName || "Valued Customer"}, your shipment order has been registered into the autonomous logistics corridor.</p>
    </div>
    <div class="content">
      <div class="code-box">
        <div class="code-label">Tracking Reference</div>
        <div class="code-value">${code}</div>
      </div>

      <p style="font-size: 13px; line-height: 1.6; color: #393c41; margin: 0 0 18px;">
        Your parcel has been assigned to an authorized carrier transport. Live telemetry tracking, real-time GPS telemetry, and waypoint timestamps are accessible below.
      </p>

      <table class="info-table">
        <tr><td class="label">Destination</td><td class="value">${data.destination || data.recipientAddress || "Destination Hub"}</td></tr>
        <tr><td class="label">Origin Hub</td><td class="value">${data.origin || "Tesla Regional Distribution Center"}</td></tr>
        <tr><td class="label">Estimated Arrival</td><td class="value">${data.eta || "Calculated at Departure"}</td></tr>
        <tr><td class="label">Carrier</td><td class="value">${data.carrier || "Tesla Logistics Express"}</td></tr>
        <tr><td class="label">Service Class</td><td class="value">${data.deliveryMethod || "Express Dedicated Ground"}</td></tr>
      </table>

      ${data.customNotes ? `<div class="note-box"><strong>Notice:</strong> ${data.customNotes}</div>` : ""}

      <a href="${trackUrl}" class="btn-track">Track Shipment Live</a>
    </div>
    <div class="footer">
      <div>Tesla Logistics Autonomous Transport Network</div>
      <div style="margin-top: 6px;">
        <a href="${trackUrl}">View Telemetry</a> &bull;
        <a href="https://tesla.com/support">Support</a> &bull;
        <a href="https://tesla.com/legal/privacy">Privacy Policy</a>
      </div>
      <div style="margin-top: 10px; color: #8d9096; font-size: 10px;">Tesla, Inc. &copy; ${new Date().getFullYear()} &bull; 1 Tesla Road, Austin, TX 78725</div>
    </div>
  </div>
</body>
</html>`;

      const text = `Shipment Confirmed: ${code}\nRecipient: ${data.recipientName || "Customer"}\nDestination: ${data.destination || "Address"}\nETA: ${data.eta || "Pending"}\nTrack live: ${trackUrl}`;
      return { subject, html, text };
    },
  },

  // 2. In Transit Live Telemetry
  {
    id: "in_transit",
    name: "In Transit / GPS Telemetry Active",
    description: "Sent while the vehicle is en route between regional hubs with live GPS telemetry details.",
    category: "transit",
    defaultSubject: "Transit Update: {{code}} is currently en route",
    badge: { label: "In Transit", bg: "rgba(62,106,225,0.08)", color: "#3e6ae1", border: "#dbeafe" },
    render: (data) => {
      const code = (data.trackingCode || "TSL-XXXX-XX").toUpperCase();
      const subject = `Transit Update: ${code} is en route to ${data.destination || "Destination"}`;
      const trackUrl = data.appUrl ? `${data.appUrl.replace(/\/$/, "")}/track?code=${encodeURIComponent(code)}` : `https://teslatrack.io/track?code=${encodeURIComponent(code)}`;
      const speed = data.speedKph || 85;

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand-row">
        <div class="brand-logo-wrap">
          <img src="${TESLA_LOGO_URL}" alt="Tesla" width="28" height="28" style="width: 28px; height: 28px; display: block;" />
          <h1 class="brand-title">TESLA<span class="brand-accent">TRACK</span></h1>
        </div>
        <span class="status-pill" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">GPS ACTIVE</span>
      </div>
      <h2 class="heading-title">Vehicle In Transit</h2>
      <p class="heading-sub">Active autonomous corridor telemetry for tracking reference ${code}</p>
    </div>
    <div class="content">
      <div class="code-box">
        <div class="code-label">Tracking Reference</div>
        <div class="code-value">${code}</div>
      </div>

      <table class="info-table">
        <tr><td class="label">Corridor Status</td><td class="value" style="color: #1d4ed8;">In Transit &mdash; Highway Corridor</td></tr>
        <tr><td class="label">Destination</td><td class="value">${data.destination || "Destination Hub"}</td></tr>
        <tr><td class="label">Ground Speed</td><td class="value">${speed} km/h (Live GPS Cruise)</td></tr>
        <tr><td class="label">Estimated Arrival</td><td class="value" style="color: #171a20; font-weight: 700;">${data.eta || "On Schedule"}</td></tr>
        <tr><td class="label">Carrier Fleet</td><td class="value">${data.carrier || "Tesla Semi Logistics Fleet"}</td></tr>
      </table>

      ${data.customNotes ? `<div class="note-box"><strong>Corridor Dispatch Notice:</strong> ${data.customNotes}</div>` : ""}

      <a href="${trackUrl}" class="btn-track">View Vehicle on Live Map</a>
    </div>
    <div class="footer">
      <div>Tesla Logistics Autonomous Transport Network</div>
      <div style="margin-top: 6px;">
        <a href="${trackUrl}">Live Coordinates</a> &bull;
        <a href="https://tesla.com/support">Support</a> &bull;
        <a href="https://tesla.com/legal/privacy">Privacy Policy</a>
      </div>
      <div style="margin-top: 10px; color: #8d9096; font-size: 10px;">Tesla, Inc. &copy; ${new Date().getFullYear()} &bull; 1 Tesla Road, Austin, TX 78725</div>
    </div>
  </div>
</body>
</html>`;

      const text = `Transit Update: ${code} is en route.\nDestination: ${data.destination || "N/A"}\nSpeed: ${speed} km/h\nETA: ${data.eta || "On Schedule"}\nTrack: ${trackUrl}`;
      return { subject, html, text };
    },
  },

  // 3. Out for Delivery
  {
    id: "out_for_delivery",
    name: "Out for Delivery (Final Mile)",
    description: "Sent when driver has loaded package for the final delivery run to recipient's doorstep.",
    category: "out_for_delivery",
    defaultSubject: "Out for Delivery: {{code}} arrives today",
    badge: { label: "Out for Delivery", bg: "rgba(234,88,12,0.08)", color: "#c2410c", border: "#fed7aa" },
    render: (data) => {
      const code = (data.trackingCode || "TSL-XXXX-XX").toUpperCase();
      const subject = `Out for Delivery: ${code} arrives today at ${data.destination || "your address"}`;
      const trackUrl = data.appUrl ? `${data.appUrl.replace(/\/$/, "")}/track?code=${encodeURIComponent(code)}` : `https://teslatrack.io/track?code=${encodeURIComponent(code)}`;

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand-row">
        <div class="brand-logo-wrap">
          <img src="${TESLA_LOGO_URL}" alt="Tesla" width="28" height="28" style="width: 28px; height: 28px; display: block;" />
          <h1 class="brand-title">TESLA<span class="brand-accent">TRACK</span></h1>
        </div>
        <span class="status-pill" style="background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa;">FINAL MILE</span>
      </div>
      <h2 class="heading-title">Package is Out for Delivery</h2>
      <p class="heading-sub">The courier is on the final route to your location.</p>
    </div>
    <div class="content">
      <div class="code-box">
        <div class="code-label">Tracking Reference</div>
        <div class="code-value">${code}</div>
      </div>

      <div style="background: #fff7ed; border: 1px solid #ffedd5; border-radius: 6px; padding: 16px; margin: 20px 0; text-align: center;">
        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #c2410c; font-weight: 700;">Scheduled Delivery Window</div>
        <div style="font-size: 20px; font-weight: 700; color: #171a20; margin-top: 4px;">${data.eta || "Today by 5:00 PM"}</div>
      </div>

      <table class="info-table">
        <tr><td class="label">Recipient</td><td class="value">${data.recipientName || "Authorized Receiver"}</td></tr>
        <tr><td class="label">Delivery Address</td><td class="value">${data.recipientAddress || data.destination || "Registered Destination"}</td></tr>
        <tr><td class="label">Courier Service</td><td class="value">${data.carrier || "Tesla Final-Mile Courier"}</td></tr>
      </table>

      <div class="note-box" style="border-left-color: #ea580c;">
        <strong>Dropoff Advisory:</strong> Please ensure the delivery entrance is accessible. High-value cargo may require digital signature verification upon handover.
      </div>

      <a href="${trackUrl}" class="btn-track btn-track-red">Follow Courier on Map</a>
    </div>
    <div class="footer">
      <div>Tesla Logistics Autonomous Transport Network</div>
      <div style="margin-top: 6px;">
        <a href="${trackUrl}">Live GPS</a> &bull;
        <a href="https://tesla.com/support">Support</a> &bull;
        <a href="https://tesla.com/legal/privacy">Privacy Policy</a>
      </div>
      <div style="margin-top: 10px; color: #8d9096; font-size: 10px;">Tesla, Inc. &copy; ${new Date().getFullYear()} &bull; 1 Tesla Road, Austin, TX 78725</div>
    </div>
  </div>
</body>
</html>`;

      const text = `Out for Delivery: ${code} is scheduled for dropoff today at ${data.recipientAddress || data.destination || "your address"}.\nETA: ${data.eta || "Today"}\nTrack: ${trackUrl}`;
      return { subject, html, text };
    },
  },

  // 4. Delivered
  {
    id: "delivered",
    name: "Shipment Delivered / Complete",
    description: "Sent once drop-off confirmation is verified with timestamp and delivery location.",
    category: "delivered",
    defaultSubject: "Delivered: {{code}} has arrived",
    badge: { label: "Delivered", bg: "rgba(16,185,129,0.08)", color: "#047857", border: "#a7f3d0" },
    render: (data) => {
      const code = (data.trackingCode || "TSL-XXXX-XX").toUpperCase();
      const subject = `Delivered: ${code} has been successfully delivered`;
      const trackUrl = data.appUrl ? `${data.appUrl.replace(/\/$/, "")}/track?code=${encodeURIComponent(code)}` : `https://teslatrack.io/track?code=${encodeURIComponent(code)}`;

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand-row">
        <div class="brand-logo-wrap">
          <img src="${TESLA_LOGO_URL}" alt="Tesla" width="28" height="28" style="width: 28px; height: 28px; display: block;" />
          <h1 class="brand-title">TESLA<span class="brand-accent">TRACK</span></h1>
        </div>
        <span class="status-pill" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">DELIVERED</span>
      </div>
      <h2 class="heading-title">Your Shipment Has Arrived</h2>
      <p class="heading-sub">Handover completed for consignee ${data.recipientName || "Valued Customer"}</p>
    </div>
    <div class="content">
      <div class="code-box">
        <div class="code-label">Tracking Reference</div>
        <div class="code-value">${code}</div>
      </div>

      <div style="background: #ecfdf5; border: 1px solid #d1fae5; border-radius: 6px; padding: 18px; margin: 20px 0;">
        <div style="color: #047857; font-weight: 700; font-size: 14px; margin-bottom: 4px;">&check; Dropoff Verified</div>
        <div style="font-size: 13px; color: #393c41; line-height: 1.5;">
          Package was safely placed at <strong>${data.recipientAddress || data.destination || "Front Entrance / Porch"}</strong>.
        </div>
      </div>

      <table class="info-table">
        <tr><td class="label">Delivered To</td><td class="value">${data.recipientName || "Recipient"}</td></tr>
        <tr><td class="label">Location</td><td class="value">${data.recipientAddress || data.destination || "Destination"}</td></tr>
        <tr><td class="label">Carrier</td><td class="value">${data.carrier || "Tesla Logistics Courier"}</td></tr>
        <tr><td class="label">Completed</td><td class="value">${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td></tr>
      </table>

      <a href="${trackUrl}" class="btn-track">View Delivery Proof & Details</a>
    </div>
    <div class="footer">
      <div>Tesla Logistics Autonomous Transport Network</div>
      <div style="margin-top: 6px;">
        <a href="${trackUrl}">Delivery Proof</a> &bull;
        <a href="https://tesla.com/support">Support</a> &bull;
        <a href="https://tesla.com/legal/privacy">Privacy Policy</a>
      </div>
      <div style="margin-top: 10px; color: #8d9096; font-size: 10px;">Tesla, Inc. &copy; ${new Date().getFullYear()} &bull; 1 Tesla Road, Austin, TX 78725</div>
    </div>
  </div>
</body>
</html>`;

      const text = `Delivered: ${code} has been delivered successfully to ${data.recipientAddress || data.destination || "your address"}.\nView details: ${trackUrl}`;
      return { subject, html, text };
    },
  },

  // 5. Customs Clearance Notice
  {
    id: "customs_update",
    name: "Customs & Port Inspection Update",
    description: "Sent when international shipments enter inspection, border verification, or clearance.",
    category: "customs",
    defaultSubject: "Customs Status Update: {{code}} Clearance Processing",
    badge: { label: "Customs", bg: "rgba(202,138,4,0.08)", color: "#a16207", border: "#fde68a" },
    render: (data) => {
      const code = (data.trackingCode || "TSL-XXXX-XX").toUpperCase();
      const subject = `Customs Status: ${code} Port Inspection & Clearance Update`;
      const trackUrl = data.appUrl ? `${data.appUrl.replace(/\/$/, "")}/track?code=${encodeURIComponent(code)}` : `https://teslatrack.io/track?code=${encodeURIComponent(code)}`;

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand-row">
        <div class="brand-logo-wrap">
          <img src="${TESLA_LOGO_URL}" alt="Tesla" width="28" height="28" style="width: 28px; height: 28px; display: block;" />
          <h1 class="brand-title">TESLA<span class="brand-accent">TRACK</span></h1>
        </div>
        <span class="status-pill" style="background: #fefce8; color: #a16207; border: 1px solid #fef08a;">CUSTOMS INSPECTION</span>
      </div>
      <h2 class="heading-title">International Port Clearance</h2>
      <p class="heading-sub">Cargo documentation & import tariff verification for ${code}</p>
    </div>
    <div class="content">
      <div class="code-box">
        <div class="code-label">Tracking Reference</div>
        <div class="code-value">${code}</div>
      </div>

      <table class="info-table">
        <tr><td class="label">Port of Entry</td><td class="value">Port of Entry Gateway / Customs Terminal</td></tr>
        <tr><td class="label">Clearance Status</td><td class="value" style="color: #a16207; font-weight: 700;">In Review & Processing</td></tr>
        <tr><td class="label">Destination</td><td class="value">${data.destination || "Consignee Address"}</td></tr>
        <tr><td class="label">Estimated Release</td><td class="value">${data.eta || "Within 24-48 business hours"}</td></tr>
      </table>

      ${data.customNotes ? `<div class="note-box" style="border-left-color: #ca8a04;"><strong>Inspection Notes:</strong> ${data.customNotes}</div>` : ""}

      <a href="${trackUrl}" class="btn-track">Review Customs Clearance</a>
    </div>
    <div class="footer">
      <div>Tesla Logistics International Customs Brokerage</div>
      <div style="margin-top: 6px;">
        <a href="${trackUrl}">Clearance Status</a> &bull;
        <a href="https://tesla.com/support">Support</a> &bull;
        <a href="https://tesla.com/legal/privacy">Privacy Policy</a>
      </div>
      <div style="margin-top: 10px; color: #8d9096; font-size: 10px;">Tesla, Inc. &copy; ${new Date().getFullYear()} &bull; 1 Tesla Road, Austin, TX 78725</div>
    </div>
  </div>
</body>
</html>`;

      const text = `Customs Status: ${code} is currently undergoing import processing.\nETA: ${data.eta || "Pending"}\nTrack: ${trackUrl}`;
      return { subject, html, text };
    },
  },

  // 6. Shipping Label & Tracking Summary Waybill
  {
    id: "shipping_label",
    name: "Shipping Waybill & Print Label Summary",
    description: "Official carrier shipping label and dispatch waybill with printable barcode and shipment manifest.",
    category: "order",
    defaultSubject: "Shipping Waybill & Label: {{code}} Transport Summary",
    badge: { label: "Label & Waybill", bg: "rgba(23,26,32,0.06)", color: "#171a20", border: "#e5e7eb" },
    render: (data) => {
      const code = (data.trackingCode || "TSL-XXXX-XX").toUpperCase();
      const subject = `Shipping Waybill & Label: ${code} Transport Summary`;
      const trackUrl = data.appUrl ? `${data.appUrl.replace(/\/$/, "")}/track?code=${encodeURIComponent(code)}` : `https://teslatrack.io/track?code=${encodeURIComponent(code)}`;

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>${getBaseStyles()}
    .waybill-box { background: #ffffff; color: #171a20; border-radius: 6px; padding: 22px; margin: 20px 0; border: 2px solid #171a20; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .wb-hdr { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #171a20; padding-bottom: 12px; margin-bottom: 14px; }
    .wb-title { font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #171a20; }
    .wb-badge { background: #171a20; color: #ffffff; font-size: 9px; font-weight: 700; padding: 4px 8px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.05em; }
    .wb-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; border-bottom: 1px dashed #d1d5db; padding-bottom: 14px; }
    .wb-party-title { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #5c5e62; margin-bottom: 4px; letter-spacing: 0.06em; }
    .wb-party-name { font-size: 12px; font-weight: 700; color: #171a20; }
    .wb-party-addr { font-size: 11px; color: #393c41; margin-top: 2px; }
    .wb-barcode { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 22px; font-weight: 800; letter-spacing: 0.15em; text-align: center; padding: 12px; border: 1px solid #171a20; background: #f8f9fa; margin: 12px 0 4px; }
    .wb-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 10px; background: #f4f4f6; padding: 10px; border-radius: 4px; }
    .wb-grid-label { color: #5c5e62; text-transform: uppercase; font-size: 8px; font-weight: 600; }
    .wb-grid-val { color: #171a20; font-weight: 700; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand-row">
        <div class="brand-logo-wrap">
          <img src="${TESLA_LOGO_URL}" alt="Tesla" width="28" height="28" style="width: 28px; height: 28px; display: block;" />
          <h1 class="brand-title">TESLA<span class="brand-accent">TRACK</span></h1>
        </div>
        <span class="status-pill" style="background: #f4f4f6; color: #171a20; border: 1px solid #e5e7eb;">OFFICIAL WAYBILL</span>
      </div>
      <h2 class="heading-title">Shipment Summary &amp; Printable Label</h2>
      <p class="heading-sub">Verified carrier waybill issued for tracking reference ${code}</p>
    </div>
    <div class="content">
      <div class="waybill-box">
        <div class="wb-hdr">
          <div style="display: flex; align-items: center; gap: 8px;">
            <img src="${TESLA_LOGO_URL}" alt="Tesla Logo" width="20" height="20" style="width: 20px; height: 20px; vertical-align: middle;" />
            <div class="wb-title">TESLA LOGISTICS EXPRESS</div>
          </div>
          <div class="wb-badge">STANDARD AIR/GROUND WAYBILL</div>
        </div>

        <div class="wb-parties">
          <div>
            <div class="wb-party-title">SHIP FROM (ORIGIN):</div>
            <div class="wb-party-name">${data.senderName || "Tesla Central Distribution Hub"}</div>
            <div class="wb-party-addr">${data.origin || "Fremont Gigafactory Hub, CA"}</div>
          </div>
          <div>
            <div class="wb-party-title">SHIP TO (CONSIGNEE):</div>
            <div class="wb-party-name">${data.recipientName || "Valued Consignee"}</div>
            <div class="wb-party-addr">${data.recipientAddress || data.destination || "Palo Alto, CA"}</div>
          </div>
        </div>

        <div class="wb-barcode">${code}</div>
        <div style="text-align: center; font-size: 9px; color: #5c5e62; margin-bottom: 12px; letter-spacing: 0.05em;">CARRIER SCAN BARCODE &bull; AUTONOMOUS FLEET WAYBILL</div>

        <div class="wb-grid">
          <div>
            <div class="wb-grid-label">Service</div>
            <div class="wb-grid-val">${data.deliveryMethod || "Express Dedicated"}</div>
          </div>
          <div>
            <div class="wb-grid-label">Carrier</div>
            <div class="wb-grid-val">${data.carrier || "Tesla Express"}</div>
          </div>
          <div>
            <div class="wb-grid-label">Status</div>
            <div class="wb-grid-val">${data.status || "In Transit"}</div>
          </div>
          <div>
            <div class="wb-grid-label">Est. Delivery</div>
            <div class="wb-grid-val">${data.eta || "Scheduled Today"}</div>
          </div>
        </div>
      </div>

      <p style="font-size: 13px; line-height: 1.6; color: #393c41; margin: 16px 0;">
        You can print this shipping label directly from your TeslaTrack shipment portal or attach it to package documentation for customs clearance.
      </p>

      <a href="${trackUrl}" class="btn-track">Open Live Tracking &amp; Print Label</a>
    </div>
    <div class="footer">
      <div>Tesla Logistics Autonomous Transport Network</div>
      <div style="margin-top: 6px;">
        <a href="${trackUrl}">Live Tracking</a> &bull;
        <a href="https://tesla.com/support">Support</a> &bull;
        <a href="https://tesla.com/legal/privacy">Privacy Policy</a>
      </div>
      <div style="margin-top: 10px; color: #8d9096; font-size: 10px;">Tesla, Inc. &copy; ${new Date().getFullYear()} &bull; 1 Tesla Road, Austin, TX 78725</div>
    </div>
  </div>
</body>
</html>`;

      const text = `Shipping Waybill & Label Summary\nTracking Code: ${code}\nShipper: ${data.senderName || "Tesla Distribution"}\nConsignee: ${data.recipientName || "Consignee"}\nDestination: ${data.destination || "Address"}\nETA: ${data.eta || "On Schedule"}\nTrack & Print: ${trackUrl}`;
      return { subject, html, text };
    },
  },
];
