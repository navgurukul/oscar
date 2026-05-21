"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { v2, v2Serif, V2Caps } from "@/components/v2/V2Primitives";

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  periodEnd: string | null;
}

function formatDate(dateString: string | null) {
  if (!dateString) return "the end of your current billing period";
  return new Date(dateString).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const REASONS = [
  "Too expensive",
  "Not using it enough",
  "Found something better",
  "Privacy concerns",
  "Just trying it out",
  "Other",
];

export function CancelSubscriptionModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  periodEnd,
}: CancelSubscriptionModalProps) {
  const [reason, setReason] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,13,10,0.55)", fontFamily: "var(--font-figtree), system-ui" }}
    >
      <div
        className="rounded-2xl overflow-hidden w-full"
        style={{
          background: v2.cream,
          color: v2.ink,
          maxWidth: 560,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div className="px-7 md:px-9 pt-9 pb-9">
          <V2Caps color="#8c2f25">CANCEL SUBSCRIPTION</V2Caps>
          <h1
            className="mt-2"
            style={{
              fontFamily: v2Serif,
              fontSize: 38,
              lineHeight: 1.0,
              letterSpacing: "-0.025em",
              fontWeight: 500,
            }}
          >
            Before you <em style={{ fontStyle: "italic", color: v2.accent }}>go</em>…
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Your Pro plan stays active until <strong>{formatDate(periodEnd)}</strong>. After that
            you&rsquo;ll drop to Free. Existing Scribbles stay yours.
          </p>

          <div className="mt-7">
            <V2Caps>QUICK QUESTION · WHY</V2Caps>
            <div className="mt-3 space-y-2">
              {REASONS.map((r) => {
                const active = reason === r;
                return (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className="w-full text-left rounded-md py-2.5 px-4 text-[13px] transition-colors"
                    style={{
                      background: active ? v2.cream2 : "transparent",
                      border: `1px solid ${active ? v2.accent : v2.rule}`,
                      color: v2.ink,
                    }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="mt-7 rounded-md p-4"
            style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
          >
            <V2Caps color={v2.accent}>BEFORE YOU GO</V2Caps>
            <p className="mt-2 text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>
              We&rsquo;d hate to lose you. Reach out if Oscar isn&rsquo;t working — we read every
              note.
            </p>
            <a
              href="mailto:hello@oscar.ai?subject=Cancellation%20feedback"
              className="mt-3 inline-block text-[12px] rounded-full px-4 py-2"
              style={{ background: v2.ink, color: v2.cream }}
            >
              Tell us what&rsquo;s up
            </a>
          </div>

          <div className="mt-7 flex items-center gap-3 flex-wrap">
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="text-[13px] rounded-full px-5 py-2.5 disabled:opacity-50"
              style={{ color: "#8c2f25", border: "1px solid #d6b3a8" }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 inline mr-2 animate-spin" /> Cancelling…
                </>
              ) : (
                "Cancel anyway"
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="text-[13px]"
              style={{ color: v2.inkSoft }}
            >
              Keep Pro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
