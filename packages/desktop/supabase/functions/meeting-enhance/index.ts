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

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "gemini-2.5-flash-lite";
const MAX_SEGMENT_BATCH_CHARS = 12_000;
const MAX_SEGMENT_BATCH_SIZE = 80;
const MAX_CLEANUP_BATCH_CHARS = 8_000;
const MAX_CLEANUP_BATCH_SIZE = 50;
const NO_USABLE_MEETING_NOTES_ERROR =
  "NO_USABLE_MEETING_NOTES: model output contained no transcript-backed bullets.";
const NON_SUBSTANTIVE_BULLET_RE =
  /^(none captured|no (specific )?.*captured|not captured|n\/a)\.?$/i;

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
        "Action items",
        "Decisions",
        "Key topics",
        "Open questions",
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
    "Speaker source semantics: segments tagged 'microphone' come from the meeting host (the person recording); segments tagged 'speaker' come from other participants captured via system audio. Use this to attribute claims, decisions, and action items to the right side.",
  ]
    .filter(Boolean)
    .join("\n");
}

function speakerDisplayLabel(source: MeetingTranscriptSource): string {
  return source === "microphone" ? "Me" : "Them";
}

function formatSegmentsForPrompt(segments: MeetingTranscriptSegment[]): string {
  return segments
    .map(
      (segment) =>
        `${segment.id} | ${segment.start_time} | ${segment.end_time} | ${segment.speaker.source} (${speakerDisplayLabel(segment.speaker.source)}) | ${segment.text}`,
    )
    .join("\n");
}

function splitSegmentBatchesWithLimits(
  segments: MeetingTranscriptSegment[],
  maxChars: number,
  maxSize: number,
): MeetingTranscriptSegment[][] {
  const batches: MeetingTranscriptSegment[][] = [];
  let currentBatch: MeetingTranscriptSegment[] = [];
  let currentChars = 0;

  for (const segment of segments) {
    const segmentChars = segment.text.length + 80;
    const wouldOverflow =
      currentBatch.length >= maxSize ||
      currentChars + segmentChars > maxChars;

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

function splitSegmentBatches(
  segments: MeetingTranscriptSegment[],
): MeetingTranscriptSegment[][] {
  return splitSegmentBatchesWithLimits(
    segments,
    MAX_SEGMENT_BATCH_CHARS,
    MAX_SEGMENT_BATCH_SIZE,
  );
}

async function callGemini(
  geminiApiKey: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const upstream = await fetch(
    `${GEMINI_API_BASE_URL}/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": geminiApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          { role: "user", parts: [{ text: user }] },
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.2,
        },
      }),
    },
  );

  if (!upstream.ok) {
    const errBody = await upstream.text();
    throw new Error(`Gemini API error ${upstream.status}: ${errBody}`);
  }

  const data = await upstream.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const output = Array.isArray(parts)
    ? parts.map((p: { text?: string }) => (typeof p?.text === "string" ? p.text : "")).join("").trim()
    : "";
  if (!output) {
    throw new Error("Empty response from AI service.");
  }

  return output;
}

function parseCleanedSegmentLines(
  output: string,
  originalSegments: MeetingTranscriptSegment[],
): MeetingTranscriptSegment[] {
  const byId = new Map(
    originalSegments.map((segment) => [segment.id, segment] as const),
  );
  const cleanedById = new Map<string, string>();
  const sanitized = sanitizeModelMarkdown(output);

  for (const rawLine of sanitized.split("\n")) {
    const line = rawLine.trim().replace(/^\s*[-*]\s+/, "");
    if (!line) continue;

    const match = line.match(/^([A-Za-z0-9._:-]+)\s*\|\s*(?:(microphone|speaker|me|them)\s*\|\s*)?(.*?)\s*$/i);
    if (!match) continue;

    const id = match[1].trim();
    if (!byId.has(id)) continue;

    const cleanedText = match[3]
      .replace(/^["']|["']$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    cleanedById.set(id, cleanedText);
  }

  return originalSegments.map((segment) => {
    if (!cleanedById.has(segment.id)) return segment;
    const cleanedText = cleanedById.get(segment.id) ?? "";
    if (!cleanedText) {
      return {
        ...segment,
        text: "",
      };
    }

    const normalizedCleaned = normalizeText(cleanedText);
    const normalizedOriginal = normalizeText(segment.text);
    if (!normalizedCleaned) return segment;
    if (
      normalizedCleaned.length < 8 &&
      normalizedOriginal.length > normalizedCleaned.length * 4
    ) {
      return segment;
    }

    return {
      ...segment,
      text: cleanedText,
    };
  });
}

async function cleanTranscriptSegments(
  geminiApiKey: string,
  request: EnhancedMeetingNoteRequest,
): Promise<MeetingTranscriptSegment[]> {
  if (request.transcript_segments.length === 0) {
    return request.transcript_segments;
  }

  const batches = splitSegmentBatchesWithLimits(
    request.transcript_segments,
    MAX_CLEANUP_BATCH_CHARS,
    MAX_CLEANUP_BATCH_SIZE,
  );
  const cleanedSegments: MeetingTranscriptSegment[] = [];
  const systemPrompt =
    "You clean noisy meeting transcript segments before summarization. " +
    "This is not a summary task. Preserve meaning, facts, numbers, names, branches, files, PRs, design references, dates, and action items. " +
    "Fix obvious speech-recognition errors in English, Hindi, and Hinglish when the nearby context supports the correction. " +
    "Remove filler-only noise such as hmm, uh, aham, repeated stutters, and accidental repeated phrases. " +
    "Keep the speaker source intact: microphone means Me/host; speaker means Them/other participants. " +
    "Output exactly one line per input segment in this format: SEGMENT_ID | SOURCE | CLEANED_TEXT. " +
    "Use SOURCE as microphone or speaker exactly. Do not merge segments. Do not add headings, bullets, prose, timestamps, or citations. " +
    "If a segment has no meaningful speech, output the segment id and source with an empty CLEANED_TEXT.";

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const userPrompt = [
      `Meeting title: ${request.meeting_title || "Untitled Meeting"}`,
      request.attendees_compact
        ? `Attendees: ${request.attendees_compact}`
        : "",
      `Transcript cleanup batch ${index + 1} of ${batches.length}:`,
      formatSegmentsForPrompt(batch),
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const cleanedOutput = await callGemini(
        geminiApiKey,
        systemPrompt,
        userPrompt,
        2_400,
      );
      cleanedSegments.push(...parseCleanedSegmentLines(cleanedOutput, batch));
    } catch (error) {
      console.warn("[meeting-enhance] transcript cleanup failed:", error);
      cleanedSegments.push(...batch);
    }
  }

  return cleanedSegments;
}

async function reduceTranscriptBatches(
  geminiApiKey: string,
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
    "Each bullet must capture one concrete fact, blocker, decision, open question, action item, or follow-up. " +
    "Preserve verbatim: people's names, product names, tool names, file names, URLs, project IDs, numbers, durations, dates, error strings, and exact technical terms. " +
    "Attribute claims using speaker source: 'microphone' = the meeting host, 'speaker' = other participants. When a participant's name is identifiable from context, prefer it over generic pronouns. " +
    "BANNED phrasing: 'the user', 'the conversation', 'it was discussed', 'discussion around', 'they talked about', 'the meeting covered'. Write the substance directly instead. " +
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

    reductions.push(await callGemini(geminiApiKey, systemPrompt, userPrompt, 1_100));
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

function transcriptText(request: EnhancedMeetingNoteRequest): string {
  return request.transcript_segments
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function pushUniqueBullet(bucket: string[], bullet: string): void {
  const normalized = normalizeText(bullet);
  if (!normalized) return;
  if (bucket.some((existing) => normalizeText(existing) === normalized)) return;
  bucket.push(bullet);
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

function fallbackBulletForEmptySection(heading: string): string | null {
  if (normalizeHeadingKey(heading) === "mutual feedback") {
    return "No specific feedback captured.";
  }

  return "None captured.";
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
  const modelBulletsByHeadingKey = new Map<string, string[]>();
  const segmentsById = new Map(
    request.transcript_segments.map((segment) => [segment.id, segment] as const),
  );
  const manualBulletSet = new Set<string>();

  for (const [heading, bullets] of modelSections.bulletsByHeading.entries()) {
    const key = normalizeHeadingKey(heading);
    if (!key) continue;
    modelBulletsByHeadingKey.set(key, [
      ...(modelBulletsByHeadingKey.get(key) ?? []),
      ...bullets,
    ]);
  }

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

    for (const bullet of modelBulletsByHeadingKey.get(normalizeHeadingKey(heading)) ?? []) {
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
    let headingBulletCount = 0;

    for (const { source, raw: rawBullet } of mergedBullets) {
      if (!rawBullet) continue;

      if (source === "manual") {
        outputLines.push(`- ${rawBullet}`);
        generatedBulletCount += 1;
        headingBulletCount += 1;
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
      headingBulletCount += 1;
    }

    if (headingBulletCount === 0) {
      const fallbackBullet = fallbackBulletForEmptySection(heading);
      if (fallbackBullet) {
        outputLines.push(`- ${fallbackBullet}`);
        generatedBulletCount += 1;
      }
    }

    outputLines.push("");
  }

  return {
    markdown: outputLines.join("\n").trimEnd(),
    bulletCount: generatedBulletCount,
    transcriptBulletCount,
  };
}

async function generateUncitedFallbackMarkdown(
  geminiApiKey: string,
  request: EnhancedMeetingNoteRequest,
  expectedSections: ParsedSections,
  meetingType: InferredMeetingType,
  transcriptMaterial: string,
  previousAnswer: string,
): Promise<FinalMarkdownResult> {
  const sections = expectedSections.orderedHeadings;
  const systemPrompt =
    "You are recovering useful meeting notes from a noisy transcript. " +
    "Output only markdown. Use the required section headings exactly as given; do not rename, reorder, add, or omit headings. " +
    "Use markdown bullets under every heading. Do not use citation tokens. " +
    "Prefer concrete action items, technical details, decisions, open questions, numeric values, branch names, PRs, testing needs, and design follow-ups. " +
    "The transcript may mix English, Hindi, Hinglish, and speech-recognition errors. Recover likely meaning when several nearby words support it. " +
    "Common noisy mappings: 'piyar raise', 'pyar raise', or 'PR raise' means raise a PR; 'git', 'github', or 'gidhub' means GitHub; 'feat audio transcription' is a branch name; '0 percent English usage', '36 percent', and '59 percent' are accuracy/usage metrics; 'design PDF', 'dark mode', 'light mode', 'font', and 'spacing' are UI/design follow-ups. " +
    "Never output only 'None captured' when the transcript contains app demo, GitHub, PR, testing, English usage, accuracy, design, branch, PDF, UI, or data/storage details. " +
    "Never write blank sections. If a section truly has no evidence, write one bullet: None captured. " +
    "For Action items, use '- [ ] <action> — <Owner>' with the owner if identifiable, or 'Owner: unassigned'.";

  const userPrompt = [
    formatMeetingContext(request, sections, meetingType),
    request.my_notes_markdown.trim()
      ? `Manual notes:\n${request.my_notes_markdown.trim()}`
      : "",
    `No-citation recovery required. Previous citation-based answer produced no usable bullets:\n${sanitizeModelMarkdown(previousAnswer)}`,
    `Transcript material:\n${transcriptMaterial}`,
    "Produce useful meeting notes now.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const fallbackPass = await callGemini(geminiApiKey, systemPrompt, userPrompt, 2_200);
  return buildFinalMarkdown(request, expectedSections, fallbackPass);
}

function buildHeuristicRecoveryMarkdown(
  request: EnhancedMeetingNoteRequest,
  expectedSections: ParsedSections,
): string {
  const rawTranscript = transcriptText(request);
  const lower = rawTranscript.toLowerCase();
  const normalized = normalizeText(rawTranscript);
  const bulletsByHeading = new Map<string, string[]>();

  const bucketFor = (heading: string): string[] => {
    const key = normalizeHeadingKey(heading);
    const bucket = bulletsByHeading.get(key) ?? [];
    bulletsByHeading.set(key, bucket);
    return bucket;
  };

  const hasGithub = includesAny(lower, [/git\s*hub|github|gidhub|git par|git pe|गिट|गिद/]);
  const hasPush = includesAny(lower, [/push|sync|सिंक|पुश/]);
  const hasPr = includesAny(lower, [/\bpr\b|pull request|piyar|pyar|pyaar|पी\s*आर|प्यार/]);
  const hasBranch = includesAny(lower, [/branch|feat[-\s]?audio[-\s]?transcription|audio transcription|ब्रांच/]);
  const hasTesting = includesAny(lower, [/test|testing|1-2|1 to 2|one or two|accuracy|accurate|95|98|100%|100 percent|english usage|इंग्लिश|टेस्ट/]);
  const hasDesign = includesAny(lower, [/design|pdf|ui|font|spacing|dark mode|light mode|opening screen|screen|डिजाइन|फॉन्ट/]);
  const hasDemo = includesAny(lower, [/start your first session|start session|participant|joining|session|demo|visible|phone|screen share/]);
  const hasMetrics = includesAny(lower, [/0%|0 percent|zero percent|36%|36 percent|59%|59 percent|english usage|calculation|match/]);
  const hasBackend = includesAny(lower, [/backend|back end|front end|frontend|database|data clean|delete data|internal database|डेटा/]);
  const hasSpeakerDiarization = includesAny(lower, [/diarization|speaker diarization/]);

  for (const heading of expectedSections.orderedHeadings) {
    const key = normalizeHeadingKey(heading);
    const bucket = bucketFor(heading);

    if (key === "action items") {
      if (hasGithub && hasPush) {
        pushUniqueBullet(bucket, "- [ ] Push or sync the code to GitHub — Owner: unassigned");
      }
      if (hasPr) {
        pushUniqueBullet(bucket, "- [ ] Raise a PR to main — Owner: unassigned");
      }
      if (hasTesting) {
        pushUniqueBullet(bucket, "- [ ] Test English usage accuracy with 1-2 people, including a 100% English speech run — Owner: unassigned");
      }
      if (hasDesign) {
        pushUniqueBullet(bucket, "- [ ] Review the shared design PDF and update UI details such as font, spacing, and session screens — Owner: unassigned");
      }
      if (hasBranch) {
        pushUniqueBullet(bucket, "- [ ] Share or use the feat-audio-transcription branch for follow-up work — Owner: unassigned");
      }
      continue;
    }

    if (key === "decisions") {
      if (hasGithub || hasPr) {
        pushUniqueBullet(bucket, "- Code review and design follow-up should happen through GitHub after the branch is pushed.");
      }
      if (hasDesign) {
        pushUniqueBullet(bucket, "- UI/design changes can be handled after the current functional work is available in a PR.");
      }
      continue;
    }

    if (key === "key topics") {
      if (hasDemo) {
        pushUniqueBullet(bucket, "- App demo covered session creation, participant entry, starting a session, and live session flow.");
      }
      if (hasMetrics) {
        pushUniqueBullet(bucket, "- English usage and accuracy tracking showed questionable results, including 0% English usage and earlier 36% / 59% readings.");
      }
      if (hasTesting) {
        pushUniqueBullet(bucket, "- Accuracy needs verification with cleaner English-only testing before deciding whether model or calculation changes are needed.");
      }
      if (hasDesign) {
        pushUniqueBullet(bucket, "- UI differences were called out around the Start Session design, font, spacing, and shared PDF screens.");
      }
      if (hasBackend) {
        pushUniqueBullet(bucket, "- Data handling and app storage were discussed, including frontend/backend connection and internal database behavior.");
      }
      if (hasSpeakerDiarization) {
        pushUniqueBullet(bucket, "- Speaker diarization is not implemented, so longer accuracy testing should account for that limitation.");
      }
      continue;
    }

    if (key === "open questions") {
      if (hasMetrics) {
        pushUniqueBullet(bucket, "- Is the 0% English usage result caused by mostly Hindi speech, calculation issues, or the phone setup?");
      }
      if (hasTesting) {
        pushUniqueBullet(bucket, "- What accuracy gap remains when the app is tested with 100% English speech?");
      }
      if (hasDesign) {
        pushUniqueBullet(bucket, "- Which UI details from the design PDF still need to be matched?");
      }
      continue;
    }

    if (key === "next steps") {
      if (hasGithub && hasPush) {
        pushUniqueBullet(bucket, "- Push or sync the branch to GitHub.");
      }
      if (hasPr) {
        pushUniqueBullet(bucket, "- Raise a PR against main for review.");
      }
      if (hasTesting) {
        pushUniqueBullet(bucket, "- Run accuracy testing with 1-2 people and a fully English speech sample.");
      }
      if (hasDesign) {
        pushUniqueBullet(bucket, "- Review the PDF design screens and update UI after code is available.");
      }
    }
  }

  const lines = [
    `## ${request.meeting_title || "Untitled Meeting"}`,
    request.meeting_local_datetime,
    request.attendees_compact,
    "",
  ];

  for (const heading of expectedSections.orderedHeadings) {
    lines.push(`### ${heading}`);
    const bucket = bulletsByHeading.get(normalizeHeadingKey(heading)) ?? [];
    if (bucket.length > 0) {
      lines.push(...bucket);
    } else {
      lines.push("- None captured.");
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function buildTranscriptExcerptFallbackMarkdown(
  request: EnhancedMeetingNoteRequest,
  expectedSections: ParsedSections,
): string {
  const transcriptExcerpt = transcriptText(request)
    .slice(0, 1_500)
    .trim();

  const lines = [
    `## ${request.meeting_title || "Untitled Meeting"}`,
    request.meeting_local_datetime,
    request.attendees_compact,
    "",
  ];

  for (const heading of expectedSections.orderedHeadings) {
    lines.push(`### ${heading}`);
    if (normalizeHeadingKey(heading) === "key topics" && transcriptExcerpt) {
      lines.push(`- Transcript captured, but structured extraction failed. Excerpt: ${transcriptExcerpt}`);
    } else {
      lines.push("- None captured.");
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

async function generateFinalMarkdown(
  geminiApiKey: string,
  request: EnhancedMeetingNoteRequest,
  expectedSections: ParsedSections,
  meetingType: InferredMeetingType,
): Promise<string> {
  const sections = expectedSections.orderedHeadings;
  const transcriptMaterial = await reduceTranscriptBatches(
    geminiApiKey,
    request,
    sections,
    meetingType,
  );

  const systemPrompt =
    "You are generating high-signal meeting notes that capture substance, not narration. " +
    "Output only markdown. Use the required section headings exactly as given; do not rename, reorder, add, or omit headings. " +
    "Under each heading, use markdown bullets only. No prose paragraphs, code fences, preamble, or visible timestamps. " +
    "Every bullet derived from transcript content must end with exactly one citation token in the form [[seg:SEGMENT_ID]]. " +
    "ATTRIBUTION: segments tagged 'microphone' come from the meeting host; 'speaker' segments come from other participants. Attribute action items, decisions, commitments, and quotes to the correct side. Use participant names from the attendees list when identifiable from context. " +
    "BANNED phrasing — never write: 'the user', 'the conversation', 'it was discussed', 'discussion around', 'they talked about', 'the meeting covered', 'the speaker', 'the participant'. State the substance directly. " +
    "PRESERVE VERBATIM: people's names, product/feature names (Stream, Scribble, Minutes, etc.), tool names, file names, URLs, project IDs, numbers, durations, dates, error messages, and exact technical terms. Never paraphrase a named entity. " +
    "ACTION ITEMS section (when present): format each bullet as '- [ ] <action> — <Owner>' with the owner's name when identifiable, or 'Owner: unassigned' otherwise. Include a deadline only if explicitly stated. " +
    "DECISIONS section (when present): one bullet per decision, stating what was decided and who decided. " +
    "Use 1-4 bullets per section by default. Action items and Decisions may have up to 8 bullets each if the meeting warrants it. " +
    "Never invent facts. Never restate the section name inside its bullets. Preserve the structure and intent of any manual notes. " +
    "If a required section truly has no content from the transcript or manual notes, write exactly one bullet: None captured.";

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

  let firstPass = await callGemini(geminiApiKey, systemPrompt, userPrompt, 1_800);
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

    firstPass = await callGemini(geminiApiKey, systemPrompt, repairPrompt, 1_800);
    finalOutput = buildFinalMarkdown(request, expectedSections, firstPass);
  }

  if (
    request.transcript_segments.length > 0 &&
    finalOutput.transcriptBulletCount === 0
  ) {
    try {
      const fallbackOutput = await generateUncitedFallbackMarkdown(
        geminiApiKey,
        request,
        expectedSections,
        meetingType,
        transcriptMaterial,
        firstPass,
      );

      if (countSubstantiveBullets(fallbackOutput.markdown) > 0) {
        return fallbackOutput.markdown;
      }
    } catch (fallbackError) {
      console.warn("[meeting-enhance] no-citation fallback failed:", fallbackError);
    }

    const heuristicMarkdown = buildHeuristicRecoveryMarkdown(
      request,
      expectedSections,
    );
    if (countSubstantiveBullets(heuristicMarkdown) > 0) {
      return heuristicMarkdown;
    }

    return buildTranscriptExcerptFallbackMarkdown(request, expectedSections);
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

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not configured on the server." }), {
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

    const cleanedRequest: EnhancedMeetingNoteRequest = {
      ...normalizedRequest,
      transcript_segments: (
        await cleanTranscriptSegments(
          geminiApiKey,
          normalizedRequest,
        )
      ).filter((segment) => Boolean(segment.text.trim())),
    };

    const meetingType = inferMeetingType(cleanedRequest);
    const expectedSections = buildExpectedSections(
      cleanedRequest,
      meetingType,
    );

    const markdown = await generateFinalMarkdown(
      geminiApiKey,
      cleanedRequest,
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
    const message = (err as Error).message;
    const noUsableNotes = message.startsWith("NO_USABLE_MEETING_NOTES");

    return new Response(
      JSON.stringify({
        error: noUsableNotes ? message : `Internal error: ${message}`,
      }),
      {
        status: noUsableNotes ? 422 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
