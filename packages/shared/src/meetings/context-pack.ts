import type {
  EnhancedMeetingNoteRequest,
  MeetingContextConfidence,
  MeetingContextItem,
  MeetingContextItemKind,
  MeetingContextPack,
  MeetingContextSource,
} from "../types/meeting.types";

type VocabularyInput =
  | string
  | {
      term?: string | null;
      pronunciation?: string | null;
      context?: string | null;
    };

interface WorkspaceGlossaryEntry {
  label: string;
  kind: MeetingContextItemKind;
  aliases?: string[];
  note?: string;
}

export interface BuildMeetingContextPackOptions {
  vocabulary?: VocabularyInput[];
  workspaceGlossary?: WorkspaceGlossaryEntry[];
  maxTranscriptCandidates?: number;
}

const DEFAULT_MAX_TRANSCRIPT_CANDIDATES = 16;
const MAX_CONTEXT_ITEMS = 80;

const DEFAULT_WORKSPACE_GLOSSARY: WorkspaceGlossaryEntry[] = [
  { label: "OSCAR", kind: "product", aliases: ["oscar"] },
  { label: "Stream", kind: "feature", aliases: ["stream"] },
  { label: "Scribble", kind: "feature", aliases: ["scribbles", "scribble"] },
  { label: "Minutes", kind: "feature", aliases: ["minutes"] },
  { label: "dictation pill", kind: "feature", aliases: ["pill", "bottom pill", "edge handle"] },
  {
    label: "Click to dictate",
    kind: "feature",
    aliases: ["click to dictate", "click to dedicate", "click dictate"],
  },
  {
    label: "Ctrl+Space",
    kind: "shortcut",
    aliases: ["ctrl space", "control space", "control plus space", "ctrl+space", "control + space"],
  },
  { label: "API", kind: "tool", aliases: ["api"] },
  { label: "payload", kind: "tool", aliases: ["payload", "pay load"] },
  { label: "Network tab", kind: "tool", aliases: ["network tab"] },
  { label: "console debug", kind: "tool", aliases: ["console debug", "debug statement", "debug statements"] },
  { label: "Gemini", kind: "product", aliases: ["gemini"] },
  { label: "Whisper", kind: "product", aliases: ["whisper"] },
  { label: "Supabase", kind: "product", aliases: ["supabase"] },
  { label: "Slack", kind: "tool", aliases: ["slack"] },
  { label: "Notion", kind: "tool", aliases: ["notion", "noshan"] },
];

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "and",
  "also",
  "because",
  "before",
  "being",
  "better",
  "button",
  "called",
  "check",
  "click",
  "coming",
  "could",
  "data",
  "doing",
  "error",
  "exactly",
  "feature",
  "first",
  "from",
  "have",
  "into",
  "issue",
  "last",
  "like",
  "maybe",
  "meeting",
  "note",
  "notes",
  "only",
  "open",
  "other",
  "point",
  "points",
  "problem",
  "proper",
  "really",
  "response",
  "same",
  "screen",
  "should",
  "slow",
  "something",
  "start",
  "stop",
  "testing",
  "text",
  "then",
  "there",
  "thing",
  "this",
  "time",
  "when",
  "where",
  "which",
  "with",
  "would",
  "write",
]);

const TECH_CONTEXT_RE =
  /\b(api|payload|network|console|debug|response|request|server|audio|text|transcription|transcript|dictation|minutes|ctrl|control|space|tab|window|browser|slack|notion|ai|model|gemini|whisper|supabase|error|bug|issue|testing|test|slow|hang|hanging|latency|prompt)\b/i;

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hasPhrase(haystack: string, phrase: string): boolean {
  const normalizedPhrase = normalizeLabel(phrase);
  if (!normalizedPhrase) return false;
  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^| )${escaped}( |$)`).test(haystack);
}

function vocabularyLabel(value: VocabularyInput): string {
  if (typeof value === "string") return value;
  return value.term ?? "";
}

function vocabularyNote(value: VocabularyInput): string | undefined {
  if (typeof value === "string") return undefined;
  const parts = [
    value.pronunciation ? `Sounds like: ${value.pronunciation}` : "",
    value.context ? `Context: ${value.context}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("; ") : undefined;
}

function inferKind(label: string, fallback: MeetingContextItemKind = "unknown"): MeetingContextItemKind {
  const normalized = normalizeLabel(label);
  if (/\b(ctrl|control|space|cmd|command|shortcut)\b/.test(normalized)) return "shortcut";
  if (/\b(api|payload|network|console|slack|notion|browser|tab|debug)\b/.test(normalized)) return "tool";
  if (/\b(stream|scribble|minutes|dictate|dictation|pill)\b/.test(normalized)) return "feature";
  if (/\b(oscar|gemini|whisper|supabase)\b/.test(normalized)) return "product";
  if (/\b(test|testing|qa|feedback|triage|process)\b/.test(normalized)) return "process";
  return fallback;
}

function pushItem(
  itemsByKey: Map<string, MeetingContextItem>,
  label: string,
  source: MeetingContextSource,
  confidence: MeetingContextConfidence,
  kind: MeetingContextItemKind = "unknown",
  note?: string,
): void {
  const cleaned = cleanLabel(label);
  const normalized = normalizeLabel(cleaned);
  if (!cleaned || !normalized) return;

  const existing = itemsByKey.get(normalized);
  if (existing) {
    const confidenceRank = { low: 1, medium: 2, high: 3 } as const;
    if (confidenceRank[confidence] > confidenceRank[existing.confidence]) {
      existing.confidence = confidence;
      existing.source = source;
    }
    if (existing.kind === "unknown" && kind !== "unknown") existing.kind = kind;
    if (
      !existing.note &&
      note &&
      confidenceRank[confidence] >= confidenceRank[existing.confidence]
    ) {
      existing.note = note;
    }
    return;
  }

  itemsByKey.set(normalized, {
    label: cleaned,
    normalized_label: normalized,
    kind: kind === "unknown" ? inferKind(cleaned, kind) : kind,
    source,
    confidence,
    ...(note ? { note } : {}),
  });
}

function transcriptText(request: EnhancedMeetingNoteRequest): string {
  return [
    request.meeting_title,
    request.calendar_context?.event_title ?? "",
    request.my_notes_markdown,
    ...request.transcript_segments.map((segment) => segment.text),
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function addCalendarContext(
  itemsByKey: Map<string, MeetingContextItem>,
  request: EnhancedMeetingNoteRequest,
): void {
  pushItem(itemsByKey, request.meeting_title, "calendar", "high", "process", "Meeting title");
  if (request.calendar_context?.event_title) {
    pushItem(
      itemsByKey,
      request.calendar_context.event_title,
      "calendar",
      "high",
      "process",
      "Calendar event title",
    );
  }
}

function addAttendeeContext(
  itemsByKey: Map<string, MeetingContextItem>,
  request: EnhancedMeetingNoteRequest,
): void {
  for (const attendee of request.attendees_full) {
    pushItem(itemsByKey, attendee.name, "attendee", "high", "person", attendee.email || undefined);
    if (attendee.email) {
      pushItem(itemsByKey, attendee.email, "attendee", "high", "person", attendee.name || undefined);
    }
  }
}

function addVocabularyContext(
  itemsByKey: Map<string, MeetingContextItem>,
  vocabulary: VocabularyInput[],
): void {
  for (const entry of vocabulary) {
    pushItem(
      itemsByKey,
      vocabularyLabel(entry),
      "user_vocabulary",
      "high",
      "unknown",
      vocabularyNote(entry),
    );
  }
}

function addWorkspaceGlossaryContext(
  itemsByKey: Map<string, MeetingContextItem>,
  normalizedHaystack: string,
  glossary: WorkspaceGlossaryEntry[],
): void {
  for (const entry of glossary) {
    const matched =
      hasPhrase(normalizedHaystack, entry.label) ||
      (entry.aliases ?? []).some((alias) => hasPhrase(normalizedHaystack, alias));
    if (!matched) continue;

    pushItem(
      itemsByKey,
      entry.label,
      "workspace_glossary",
      "high",
      entry.kind,
      entry.note,
    );
  }
}

function addRepeatedTranscriptCandidates(
  itemsByKey: Map<string, MeetingContextItem>,
  rawTranscript: string,
  maxCandidates: number,
): void {
  const counts = new Map<string, { label: string; count: number }>();
  const sentences = rawTranscript
    .split(/[.!?\n]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && TECH_CONTEXT_RE.test(sentence));

  for (const sentence of sentences) {
    const tokens = sentence.match(/\b[A-Za-z][A-Za-z0-9+.-]{2,}\b/g) ?? [];
    for (const token of tokens) {
      const normalized = normalizeLabel(token);
      if (!normalized || normalized.length < 3 || STOP_WORDS.has(normalized)) continue;
      const current = counts.get(normalized) ?? { label: token, count: 0 };
      current.count += 1;
      counts.set(normalized, current);
    }
  }

  [...counts.values()]
    .filter((entry) => entry.count >= 2)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, maxCandidates)
    .forEach((entry) => {
      pushItem(
        itemsByKey,
        entry.label,
        "transcript_candidate",
        "medium",
        inferKind(entry.label),
        `Repeated ${entry.count} times near technical context`,
      );
    });
}

function addLowConfidenceSingletons(
  itemsByKey: Map<string, MeetingContextItem>,
  rawTranscript: string,
  maxCandidates: number,
): void {
  const patterns = [
    /\b(?:feature\s+name|name|option|button|term)\s+(?:is|was|as|called|named)\s+(?:a|the)?\s*["']?([A-Za-z][A-Za-z0-9-]{2,})["']?/gi,
    /\b(?:called|named)\s+(?:a|the)?\s*["']?([A-Za-z][A-Za-z0-9-]{2,})["']?/gi,
  ];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(rawTranscript)) && seen.size < maxCandidates) {
      const label = match[1];
      const normalized = normalizeLabel(label);
      if (!normalized || STOP_WORDS.has(normalized) || seen.has(normalized)) continue;
      if (itemsByKey.has(normalized)) continue;
      seen.add(normalized);
      pushItem(
        itemsByKey,
        label,
        "transcript_candidate",
        "low",
        "unknown",
        "Single mention near naming language; do not treat as confirmed without support",
      );
    }
  }
}

export function buildMeetingContextPack(
  request: EnhancedMeetingNoteRequest,
  options: BuildMeetingContextPackOptions = {},
): MeetingContextPack {
  const itemsByKey = new Map<string, MeetingContextItem>();
  const rawTranscript = transcriptText(request);
  const normalizedHaystack = normalizeLabel(rawTranscript);
  const maxTranscriptCandidates =
    options.maxTranscriptCandidates ?? DEFAULT_MAX_TRANSCRIPT_CANDIDATES;

  addCalendarContext(itemsByKey, request);
  addAttendeeContext(itemsByKey, request);
  addVocabularyContext(itemsByKey, options.vocabulary ?? []);
  addWorkspaceGlossaryContext(
    itemsByKey,
    normalizedHaystack,
    options.workspaceGlossary ?? DEFAULT_WORKSPACE_GLOSSARY,
  );
  addRepeatedTranscriptCandidates(itemsByKey, rawTranscript, maxTranscriptCandidates);
  addLowConfidenceSingletons(itemsByKey, rawTranscript, Math.ceil(maxTranscriptCandidates / 2));

  return {
    items: [...itemsByKey.values()].slice(0, MAX_CONTEXT_ITEMS),
    summary_policy: {
      require_uncertainty_labels: true,
      glossary_suggests_only: true,
      do_not_confirm_singleton_unknown_terms: true,
    },
  };
}
