"use client";

import { cn } from "@/lib/utils";

interface UsageIndicatorProps {
  type: "recordings" | "notes" | "vocabulary";
  current: number;
  limit: number | null;
  variant?: "compact" | "full";
}

export function UsageIndicator({
  type,
  current,
  limit,
  variant = "compact",
}: UsageIndicatorProps) {
  // Unlimited (pro user)
  if (limit === null) {
    return (
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 text-xs font-medium bg-cyan-500/20 text-cyan-400 rounded-full">
          Unlimited
        </span>
        {variant === "full" && (
          <span className="text-sm text-gray-400">
            {current}{" "}
            {type === "recordings"
              ? "recordings"
              : type === "notes"
              ? "notes"
              : "vocabulary entries"}{" "}
            {type === "recordings" ? "this month" : "total"}
          </span>
        )}
      </div>
    );
  }

  const percentage = Math.min(100, (current / limit) * 100);
  const remaining = Math.max(0, limit - current);

  // Color based on usage
  const getColor = () => {
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 80) return "bg-yellow-500";
    return "bg-cyan-500";
  };

  const getTextColor = () => {
    if (percentage >= 100) return "text-red-400";
    if (percentage >= 80) return "text-yellow-400";
    return "text-gray-300";
  };

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2">
        <span className={cn("text-sm font-medium", getTextColor())}>
          {current} / {limit}
        </span>
        <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", getColor())}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">
          {type === "recordings"
            ? "Recordings this month"
            : type === "notes"
            ? "Total notes"
            : "Vocabulary entries"}
        </span>
        <span className={cn("font-medium", getTextColor())}>
          {current} / {limit}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">
        {remaining === 0
          ? `Limit reached. Upgrade to Pro for unlimited ${type}.`
          : `${remaining} ${type} remaining`}
      </p>
    </div>
  );
}
