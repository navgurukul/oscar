"use client";

// Client-side analytics wrapper around posthog-js.
//
// One indirection point so call sites never import posthog directly and we keep
// event names + property shapes in one typed place. posthog-js is a singleton:
// it is initialised once in components/providers/PostHogProvider.tsx, and every
// call here reuses that instance. If PostHog is not configured (no env key) the
// SDK no-ops, so these are always safe to call.
//
// PRIVACY: per the metadata-only telemetry decision, NEVER pass note bodies,
// transcripts, or cleaned text into event properties — counts and durations
// only. The `length` fields below are character counts, not content.

import posthog from "posthog-js";

export const ANALYTICS_EVENTS = {
  RECORDING_STARTED: "recording_started",
  TRANSCRIPTION_COMPLETED: "transcription_completed",
  SCRIBBLE_SAVED: "scribble_saved",
} as const;

type AnalyticsEvent =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/**
 * Capture a product event. Thin guarded wrapper: tolerates posthog being
 * uninitialised (SSR, missing env) so call sites stay one-liners.
 */
export function track(
  event: AnalyticsEvent,
  properties?: Record<string, string | number | boolean | undefined>,
): void {
  try {
    if (typeof window === "undefined") return;
    posthog.capture(event, properties);
  } catch {
    // Telemetry must never break a user flow.
  }
}
