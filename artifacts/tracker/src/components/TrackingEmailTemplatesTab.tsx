import { useState, useEffect, useMemo, useRef } from "react";
import {
  Mail, Send, CheckCircle2, AlertCircle, Copy, Check, Eye, Code,
  Smartphone, Monitor, RefreshCw, Sparkles, Truck, Package, Shield,
  Clock, MapPin, User, ChevronRight, FileText, ExternalLink, Loader2
} from "lucide-react";
import {
  fetchEmailTemplates, previewEmailTemplate, sendEmailTemplate, checkSmtpStatus,
  type Package as Pkg, type EmailTemplateMeta, type RenderedTemplate
} from "@/lib/api";

interface TrackingEmailTemplatesTabProps {
  packages: Pkg[];
  initialPackageCode?: string;
  onTrack?: (code: string) => void;
}

export function TrackingEmailTemplatesTab({ packages, initialPackageCode, onTrack }: TrackingEmailTemplatesTabProps) {
  const [templates, setTemplates] = useState<EmailTemplateMeta[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("tesla_vehicle_delivered");
  const [selectedPkgCode, setSelectedPkgCode] = useState<string>(initialPackageCode || (packages[0]?.code ?? ""));
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [previewData, setPreviewData] = useState<RenderedTemplate | null>(null);
  const [rendering, setRendering] = useState(false);

  // Form customization values
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("Alex Morgan");
  const [recipientAddress, setRecipientAddress] = useState("742 Evergreen Terrace, Palo Alto, CA 94301");
  const [trackingCode, setTrackingCode] = useState("TSL-4821-KM");
  const [origin, setOrigin] = useState("Fremont Gigafactory Hub, CA");
  const [destination, setDestination] = useState("Palo Alto, CA");
  const [status, setStatus] = useState("In Transit");
  const [carrier, setCarrier] = useState("Tesla Logistics Express Fleet");
  const [eta, setEta] = useState("Today at 3:30 PM");
  const [deliveryMethod, setDeliveryMethod] = useState("Express Dedicated Ground");
  const [customNotes, setCustomNotes] = useState("Autonomous vehicle escort in progress. Doorstep delivery requested.");
  const [customSubject, setCustomSubject] = useState("");

  // Vehicle-specific customization (Tesla Delivery Template)
  const [vehicleModel, setVehicleModel] = useState("Model 3");
  const [vin, setVin] = useState("5YJ3E1EA7RF123456");
  const [deliveryDate, setDeliveryDate] = useState("Dec 27, 2025");
  const [deliveryLocation, setDeliveryLocation] = useState("Tesla Delivery Center");
  const [vehicleImageUrl, setVehicleImageUrl] = useState("/images/tesla_model_3_delivered.jpg");

  // Preview options
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [viewSource, setViewSource] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);

  // Send state
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; msg: string; simulated?: boolean } | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<{ configured: boolean; user: string | null } | null>(null);

  // Load SMTP status and available templates
  useEffect(() => {
    checkSmtpStatus().then(setSmtpStatus);

    fetchEmailTemplates().then((list) => {
      setTemplates(list);
      if (list.length > 0 && !list.some((t) => t.id === selectedTemplateId)) {
        setSelectedTemplateId(list[0].id);
      }
      setLoadingTemplates(false);
    });
  }, []);

  // Sync with chosen shipment from package dropdown
  useEffect(() => {
    if (!selectedPkgCode) return;
    const pkg = packages.find((p) => p.code === selectedPkgCode);
    if (pkg) {
      setTrackingCode(pkg.code);
      setRecipientName(pkg.receiver_name || "Valued Customer");
      setRecipientEmail(pkg.receiver_email || "");
      setRecipientAddress(pkg.receiver_address || pkg.destination || "");
      setOrigin(pkg.origin || "Fremont Gigafactory Hub, CA");
      setDestination(pkg.destination || "Destination Hub");
      setStatus(pkg.status || "In Transit");
      setCarrier(pkg.carrier || "Tesla Logistics Express");
      setEta(pkg.eta || "Scheduled Today");
      setDeliveryMethod(pkg.delivery_method || "Standard Delivery");

      // Auto-suggest template based on package status
      const s = (pkg.status || "").toLowerCase();
      if (s.includes("deliver") && !s.includes("out")) {
        setSelectedTemplateId("tesla_vehicle_delivered");
      } else if (s.includes("out for delivery")) {
        setSelectedTemplateId("out_for_delivery");
      } else if (s.includes("custom")) {
        setSelectedTemplateId("customs_update");
      } else if (s.includes("transit")) {
        setSelectedTemplateId("in_transit");
      } else {
        setSelectedTemplateId("tesla_vehicle_delivered");
      }
    }
  }, [selectedPkgCode, packages]);

  // Request rendered preview whenever template or form parameters change
  const currentFormData = useMemo(() => ({
    trackingCode,
    recipientName,
    recipientEmail,
    recipientAddress,
    origin,
    destination,
    status,
    carrier,
    eta,
    deliveryMethod,
    customNotes,
    appUrl: window.location.origin,
    vehicleModel,
    vin,
    deliveryDate,
    deliveryLocation,
    vehicleImageUrl,
  }), [
    trackingCode, recipientName, recipientEmail, recipientAddress,
    origin, destination, status, carrier, eta, deliveryMethod, customNotes,
    vehicleModel, vin, deliveryDate, deliveryLocation, vehicleImageUrl
  ]);

  const updatePreview = async () => {
    if (!selectedTemplateId) return;
    setRendering(true);
    const result = await previewEmailTemplate(selectedTemplateId, currentFormData);
    setPreviewData(result);
    setRendering(false);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      updatePreview();
    }, 150);
    return () => clearTimeout(timeout);
  }, [selectedTemplateId, currentFormData]);

  const handleCopyHtml = () => {
    if (!previewData?.rendered.html) return;
    navigator.clipboard.writeText(previewData.rendered.html);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2500);
  };

  const handleSend = async () => {
    const targetEmail = recipientEmail.trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      setSendResult({ success: false, msg: "Please enter a valid recipient email address." });
      return;
    }

    setSending(true);
    setSendResult(null);

    const res = await sendEmailTemplate({
      to: targetEmail,
      templateId: selectedTemplateId,
      data: currentFormData,
      customSubject: customSubject.trim() || undefined,
    });

    setSending(false);

    if (res.success) {
      if (res.simulated) {
        setSendResult({
          success: true,
          simulated: true,
          msg: "Template generated & verified. (SMTP in simulation mode until credentials set in environment).",
        });
      } else {
        setSendResult({
          success: true,
          simulated: false,
          msg: `Dispatched successfully via Gmail SMTP to ${targetEmail}! (Message ID: ${res.messageId})`,
        });
      }
    } else {
      setSendResult({
        success: false,
        msg: res.error || "Failed to dispatch email template.",
      });
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#111] border border-white/6 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-red-600/15 flex items-center justify-center">
              <Mail className="w-3.5 h-3.5 text-red-400" />
            </div>
            <h2 className="text-sm font-semibold text-white/90">Automated Tracking Email Templates</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-500/10 text-red-300 border border-red-500/20">
              Gmail SMTP Ready
            </span>
          </div>
          <p className="text-xs text-white/40 max-w-2xl leading-relaxed">
            Generate, customize, and dispatch responsive dark-mode HTML tracking notifications for every milestone in the shipment lifecycle.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {smtpStatus && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border ${
              smtpStatus.configured
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                : "bg-amber-500/10 border-amber-500/25 text-amber-300"
            }`}>
              <div className={`w-2 h-2 rounded-full ${smtpStatus.configured ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span className="text-[11px] font-medium">
                {smtpStatus.configured ? `Gmail SMTP Connected` : "SMTP Standby (Preview Active)"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Template Selector Carousel */}
      <div>
        <div className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2.5 px-1">
          Select Milestone Template
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {templates.map((tpl) => {
            const isSelected = tpl.id === selectedTemplateId;
            return (
              <button
                key={tpl.id}
                onClick={() => setSelectedTemplateId(tpl.id)}
                className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? "bg-red-950/20 border-red-500/50 shadow-lg shadow-red-950/30"
                    : "bg-[#111] border-white/6 hover:border-white/15 hover:bg-white/2"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <span
                      className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: tpl.badge.bg,
                        color: tpl.badge.color,
                        border: `1px solid ${tpl.badge.border}`,
                      }}
                    >
                      {tpl.badge.label}
                    </span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    )}
                  </div>
                  <div className={`text-xs font-semibold line-clamp-1 ${isSelected ? "text-white" : "text-white/80"}`}>
                    {tpl.name}
                  </div>
                  <div className="text-[10px] text-white/35 mt-1 line-clamp-2 leading-relaxed">
                    {tpl.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Studio Area: Editor (Left) & Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Customization & Dispatch Form */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#111] border border-white/6 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/6">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-400" />
                <span className="text-xs font-semibold text-white/90">Template Configuration</span>
              </div>

              {/* Package selector */}
              {packages.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/30">Auto-fill:</span>
                  <select
                    value={selectedPkgCode}
                    onChange={(e) => setSelectedPkgCode(e.target.value)}
                    className="bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white/80 outline-none focus:border-red-500/50"
                  >
                    <option value="">-- Demo Sample --</option>
                    {packages.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code} ({p.receiver_name || p.destination})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Recipient details */}
            <div className="space-y-3">
              <div className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
                Recipient & Delivery
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-white/30 block mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full bg-black/40 border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/30 block mb-1">Tracking Code</label>
                  <input
                    type="text"
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                    className="w-full bg-black/40 border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder-white/20 outline-none focus:border-red-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/30 block mb-1">Recipient Email (Dispatch Target)</label>
                <div className="relative">
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full bg-black/40 border border-white/8 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/40"
                  />
                  <Mail className="w-3.5 h-3.5 text-white/25 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/30 block mb-1">Destination Address</label>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className="w-full bg-black/40 border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/40"
                />
              </div>
            </div>

            {/* Dedicated Vehicle Specification Details for Tesla Handover Template */}
            {selectedTemplateId === "tesla_vehicle_delivered" && (
              <div className="space-y-3 pt-3 border-t border-red-500/20 bg-red-950/15 p-3.5 rounded-xl border border-red-500/25">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-red-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                    <span>Tesla Vehicle Specifications</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 font-mono">
                    Model 3 Official
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">Vehicle Model</label>
                    <input
                      type="text"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      placeholder="Model 3"
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">Vehicle VIN</label>
                    <input
                      type="text"
                      value={vin}
                      onChange={(e) => setVin(e.target.value.toUpperCase())}
                      placeholder="5YJ3E1EA7RF123456"
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder-white/20 outline-none focus:border-red-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">Delivery Date</label>
                    <input
                      type="text"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      placeholder="Dec 27, 2025"
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">Delivery Location</label>
                    <input
                      type="text"
                      value={deliveryLocation}
                      onChange={(e) => setDeliveryLocation(e.target.value)}
                      placeholder="Tesla Delivery Center"
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-white/40 block mb-1">Hero Image Asset URL</label>
                  <input
                    type="text"
                    value={vehicleImageUrl}
                    onChange={(e) => setVehicleImageUrl(e.target.value)}
                    placeholder="/images/tesla_model_3_delivered.jpg"
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/50 font-mono text-[11px]"
                  />
                </div>
              </div>
            )}

            {/* Logistics details */}
            <div className="space-y-3 pt-2 border-t border-white/6">
              <div className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
                Corridor & Telemetry
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-white/30 block mb-1">Origin Hub</label>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full bg-black/40 border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/30 block mb-1">Destination City</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-black/40 border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-white/30 block mb-1">Estimated Arrival (ETA)</label>
                  <input
                    type="text"
                    value={eta}
                    onChange={(e) => setEta(e.target.value)}
                    className="w-full bg-black/40 border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/30 block mb-1">Carrier Fleet</label>
                  <input
                    type="text"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="w-full bg-black/40 border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/30 block mb-1">Custom Dispatch Note / Gate Code</label>
                <textarea
                  rows={2}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="w-full bg-black/40 border border-white/8 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/40 resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/30 block mb-1">Subject Override (Optional)</label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder={previewData?.rendered.subject || "Default template subject"}
                  className="w-full bg-black/40 border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/40"
                />
              </div>
            </div>

            {/* Actions: Send & Copy */}
            <div className="pt-3 border-t border-white/6 space-y-3">
              <button
                onClick={handleSend}
                disabled={sending || !recipientEmail.includes("@")}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-semibold transition-all shadow-lg shadow-red-950/40"
              >
                {sending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Dispatching via SMTP…</>
                ) : (
                  <><Send className="w-3.5 h-3.5" /> Send Tracking Email Now</>
                )}
              </button>

              {sendResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    sendResult.success
                      ? sendResult.simulated
                        ? "bg-amber-500/10 border-amber-500/25 text-amber-300"
                        : "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                      : "bg-red-500/10 border-red-500/25 text-red-300"
                  }`}
                >
                  {sendResult.success ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold">{sendResult.success ? "Dispatch Status" : "Error"}</div>
                    <div className="text-[11px] opacity-90 mt-0.5">{sendResult.msg}</div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-white/30 px-1 pt-1">
                <span>Direct link to live track:</span>
                {onTrack && trackingCode && (
                  <button
                    onClick={() => onTrack(trackingCode)}
                    className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                  >
                    <span>Inspect {trackingCode}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Email Client Simulator */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          {/* Preview Toolbar */}
          <div className="flex items-center justify-between bg-[#111] border border-white/6 px-4 py-2.5 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/80 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-white/40" />
                <span>Live Email Client Preview</span>
              </span>
              {rendering && <Loader2 className="w-3 h-3 text-red-400 animate-spin" />}
            </div>

            <div className="flex items-center gap-2">
              {/* Desktop / Mobile Switch */}
              <div className="flex items-center bg-black/60 p-0.5 rounded-lg border border-white/8">
                <button
                  onClick={() => setPreviewMode("desktop")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                    previewMode === "desktop" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <Monitor className="w-3 h-3" />
                  <span>Desktop</span>
                </button>
                <button
                  onClick={() => setPreviewMode("mobile")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                    previewMode === "mobile" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Mobile</span>
                </button>
              </div>

              {/* View Source Toggle */}
              <button
                onClick={() => setViewSource(!viewSource)}
                className={`p-1.5 rounded-lg border transition-colors ${
                  viewSource
                    ? "bg-red-500/20 border-red-500/40 text-red-300"
                    : "bg-white/4 border-white/8 text-white/40 hover:text-white/70"
                }`}
                title="Toggle HTML Source"
              >
                <Code className="w-3.5 h-3.5" />
              </button>

              {/* Copy HTML Button */}
              <button
                onClick={handleCopyHtml}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/4 hover:bg-white/8 border border-white/8 text-white/80 text-[10px] font-medium transition-colors"
              >
                {copiedHtml ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedHtml ? "Copied" : "Copy HTML"}</span>
              </button>
            </div>
          </div>

          {/* Mail Client Chrome Wrapper */}
          <div className="bg-[#0b0c10] border border-white/8 rounded-2xl overflow-hidden shadow-2xl flex-1 flex flex-col min-h-[640px]">
            {/* Mock Email Client Header */}
            <div className="bg-[#15171e] px-4 py-3 border-b border-white/8 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="font-semibold text-white/90 truncate flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span>{customSubject.trim() || previewData?.rendered.subject || selectedTemplate?.defaultSubject}</span>
                </div>
                <span className="text-[10px] text-white/30 font-mono">Just now</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/40">
                <div>
                  <span className="text-white/20">From: </span>
                  <span className="text-white/70">Tesla Track Logistics</span>{" "}
                  <span className="text-white/30 font-mono">&lt;dispatch@teslatrack.io&gt;</span>
                </div>
                <div>
                  <span className="text-white/20">To: </span>
                  <span className="text-white/70">{recipientName || "Recipient"}</span>{" "}
                  <span className="text-white/30 font-mono">&lt;{recipientEmail || "customer@example.com"}&gt;</span>
                </div>
              </div>
            </div>

            {/* Email Body Canvas */}
            <div className="flex-1 bg-[#08090c] p-4 flex items-center justify-center overflow-auto">
              {viewSource ? (
                <pre className="w-full h-full text-[11px] font-mono text-white/70 bg-black/80 p-4 rounded-xl overflow-auto border border-white/8 max-h-[580px]">
                  {previewData?.rendered.html || "Generating HTML source..."}
                </pre>
              ) : previewMode === "mobile" ? (
                /* Mobile Phone Frame Simulator */
                <div className="w-[375px] h-[600px] bg-[#13151c] rounded-[36px] p-3 border-4 border-white/15 shadow-2xl relative flex flex-col my-auto overflow-hidden">
                  {/* Phone Speaker Notch */}
                  <div className="w-28 h-4 bg-black rounded-full mx-auto mb-2 flex-shrink-0" />
                  <div className="flex-1 rounded-[24px] overflow-hidden bg-[#08090c]">
                    <iframe
                      srcDoc={previewData?.rendered.html || ""}
                      title="Mobile Email Preview"
                      className="w-full h-full border-0"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>
              ) : (
                /* Desktop Client Container */
                <div className="w-full h-full min-h-[560px] flex items-center justify-center">
                  <iframe
                    srcDoc={previewData?.rendered.html || ""}
                    title="Desktop Email Preview"
                    className="w-full h-[580px] border-0 rounded-xl shadow-lg"
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
