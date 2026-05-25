import type { DictationContextSource } from "../types/scribble.types";

interface ContextLabelProps {
  /** dictation_app_key from scribble metadata. Examples: gmail, notion, slack. */
  appKey?: string | null;
  /** dictation_context_source — site/app -> high confidence; fallback -> low. */
  source?: DictationContextSource | null;
  /** Compact variant for list rows (just app name). */
  variant?: "full" | "compact";
  className?: string;
}

function normalizeAppLabel(key?: string | null): string | null {
  if (!key) return null;
  const trimmed = key.trim();
  if (!trimmed) return null;
  // Replace `-` and `_` with space; uppercase.
  return trimmed.replace(/[-_]/g, " ").toUpperCase();
}

function confidenceFromSource(source?: DictationContextSource | null): "high" | "low" {
  if (source === "site" || source === "app") return "high";
  return "low";
}

/**
 * V2 "Optimized for X" passive label. Reads HIGH-confidence context as
 * terracotta caps; falls back to neutral mono when confidence is low. Never
 * blocks the dictation — purely informational.
 */
export function ContextLabel({
  appKey,
  source,
  variant = "full",
  className = "",
}: ContextLabelProps) {
  const app = normalizeAppLabel(appKey);
  if (!app) return null;
  const confidence = confidenceFromSource(source);
  const isHigh = confidence === "high";

  if (variant === "compact") {
    return (
      <span
        className={`font-mono text-[10px] tracking-[0.16em] uppercase ${
          isHigh ? "text-terracotta" : "text-ink-faint"
        } ${className}`}
      >
        {app}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase ${
        isHigh ? "text-terracotta" : "text-ink-faint"
      } ${className}`}
    >
      <span>OPTIMIZED FOR {app}</span>
      <span className="text-ink-faint">·</span>
      <span className="text-ink-faint">{isHigh ? "HIGH CONFIDENCE" : "NEUTRAL"}</span>
    </span>
  );
}
