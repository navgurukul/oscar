import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type MeetingTypeHint =
  | "auto"
  | "discovery"
  | "1on1"
  | "standup"
  | "general";

type MeetingTranscriptSource = "microphone" | "speaker";

interface MeetingAttendee {
  name: string;
  email: string;
}

interface MeetingCalendarContext {
  scheduled_start_time: string;
  scheduled_end_time: string;
  organizer_email: string;
  event_title: string;
}

interface MeetingTranscriptSegment {
  id: string;
  speaker: {
    source: MeetingTranscriptSource;
    diarization_label?: string;
  };
  text: string;
  start_time: string;
  end_time: string;
}

interface EnhancedMeetingNoteRequest {
  meeting_title: string;
  meeting_local_datetime: string;
  attendees_compact: string;
  attendees_full: MeetingAttendee[];
  calendar_context: MeetingCalendarContext | null;
  my_notes_markdown: string;
  transcript_segments: MeetingTranscriptSegment[];
  meeting_type_hint: MeetingTypeHint;
}

interface EnhancedMeetingNoteResponse {
  markdown: string;
}

type InferredMeetingType = Exclude<MeetingTypeHint, "auto">;

interface ParsedSections {
  orderedHeadings: string[];
  bulletsByHeading: Map<string, string[]>;
}

interface FinalMarkdownResult {
  markdown: string;
  bulletCount: number;
  transcriptBulletCount: number;
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_SEGMENT_BATCH_CHARS = 12_000;
const MAX_SEGMENT_BATCH_SIZE = 80;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "was",
  "we",
  "with",
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value.trim());
  }

  return result;
}

function stripCitationToken(value: string): string {
  return value.replace(/\[\[seg:([A-Za-z0-9._:-]+)\]\]\s*$/g, "").trim();
}

function normalizeHeadingKey(value: string): string {
  return value.trim().toLowerCase();
}

function inferMeetingType(request: EnhancedMeetingNoteRequest): InferredMeetingType {
  if (request.meeting_type_hint !== "auto") {
    return request.meeting_type_hint;
  }

  const haystack = [
    request.meeting_title,
    request.calendar_context?.event_title ?? "",
    request.my_notes_markdown,
    request.transcript_segments.map((segment) => segment.text).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  if (
    /(discovery|intro call|introduction call|customer discovery|prospect|prospective|demo|sales call|vendor evaluation)/.test(
      haystack,
    )
  ) {
    return "discovery";
  }

  if (/(1:1|1-1|one on one|one-on-one)/.test(haystack)) {
    return "1on1";
  }

  if (/(standup|stand-up|daily scrum|daily sync|scrum)/.test(haystack)) {
    return "standup";
  }

  return "general";
}

function defaultSectionsForType(meetingType: InferredMeetingType): string[] {
  switch (meetingType) {
    case "discovery":
      return [
        "About them",
        "Current situation / Current provider (if applicable)",
        "Key takeaways",
        "Their Requirements",
        "Budget & Timeline",
        "Decision Criteria",
        "Next Steps",
      ];
    case "1on1":
      return [
        "Wins",
        "Priorities",
        "Blockers",
        "Feedback",
        "Decisions",
        "Next Steps",
      ];
    case "standup":
      return [
        "Progress since last standup",
        "Today's plan",
        "Blockers",
        "Dependencies / Risks",
        "Next Steps",
      ];
    case "general":
    default:
      return [
        "Overview",
        "Key takeaways",
        "Decisions",
        "Open questions / Risks",
        "Next steps",
      ];
  }
}

function parseSectionsFromMarkdown(markdown: string): ParsedSections {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const orderedHeadings: string[] = [];
  const bulletsByHeading = new Map<string, string[]>();
  let currentHeading: string | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (headingMatch) {
      currentHeading = headingMatch[1].trim();
      if (!orderedHeadings.includes(currentHeading)) {
        orderedHeadings.push(currentHeading);
      }
      if (!bulletsByHeading.has(currentHeading)) {
        bulletsByHeading.set(currentHeading, []);
      }
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (bulletMatch && currentHeading) {
      const bucket = bulletsByHeading.get(currentHeading);
      bucket?.push(bulletMatch[1].trim());
    }
  }

  return {
    orderedHeadings,
    bulletsByHeading,
  };
}

function buildExpectedSections(
  request: EnhancedMeetingNoteRequest,
  meetingType: InferredMeetingType,
): ParsedSections {
  const parsed = parseSectionsFromMarkdown(request.my_notes_markdown);
  const defaultHeadings = defaultSectionsForType(meetingType);
  if (parsed.orderedHeadings.length > 0) {
    const existingKeys = new Set(
      parsed.orderedHeadings.map((heading) => normalizeHeadingKey(heading)),
    );

    for (const heading of defaultHeadings) {
      if (existingKeys.has(normalizeHeadingKey(heading))) continue;
      parsed.orderedHeadings.push(heading);
      parsed.bulletsByHeading.set(heading, []);
    }

    return parsed;
  }

  const orderedHeadings = defaultHeadings;
  const bulletsByHeading = new Map<string, string[]>();
  for (const heading of orderedHeadings) {
    bulletsByHeading.set(heading, []);
  }

  return {
    orderedHeadings,
    bulletsByHeading,
  };
}

function formatMeetingContext(
  request: EnhancedMeetingNoteRequest,
  sections: string[],
  meetingType: InferredMeetingType,
): string {
  return [
    `Meeting title: ${request.meeting_title || "Untitled Meeting"}`,
    `Local meeting datetime: ${request.meeting_local_datetime}`,
    `Attendees compact: ${request.attendees_compact}`,
    request.attendees_full.length > 0
      ? `Attendees full: ${request.attendees_full
          .map((attendee) =>
            attendee.email
              ? `${attendee.name} <${attendee.email}>`
              : attendee.name)
          .join(", ")}`
      : "",
    request.calendar_context
      ? `Calendar context: ${JSON.stringify(request.calendar_context)}`
      : "",
    `Meeting type hint: ${request.meeting_type_hint}`,
    `Inferred meeting type: ${meetingType}`,
    `Required section order: ${sections.join(" | ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatSegmentsForPrompt(segments: MeetingTranscriptSegment[]): string {
  return segments
    .map(
      (segment) =>
        `${segment.id} | ${segment.start_time} | ${segment.end_time} | ${segment.speaker.source} | ${segment.text}`,
    )
    .join("\n");
}

function splitSegmentBatches(
  segments: MeetingTranscriptSegment[],
): MeetingTranscriptSegment[][] {
  const batches: MeetingTranscriptSegment[][] = [];
  let currentBatch: MeetingTranscriptSegment[] = [];
  let currentChars = 0;

  for (const segment of segments) {
    const segmentChars = segment.text.length + 80;
    const wouldOverflow =
      currentBatch.length >= MAX_SEGMENT_BATCH_SIZE ||
      currentChars + segmentChars > MAX_SEGMENT_BATCH_CHARS;

    if (wouldOverflow && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }

    currentBatch.push(segment);
    currentChars += segmentChars;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

async function callGroq(
  groqApiKey: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const upstream = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.2,
      stream: false,
    }),
  });

  if (!upstream.ok) {
    const errBody = await upstream.text();
    throw new Error(`Groq API error ${upstream.status}: ${errBody}`);
  }

  const data = await upstream.json();
  const output = data?.choices?.[0]?.message?.content?.trim();
  if (!output) {
    throw new Error("Empty response from AI service.");
  }

  return output;
}

async function reduceTranscriptBatches(
  groqApiKey: string,
  request: EnhancedMeetingNoteRequest,
  sections: string[],
  meetingType: InferredMeetingType,
): Promise<string> {
  const segmentBatches = splitSegmentBatches(request.transcript_segments);
  if (segmentBatches.length <= 1) {
    return formatSegmentsForPrompt(request.transcript_segments);
  }

  const reductions: string[] = [];
  const systemPrompt =
    "You reduce long meeting transcript batches into citation-preserving fact bullets. " +
    "Return only markdown bullets. Every bullet must end with exactly one citation token in the form [[seg:SEGMENT_ID]]. " +
    "Do not invent facts. Do not output headings or prose.";

  for (let index = 0; index < segmentBatches.length; index += 1) {
    const batch = segmentBatches[index];
    const userPrompt = [
      formatMeetingContext(request, sections, meetingType),
      request.my_notes_markdown.trim()
        ? `Manual notes:\n${request.my_notes_markdown.trim()}`
        : "",
      `Transcript batch ${index + 1} of ${segmentBatches.length}:`,
      formatSegmentsForPrompt(batch),
    ]
      .filter(Boolean)
      .join("\n\n");

    reductions.push(await callGroq(groqApiKey, systemPrompt, userPrompt, 1_100));
  }

  return reductions
    .map((reduction, index) => `Batch ${index + 1}\n${reduction}`)
    .join("\n\n");
}

function sanitizeModelMarkdown(markdown: string): string {
  return markdown
    .replace(/```markdown|```md|```/gi, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function scoreSegmentMatch(
  bulletText: string,
  segment: MeetingTranscriptSegment,
): number {
  const bulletTokens = tokenize(bulletText);
  const segmentTokens = new Set(tokenize(segment.text));

  let score = 0;
  for (const token of bulletTokens) {
    if (segmentTokens.has(token)) score += 1;
  }

  const normalizedBullet = normalizeText(bulletText);
  const normalizedSegment = normalizeText(segment.text);
  if (normalizedBullet && normalizedSegment.includes(normalizedBullet)) {
    score += 8;
  } else if (
    normalizedSegment &&
    normalizedBullet &&
    normalizedBullet.includes(normalizedSegment)
  ) {
    score += 5;
  }

  return score;
}

function pickBestSegmentId(
  bulletText: string,
  segmentsById: Map<string, MeetingTranscriptSegment>,
): string | null {
  let bestId: string | null = null;
  let bestScore = 0;

  for (const [segmentId, segment] of segmentsById.entries()) {
    const score = scoreSegmentMatch(bulletText, segment);
    if (score > bestScore) {
      bestScore = score;
      bestId = segmentId;
    }
  }

  return bestScore > 0 ? bestId : null;
}

function appendEvidenceMarker(
  bulletText: string,
  segmentId: string | null,
  segmentsById: Map<string, MeetingTranscriptSegment>,
): string {
  if (!segmentId) {
    return `- ${bulletText}`;
  }

  const segment = segmentsById.get(segmentId);
  if (!segment) {
    return `- ${bulletText}`;
  }

  return `- ${bulletText} <!-- ev:start=${segment.start_time} end=${segment.end_time} src=${segment.speaker.source} -->`;
}

function parseModelSections(markdown: string): ParsedSections {
  const sanitized = sanitizeModelMarkdown(markdown);
  const lines = sanitized.split("\n");
  const orderedHeadings: string[] = [];
  const bulletsByHeading = new Map<string, string[]>();
  let currentHeading: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const headingMatch = line.match(/^#{2,3}\s+(.+?)\s*$/);
    if (headingMatch) {
      currentHeading = headingMatch[1].trim();
      if (!orderedHeadings.includes(currentHeading)) {
        orderedHeadings.push(currentHeading);
      }
      if (!bulletsByHeading.has(currentHeading)) {
        bulletsByHeading.set(currentHeading, []);
      }
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!bulletMatch) continue;

    if (!currentHeading) {
      currentHeading = "Overview";
      orderedHeadings.push(currentHeading);
      bulletsByHeading.set(currentHeading, []);
    }

    bulletsByHeading.get(currentHeading)?.push(bulletMatch[1].trim());
  }

  return {
    orderedHeadings,
    bulletsByHeading,
  };
}

function buildFinalMarkdown(
  request: EnhancedMeetingNoteRequest,
  expectedSections: ParsedSections,
  modelMarkdown: string,
): FinalMarkdownResult {
  const modelSections = parseModelSections(modelMarkdown);
  const manualSectionBullets = expectedSections.bulletsByHeading;
  const expectedHeadings = expectedSections.orderedHeadings;
  const segmentsById = new Map(
    request.transcript_segments.map((segment) => [segment.id, segment] as const),
  );
  const manualBulletSet = new Set<string>();

  for (const bullets of manualSectionBullets.values()) {
    for (const bullet of bullets) {
      manualBulletSet.add(normalizeText(bullet));
    }
  }

  const mergeBulletsForHeading = (heading: string) => {
    const merged: Array<{ source: "manual" | "model"; raw: string }> = [];
    const seen = new Set<string>();

    for (const bullet of uniqueStrings(manualSectionBullets.get(heading) ?? [])) {
      const normalized = normalizeText(bullet);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      merged.push({ source: "manual", raw: bullet.trim() });
    }

    for (const bullet of modelSections.bulletsByHeading.get(heading) ?? []) {
      const normalized = normalizeText(stripCitationToken(bullet));
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      merged.push({ source: "model", raw: bullet.trim() });
    }

    return merged;
  };

  const outputLines = [
    `## ${request.meeting_title || "Untitled Meeting"}`,
    request.meeting_local_datetime,
    request.attendees_compact,
    "",
  ];

  let generatedBulletCount = 0;
  let transcriptBulletCount = 0;

  for (const heading of expectedHeadings) {
    outputLines.push(`### ${heading}`);
    const mergedBullets = mergeBulletsForHeading(heading);

    for (const { source, raw: rawBullet } of mergedBullets) {
      if (!rawBullet) continue;

      if (source === "manual") {
        outputLines.push(`- ${rawBullet}`);
        generatedBulletCount += 1;
        continue;
      }

      const citationMatch = rawBullet.match(/\[\[seg:([A-Za-z0-9._:-]+)\]\]\s*$/);
      const visibleBullet = stripCitationToken(rawBullet);
      const normalizedVisible = normalizeText(visibleBullet);
      if (!visibleBullet) continue;

      if (manualBulletSet.has(normalizedVisible)) {
        continue;
      }

      const citedSegmentId =
        citationMatch?.[1] ?? pickBestSegmentId(visibleBullet, segmentsById);
      outputLines.push(
        appendEvidenceMarker(visibleBullet, citedSegmentId, segmentsById),
      );
      generatedBulletCount += 1;
      transcriptBulletCount += 1;
    }

    outputLines.push("");
  }

  return {
    markdown: outputLines.join("\n").trimEnd(),
    bulletCount: generatedBulletCount,
    transcriptBulletCount,
  };
}

async function generateFinalMarkdown(
  groqApiKey: string,
  request: EnhancedMeetingNoteRequest,
  expectedSections: ParsedSections,
  meetingType: InferredMeetingType,
): Promise<string> {
  const sections = expectedSections.orderedHeadings;
  const transcriptMaterial = await reduceTranscriptBatches(
    groqApiKey,
    request,
    sections,
    meetingType,
  );

  const systemPrompt =
    "You are generating Granola-style enhanced meeting notes. " +
    "Output only markdown. Use headings and bullets only. " +
    "Every bullet derived from transcript content must end with exactly one citation token in the form [[seg:SEGMENT_ID]]. " +
    "Do not use fences, preamble, or visible timestamps. " +
    "Never invent facts. Preserve the structure and intent of any manual notes.";

  const userPrompt = [
    formatMeetingContext(request, sections, meetingType),
    expectedSections.orderedHeadings.length > 0 &&
      request.my_notes_markdown.trim()
      ? `Manual notes markdown (preserve heading order and use as anchors):\n${request.my_notes_markdown.trim()}`
      : request.my_notes_markdown.trim()
      ? `Manual notes:\n${request.my_notes_markdown.trim()}`
      : "",
    request.transcript_segments.length > 0
      ? `Transcript evidence material:\n${transcriptMaterial}`
      : "",
    "Produce the final meeting notes now.",
  ]
    .filter(Boolean)
    .join("\n\n");

  let firstPass = await callGroq(groqApiKey, systemPrompt, userPrompt, 1_800);
  let finalOutput = buildFinalMarkdown(request, expectedSections, firstPass);

  if (
    request.transcript_segments.length > 0 &&
    finalOutput.transcriptBulletCount === 0
  ) {
    const repairPrompt = [
      userPrompt,
      "The previous answer was invalid because it did not yield usable bullets. " +
        "Try again and make sure each transcript-derived bullet ends with exactly one [[seg:SEGMENT_ID]] token.",
      `Previous answer:\n${sanitizeModelMarkdown(firstPass)}`,
    ].join("\n\n");

    firstPass = await callGroq(groqApiKey, systemPrompt, repairPrompt, 1_800);
    finalOutput = buildFinalMarkdown(request, expectedSections, firstPass);
  }

  return finalOutput.markdown;
}

function validateRequest(request: EnhancedMeetingNoteRequest): string | null {
  if (!request || typeof request !== "object") {
    return "Missing request body.";
  }

  if (typeof request.meeting_title !== "string") {
    return "Missing or invalid 'meeting_title'.";
  }

  if (typeof request.meeting_local_datetime !== "string") {
    return "Missing or invalid 'meeting_local_datetime'.";
  }

  if (typeof request.attendees_compact !== "string") {
    return "Missing or invalid 'attendees_compact'.";
  }

  if (!Array.isArray(request.attendees_full)) {
    return "Missing or invalid 'attendees_full'.";
  }

  if (
    !Array.isArray(request.transcript_segments) ||
    request.transcript_segments.some(
      (segment) =>
        !segment ||
        typeof segment.id !== "string" ||
        typeof segment.text !== "string" ||
        typeof segment.start_time !== "string" ||
        typeof segment.end_time !== "string" ||
        !segment.speaker ||
        (segment.speaker.source !== "microphone" &&
          segment.speaker.source !== "speaker"),
    )
  ) {
    return "Missing or invalid 'transcript_segments'.";
  }

  if (
    request.transcript_segments.length === 0 &&
    !request.my_notes_markdown?.trim()
  ) {
    return "Provide transcript segments or manual notes.";
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(accessToken);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestBody = (await req.json()) as EnhancedMeetingNoteRequest;
    const validationError = validateRequest(requestBody);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: "GROQ_API_KEY is not configured on the server." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedRequest: EnhancedMeetingNoteRequest = {
      ...requestBody,
      my_notes_markdown: requestBody.my_notes_markdown ?? "",
      transcript_segments: requestBody.transcript_segments
        .map((segment) => ({
          ...segment,
          text: segment.text.trim(),
        }))
        .filter((segment) => Boolean(segment.text)),
    };

    const meetingType = inferMeetingType(normalizedRequest);
    const expectedSections = buildExpectedSections(
      normalizedRequest,
      meetingType,
    );

    const markdown = await generateFinalMarkdown(
      groqApiKey,
      normalizedRequest,
      expectedSections,
      meetingType,
    );

    return new Response(
      JSON.stringify({ markdown } satisfies EnhancedMeetingNoteResponse),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[meeting-enhance] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: `Internal error: ${(err as Error).message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
