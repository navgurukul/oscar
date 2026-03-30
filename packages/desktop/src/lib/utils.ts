import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get user initials from an email address.
 * Splits on common separators (., _, -, +) and takes the first letter of up to 2 parts.
 */
export function getInitials(email?: string): string {
  if (!email) return "?";
  const local = email.split("@")[0];
  const parts = local.split(/[._\-+]/);
  return (
    parts
      .slice(0, 2)
      .map((p) => (p[0] ?? "").toUpperCase())
      .join("") || (email[0]?.toUpperCase() ?? "?")
  );
}

/**
 * Format a date string for display in note cards.
 * Shows month, day, year, hour, and minute.
 */
export function formatNoteDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format a date string for short display (e.g. trash panel).
 * Shows month and day only.
 */
export function formatShortDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date string for billing display.
 * Shows year, month, and day.
 */
export function formatBillingDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
