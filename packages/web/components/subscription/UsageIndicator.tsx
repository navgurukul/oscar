"use client";

import { v2 } from "@/components/v2/V2Primitives";

interface UsageIndicatorProps {
  type: "recordings" | "scribbles" | "vocabulary";
  current: number;
  limit: number | null;
  variant?: "compact" | "full";
}

const LABEL = {
  recordings: "Scribble recordings",
  scribbles: "Scribbles",
  vocabulary: "vocabulary entries",
} as const;

const FULL_HEADING = {
  recordings: "Scribble recordings this month",
  scribbles: "Total Scribbles",
  vocabulary: "Vocabulary entries",
} as const;

const WARN = v2.accent;
const DANGER = v2.danger;

export function UsageIndicator({
  type,
  current,
  limit,
  variant = "compact",
}: UsageIndicatorProps) {
  if (limit === null) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="px-2 py-0.5 text-xs font-medium rounded-full"
          style={{ background: v2.accentSoft, color: v2.accent }}
        >
          Unlimited
        </span>
        {variant === "full" && (
          <span className="text-sm" style={{ color: v2.inkSoft }}>
            {current} {LABEL[type]} {type === "recordings" ? "this month" : "total"}
          </span>
        )}
      </div>
    );
  }

  const percentage = Math.min(100, (current / limit) * 100);
  const remaining = Math.max(0, limit - current);

  const fillColor = percentage >= 100 ? DANGER : percentage >= 80 ? WARN : v2.accent;
  const valueColor = percentage >= 100 ? DANGER : percentage >= 80 ? WARN : v2.ink;

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" style={{ color: valueColor }}>
          {current} / {limit}
        </span>
        <div
          className="w-16 h-1.5 rounded-full overflow-hidden"
          style={{ background: v2.rule }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${percentage}%`, background: fillColor }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: v2.inkSoft }}>{FULL_HEADING[type]}</span>
        <span className="font-medium" style={{ color: valueColor }}>
          {current} / {limit}
        </span>
      </div>
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{ background: v2.rule }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percentage}%`, background: fillColor }}
        />
      </div>
      <p className="text-xs" style={{ color: v2.inkFaint }}>
        {remaining === 0
          ? `Limit reached. Upgrade to Pro for unlimited ${LABEL[type]}.`
          : `${remaining} ${LABEL[type]} remaining`}
      </p>
    </div>
  );
}
