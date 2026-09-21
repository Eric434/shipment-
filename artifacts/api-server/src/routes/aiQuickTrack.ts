import { Router, type IRouter } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import pool from "../lib/db";
import { requireAdmin } from "../lib/adminAuth";

const router: IRouter = Router();

let aiClient: GoogleGenAI | null = null;

function getAi(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Known coordinates for interpolation fallback
const CITY_COORDS: Record<string, [number, number]> = {
  "fremont": [37.5485, -121.9886],
  "san jose": [37.3382, -121.8863],
  "san francisco": [37.7749, -122.4194],
  "los angeles": [34.0522, -118.2437],
  "austin": [30.2672, -97.7431],
  "seattle": [47.6062, -122.3321],
  "portland": [45.5152, -122.6784],
  "chicago": [41.8781, -87.6298],
  "new york": [40.7128, -74.006],
  "miami": [25.7617, -80.1918],
  "reno": [39.5296, -119.8138],
  "las vegas": [36.1699, -115.1398],
  "phoenix": [33.4484, -112.074],
  "denver": [39.7392, -104.9903],
  "dallas": [32.7767, -96.797],
  "houston": [29.7604, -95.3698],
  "atlanta": [33.749, -84.388],
  "boston": [42.3601, -71.0589],
  "berlin": [52.52, 13.405],
  "london": [51.5074, -0.1278],
};

function generateTrackingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "0123456789";
  const r = (s: string, n: number) =>
    Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join("");
  return `TSL-${r(nums, 4)}-${r(chars, 2)}`;
}

function interpolateWaypoints(
  start: [number, number],
  end: [number, number],
  count: number = 8
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    // Add slight curvature to make it look like a highway route rather than straight line
    const curve = Math.sin(t * Math.PI) * 0.45;
    const lat = Number((start[0] + (end[0] - start[0]) * t + curve * 0.15).toFixed(4));
    const lng = Number((start[1] + (end[1] - start[1]) * t + curve * 0.35).toFixed(4));
    points.push([lat, lng]);
  }
  return points;
}

function findCityCoords(cityStr: string): [number, number] | null {
  const lower = (cityStr || "").toLowerCase();
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(key)) return coords;
  }
  return null;
}

function buildFallbackTracking(prompt: string, preset?: string) {
  const code = generateTrackingCode();
  const lower = (prompt || "").toLowerCase();

  let origin = "Fremont Gigafactory, CA";
  let destination = "Austin Gigafactory, TX";
  let carrier = "Tesla Autonomous Semi Freight";
  let status = "In Transit";
  let delivery_method = "Priority Autonomous";
  let weight = "1,850 kg";
  let shipping_cost = 249.0;
  let speed_kph = 92;
  let start_progress = 0.45;
  let customs_status = "Cleared";
  let customs_fee = 0;
  let sender_name = "Tesla Logistics Direct";
  let sender_email = "dispatch@teslatrack.io";
  let sender_phone = "+1 (888) 518-3752";
  let sender_address = "45500 Fremont Blvd, Fremont, CA 94538";
  let receiver_name = "Priority Delivery Center";
  let receiver_email = "recipient@example.com";
  let receiver_phone = "+1 (512) 555-0199";
  let receiver_address = "13101 Harold Green Rd, Austin, TX 78725";

  // Check common cities in prompt
  if (lower.includes("seattle") || lower.includes("wa")) {
    destination = "Seattle Service Center, WA";
    receiver_address = "415 Fairview Ave N, Seattle, WA 98109";
  } else if (lower.includes("miami") || lower.includes("fl")) {
    destination = "Miami Delivery Hub, FL";
    receiver_address = "2790 Biscayne Blvd, Miami, FL 33137";
  } else if (lower.includes("new york") || lower.includes("ny")) {
    destination = "New York Manhattan Hub, NY";
    receiver_address = "860 Washington St, New York, NY 10014";
  } else if (lower.includes("chicago") || lower.includes("il")) {
    destination = "Chicago Delivery Center, IL";
    receiver_address = "1053 W Grand Ave, Chicago, IL 60642";
  } else if (lower.includes("los angeles") || lower.includes("la")) {
    destination = "Los Angeles Delivery Center, CA";
    receiver_address = "Centinela Ave, Los Angeles, CA 90066";
  }

  if (lower.includes("model y") || lower.includes("model 3") || lower.includes("cybertruck") || preset === "vehicle_delivery") {
    weight = "2,100 kg (Vehicle Transport)";
    carrier = "Tesla Enclosed Auto Hauler";
    delivery_method = "Direct Delivery";
    shipping_cost = 450.0;
  } else if (lower.includes("battery") || lower.includes("megapack") || preset === "battery_pack") {
    weight = "1,420 kg (Lithium-ion Pack)";
    carrier = "Tesla Heavy Autonomous Freight";
    delivery_method = "Secure Escort";
    shipping_cost = 680.0;
  } else if (lower.includes("supercharger") || lower.includes("v4")) {
    weight = "380 kg (V4 Power Modules)";
    carrier = "Tesla Rapid Infrastructure";
    delivery_method = "Express";
    shipping_cost = 180.0;
  }

  const startCoord = findCityCoords(origin) || [37.5485, -121.9886];
  const endCoord = findCityCoords(destination) || [30.2672, -97.7431];
  const route = interpolateWaypoints(startCoord, endCoord, 10);

  const events = [
    { time_label: "06:00 AM", label: "Order Received & Dispatched", location: origin, done: true, sort_order: 0 },
    { time_label: "09:30 AM", label: "Gigafactory Gate Departure", location: origin, done: true, sort_order: 1 },
    { time_label: "01:15 PM", label: "In Autonomous Transit Corridor", location: "Interstate Highway Hub", done: true, sort_order: 2 },
    { time_label: "05:45 PM", label: "Supercharger En-Route Sync", location: "Supercharger Depot", done: false, sort_order: 3 },
    { time_label: "Tomorrow 10:00 AM", label: "Out for Final Delivery", location: destination, done: false, sort_order: 4 },
    { time_label: "Tomorrow 02:00 PM", label: "Delivered & Customer Handover", location: destination, done: false, sort_order: 5 },
  ];

  return {
    code,
    status,
    eta: "Tomorrow by 2:00 PM",
    origin,
    destination,
    carrier,
    weight,
    speed_kph,
    start_progress,
    delivery_method,
    shipping_cost,
    customs_status,
    customs_fee,
    sender_name,
    sender_email,
    sender_phone,
    sender_address,
    receiver_name,
    receiver_email,
    receiver_phone,
    receiver_address,
    route,
    events,
    ai_insights: `Quick-generated shipment with realistic autonomous corridor routing between ${origin} and ${destination}.`,
  };
}

// ─── POST /api/admin/ai/quick-track-generate ─────────────────────────────────
// Generates a complete shipment manifest using Gemini or intelligent fallback
router.post("/admin/ai/quick-track-generate", requireAdmin, async (req, res) => {
  const { prompt, preset } = req.body as { prompt?: string; preset?: string };
  const userPrompt = (prompt || "").trim();

  const effectivePrompt = userPrompt || (
    preset === "vehicle_delivery" ? "Deliver a new Tesla Model Y Performance from Fremont Gigafactory to Seattle Service Center for customer handover" :
    preset === "megapack_rush" ? "Express transport of 4680 Megapack battery cells from Sparks Nevada Gigafactory to Austin Texas with hazmat escort" :
    preset === "supercharger_v4" ? "High priority dispatch of Supercharger V4 charging pedestals from Buffalo NY to Miami FL" :
    preset === "cybertruck_chicago" ? "Cybertruck Foundation Series delivery from Giga Texas to Chicago Illinois with enclosed carrier" :
    "Express logistics dispatch for Tesla parts from Fremont Gigafactory to Los Angeles"
  );

  const ai = getAi();
  if (!ai) {
    const fallback = buildFallbackTracking(effectivePrompt, preset);
    res.json({ ok: true, tracking: fallback, isAiGenerated: false, reason: "Local generator (No GEMINI_API_KEY)" });
    return;
  }

  try {
    const systemInstruction = `You are the AI Logistics Dispatcher for TeslaTrack, an autonomous Tesla fleet & freight tracking platform.
Your job is to parse or generate an end-to-end, hyper-realistic Tesla tracking shipment based on the administrator's prompt.

You MUST respond strictly with valid JSON conforming to the following structure:
{
  "code": "TSL-XXXX-XX" (where XXXX is 4 digits and XX is 2 uppercase letters, e.g. TSL-8492-KR),
  "status": "Processing" | "In Transit" | "Customs Clearance" | "Out for Delivery" | "Delivered",
  "eta": "Realistic human readable ETA, e.g. Tomorrow by 3:30 PM or Oct 24, 2:15 PM",
  "origin": "Origin City, State/Country (e.g. Fremont Gigafactory, CA)",
  "destination": "Destination City, State/Country (e.g. Seattle, WA)",
  "carrier": "e.g. Tesla Autonomous Semi Freight / Tesla Express Logistics / Tesla Enclosed Hauler",
  "weight": "e.g. 2,100 kg or 18.5 kg",
  "speed_kph": integer number between 65 and 110,
  "start_progress": float between 0.05 and 0.85,
  "delivery_method": "Standard" | "Express" | "Priority Autonomous" | "Same-Day" | "Direct Delivery",
  "shipping_cost": float number,
  "customs_status": "Pending" | "In Review" | "Cleared" | "Held" | "N/A - Domestic",
  "customs_fee": float number (0 for domestic),
  "sender_name": "Name of dispatcher or facility (e.g. Tesla Fremont Logistics / Sarah Chen)",
  "sender_email": "e.g. dispatch@teslatrack.io",
  "sender_phone": "e.g. +1 (888) 518-3752",
  "sender_address": "Realistic street address at origin",
  "receiver_name": "Full name of recipient / customer / service manager",
  "receiver_email": "e.g. customer@example.com",
  "receiver_phone": "Realistic recipient phone number",
  "receiver_address": "Realistic street address at destination",
  "route": [
    [latitude, longitude],
    [latitude, longitude],
    ... (between 8 and 14 valid GPS coordinates tracing a real highway route from origin to destination. Latitude between -90 and 90, Longitude between -180 and 180)
  ],
  "events": [
    {
      "time_label": "e.g. 07:30 AM",
      "label": "e.g. Order Received / Autonomous Departure / Highway Escort / Customs Clearance",
      "location": "City or facility name",
      "done": boolean (consistent with start_progress),
      "sort_order": integer from 0 to 5
    }
  ],
  "ai_insights": "A 1-2 sentence professional dispatch briefing highlighting speed, safety status, and estimated delivery."
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Generate a complete TeslaTrack shipment for this order/instruction: "${effectivePrompt}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const text = (response.text || "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Clean possible markdown code fences
      const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(cleaned);
    }

    // Ensure valid code and route
    if (!parsed.code || !parsed.code.startsWith("TSL-")) {
      parsed.code = generateTrackingCode();
    }
    if (!Array.isArray(parsed.route) || parsed.route.length < 2) {
      const startCoord = findCityCoords(parsed.origin) || [37.5485, -121.9886];
      const endCoord = findCityCoords(parsed.destination) || [30.2672, -97.7431];
      parsed.route = interpolateWaypoints(startCoord, endCoord, 10);
    }

    if (!Array.isArray(parsed.events) || parsed.events.length === 0) {
      parsed.events = [
        { time_label: "07:00 AM", label: "Order Received", location: parsed.origin, done: true, sort_order: 0 },
        { time_label: "09:45 AM", label: "Gigafactory Departure", location: parsed.origin, done: true, sort_order: 1 },
        { time_label: "01:30 PM", label: "In Transit Corridor", location: "Transit Hub", done: true, sort_order: 2 },
        { time_label: "Tomorrow 09:00 AM", label: "Out for Delivery", location: parsed.destination, done: false, sort_order: 3 },
        { time_label: "Tomorrow 01:00 PM", label: "Delivered", location: parsed.destination, done: false, sort_order: 4 },
      ];
    }

    res.json({
      ok: true,
      tracking: parsed,
      isAiGenerated: true,
    });
  } catch (err: any) {
    console.warn("Gemini quick track generation error, falling back to local heuristic:", err?.message);
    const fallback = buildFallbackTracking(effectivePrompt, preset);
    res.json({
      ok: true,
      tracking: fallback,
      isAiGenerated: false,
      reason: `Fallback used (${err?.message || "AI temporary error"})`,
    });
  }
});

// ─── POST /api/admin/ai/quick-track-create ───────────────────────────────────
// Inserts a generated tracking directly into the database
router.post("/admin/ai/quick-track-create", requireAdmin, async (req, res) => {
  const { tracking } = req.body as { tracking: any };
  if (!tracking || !tracking.origin || !tracking.destination) {
    res.status(400).json({ error: "Missing tracking payload" });
    return;
  }

  let code = (tracking.code || generateTrackingCode()).trim().toUpperCase();
  if (!code.startsWith("TSL-")) {
    code = generateTrackingCode();
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // If duplicate, regenerate
    const check = await client.query("SELECT code FROM packages WHERE code = $1", [code]);
    if (check.rowCount && check.rowCount > 0) {
      code = generateTrackingCode();
    }

    await client.query(
      `INSERT INTO packages (
        code, status, eta, origin, destination, carrier, weight, speed_kph, start_progress, route,
        sender_name, sender_email, sender_phone, sender_address,
        receiver_name, receiver_email, receiver_phone, receiver_address,
        delivery_method, shipping_cost, customs_status, customs_fee
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        code,
        tracking.status || "In Transit",
        tracking.eta || "Tomorrow by 2:00 PM",
        tracking.origin,
        tracking.destination,
        tracking.carrier || "Tesla Autonomous Freight",
        tracking.weight || "2,050 kg",
        Number(tracking.speed_kph) || 88,
        Number(tracking.start_progress) || 0.25,
        JSON.stringify(tracking.route || []),
        tracking.sender_name || "Tesla Logistics Direct",
        tracking.sender_email || "dispatch@teslatrack.io",
        tracking.sender_phone || "+1 (888) 518-3752",
        tracking.sender_address || "",
        tracking.receiver_name || "Customer",
        tracking.receiver_email || "",
        tracking.receiver_phone || "",
        tracking.receiver_address || "",
        tracking.delivery_method || "Priority Autonomous",
        Number(tracking.shipping_cost) || 199.0,
        tracking.customs_status || "Cleared",
        Number(tracking.customs_fee) || 0,
      ]
    );

    if (Array.isArray(tracking.events) && tracking.events.length > 0) {
      for (const ev of tracking.events) {
        await client.query(
          `INSERT INTO package_events (code, time_label, label, location, done, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            code,
            ev.time_label || "",
            ev.label || "Status Update",
            ev.location || "",
            ev.done ?? false,
            Number(ev.sort_order) || 0,
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json({ ok: true, code, message: `Tracking ${code} successfully registered and tracked live.` });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Failed to insert AI quick tracking:", err);
    res.status(500).json({ error: err?.message || "Failed to create shipment" });
  } finally {
    client.release();
  }
});

// ─── POST /api/admin/ai/quick-track-assist ────────────────────────────────────
// Natural language assistant for admin questions about fleet / trackings
router.post("/admin/ai/quick-track-assist", requireAdmin, async (req, res) => {
  const { question } = req.body as { question?: string };
  if (!question || !question.trim()) {
    res.status(400).json({ error: "Question required" });
    return;
  }

  try {
    // Gather recent packages to give context to the assistant
    const pkgResult = await pool.query(
      `SELECT code, status, eta, origin, destination, carrier, customs_status, receiver_name
       FROM packages ORDER BY created_at DESC LIMIT 15`
    );
    const contextList = pkgResult.rows.map((r) =>
      `• ${r.code}: ${r.status} (${r.origin} -> ${r.destination}), ETA: ${r.eta}, Carrier: ${r.carrier}, Recipient: ${r.receiver_name}, Customs: ${r.customs_status}`
    ).join("\n");

    const ai = getAi();
    if (!ai) {
      res.json({
        ok: true,
        answer: `I analyzed your active fleet of ${pkgResult.rowCount} shipments. Please provide a tracking code or prompt to create a quick shipment. (AI Assistant offline mode)`,
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Current active fleet shipments:\n${contextList}\n\nAdmin question: "${question}"\n\nProvide a concise, direct, helpful answer for the logistics administrator.`,
      config: {
        systemInstruction: "You are TeslaTrack AI Assistant. Be precise, concise, and helpful with logistics operations and telemetry.",
      },
    });

    res.json({
      ok: true,
      answer: response.text || "No insights available.",
    });
  } catch (err: any) {
    res.json({
      ok: true,
      answer: `Unable to connect to AI server: ${err?.message || "Internal error"}.`,
    });
  }
});

export default router;
