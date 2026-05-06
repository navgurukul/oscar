export const DICTATION_CATEGORIES = [
  "default",
  "ide",
  "email",
  "docs",
  "chat",
  "browser",
] as const;

export type DictationCategory = (typeof DICTATION_CATEGORIES)[number];

export const DICTATION_PROMPT_VERSION = "context-v1" as const;

export const DICTATION_CATEGORY_LABELS: Record<DictationCategory, string> = {
  default: "Default",
  ide: "IDE",
  email: "Email",
  docs: "Docs",
  chat: "Chat",
  browser: "Browser",
} as const;

export const DICTATION_CATEGORY_DESCRIPTIONS: Record<DictationCategory, string> = {
  default: "General cleanup when no reliable app or site context is available.",
  ide: "Task-like cleanup for coding tools that preserves code, paths, errors, and CLI details.",
  email: "Professional prose cleanup for email clients without inventing greetings or sign-offs.",
  docs: "Structured prose cleanup for notes, documents, and knowledge-base tools.",
  chat: "Compact conversational cleanup for send-ready chat messages.",
  browser: "Minimal cleanup for search, form-fill, and general browser input.",
} as const;

export function isDictationCategory(
  value?: string | null,
): value is DictationCategory {
  return DICTATION_CATEGORIES.includes(value as DictationCategory);
}

export type DictationContextSource = "app" | "site" | "fallback";

export type DictationRoutingConfidence = "high" | "medium" | "low";

export interface DictationContextSnapshot {
  platform: string;
  appName: string;
  appId?: string | null;
  processName?: string | null;
  windowTitle?: string | null;
  siteHost?: string | null;
  siteTitle?: string | null;
  capturedAt: string;
}

export interface DictationRoutingResult {
  category: DictationCategory;
  appKey: string;
  source: DictationContextSource;
  confidence: DictationRoutingConfidence;
  promptVersion: string;
}
