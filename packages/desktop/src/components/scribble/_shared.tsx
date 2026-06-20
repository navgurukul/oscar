import React from "react";
import type { DBScribble } from "../../types/scribble.types";

// Mono all-caps caption — the same token the rest of the Scribble surface uses.
export function Caps({
  children,
  tone = "faint",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "faint" | "ink" | "terra";
  className?: string;
}) {
  const toneClass =
    tone === "terra"
      ? "text-terracotta"
      : tone === "ink"
        ? "text-ink"
        : "text-ink-faint";
  return (
    <span
      className={`font-mono text-[10px] tracking-[0.18em] uppercase ${toneClass} ${className}`}
    >
      {children}
    </span>
  );
}

/** The canonical readable body: user edit if present, else Oscar's clean text. */
export function cleanBody(s: DBScribble): string {
  return s.edited_text || s.original_formatted_text || "";
}
