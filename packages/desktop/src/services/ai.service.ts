import { supabase } from "../supabase";
import { getValidAccessToken } from "../lib/auth-session";
import { orgContextService } from "./orgContext.service";
import { applyTranscriptPostProcessing } from "@oscar/shared/prompts";
import { API_CONFIG, MEETING_CONFIG } from "@oscar/shared/constants";
import { WEB_APP_URL } from "../lib/web-app-url";
import type {
  EnhancedMeetingNoteRequest,
  EnhancedMeetingNoteResponse,
  MeetingTranscriptSegment,
} from "../types/meeting.types";
import type {
  DictationContextSnapshot,
  DictationRoutingResult,
} from "../types/scribble.types";
import type { CleanupStyleWire } from "../lib/cleanup-style";

export type DesktopAIMode =
  | "transcribe_cleanup"
  | "cleanup"
  | "summary"
  | "bullets"
  | "email"
  | "meeting_notes";
type AIProcessPromptProfile = "stream";

interface AIProcessResponse {
  text?: string;
  error?: string;
}

interface AIProcessRequest {
  text: string;
  mode: DesktopAIMode;
  context?: DictationContextSnapshot;
  routing?: DictationRoutingResult;
  promptProfile?: AIProcessPromptProfile;
  // User-chosen cleanup style (or the ephemeral prompt-engineer override).
  // Only meaningful for transcribe_cleanup; the edge function ignores it for
  // other modes. Missing = faithful (today's behaviour).
  stylePreset?: CleanupStyleWire;
  // Workspace context (active-org vocabulary + reference docs) packaged by
  // orgContextService. Appended to the Mercury system prompt when present.
  orgContextBlock?: string;
  // User-selected transcription language code (e.g. "hi", "hi-en", "en", "auto").
  // Tells Mercury 2 cleanup to preserve Devanagari for "hi", apply Hinglish
  // spelling rules for "hi-en", or standard English cleanup for "en".
  // Missing/empty = edge function auto-detects from text content.
  language?: string;
}

/**
 * Per-call wire-level timing for an `ai-process` invocation. All values are
 * milliseconds. Populated best-effort from `PerformanceResourceTiming` for the
 * matching Supabase functions URL — when the entry is missing (eg. it was
 * evicted from the buffer or the runtime doesn't surface it) we still emit
 * `prep` and `roundtrip` from `performance.now()` deltas so the caller gets a
 * usable wall-clock number.
 */
export interface AIProcessTiming {
  /** Pre-invoke prep (auth lookup, JSON serialisation, supabase client work). */
  prepMs: number;
  /** Wall-clock for the entire `supabase.functions.invoke` call. */
  roundtripMs: number;
  /** DNS lookup ms for the matched resource entry. `undefined` if not found. */
  dnsMs?: number;
  /** TCP connect ms. `undefined` if not found or connection reused. */
  tcpMs?: number;
  /** TLS handshake ms. `undefined` if not found or connection reused. */
  tlsMs?: number;
  /**
   * Time-to-first-byte (responseStart - requestStart). Closest local proxy
   * for "server compute + queue + outbound network" — when this dominates
   * `roundtripMs`, the slowness is server-side, not client-side.
   */
  ttfbMs?: number;
  /** Body download time (responseEnd - responseStart). */
  downloadMs?: number;
  /** True when a PerformanceResourceTiming entry was matched. */
  matchedResource: boolean;
}

const EDGE_FUNCTION_FETCH_ERROR = "Failed to send a request to the Edge Function";
const EDGE_FUNCTION_RELAY_ERROR = "Relay Error invoking the Edge Function";
const EDGE_FUNCTION_NON_2XX_ERROR = "Edge Function returned a non-2xx status code";
const NO_USABLE_MEETING_NOTES_ERROR = "NO_USABLE_MEETING_NOTES";
const NON_SUBSTANTIVE_BULLET_RE =
  /^(none captured|no (specific )?.*captured|not captured|n\/a)\.?$/i;
const {
  MAX_REQUEST_SEGMENTS: MAX_MEETING_REQUEST_SEGMENTS,
  MAX_REQUEST_CHARS: MAX_MEETING_REQUEST_CHARS,
  MAX_COMPACTED_SEGMENT_CHARS,
  MAX_COMPACTED_GAP_MS,
  FALLBACK_SOURCE_CHARS: MEETING_FALLBACK_SOURCE_CHARS,
} = MEETING_CONFIG;

// Common Whisper hallucinations emitted on silence / background noise. The
// authoritative, fuller set (substring patterns, CJK detection, repetition
// loops) lives server-side in supabase/functions/meeting-enhance. This is a
// deliberately small client-side subset so we can short-circuit distillation
// for a silent meeting *before* the request reaches the server — otherwise the
// model invents action items from the attendee list (e.g. "<Attendee> will
// share the details with the team"). Keep in sync with HALLUCINATION_EXACT_PHRASES.
const MEETING_NOISE_PHRASES: ReadonlySet<string> = new Set([
  "thank you",
  "thank you.",
  "thanks for watching",
  "thanks for watching.",
  "thanks for watching!",
  "you",
  "bye",
  "bye.",
  "bye!",
  "...",
  "subscribe",
  "please subscribe",
  "please subscribe.",
]);

// True when at least one transcript segment carries real speech — i.e. content
// that survives stripping the known Whisper noise phrases. A silent meeting
// whose only "turn" is a hallucination returns false.
function meetingTranscriptHasSpeech(
  segments: MeetingTranscriptSegment[],
): boolean {
  for (const segment of segments) {
    const text = segment.text.trim().toLowerCase();
    if (!text) continue;
    if (MEETING_NOISE_PHRASES.has(text)) continue;
    // Require some real alphanumeric content (drops pure punctuation/symbols).
    if (/[a-z0-9]/i.test(text.replace(/[^a-z0-9]+/gi, ""))) return true;
  }
  return false;
}

// Honest, non-fabricated note for a meeting that captured no usable speech and
// has no manual notes. Header only — no AI call, no invented action items.
function buildEmptyMeetingMarkdown(
  request: EnhancedMeetingNoteRequest,
): string {
  return [
    `## ${request.meeting_title.trim() || "Untitled Meeting"}`,
    request.meeting_local_datetime.trim(),
    request.attendees_compact.trim(),
    "",
    "_No speech was captured for this meeting. Re-record, or add your own notes and regenerate._",
  ]
    .filter(Boolean)
    .join("\n")
    .trimEnd();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Locate the `PerformanceResourceTiming` entry for the most recent fetch to a
 * URL containing `urlNeedle` that started at or after `tBeforeInvoke`. We
 * search backwards because resource entries accumulate chronologically and
 * the call we just made is almost always the tail.
 *
 * Returns `undefined` if no match was found (eg. buffer evicted, runtime did
 * not record the entry, or the URL was mis-needled).
 */
function findRecentResourceEntry(
  urlNeedle: string,
  tBeforeInvoke: number,
): PerformanceResourceTiming | undefined {
  if (typeof performance === "undefined" || !performance.getEntriesByType) {
    return undefined;
  }

  const entries = performance.getEntriesByType(
    "resource",
  ) as PerformanceResourceTiming[];

  // Walk backwards — the call we just made is almost always at the tail.
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.startTime < tBeforeInvoke) {
      // We've passed our invocation boundary in time order — no need to look
      // further back through historical entries.
      return undefined;
    }
    if (entry.name && entry.name.includes(urlNeedle)) {
      return entry;
    }
  }

  return undefined;
}

/**
 * Build an {@link AIProcessTiming} record. The `prep` and `roundtrip` fields
 * come straight from the caller's `performance.now()` deltas; the rest are
 * filled best-effort from the matched resource entry.
 */
function buildAIProcessTiming(
  tStart: number,
  tBeforeInvoke: number,
  tAfterInvoke: number,
  resourceUrlNeedle: string,
): AIProcessTiming {
  const prepMs = Math.round(tBeforeInvoke - tStart);
  const roundtripMs = Math.round(tAfterInvoke - tBeforeInvoke);

  const entry = findRecentResourceEntry(resourceUrlNeedle, tBeforeInvoke);
  if (!entry) {
    return { prepMs, roundtripMs, matchedResource: false };
  }

  const dnsMs = Math.max(0, entry.domainLookupEnd - entry.domainLookupStart);
  const tcpMs = Math.max(0, entry.connectEnd - entry.connectStart);
  // secureConnectionStart === 0 means "no TLS handshake for this entry" (eg.
  // reused connection). Treat as undefined rather than zero so callers can
  // distinguish "fast TLS" from "no TLS step".
  const tlsMs =
    entry.secureConnectionStart > 0
      ? Math.max(0, entry.connectEnd - entry.secureConnectionStart)
      : undefined;
  // `requestStart` can also be 0 when the resource came from cache; guard the
  // subtraction so we don't emit a wildly negative TTFB in that case.
  const ttfbMs =
    entry.requestStart > 0
      ? Math.max(0, entry.responseStart - entry.requestStart)
      : undefined;
  const downloadMs = Math.max(0, entry.responseEnd - entry.responseStart);

  return {
    prepMs,
    roundtripMs,
    dnsMs: Math.round(dnsMs),
    tcpMs: Math.round(tcpMs),
    tlsMs: tlsMs !== undefined ? Math.round(tlsMs) : undefined,
    ttfbMs: ttfbMs !== undefined ? Math.round(ttfbMs) : undefined,
    downloadMs: Math.round(downloadMs),
    matchedResource: true,
  };
}

function estimateRequestSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function normalizeSentenceSpacing(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function joinTranscriptText(left: string, right: string): string {
  const trimmedLeft = normalizeSentenceSpacing(left);
  const trimmedRight = normalizeSentenceSpacing(right);

  if (!trimmedLeft) return trimmedRight;
  if (!trimmedRight) return trimmedLeft;
  if (/[.!?]$/.test(trimmedLeft)) {
    return `${trimmedLeft} ${trimmedRight}`;
  }

  return `${trimmedLeft}. ${trimmedRight}`;
}

function toComparableTimestamp(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function compactTranscriptSegments(
  segments: MeetingTranscriptSegment[],
): MeetingTranscriptSegment[] {
  const compacted: MeetingTranscriptSegment[] = [];

  for (const segment of segments) {
    const trimmedText = normalizeSentenceSpacing(segment.text);
    if (!trimmedText) continue;

    const normalizedSegment: MeetingTranscriptSegment = {
      ...segment,
      text: trimmedText,
    };
    const previous = compacted[compacted.length - 1];

    if (!previous) {
      compacted.push(normalizedSegment);
      continue;
    }

    const previousEnd = toComparableTimestamp(previous.end_time);
    const nextStart = toComparableTimestamp(normalizedSegment.start_time);
    const gapMs =
      previousEnd !== null && nextStart !== null ? nextStart - previousEnd : null;
    const canMerge =
      previous.speaker.source === normalizedSegment.speaker.source &&
      gapMs !== null &&
      gapMs >= -3_000 &&
      gapMs <= MAX_COMPACTED_GAP_MS &&
      previous.text.length + normalizedSegment.text.length <=
        MAX_COMPACTED_SEGMENT_CHARS;

    if (!canMerge) {
      compacted.push(normalizedSegment);
      continue;
    }

    previous.text = joinTranscriptText(previous.text, normalizedSegment.text);
    if (
      previousEnd === null ||
      (nextStart !== null && nextStart >= previousEnd)
    ) {
      previous.end_time = normalizedSegment.end_time;
    }
  }

  return compacted.map((segment, index) => ({
    ...segment,
    id: `segc-${index}`,
  }));
}

function buildCompactedMeetingRequest(
  request: EnhancedMeetingNoteRequest,
): EnhancedMeetingNoteRequest {
  return {
    ...request,
    my_notes_markdown: request.my_notes_markdown?.trim() ?? "",
    transcript_segments: compactTranscriptSegments(request.transcript_segments),
  };
}

function shouldCompactMeetingRequest(request: EnhancedMeetingNoteRequest): boolean {
  return (
    request.transcript_segments.length > MAX_MEETING_REQUEST_SEGMENTS ||
    estimateRequestSize(request) > MAX_MEETING_REQUEST_CHARS
  );
}

function meetingRequestChanged(
  original: EnhancedMeetingNoteRequest,
  next: EnhancedMeetingNoteRequest,
): boolean {
  return (
    next.transcript_segments.length !== original.transcript_segments.length ||
    estimateRequestSize(next) + 512 < estimateRequestSize(original)
  );
}

function extractTranscriptSource(
  request: EnhancedMeetingNoteRequest,
  maxChars: number,
): string {
  let remaining = maxChars;
  const collected: string[] = [];

  for (const segment of request.transcript_segments) {
    const text = normalizeSentenceSpacing(segment.text);
    if (!text || remaining <= 0) continue;

    const nextChunk = text.slice(0, remaining);
    collected.push(nextChunk);
    remaining -= nextChunk.length + 1;
  }

  return collected.join(" ").trim();
}

function normalizeBullets(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith("- ") ? line : `- ${line.replace(/^[*-]\s*/, "")}`));
}

function sanitizeMarkdown(value: string): string {
  return value
    .replace(/```markdown|```md|```/gi, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function countSubstantiveBullets(markdown: string): number {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\s*[-*]\s+/.test(line))
    .map((line) =>
      line
        .replace(/^\s*[-*]\s+/, "")
        .replace(/^\[[ xX]\]\s+/, "")
        .trim(),
    )
    .filter((bullet) => bullet && !NON_SUBSTANTIVE_BULLET_RE.test(bullet))
    .length;
}

function hasSubstantiveBullets(markdown: string): boolean {
  return countSubstantiveBullets(markdown) > 0;
}

function isRecoverableMeetingEnhanceFailure(message: string): boolean {
  return (
    message.includes(EDGE_FUNCTION_FETCH_ERROR) ||
    message.includes(EDGE_FUNCTION_RELAY_ERROR) ||
    message.includes(EDGE_FUNCTION_NON_2XX_ERROR) ||
    message.includes(NO_USABLE_MEETING_NOTES_ERROR)
  );
}

function buildFallbackMeetingInput(
  request: EnhancedMeetingNoteRequest,
  transcriptSource: string,
): string {
  return [
    `Meeting title: ${request.meeting_title.trim() || "Untitled Meeting"}`,
    `Local meeting datetime: ${request.meeting_local_datetime.trim()}`,
    `Attendees: ${request.attendees_compact.trim() || "Not captured"}`,
    request.attendees_full.length > 0
      ? `Attendee details: ${request.attendees_full
          .map((attendee) =>
            attendee.email ? `${attendee.name} <${attendee.email}>` : attendee.name)
          .join(", ")}`
      : "",
    request.calendar_context
      ? `Calendar context: ${JSON.stringify(request.calendar_context)}`
      : "",
    `Meeting type hint: ${request.meeting_type_hint}`,
    request.my_notes_markdown.trim()
      ? `Manual notes:\n${request.my_notes_markdown.trim()}`
      : "",
    transcriptSource ? `Transcript excerpt:\n${transcriptSource}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function extractInvokeError(error: unknown): Promise<string> {
  const fallback =
    error instanceof Error ? error.message : "AI request failed.";
  const context = (error as { context?: unknown } | null)?.context;

  if (context instanceof Response) {
    try {
      const contentType = context.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = (await context.json()) as { error?: string; details?: string };
        return body.error || body.details || fallback;
      }

      const text = await context.text();
      return text.trim() || fallback;
    } catch {
      return fallback;
    }
  }

  if (typeof context === "string" && context.trim()) {
    return context.trim();
  }

  return fallback;
}

// Delegates to the shared resilient getter: refreshes a near-expired token once
// and throws a typed AuthSessionError when the session is unrecoverable, so the
// dictation flow can prompt re-auth instead of silently pasting the raw
// transcript. See lib/auth-session.ts.
async function getSessionAccessToken(): Promise<string> {
  return getValidAccessToken();
}

// ── Web AI route client ────────────────────────────────────────────────────
// Calls the web app's /api/ai/* routes with the user's Supabase JWT so the
// desktop Scribble flow produces identical output to the web Scribble flow.

async function extractWebRouteError(response: Response): Promise<string> {
  const fallback = `Request failed (${response.status}).`;
  const body = await response.text();
  if (!body.trim()) return fallback;
  try {
    const parsed = JSON.parse(body) as { error?: string; details?: string };
    return parsed.error || parsed.details || fallback;
  } catch {
    return body.trim();
  }
}

async function callWebAiRoute<T>(
  path: string,
  body: unknown,
  parse: (response: Response) => Promise<T>,
): Promise<T> {
  const accessToken = await getSessionAccessToken();
  const response = await fetch(`${WEB_APP_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await extractWebRouteError(response));
  }

  return parse(response);
}

async function invokeAIProcess(
  accessToken: string,
  request: AIProcessRequest,
  onTiming?: (timing: AIProcessTiming) => void,
): Promise<string> {
  const tStart = performance.now();
  // Capture the boundary just before the network call — anything before this
  // counts as `prepMs`, anything between this and `tAfterInvoke` is the wire
  // roundtrip.
  const tBeforeInvoke = performance.now();
  const result = await supabase.functions.invoke<AIProcessResponse>(
    "ai-process",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        ...request,
      },
    },
  );
  const tAfterInvoke = performance.now();

  if (onTiming) {
    try {
      // Match by the Supabase functions URL fragment — works for any project
      // ref since `<project>.supabase.co/functions/v1/ai-process` always
      // contains this needle.
      const timing = buildAIProcessTiming(
        tStart,
        tBeforeInvoke,
        tAfterInvoke,
        "/functions/v1/ai-process",
      );
      onTiming(timing);
    } catch (timingErr) {
      // Timing is purely diagnostic; never let it affect the call result.
      console.warn("[ai] failed to build invoke timing:", timingErr);
    }
  }

  const { data, error } = result;

  if (error) {
    throw new Error(await extractInvokeError(error));
  }

  const processedText = data?.text?.trim() ?? "";
  // transcribe_cleanup may legitimately return empty when the server detects
  // silence / Whisper hallucinations. Surface that instead of throwing so the
  // caller can skip the paste step.
  if (!processedText && request.mode !== "transcribe_cleanup") {
    throw new Error(data?.error || "AI returned an empty response.");
  }

  if (request.mode === "transcribe_cleanup" || request.mode === "cleanup") {
    return applyTranscriptPostProcessing(processedText);
  }

  return processedText;
}

async function invokeMeetingEnhance(
  accessToken: string,
  request: EnhancedMeetingNoteRequest,
): Promise<string> {
  const { data, error } =
    await supabase.functions.invoke<EnhancedMeetingNoteResponse>(
      "meeting-enhance",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: request,
      },
    );

  if (error) {
    throw error;
  }

  const markdown = data?.markdown?.trim();
  if (!markdown) {
    throw new Error("Enhanced note generation returned an empty response.");
  }

  // A structured note whose sections are all "None captured" is a valid empty
  // result for a silent meeting, not a failure — show it as-is. Only treat the
  // response as unusable (→ recoverable fallback) when it has neither
  // substantive bullets nor section structure, which would signal a genuinely
  // broken generation rather than an intentionally empty one.
  const hasSectionStructure = /^#{2,3}\s+/m.test(markdown);
  if (
    request.transcript_segments.length > 0 &&
    !hasSubstantiveBullets(markdown) &&
    !hasSectionStructure
  ) {
    throw new Error(NO_USABLE_MEETING_NOTES_ERROR);
  }

  return markdown;
}

async function buildFallbackMeetingMarkdown(
  accessToken: string,
  request: EnhancedMeetingNoteRequest,
): Promise<string> {
  const transcriptSource = extractTranscriptSource(
    request,
    MEETING_FALLBACK_SOURCE_CHARS,
  );
  const sourceForSummary = [
    request.my_notes_markdown.trim(),
    transcriptSource,
  ]
    .filter(Boolean)
    .join("\n\n");

  let summaryBullets = "";
  if (sourceForSummary) {
    try {
      const structuredNotes = await invokeAIProcess(
        accessToken,
        {
          text: buildFallbackMeetingInput(request, transcriptSource),
          mode: "meeting_notes",
        },
      );

      if (structuredNotes.trim()) {
        const sanitizedNotes = sanitizeMarkdown(structuredNotes);
        if (hasSubstantiveBullets(sanitizedNotes)) {
          return sanitizedNotes;
        }
      }
    } catch {
      try {
        summaryBullets = await invokeAIProcess(
          accessToken,
          {
            text: sourceForSummary,
            mode: "bullets",
          },
        );
      } catch {
        summaryBullets = "";
      }
    }
  }

  if (!summaryBullets.trim() && sourceForSummary) {
    try {
      summaryBullets = await invokeAIProcess(
        accessToken,
        {
          text: sourceForSummary,
          mode: "bullets",
        },
      );
    } catch {
      summaryBullets = "";
    }
  }

  const lines = [
    `## ${request.meeting_title.trim() || "Untitled Meeting"}`,
    request.meeting_local_datetime.trim(),
    request.attendees_compact.trim(),
    "",
  ];

  if (request.my_notes_markdown.trim()) {
    lines.push("### Your Notes");
    lines.push(request.my_notes_markdown.trim());
    lines.push("");
  }

  if (summaryBullets.trim()) {
    lines.push("### Top of mind");
    lines.push(...normalizeBullets(summaryBullets));
    return lines.join("\n").trimEnd();
  }

  if (transcriptSource) {
    lines.push("### Transcript Excerpt");
    lines.push(`- ${transcriptSource}`);
  }

  return lines.join("\n").trimEnd();
}

export const aiService = {
  async processText(
    text: string,
    mode: DesktopAIMode,
    options?: {
      context?: DictationContextSnapshot;
      routing?: DictationRoutingResult;
      promptProfile?: AIProcessPromptProfile;
      stylePreset?: CleanupStyleWire;
      /**
       * User-selected transcription language code. Forwarded to Mercury 2
       * cleanup so it preserves the input script (Devanagari for "hi") and
       * applies the right spelling rules (consistent Roman for "hi-en").
       */
      language?: string;
      /**
       * Optional callback invoked once with per-call wire timing. Used by the
       * dictation perf instrumentation to record DNS/TCP/TLS/TTFB/download
       * breakdown into `perf.jsonl`. Errors thrown inside the callback are
       * swallowed and never affect the caller.
       */
      onTiming?: (timing: AIProcessTiming) => void;
    },
  ): Promise<string> {
    if (!text.trim()) {
      throw new Error("No text provided for AI processing.");
    }

    const accessToken = await getSessionAccessToken();
    // Best-effort org context — failure here must not block paste, so the
    // service swallows errors and returns an empty block when anything goes
    // wrong (no active workspace, RLS denial, network blip, ...).
    const profile = mode === "transcribe_cleanup" ? "stream" : "scribble";
    const orgContext = await orgContextService.getBlock({
      rawTranscript: text,
      profile,
    });
    return invokeAIProcess(
      accessToken,
      {
        text,
        mode,
        context: options?.context,
        routing: options?.routing,
        promptProfile: options?.promptProfile,
        stylePreset: options?.stylePreset,
        orgContextBlock: orgContext.block || undefined,
        language: options?.language,
      },
      options?.onTiming,
    );
  },

  // Polished Scribble formatting. Routes through the web app's /api/ai/format
  // so the desktop output matches the web Scribble output exactly (single
  // Gemini prompt, single rate-limit bucket).
  async formatScribble(rawText: string): Promise<string> {
    if (!rawText.trim()) {
      throw new Error("No text provided for AI processing.");
    }

    return callWebAiRoute(
      API_CONFIG.FORMAT_ENDPOINT,
      { rawText },
      async (response) => (await response.text()).trim(),
    );
  },

  // 4-10 word Scribble title via the web app's /api/ai/title.
  async generateScribbleTitle(text: string): Promise<string> {
    if (!text.trim()) {
      throw new Error("No text provided for title generation.");
    }

    return callWebAiRoute<string>(
      API_CONFIG.TITLE_ENDPOINT,
      { text },
      async (response) => {
        const data = (await response.json()) as { title?: string };
        const title = data.title?.trim();
        if (!title) throw new Error("Empty title response from AI.");
        return title;
      },
    );
  },

  async generateEnhancedMeetingNote(
    request: EnhancedMeetingNoteRequest,
  ): Promise<string> {
    // Guard the silent/empty-meeting case up front: when no segment carries
    // real speech and there are no manual notes, skip the server entirely and
    // return an honest empty note. Without this, a meeting whose only "turn" is
    // a Whisper hallucination would be distilled into fabricated action items
    // attributed to attendees. Defends in the app even before the matching
    // server-side guard is deployed.
    if (
      !meetingTranscriptHasSpeech(request.transcript_segments) &&
      !request.my_notes_markdown?.trim()
    ) {
      return buildEmptyMeetingMarkdown(request);
    }

    const accessToken = await getSessionAccessToken();
    const transcriptQuery = request.transcript_segments.map((s) => s.text).join(" ").slice(0, 5000);
    const orgContext = await orgContextService.getBlock({
      rawTranscript: transcriptQuery || request.meeting_title,
      profile: "minutes",
    });
    const requestWithContext: EnhancedMeetingNoteRequest = orgContext.block
      ? { ...request, org_context_block: orgContext.block }
      : request;
    const compactedRequest = buildCompactedMeetingRequest(requestWithContext);
    const startWithCompactedRequest =
      shouldCompactMeetingRequest(requestWithContext) &&
      meetingRequestChanged(requestWithContext, compactedRequest);
    const initialRequest = startWithCompactedRequest ? compactedRequest : requestWithContext;

    try {
      return await invokeMeetingEnhance(accessToken, initialRequest);
    } catch (initialError) {
      const initialMessage = await extractInvokeError(initialError);
      const shouldUseFallback =
        isRecoverableMeetingEnhanceFailure(initialMessage);
      const shouldRetryWithCompaction =
        !startWithCompactedRequest &&
        meetingRequestChanged(request, compactedRequest);

      if (shouldRetryWithCompaction) {
        await wait(400);

        try {
          return await invokeMeetingEnhance(accessToken, compactedRequest);
        } catch (retryError) {
          const retryMessage = await extractInvokeError(retryError);
          if (isRecoverableMeetingEnhanceFailure(retryMessage)) {
            return buildFallbackMeetingMarkdown(accessToken, compactedRequest);
          }

          throw new Error(retryMessage);
        }
      }

      if (shouldUseFallback) {
        return buildFallbackMeetingMarkdown(accessToken, compactedRequest);
      }

      throw new Error(initialMessage);
    }
  },
};
