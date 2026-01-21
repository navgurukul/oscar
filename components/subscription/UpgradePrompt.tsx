"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_CONFIG, PRICING } from "@/lib/constants";

interface UpgradePromptProps {
  limitType: "recordings" | "notes";
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
      : SUBSCRIPTION_CONFIG.FREE_MAX_NOTES;

  const handleUpgrade = () => {
    onClose();
    router.push("/pricing");
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-cyan-700/30 rounded-2xl max-w-md w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="text-center space-y-4">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto bg-cyan-500/20 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-cyan-400"
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

          {/* Title */}
          <h2 className="text-xl font-bold text-white">
            {limitType === "recordings"
              ? "Recording Limit Reached"
              : "Note Limit Reached"}
          </h2>

          {/* Description */}
          <p className="text-gray-400">
            You&apos;ve used all{" "}
            <span className="text-white font-medium">{limit}</span>{" "}
            {limitType === "recordings"
              ? "recordings this month"
              : "note slots"}
            . Upgrade to Pro for unlimited {limitType}.
          </p>

          {/* Usage indicator */}
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-400">Current usage</span>
              <span className="text-red-400 font-medium">
                {currentUsage} / {limit}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full w-full" />
            </div>
          </div>

          {/* Pro benefits */}
          <div className="text-left bg-slate-800/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-cyan-400">
              With Pro you get:
            </p>
            <ul className="text-sm text-gray-300 space-y-1">
              <li className="flex items-center gap-2">
                <span className="text-cyan-400">✓</span> Unlimited recordings
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-400">✓</span> Unlimited notes
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-400">✓</span> Priority AI processing
              </li>
            </ul>
          </div>

          {/* Price */}
          <p className="text-gray-400 text-sm">
            Starting at just{" "}
            <span className="text-white font-medium">
              ₹{PRICING.MONTHLY}/month
            </span>
          </p>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Maybe Later
            </Button>
            <Button
              onClick={handleUpgrade}
              className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              Upgrade to Pro
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
