import React, { useState, useEffect } from "react";
import {
  MapPin,
  ExternalLink,
  Sparkles,
  Loader2,
  AlertCircle,
  Zap,
  Clock,
  Car,
  Compass,
  Building,
  RotateCw,
  Search,
  MessageSquareQuote,
  ShieldCheck,
} from "lucide-react";
import {
  queryMapsGrounding,
  type MapsGroundingResult,
  type MapsGroundingPlace,
  type Package as Pkg,
} from "@/lib/api";

interface GoogleMapsGroundingPanelProps {
  pkg: Pkg;
  trackingCode: string;
}

const QUICK_PROMPTS = [
  {
    id: "destination",
    title: "Verify Destination & Access",
    desc: "Check hours, building access, dock & entrance",
    icon: Building,
    prompt:
      "Verify this delivery destination on Google Maps. What is this place, what are its typical operating or receiving hours, where should delivery drivers park or enter, and are there any access restrictions?",
  },
  {
    id: "superchargers",
    title: "Nearby Tesla Superchargers",
    desc: "Find nearest charging stations along the route",
    icon: Zap,
    prompt:
      "Find the nearest Tesla Supercharger or high-speed DC fast charging stations near this destination or route. List their locations, stall counts or speeds if available, and distances.",
  },
  {
    id: "traffic",
    title: "Area Traffic & Road Conditions",
    desc: "Google Maps live congestion & delays",
    icon: Car,
    prompt:
      "What are the typical traffic patterns, ongoing road conditions, and congestion hotspots around this delivery destination right now?",
  },
  {
    id: "landmarks",
    title: "Surrounding Hubs & Landmarks",
    desc: "Key reference points & courier dropoffs",
    icon: Compass,
    prompt:
      "What notable landmarks, transit centers, or distribution hubs surround this delivery location on Google Maps to help identify the dropoff point?",
  },
];

export function GoogleMapsGroundingPanel({ pkg, trackingCode }: GoogleMapsGroundingPanelProps) {
  const [userQuery, setUserQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MapsGroundingResult | null>(null);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);

  // Extract destination coordinates if available in package route
  const lastRoutePoint = pkg.route && pkg.route.length > 0 ? pkg.route[pkg.route.length - 1] : null;
  const destinationCoords = lastRoutePoint ? { latitude: lastRoutePoint[0], longitude: lastRoutePoint[1] } : undefined;
  const destinationAddress = pkg.receiver_address || pkg.destination;

  // Load from sessionStorage if previously queried in this session
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(`maps_grounding_${trackingCode}`);
      if (cached) {
        setResult(JSON.parse(cached));
      }
    } catch {
      // ignore storage errors
    }
  }, [trackingCode]);

  async function handleRunPrompt(promptText: string, promptId?: string) {
    if (!promptText.trim()) return;
    setLoading(true);
    setError(null);
    if (promptId) setActivePromptId(promptId);

    try {
      const res = await queryMapsGrounding({
        prompt: promptText,
        location: destinationCoords,
        destinationAddress,
        trackingCode,
      });

      if (res.ok) {
        setResult(res.data);
        try {
          sessionStorage.setItem(`maps_grounding_${trackingCode}`, JSON.stringify(res.data));
        } catch {
          // ignore storage errors
        }
      } else {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred while grounding with Google Maps.");
    } finally {
      setLoading(false);
    }
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userQuery.trim() || loading) return;
    setActivePromptId(null);
    handleRunPrompt(userQuery);
  }

  // Simple clean markdown parser for the output text
  function renderFormattedText(content: string) {
    const lines = content.split("\n");
    return (
      <div className="space-y-2 text-xs text-white/80 leading-relaxed font-sans">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1.5" />;

          // Headings
          if (trimmed.startsWith("### ")) {
            return (
              <h4 key={idx} className="text-sm font-semibold text-white/95 mt-3 mb-1 text-red-300/90">
                {trimmed.replace(/^###\s*/, "")}
              </h4>
            );
          }
          if (trimmed.startsWith("## ")) {
            return (
              <h3 key={idx} className="text-sm font-bold text-white mt-4 mb-1.5 border-b border-white/10 pb-1">
                {trimmed.replace(/^##\s*/, "")}
              </h3>
            );
          }

          // Bullet points
          if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
            const itemText = trimmed.replace(/^[\*\-]\s+/, "");
            return (
              <div key={idx} className="flex items-start gap-2 pl-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(itemText) }} />
              </div>
            );
          }

          // Regular paragraph
          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }} />
          );
        })}
      </div>
    );
  }

  function formatInlineMarkdown(text: string): string {
    // Bold
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-white/10 text-red-300 font-mono text-[10px]">$1</code>');
    return formatted;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header Banner */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-950/40 via-black/60 to-red-900/20 border border-red-500/20 flex items-start gap-3 shadow-lg">
        <div className="p-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 flex-shrink-0 mt-0.5">
          <MapPin className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white tracking-wide">Google Maps Grounded Intelligence</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-medium">
              LIVE DATA
            </span>
          </div>
          <p className="text-[10px] text-white/50 mt-0.5 line-clamp-1">
            Grounded real-world place & navigation data for {destinationAddress || "this delivery"}
          </p>
        </div>
      </div>

      {/* Target Location Card */}
      <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          <div className="truncate">
            <div className="text-[10px] uppercase font-mono text-white/40">Destination Reference</div>
            <div className="text-xs font-medium text-white truncate">{destinationAddress}</div>
          </div>
        </div>
        {destinationCoords && (
          <div className="text-[9px] font-mono text-white/40 text-right flex-shrink-0">
            {destinationCoords.latitude.toFixed(4)}, {destinationCoords.longitude.toFixed(4)}
          </div>
        )}
      </div>

      {/* Quick Action Prompt Chips */}
      <div>
        <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 font-semibold block mb-2">
          Grounded Insights
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {QUICK_PROMPTS.map((qp) => {
            const Icon = qp.icon;
            const isActive = activePromptId === qp.id;
            return (
              <button
                key={qp.id}
                onClick={() => handleRunPrompt(qp.prompt, qp.id)}
                disabled={loading}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                  isActive
                    ? "bg-red-600/20 border-red-500/40 text-white shadow-md shadow-red-950/30"
                    : "bg-white/[0.03] border-white/8 hover:bg-white/[0.06] hover:border-white/15 text-white/70 hover:text-white"
                } ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div
                  className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${
                    isActive ? "bg-red-500/30 text-red-300" : "bg-white/5 text-white/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold leading-snug">{qp.title}</div>
                  <div className="text-[10px] text-white/40 truncate mt-0.5">{qp.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Query Input */}
      <form onSubmit={handleCustomSubmit} className="relative">
        <input
          type="text"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          placeholder="Ask Google Maps about destination, parking, hours, route..."
          disabled={loading}
          className="w-full pl-9 pr-20 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 transition-colors"
        />
        <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
        <button
          type="submit"
          disabled={loading || !userQuery.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-semibold flex items-center gap-1 transition-all disabled:opacity-40 disabled:hover:bg-red-600"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          <span>Query</span>
        </button>
      </form>

      {/* Initial Empty State */}
      {!result && !loading && !error && (
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white">Google Maps Place Intelligence</div>
            <div className="text-[11px] text-white/50 mt-1 max-w-sm mx-auto">
              Select one of the quick options above or enter a custom prompt to check destination hours, dock access, nearby Tesla Superchargers, or traffic.
            </div>
          </div>
          <button
            onClick={() => handleRunPrompt(QUICK_PROMPTS[0].prompt, QUICK_PROMPTS[0].id)}
            className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors inline-flex items-center gap-1.5 shadow-md shadow-red-950/40"
          >
            <Building className="w-3.5 h-3.5" />
            <span>Verify Destination Access</span>
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/8 flex flex-col items-center justify-center text-center space-y-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-2 border-red-500/20 border-t-red-500 animate-spin flex items-center justify-center" />
            <MapPin className="w-4 h-4 text-red-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div>
            <div className="text-xs font-medium text-white">Retrieving Google Maps Grounded Data...</div>
            <div className="text-[10px] text-white/40 mt-0.5 font-mono">
              Querying place entities & live coordinates with gemini-3.5-flash
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && !loading && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-start gap-2.5 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">Google Maps Grounding Notice</span>
            <span className="text-white/70 text-[11px] leading-normal">{error}</span>
            <div className="mt-2">
              <button
                onClick={() => handleRunPrompt(QUICK_PROMPTS[0].prompt, QUICK_PROMPTS[0].id)}
                className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[10px] font-medium transition-colors"
              >
                Retry Query
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Grounded Text Response */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 shadow-inner">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/8">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/40">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Verified Google Maps Platform Grounding</span>
              </div>
              <button
                onClick={() => handleRunPrompt(activePromptId ? QUICK_PROMPTS.find(p => p.id === activePromptId)?.prompt || userQuery : userQuery)}
                className="text-white/30 hover:text-white/70 transition-colors p-1"
                title="Refresh information"
              >
                <RotateCw className="w-3 h-3" />
              </button>
            </div>
            {result.isRateLimited && (
              <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300/90 text-[11px] flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>AI rate-limit active. Direct Google Maps navigation links & coordinates are provided below.</span>
              </div>
            )}
            {renderFormattedText(result.text)}
          </div>

          {/* Grounded Google Maps Places & Direct URLs — MANDATORY REQUIREMENT */}
          {result.places && result.places.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 font-semibold flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-red-500" />
                  Grounded Google Maps Places ({result.places.length})
                </span>
                <span className="text-[9px] text-white/30">Official Google Maps Links</span>
              </div>

              <div className="space-y-2">
                {result.places.map((place: MapsGroundingPlace, pIdx: number) => (
                  <div
                    key={pIdx}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/8 hover:border-red-500/30 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <div className="p-1 rounded bg-red-600/20 text-red-400 flex-shrink-0 mt-0.5">
                          <MapPin className="w-3 h-3" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white">{place.title}</div>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-white/40 font-mono">
                            {place.source}
                          </span>
                        </div>
                      </div>

                      {place.uri && (
                        <a
                          href={place.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 hover:text-white text-[10px] font-medium flex items-center gap-1 transition-all flex-shrink-0"
                          title="Open in Google Maps"
                        >
                          <span>Open Maps</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>

                    {/* Review Snippets from Google Maps */}
                    {place.reviewSnippets && place.reviewSnippets.length > 0 && (
                      <div className="pl-6 space-y-1">
                        <div className="text-[9px] text-white/40 font-mono flex items-center gap-1">
                          <MessageSquareQuote className="w-2.5 h-2.5 text-amber-400" />
                          <span>Google Maps Review Snippets:</span>
                        </div>
                        {place.reviewSnippets.map((snip, sIdx) => (
                          <div
                            key={sIdx}
                            className="p-2 rounded-lg bg-black/40 border border-white/5 text-[10px] text-white/70 italic"
                          >
                            "{snip}"
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
