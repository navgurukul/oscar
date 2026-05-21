"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_CONFIG, PRICING, PRICING_USD } from "@/lib/constants";

interface UpgradePromptProps {
  limitType: "recordings" | "scribbles" | "vocabulary";
  currentUsage: number;
  onClose: () => void;
}

export function UpgradePrompt({
  limitType,
  currentUsage,
  onClose,
}: UpgradePromptProps) {
  const router = useRouter();

  const limit =
    limitType === "recordings"
      ? SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS
      : limitType === "scribbles"
      ? SUBSCRIPTION_CONFIG.FREE_MAX_SCRIBBLES
      : SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY;

  const handleUpgrade = () => {
    onClose();
    router.push("/pricing");
  };

  const titleMap = {
    recordings: "Recording limit reached",
    scribbles: "Scribble limit reached",
    vocabulary: "Vocabulary limit reached",
  } as const;

  const unitMap = {
    recordings: "Scribble recordings this month",
    scribbles: "Scribble slots",
    vocabulary: "vocabulary entries",
  } as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,13,10,0.55)" }}
    >
      <div
        className="rounded-2xl max-w-md w-full p-7 relative"
        style={{ background: "#f7f4ee", border: "1px solid #e5e0d6", color: "#1a1816" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 transition-colors"
          style={{ color: "#8b8780" }}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-4">
          <div
            className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
            style={{ background: "rgba(184,98,61,0.12)" }}
          >
            <svg
              className="w-8 h-8"
              style={{ color: "#b8623d" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>

          <h2
            style={{
              fontFamily: '"EB Garamond", Georgia, serif',
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: "-0.015em",
              color: "#1a1816",
            }}
          >
            {titleMap[limitType]}
          </h2>

          <p className="text-sm" style={{ color: "#5a5852" }}>
            You&rsquo;ve used all <span style={{ color: "#1a1816", fontWeight: 500 }}>{limit}</span>{" "}
            {unitMap[limitType]}. Upgrade to Pro for unlimited {limitType}.
          </p>

          <div
            className="rounded-lg p-4"
            style={{ background: "#efeae0", border: "1px solid #e5e0d6" }}
          >
            <div className="flex items-center justify-between text-sm mb-2">
              <span style={{ color: "#5a5852" }}>Current usage</span>
              <span style={{ color: "#b8623d", fontWeight: 500 }}>
                {currentUsage} / {limit}
              </span>
            </div>
            <div
              className="w-full h-1.5 rounded-full overflow-hidden"
              style={{ background: "#e5e0d6" }}
            >
              <div className="h-full w-full" style={{ background: "#b8623d" }} />
            </div>
          </div>

          <div
            className="text-left rounded-lg p-4 space-y-2"
            style={{ background: "#efeae0", border: "1px solid #e5e0d6" }}
          >
            <p
              className="text-xs"
              style={{
                fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#b8623d",
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              WITH PRO YOU GET
            </p>
            <ul className="text-sm space-y-1" style={{ color: "#1a1816" }}>
              {[
                "Unlimited Scribble recordings",
                "Unlimited Scribbles",
                "Unlimited vocabulary entries",
                "Priority AI processing",
              ].map((line) => (
                <li key={line} className="flex items-center gap-2">
                  <span style={{ color: "#b8623d" }}>✓</span> {line}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm" style={{ color: "#5a5852" }}>
            Starting at{" "}
            <span style={{ color: "#1a1816", fontWeight: 500 }}>
              ₹{PRICING.MONTHLY}/month (~${PRICING_USD.MONTHLY}/month)
            </span>
          </p>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              style={{ background: "transparent", border: "1px solid #e5e0d6", color: "#5a5852" }}
            >
              Maybe later
            </Button>
            <Button
              onClick={handleUpgrade}
              className="flex-1"
              style={{ background: "#1a1816", color: "#f7f4ee" }}
            >
              Upgrade to Pro
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
