/**
 * Returns `raw` only when it is a safe in-app destination: a path that starts
 * with a single "/" and carries no scheme or authority. This blocks open-
 * redirect vectors such as "//evil.com" (protocol-relative), "https://evil.com",
 * "javascript:..." and the "/\evil.com" backslash trick that some browsers
 * normalise to "//". Anything else falls back to `fallback` ("/" by default).
 *
 * Pure string logic with no imports so it is safe to use from both the edge
 * middleware and client components.
 */
export function sanitizeInternalPath(
  raw: string | null | undefined,
  fallback = "/"
): string {
  if (!raw) return fallback;
  const value = raw.trim();
  const isSafe =
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\") &&
    !value.includes(":");
  return isSafe ? value : fallback;
}
