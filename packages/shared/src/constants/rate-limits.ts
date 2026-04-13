export const RATE_LIMITS = {
  AI_FORMAT: {
    maxRequests: 20,
    windowMs: 60 * 1000,
    message:
      "Too many formatting requests. Please wait a moment before trying again.",
  },
  AI_TITLE: {
    maxRequests: 30,
    windowMs: 60 * 1000,
    message: "Too many title generation requests. Please wait a moment.",
  },
  AI_FORMAT_EMAIL: {
    maxRequests: 15,
    windowMs: 60 * 1000,
    message: "Too many email formatting requests. Please wait a moment.",
  },
  AI_TRANSLATE: {
    maxRequests: 15,
    windowMs: 60 * 1000,
    message: "Too many translation requests. Please wait a moment.",
  },
  PAYMENT_CREATE_SUBSCRIPTION: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    message: "Too many subscription requests. Please wait before trying again.",
  },
  PAYMENT_WEBHOOK: {
    maxRequests: 100,
    windowMs: 60 * 1000,
    message: "Webhook rate limit exceeded.",
  },
} as const;
