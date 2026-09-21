import React, { useState } from "react";
import {
  Printer, X, Copy, Check, QrCode, Mail,
  ShieldCheck, ArrowRight, Loader2, Sparkles, MapPin, Truck
} from "lucide-react";
import type { Package as Pkg } from "@/lib/api";

interface DeliveryEstimate {
  fullEstimate: string;
  shortEstimate: string;
  remainingDistanceKm: number;
  etaDate: string;
}

interface PrintShippingLabelModalProps {
  pkg: Pkg;
  code: string;
  deliveryEstimate: DeliveryEstimate;
  onClose: () => void;
  onOpenTemplates: () => void;
}

/**
 * Procedural barcode generator creating authentic variable-width bars
 * based on the character pattern of the tracking code.
 */
function BarcodeSVG({ value }: { value: string }) {
  const cleanVal = (value || "TSL-4821-KM").toUpperCase();
  const bars: { width: number; space: number }[] = [];

  // Generate deterministic bar widths from character ASCII codes
  for (let i = 0; i < cleanVal.length; i++) {
    const code = cleanVal.charCodeAt(i);
    bars.push({ width: (code % 3) + 1.6, space: ((code * 3) % 3) + 1.4 });
    bars.push({ width: ((code * 2) % 4) + 1.2, space: 1.6 });
  }

  let currentX = 8;
  return (
    <div className="flex flex-col items-center w-full">
      <svg
        viewBox="0 0 280 62"
        className="w-full max-w-[280px] h-14"
        style={{ shapeRendering: "crispEdges" }}
      >
        {bars.map((bar, idx) => {
          const x = currentX;
          currentX += bar.width + bar.space;
          return (
            <rect
              key={idx}
              x={x}
              y="3"
              width={bar.width}
              height="52"
              fill="#000000"
            />
          );
        })}
      </svg>
      <span className="font-mono text-xs font-black tracking-[0.25em] text-black mt-1 select-all">
        *{cleanVal}*
      </span>
    </div>
  );
}

export function PrintShippingLabelModal({
  pkg,
  code,
  deliveryEstimate,
  onClose,
  onOpenTemplates,
}: PrintShippingLabelModalProps) {
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const cleanCode = (code || "TSL-4821-KM").toUpperCase();
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const currentTimestamp = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    setIsPrinting(true);
    const printableArea = document.getElementById("shipping-label-printable-area");
    if (!printableArea) {
      window.print();
      setIsPrinting(false);
      return;
    }

    try {
      const printIframe = document.createElement("iframe");
      printIframe.style.position = "fixed";
      printIframe.style.right = "0";
      printIframe.style.bottom = "0";
      printIframe.style.width = "0";
      printIframe.style.height = "0";
      printIframe.style.border = "0";
      document.body.appendChild(printIframe);

      const doc = printIframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Tesla Logistics Shipping Label - ${cleanCode}</title>
              <style>
                @page { size: 4in 6in; margin: 0.15in; }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                  background: #ffffff;
                  color: #000000;
                  padding: 10px;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                .label-wrapper {
                  width: 100%;
                  max-width: 440px;
                  margin: 0 auto;
                  border: 2px solid #000000;
                  padding: 16px;
                  background: #ffffff;
                }
                .text-red-600 { color: #dc2626 !important; }
                .bg-neutral-100 { background-color: #f3f4f6 !important; }
                .bg-neutral-50 { background-color: #fafafa !important; }
              </style>
            </head>
            <body>
              <div class="label-wrapper">
                ${printableArea.innerHTML}
              </div>
            </body>
          </html>
        `);
        doc.close();
        printIframe.contentWindow?.focus();
        setTimeout(() => {
          try {
            printIframe.contentWindow?.print();
          } catch {
            window.print();
          }
          setTimeout(() => {
            if (document.body.contains(printIframe)) {
              document.body.removeChild(printIframe);
            }
            setIsPrinting(false);
          }, 1000);
        }, 350);
        return;
      }
    } catch {
      // Fallback to window.print if iframe isolation fails
    }

    window.print();
    setIsPrinting(false);
  };

  return (
    <div
      id="print-label-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#111215] border border-white/10 rounded-2xl shadow-2xl max-w-xl w-full my-auto flex flex-col overflow-hidden max-h-[94vh]">
        {/* Modal Toolbar Header */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-black/50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 flex-shrink-0">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Shipping Waybill Label</h3>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
                  Thermal 4" × 6"
                </span>
              </div>
              <p className="text-[10px] text-white/40">Official carrier summary &amp; barcode for {cleanCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              id="modal-header-print-btn"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-900/30 transition-all cursor-pointer"
              title="Print Shipping Label"
            >
              {isPrinting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              <span>Print Label</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Canvas with Print Media container */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex justify-center bg-[#070709]">
          {/* Printable Label Container */}
          <div
            id="shipping-label-printable-area"
            className="w-full max-w-[430px] bg-white text-black rounded-lg border-2 border-black p-4 sm:p-5 shadow-2xl font-sans select-text text-left"
            style={{ minHeight: "560px" }}
          >
            {/* Header / Carrier identity */}
            <div className="flex items-start justify-between border-b-2 border-black pb-2.5 mb-2.5">
              <div className="flex items-center gap-2.5">
                <img
                  src="https://img.icons8.com/?size=100&id=OinYGm0fZ470&format=png&color=000000"
                  alt="Tesla Logistics"
                  className="w-8 h-8 object-contain flex-shrink-0"
                />
                <div>
                  <div className="text-base sm:text-lg font-black tracking-wider text-black flex items-center gap-1 uppercase">
                    TESLA<span className="text-red-600">LOGISTICS</span> EXPRESS
                  </div>
                  <div className="text-[9px] font-mono tracking-widest text-neutral-600 uppercase mt-0.5 font-bold">
                    AUTONOMOUS FLEET PRIORITY WAYBILL
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block bg-black text-white text-[9px] font-extrabold px-2 py-0.5 uppercase tracking-wider rounded-sm">
                  PRIORITY 1
                </span>
                <div className="text-[9px] font-mono font-bold text-neutral-800 mt-1">
                  ZONE: 04 · AIR/GND
                </div>
              </div>
            </div>

            {/* Routing / Sorting Block */}
            <div className="grid grid-cols-3 gap-2 border-b-2 border-black pb-2 mb-2.5 bg-neutral-100 p-2 rounded">
              <div>
                <div className="text-[7.5px] font-bold uppercase text-neutral-500">ORIGIN HUB</div>
                <div className="text-[11px] font-black font-mono text-black truncate">{pkg.origin.split(",")[0]}</div>
              </div>
              <div className="text-center border-x border-neutral-300 px-1">
                <div className="text-[7.5px] font-bold uppercase text-neutral-500">DEST CODE</div>
                <div className="text-[12px] font-black font-mono text-black">
                  {pkg.destination.split(",")[1]?.trim() || "CA"}-{pkg.destination.slice(0, 3).toUpperCase()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[7.5px] font-bold uppercase text-neutral-500">DESTINATION</div>
                <div className="text-[11px] font-black font-mono text-black truncate">{pkg.destination.split(",")[0]}</div>
              </div>
            </div>

            {/* Shipper & Consignee Parties */}
            <div className="grid grid-cols-2 gap-3 border-b-2 border-black pb-2.5 mb-2.5 text-[10px]">
              {/* Ship From */}
              <div className="border-r border-neutral-300 pr-2">
                <div className="text-[7.5px] font-black uppercase text-neutral-500 tracking-wider mb-0.5">
                  SHIP FROM:
                </div>
                <div className="font-bold text-black text-[11px] leading-tight">
                  {pkg.sender_name || "Tesla Central Distribution"}
                </div>
                <div className="text-neutral-700 leading-snug mt-0.5 text-[9.5px]">
                  {pkg.sender_address || pkg.origin}
                </div>
                <div className="text-neutral-600 font-mono text-[8.5px] mt-1">
                  TEL: {pkg.sender_phone || "+1 (800) 613-8840"}
                </div>
              </div>

              {/* Ship To */}
              <div className="pl-1">
                <div className="text-[7.5px] font-black uppercase text-neutral-500 tracking-wider mb-0.5">
                  SHIP TO (CONSIGNEE):
                </div>
                <div className="font-bold text-black text-[11px] leading-tight">
                  {pkg.receiver_name || "Consignee on Record"}
                </div>
                <div className="text-neutral-900 font-semibold leading-snug mt-0.5 text-[9.5px]">
                  {pkg.receiver_address || pkg.destination}
                </div>
                <div className="text-neutral-600 font-mono text-[8.5px] mt-1">
                  TEL: {pkg.receiver_phone || "+1 (555) 019-2834"}
                </div>
              </div>
            </div>

            {/* Tracking Code and Barcode Box */}
            <div className="border-2 border-black rounded p-2 mb-2.5 bg-white text-center">
              <div className="flex items-center justify-between text-[8.5px] font-mono text-neutral-600 mb-1 border-b border-neutral-200 pb-1">
                <span className="font-bold text-black uppercase tracking-wider">CARRIER SCAN BARCODE</span>
                <span className="font-bold text-red-600">{pkg.status}</span>
              </div>

              {/* Barcode SVG */}
              <div className="py-0.5">
                <BarcodeSVG value={cleanCode} />
              </div>

              <div className="text-[8px] font-bold text-neutral-500 tracking-wider uppercase mt-0.5">
                TESLA AUTONOMOUS DISPATCH SCANNER COMPLIANT
              </div>
            </div>

            {/* Shipment Specifications Matrix */}
            <div className="grid grid-cols-4 gap-1.5 border-b-2 border-black pb-2 mb-2.5 text-center">
              <div className="bg-neutral-100 p-1.5 rounded">
                <div className="text-[7.5px] font-bold text-neutral-500 uppercase">WEIGHT</div>
                <div className="text-[10.5px] font-black font-mono text-black mt-0.5">{pkg.weight || "2.5 KG"}</div>
              </div>
              <div className="bg-neutral-100 p-1.5 rounded">
                <div className="text-[7.5px] font-bold text-neutral-500 uppercase">PIECES</div>
                <div className="text-[10.5px] font-black font-mono text-black mt-0.5">1 PKG</div>
              </div>
              <div className="bg-neutral-100 p-1.5 rounded">
                <div className="text-[7.5px] font-bold text-neutral-500 uppercase">SERVICE</div>
                <div className="text-[10px] font-black font-mono text-black mt-0.5 truncate">{pkg.delivery_method || "EXPRESS"}</div>
              </div>
              <div className="bg-neutral-100 p-1.5 rounded">
                <div className="text-[7.5px] font-bold text-neutral-500 uppercase">CUSTOMS</div>
                <div className="text-[10px] font-black font-mono text-black mt-0.5 truncate">{pkg.customs_status || "CLEARED"}</div>
              </div>
            </div>

            {/* Delivery Date & Summary */}
            <div className="border border-black p-2 mb-2 rounded flex items-center justify-between bg-neutral-50">
              <div>
                <div className="text-[7.5px] font-bold uppercase text-neutral-600">SCHEDULED ARRIVAL / ETA</div>
                <div className="text-[11.5px] font-black font-mono text-black mt-0.5">
                  {deliveryEstimate.fullEstimate || pkg.eta}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[7.5px] font-bold uppercase text-neutral-600">DECLARED VALUE</div>
                <div className="text-[11.5px] font-black font-mono text-black mt-0.5">
                  ${Number(pkg.shipping_cost || 45.00).toFixed(2)} USD
                </div>
              </div>
            </div>

            {/* Regulatory & Safety Compliance Notice */}
            <div className="text-[7px] text-neutral-600 leading-tight border-b border-neutral-300 pb-1.5 mb-1.5 font-mono">
              <strong>SPECIAL HANDLING:</strong> AUTONOMOUS LOGISTICS · TEMPERATURE CONTROLLED (18°-22°C) · RECIPIENT SIGNATURE REQUIRED · LITHIUM-ION BATTERY COMPLIANT (UN 3481)
            </div>

            {/* Footer Waybill Info & QR matrix */}
            <div className="flex items-center justify-between pt-0.5">
              <div className="text-[7.5px] font-mono text-neutral-500 leading-tight">
                <div>WAYBILL REF: TSL-{cleanCode.slice(-4)}-{Date.now().toString(36).slice(-4).toUpperCase()}</div>
                <div>GENERATED: {currentTimestamp}</div>
                <div>CARRIER: {pkg.carrier || "TESLA LOGISTICS FREMONT"}</div>
              </div>
              <div className="w-11 h-11 border border-black p-0.5 flex items-center justify-center bg-white flex-shrink-0">
                <QrCode className="w-9 h-9 text-black" />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 py-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 bg-black/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/75 hover:text-white text-xs font-medium transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy Code"}</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenTemplates();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/75 hover:text-white text-xs font-medium transition-all cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-blue-400" />
              <span>Tracking Mail Template</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition-all cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              id="modal-footer-print-btn"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-900/30 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Label</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
