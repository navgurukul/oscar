import { supabase } from "../supabase";
import type {
  EnhancedMeetingNoteRequest,
  EnhancedMeetingNoteResponse,
  MeetingTranscriptSegment,
} from "../types/meeting.types";
import type {
  DictationContextSnapshot,
  DictationRoutingResult,
} from "../types/note.types";

export type DesktopAIMode =
  | "transcribe_cleanup"
  | "cleanup"
  | "summary"
  | "bullets"
  | "email";

interface AIProcessResponse {
  text?: string;
  error?: string;
}

interface AIProcessRequest {
  text: string;
  mode: DesktopAIMode;
  context?: DictationContextSnapshot;
  routing?: DictationRoutingResult;
}

const EDGE_FUNCTION_FETCH_ERROR = "Failed to send a request to the Edge Function";
const EDGE_FUNCTION_RELAY_ERROR = "Relay Error invoking the Edge Function";
const MAX_MEETING_REQUEST_SEGMENTS = 240;
const MAX_MEETING_REQUEST_CHARS = 120_000;
const MAX_COMPACTED_SEGMENT_CHARS = 320;
const MAX_COMPACTED_GAP_MS = 20_000;
const MEETING_FALLBACK_SOURCE_CHARS = 12_000;

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

  const processedText = data?.text?.trim();
  if (!processedText) {
    throw new Error(data?.error || "AI returned an empty response.");
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
    lines.push("### Transcript Highlights");
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
      const isFetchFailure =
        initialMessage.includes(EDGE_FUNCTION_FETCH_ERROR) ||
        initialMessage.includes(EDGE_FUNCTION_RELAY_ERROR);
      const shouldRetryWithCompaction =
        !startWithCompactedRequest &&
        meetingRequestChanged(request, compactedRequest);

      if (shouldRetryWithCompaction) {
        await wait(400);

        try {
          return await invokeMeetingEnhance(accessToken, compactedRequest);
        } catch (retryError) {
          const retryMessage = await extractInvokeError(retryError);
          if (
            retryMessage.includes(EDGE_FUNCTION_FETCH_ERROR) ||
            retryMessage.includes(EDGE_FUNCTION_RELAY_ERROR)
          ) {
            return buildFallbackMeetingMarkdown(accessToken, compactedRequest);
          }

          throw new Error(retryMessage);
        }
      }

      if (isFetchFailure) {
        return buildFallbackMeetingMarkdown(accessToken, compactedRequest);
      }

      throw new Error(initialMessage);
    }
  },
};
