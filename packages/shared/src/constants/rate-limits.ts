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
  PAYMENT_CANCEL: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    message: "Too many cancel requests. Please wait before trying again.",
  },
  PAYMENT_VERIFY: {
    maxRequests: 20,
    windowMs: 60 * 1000,
    message: "Too many verification requests. Please wait a moment.",
  },
  USER_DESTRUCTIVE: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000,
    message: "Too many account-destructive requests. Please wait before retrying.",
  },
  USAGE_WRITE: {
    maxRequests: 120,
    windowMs: 60 * 1000,
    message: "Too many usage updates. Please slow down.",
  },
  AI_CONTEXT: {
    maxRequests: 30,
    windowMs: 60 * 1000,
    message: "Too many context requests. Please wait a moment.",
  },
  ORG_WRITE: {
    maxRequests: 30,
    windowMs: 60 * 1000,
    message: "Too many workspace updates. Please slow down.",
  },
  ORG_INVITE: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000,
    message: "Too many invitations sent. Please wait before sending more.",
  },
  SHARE_LINK: {
    maxRequests: 20,
    windowMs: 60 * 1000,
    message: "Too many share-link requests. Please wait a moment.",
  },
} as const;
