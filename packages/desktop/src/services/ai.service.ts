import { supabase } from "../supabase";
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

async function getSessionAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("AI features require a valid OSCAR sign-in.");
  }

  return session.access_token;
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
): Promise<string> {
  const { data, error } = await supabase.functions.invoke<AIProcessResponse>(
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

  if (request.transcript_segments.length > 0 && !hasSubstantiveBullets(markdown)) {
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
    },
  ): Promise<string> {
    if (!text.trim()) {
      throw new Error("No text provided for AI processing.");
    }

    const accessToken = await getSessionAccessToken();
    return invokeAIProcess(
      accessToken,
      {
        text,
        mode,
        context: options?.context,
        routing: options?.routing,
        promptProfile: options?.promptProfile,
      },
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
    const accessToken = await getSessionAccessToken();
    const compactedRequest = buildCompactedMeetingRequest(request);
    const startWithCompactedRequest =
      shouldCompactMeetingRequest(request) &&
      meetingRequestChanged(request, compactedRequest);
    const initialRequest = startWithCompactedRequest ? compactedRequest : request;

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
