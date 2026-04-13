export const SUBSCRIPTION_CONFIG = {
  FREE_MONTHLY_RECORDINGS: 10,
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
