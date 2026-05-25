"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { v2, v2Serif, V2Caps } from "@/components/v2/V2Primitives";

function Toggle({
  label,
  desc,
  on,
  disabled,
}: {
  label: string;
  desc: string;
  on: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex items-start justify-between py-5"
      style={{ borderBottom: `1px solid ${v2.rule}` }}
    >
      <div className="max-w-md">
        <div style={{ fontSize: 14, color: v2.ink, fontWeight: 500 }}>{label}</div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>
          {desc}
        </p>
      </div>
      <div
        className="rounded-full"
        style={{
          height: 24,
          width: 44,
          background: on ? v2.accent : v2.ruleHard,
          position: "relative",
          flexShrink: 0,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <div
          className="rounded-full"
          style={{
            position: "absolute",
            top: 2,
            left: on ? 22 : 2,
            height: 20,
            width: 20,
            background: v2.cream,
            transition: "left 0.2s",
          }}
        />
      </div>
    </div>
  );
}

export default function DataPrivacySection() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleExportData = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    setIsExporting(true);
    try {
      const res = await fetch("/api/user/export-data");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oscar-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export complete" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearData = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    setIsClearing(true);
    try {
      const res = await fetch("/api/user/clear-data", { method: "DELETE" });
      if (!res.ok) throw new Error("Clear failed");
      toast({ title: "Data cleared" });
      setShowClearConfirm(false);
    } catch {
      toast({ title: "Clear failed", variant: "destructive" });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-12">
      {/* What's stored */}
      <section
        className="grid grid-cols-12 gap-6 md:gap-10"
        style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 24 }}
      >
        <div className="col-span-12 md:col-span-3">
          <V2Caps>WHAT&rsquo;S STORED</V2Caps>
        </div>
        <div className="col-span-12 md:col-span-9">
          <Toggle
            label="Audio recordings"
            desc="Audio is discarded by default after transcription. We don't keep recordings on our servers."
            on={false}
            disabled
          />
          <Toggle
            label="Transcripts"
            desc="Cleaned text is stored so the library is searchable."
            on={true}
            disabled
          />
          <Toggle
            label="Telemetry"
            desc="Anonymous usage stats — feature use, crash reports. No content."
            on={true}
            disabled
          />
        </div>
      </section>

      {/* Your data */}
      <section
        className="grid grid-cols-12 gap-6 md:gap-10"
        style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 24 }}
      >
        <div className="col-span-12 md:col-span-3">
          <V2Caps>YOUR DATA</V2Caps>
        </div>
        <div className="col-span-12 md:col-span-9 space-y-4">
          {/* Export */}
          <div
            className="rounded-lg p-5 flex items-start justify-between gap-6 flex-wrap"
            style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
          >
            <div>
              <div style={{ fontFamily: v2Serif, fontSize: 20, fontWeight: 500 }}>
                Export everything
              </div>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
                Download a JSON of every Scribble, every vocabulary entry, every preference.
              </p>
            </div>
            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="text-[12px] rounded-full px-4 py-2 font-medium shrink-0 disabled:opacity-50"
              style={{ background: v2.ink, color: v2.cream }}
            >
              {isExporting ? "Exporting…" : "Start export"}
            </button>
          </div>

          {/* Clear */}
          {!showClearConfirm ? (
            <div
              className="rounded-lg p-5 flex items-start justify-between gap-6 flex-wrap"
              style={{ border: `1px solid ${v2.dangerSoft}` }}
            >
              <div>
                <div
                  style={{
                    fontFamily: v2Serif,
                    fontSize: 20,
                    fontWeight: 500,
                    color: v2.danger,
                  }}
                >
                  Clear all data
                </div>
                <p className="mt-1 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
                  Permanently delete all Scribbles and vocabulary. Account stays. Cannot be
                  undone.
                </p>
              </div>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-[12px] rounded-full px-4 py-2 shrink-0"
                style={{ color: v2.danger, border: `1px solid ${v2.dangerSoft}` }}
              >
                Clear all data
              </button>
            </div>
          ) : (
            <div
              className="rounded-lg p-5"
              style={{ background: "rgba(140,47,37,0.05)", border: `1px solid ${v2.dangerSoft}` }}
            >
              <V2Caps color={v2.danger}>CONFIRM · CANNOT BE UNDONE</V2Caps>
              <p className="mt-2 text-[14px]" style={{ color: v2.ink }}>
                Delete every Scribble and vocabulary entry?
              </p>
              <div className="mt-4 flex gap-2 flex-wrap">
                <button
                  onClick={handleClearData}
                  disabled={isClearing}
                  className="text-[12px] rounded-full px-4 py-2 disabled:opacity-50"
                  style={{ background: v2.danger, color: v2.cream }}
                >
                  {isClearing ? "Clearing…" : "Yes, delete everything"}
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="text-[12px] rounded-full px-4 py-2"
                  style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Legal */}
      <section
        className="grid grid-cols-12 gap-6 md:gap-10"
        style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 24 }}
      >
        <div className="col-span-12 md:col-span-3">
          <V2Caps>LEGAL</V2Caps>
        </div>
        <div className="col-span-12 md:col-span-9 space-y-2">
          {[
            ["Privacy Policy", "/privacy"],
            ["Terms of Service", "/terms"],
            ["Refund Policy", "/refund-policy"],
          ].map(([label, href]) => (
            <a
              key={label as string}
              href={href as string}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between py-3"
              style={{ borderBottom: `1px solid ${v2.rule}`, color: v2.ink }}
            >
              <span style={{ fontFamily: v2Serif, fontSize: 17, fontWeight: 500 }}>{label}</span>
              <ExternalLink className="w-3.5 h-3.5" style={{ color: v2.inkFaint }} />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
