import { Router, type IRouter } from "express";
import { GoogleGenAI } from "@google/genai";

const router: IRouter = Router();

let aiClient: GoogleGenAI | null = null;

function getAi(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// In-memory cache for queries (15 min TTL) to preserve quota and avoid redundant API calls
const cache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

interface GroundingPayload {
  prompt: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  destinationAddress?: string;
  trackingCode?: string;
}

function buildFallbackResponse(
  prompt: string,
  destinationAddress: string | undefined,
  location: { latitude: number; longitude: number } | undefined,
  reason: string
) {
  const target = destinationAddress || "Delivery Destination";
  const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`;
  const superchargerUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Tesla Supercharger near ${target}`)}`;
  const trafficUrl = location
    ? `https://www.google.com/maps/@${location.latitude},${location.longitude},14z/data=!5m1!1e1`
    : mapsSearchUrl;

  const places: Array<{
    title: string;
    uri: string;
    source: string;
    reviewSnippets?: string[];
  }> = [
    {
      title: `${target} - Google Maps Location`,
      uri: mapsSearchUrl,
      source: "Google Maps",
    },
    {
      title: `Tesla Superchargers near ${target}`,
      uri: superchargerUrl,
      source: "Google Maps",
    },
  ];

  const text = `### Google Maps Location Intelligence

* **Destination:** ${target}
* **Coordinates:** ${location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : "Referenced from route manifest"}
* **Live Map Link:** [Open in Google Maps](${mapsSearchUrl})
* **Nearby Charging:** [Find Nearest Tesla Superchargers](${superchargerUrl})
* **Traffic & Route Status:** [View Live Congestion & Route on Google Maps](${trafficUrl})

*(Note: Live generative quota is temporarily rate-limited; verified direct Google Maps Platform links and navigation endpoints are active above.)*`;

  return {
    text,
    places,
    groundingChunks: [],
    searchQueries: [target],
    isRateLimited: true,
    rateLimitReason: reason,
  };
}

router.post("/maps/grounding", async (req, res) => {
  try {
    const { prompt, location, destinationAddress, trackingCode } = req.body as GroundingPayload;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      res.status(400).json({ error: "Missing or invalid prompt parameter." });
      return;
    }

    const trimmedPrompt = prompt.trim();
    const cacheKey = `${trackingCode || ""}:${destinationAddress || ""}:${trimmedPrompt}`;

    // Return cached response if valid
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      res.json(cached.data);
      return;
    }

    const ai = getAi();
    if (!ai) {
      // If no API key configured, provide structured Google Maps direct intelligence
      const fallback = buildFallbackResponse(
        trimmedPrompt,
        destinationAddress,
        location,
        "GEMINI_API_KEY environment variable is not configured."
      );
      cache.set(cacheKey, { timestamp: Date.now(), data: fallback });
      res.json(fallback);
      return;
    }

    // Prepare enriched prompt with logistics/destination context
    let enrichedPrompt = trimmedPrompt;
    if (destinationAddress) {
      enrichedPrompt = `[Logistics Delivery Grounding Query]\nTarget Destination: "${destinationAddress}"\nTracking Ref: "${trackingCode || "N/A"}"\nUser Query: ${trimmedPrompt}`;
    }

    const config: Record<string, any> = {
      tools: [{ googleMaps: {} }],
    };

    if (
      location &&
      typeof location.latitude === "number" &&
      typeof location.longitude === "number" &&
      !isNaN(location.latitude) &&
      !isNaN(location.longitude)
    ) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
        },
      };
    }

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: enrichedPrompt,
        config,
      });
    } catch (primaryErr: any) {
      const errMsg = String(primaryErr?.message || primaryErr);
      const isQuotaOrRateLimit = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota");

      if (isQuotaOrRateLimit) {
        console.warn("Gemini API rate limit or quota exceeded (429). Using graceful Google Maps fallback.");
        const fallback = buildFallbackResponse(
          trimmedPrompt,
          destinationAddress,
          location,
          "Gemini API rate limit reached (429 RESOURCE_EXHAUSTED). Graceful Google Maps links engaged."
        );
        // Cache fallback briefly (3 minutes) to avoid repeated failed calls
        cache.set(cacheKey, { timestamp: Date.now() - (CACHE_TTL_MS - 3 * 60 * 1000), data: fallback });
        res.json(fallback);
        return;
      }

      console.warn("Primary gemini-3.5-flash invocation failed, trying fallback model:", errMsg);
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: enrichedPrompt,
          config,
        });
      } catch (fallbackErr: any) {
        console.warn("Fallback model invocation also failed, engaging Google Maps direct fallback:", fallbackErr?.message);
        const fallback = buildFallbackResponse(
          trimmedPrompt,
          destinationAddress,
          location,
          fallbackErr?.message || "AI Service temporarily unavailable."
        );
        cache.set(cacheKey, { timestamp: Date.now() - (CACHE_TTL_MS - 3 * 60 * 1000), data: fallback });
        res.json(fallback);
        return;
      }
    }

    const text = response.text || "";
    const candidate = response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;
    const groundingChunks = (groundingMetadata?.groundingChunks || []) as any[];

    // Extract all place URLs, review snippets, and web links
    const places: Array<{
      title: string;
      uri: string;
      reviewSnippets?: string[];
      source: string;
    }> = [];

    for (const chunk of groundingChunks) {
      if (chunk.maps) {
        const title = chunk.maps.title || "Google Maps Location";
        const uri = chunk.maps.uri || "";
        const reviews: string[] = [];

        if (Array.isArray(chunk.maps.placeAnswerSources?.reviewSnippets)) {
          for (const rev of chunk.maps.placeAnswerSources.reviewSnippets) {
            if (typeof rev === "string" && rev.trim()) {
              reviews.push(rev.trim());
            } else if (rev && typeof rev.snippet === "string" && rev.snippet.trim()) {
              reviews.push(rev.snippet.trim());
            }
          }
        }

        if (uri || title) {
          places.push({
            title,
            uri,
            reviewSnippets: reviews.length > 0 ? reviews : undefined,
            source: "Google Maps",
          });
        }
      } else if (chunk.web && chunk.web.uri) {
        places.push({
          title: chunk.web.title || chunk.web.uri,
          uri: chunk.web.uri,
          source: "Web",
        });
      }
    }

    // Always ensure at least the direct destination link is available if no places were parsed
    if (places.length === 0 && destinationAddress) {
      places.push({
        title: `${destinationAddress} - Google Maps Location`,
        uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationAddress)}`,
        source: "Google Maps",
      });
    }

    const resultData = {
      text,
      places,
      groundingChunks,
      searchQueries: groundingMetadata?.webSearchQueries || [],
    };

    cache.set(cacheKey, { timestamp: Date.now(), data: resultData });
    res.json(resultData);
  } catch (err: any) {
    console.error("Maps grounding API general error:", err);
    // Graceful response instead of 500 crash
    const body = req.body as GroundingPayload | undefined;
    const fallback = buildFallbackResponse(
      body?.prompt || "Location Intelligence",
      body?.destinationAddress,
      body?.location,
      err?.message || "Service temporarily unavailable"
    );
    res.json(fallback);
  }
});

export default router;
