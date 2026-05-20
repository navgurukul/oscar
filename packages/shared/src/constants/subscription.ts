export const SUBSCRIPTION_CONFIG = {
  FREE_MONTHLY_RECORDINGS: 10,
  // Free org tier: shared recording quota across every workspace member.
  // Each member's recording (web + desktop) increments the same counter.
  FREE_ORG_MONTHLY_RECORDINGS: 25,
  FREE_MAX_SCRIBBLES: 20,
  // Semantic alias used by getSubscriptionEntitlement — the product calls
  // Notes "Scribbles" now, so both names point at the same cap.
  FREE_MAX_NOTES: 20,
  FREE_MAX_VOCABULARY: 5,
} as const;

export const PRICING = {
  MONTHLY: 99,
  YEARLY: 990,
  YEARLY_SAVINGS_PERCENT: 17,
  CURRENCY: "INR",
} as const;

export const PRICING_USD = {
  MONTHLY: 1,
  YEARLY: 10,
  YEARLY_SAVINGS_PERCENT: 17,
  CURRENCY: "USD",
} as const;

export type Currency = "INR" | "USD";

export type SubscriptionTier = "free" | "pro";

export type SubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired"
  | "paused"
  | "past_due";

export interface SubscriptionEntitlementInput {
  tier?: string | null;
  status?: string | null;
  currentPeriodEnd?: string | Date | null;
  current_period_end?: string | Date | null;
}

export interface SubscriptionEntitlement {
  isPro: boolean;
  isCancelling: boolean;
  recordingsLimit: number | null;
  notesLimit: number | null;
  vocabularyLimit: number | null;
}

export const ACTIVE_PRO_SUBSCRIPTION_STATUSES = [
  "active",
  "authenticated",
  "created",
] as const satisfies readonly SubscriptionStatus[];

export function isActiveProSubscriptionStatus(
  status?: string | null,
): boolean {
  return ACTIVE_PRO_SUBSCRIPTION_STATUSES.includes(
    status as (typeof ACTIVE_PRO_SUBSCRIPTION_STATUSES)[number],
  );
}

export function isFutureBillingPeriodEnd(
  value?: string | Date | null,
  now = new Date(),
): boolean {
  if (!value) return false;

  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();

  return Number.isFinite(time) && time > now.getTime();
}

export function isCancelledSubscriptionInGracePeriod(
  subscription: SubscriptionEntitlementInput,
  now = new Date(),
): boolean {
  const periodEnd =
    subscription.currentPeriodEnd ?? subscription.current_period_end;

  return (
    subscription.status === "cancelled" &&
    isFutureBillingPeriodEnd(periodEnd, now)
  );
}

export function getSubscriptionEntitlement(
  subscription: SubscriptionEntitlementInput | null | undefined,
  now = new Date(),
): SubscriptionEntitlement {
  const isCancelling = subscription
    ? isCancelledSubscriptionInGracePeriod(subscription, now)
    : false;

  const isPro =
    !!subscription &&
    ((subscription.tier === "pro" &&
      isActiveProSubscriptionStatus(subscription.status)) ||
      // Cancellation keeps paid access until the paid period ends, even if an
      // older webhook has already drifted the tier field back to free.
      isCancelling);

  return {
    isPro,
    isCancelling,
    recordingsLimit: isPro ? null : SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS,
    notesLimit: isPro ? null : SUBSCRIPTION_CONFIG.FREE_MAX_NOTES,
    vocabularyLimit: isPro ? null : SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY,
  };
}
