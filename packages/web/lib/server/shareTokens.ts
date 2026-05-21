import { randomBytes } from "crypto";

/**
 * URL-safe random token used in /s/{token} and /m/{token} public viewer URLs.
 * 22 chars of base64url ≈ 132 bits of entropy — enough that enumeration is
 * not viable even if RLS ever loosens around the public row.
 */
export function mintPublicShareToken(): string {
  return randomBytes(16).toString("base64url");
}

export type Visibility = "private" | "org" | "public";

export function isVisibility(value: unknown): value is Visibility {
  return value === "private" || value === "org" || value === "public";
}
