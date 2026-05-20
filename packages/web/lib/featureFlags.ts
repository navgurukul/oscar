// Public feature flags. NEXT_PUBLIC_* so they inline on the client.
const truthy = new Set(["1", "true", "yes", "on"]);

function flag(value: string | undefined): boolean {
  return truthy.has((value ?? "").toLowerCase().trim());
}

export const FEATURE_FLAGS = {
  ORG_FEATURE_ENABLED: flag(process.env.NEXT_PUBLIC_ORG_FEATURE_ENABLED),
} as const;

export function isOrgFeatureEnabled(): boolean {
  return FEATURE_FLAGS.ORG_FEATURE_ENABLED;
}
