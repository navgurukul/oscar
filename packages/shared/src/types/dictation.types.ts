export type DictationCategory =
  | "default"
  | "ide"
  | "email"
  | "docs"
  | "chat"
  | "browser";

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
