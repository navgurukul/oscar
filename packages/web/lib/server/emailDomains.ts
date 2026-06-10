// Generic public email providers — disallowed as auto-join domains. An org
// can't claim everyone with a gmail/yahoo/etc. address. Extend as needed.
// Kept in a separate module so both the POST /api/org route (org creation)
// and the PATCH /api/org/[id] route (later edits) can share the same list.
export const GENERIC_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "zoho.com",
  "yandex.com",
  "mail.com",
  "gmx.com",
  "fastmail.com",
  "tutanota.com",
]);

export function isGenericEmailDomain(domain: string): boolean {
  return GENERIC_EMAIL_DOMAINS.has(domain.toLowerCase());
}
