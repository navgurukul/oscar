import type {
  MeetingAttendee,
  MeetingTranscriptSegment,
  MeetingTranscriptSource,
} from "../types/meeting.types";
import type { MeetingSegmentJob, Transcription } from "./app-types";

export interface SpeakerLabels {
  microphone: string;
  speaker: string;
}

const DEFAULT_HOST_LABEL = "You";
const DEFAULT_OTHERS_LABEL = "Others";

function normalizeEmail(value: string | undefined | null): string {
  return (value || "").trim().toLowerCase();
}

function preferredAttendeeLabel(attendee: MeetingAttendee): string {
  const name = attendee.name?.trim();
  if (name) return name;
  const email = attendee.email?.trim();
  if (email) return email;
  return "";
}

export function resolveSpeakerLabels(
  attendees: MeetingAttendee[],
  hostName: string,
  hostEmail: string,
): SpeakerLabels {
  const micLabel = hostName?.trim() || hostEmail?.trim() || DEFAULT_HOST_LABEL;
  const hostKey = normalizeEmail(hostEmail);

  const others = attendees.filter((attendee) => {
    const email = normalizeEmail(attendee.email);
    if (hostKey && email && email === hostKey) return false;
    return Boolean(preferredAttendeeLabel(attendee));
  });

  if (others.length === 1) {
    const label = preferredAttendeeLabel(others[0]);
    return {
      microphone: micLabel,
      speaker: label || DEFAULT_OTHERS_LABEL,
    };
  }

  return {
    microphone: micLabel,
    speaker: DEFAULT_OTHERS_LABEL,
  };
}

export interface TranscriptTurn {
  source: MeetingTranscriptSource;
  label: string;
  text: string;
  startTime: string;
  endTime: string;
}

export function groupSegmentsIntoTurns(
  segments: MeetingTranscriptSegment[],
  labels: SpeakerLabels,
): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  for (const segment of segments) {
    const text = segment.text.trim();
    if (!text) continue;

    const source = segment.speaker.source;
    const label = source === "microphone" ? labels.microphone : labels.speaker;
    const previous = turns[turns.length - 1];

    if (previous && previous.source === source) {
      previous.text = appendTranscriptSegment(previous.text, text);
      previous.endTime = segment.end_time;
      continue;
    }

    turns.push({
      source,
      label,
      text,
      startTime: segment.start_time,
      endTime: segment.end_time,
    });
  }
  return turns;
}

export function buildLabeledTranscript(
  segments: MeetingTranscriptSegment[],
  labels: SpeakerLabels,
): string {
  const turns = groupSegmentsIntoTurns(segments, labels);
  if (turns.length === 0) return "";
  return turns.map((turn) => `${turn.label}: ${turn.text}`).join("\n\n");
}

export function getTranscriptTailWords(text: string, wordCount: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return undefined;
  return words.slice(-wordCount).join(" ");
}

export function normalizeTranscriptBoundary(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function appendTranscriptSegment(existing: string, nextSegment: string) {
  const trimmedExisting = existing.trim();
  const trimmedNext = nextSegment.trim();
  if (!trimmedExisting) return trimmedNext;
  if (!trimmedNext) return trimmedExisting;

  const existingWords = trimmedExisting.split(/\s+/);
  const nextWords = trimmedNext.split(/\s+/);
  const maxOverlap = Math.min(20, existingWords.length, nextWords.length);

  for (let overlap = maxOverlap; overlap >= 1; overlap -= 1) {
    const existingSlice = normalizeTranscriptBoundary(
      existingWords.slice(-overlap).join(" "),
    );
    const nextSlice = normalizeTranscriptBoundary(
      nextWords.slice(0, overlap).join(" "),
    );
    if (existingSlice && existingSlice === nextSlice) {
      return `${trimmedExisting} ${nextWords.slice(overlap).join(" ")}`.trim();
    }
  }

  return `${trimmedExisting} ${trimmedNext}`.trim();
}

export function segmentsAreLikelyDuplicates(
  left: MeetingTranscriptSegment,
  right: MeetingTranscriptSegment,
) {
  const leftStart = Date.parse(left.start_time);
  const rightStart = Date.parse(right.start_time);
  const leftEnd = Date.parse(left.end_time);
  const rightEnd = Date.parse(right.end_time);
  const sameText =
    normalizeTranscriptBoundary(left.text) ===
    normalizeTranscriptBoundary(right.text);
  const containedText =
    normalizeTranscriptBoundary(left.text).includes(
      normalizeTranscriptBoundary(right.text),
    ) ||
    normalizeTranscriptBoundary(right.text).includes(
      normalizeTranscriptBoundary(left.text),
    );
  const timesOverlap =
    Number.isFinite(leftStart) &&
    Number.isFinite(rightStart) &&
    Number.isFinite(leftEnd) &&
    Number.isFinite(rightEnd) &&
    leftStart <= rightEnd + 5_000 &&
    rightStart <= leftEnd + 5_000;
  const differentSources = left.speaker.source !== right.speaker.source;

  return differentSources && timesOverlap && (sameText || containedText);
}

export function mergeMeetingTranscriptSegments(
  existing: MeetingTranscriptSegment[],
  nextSegments: MeetingTranscriptSegment[],
) {
  const sorted = [...existing, ...nextSegments].sort((left, right) => {
    const byStart = Date.parse(left.start_time) - Date.parse(right.start_time);
    if (byStart !== 0) return byStart;
    return Date.parse(left.end_time) - Date.parse(right.end_time);
  });

  const merged: MeetingTranscriptSegment[] = [];
  for (const segment of sorted) {
    const trimmedText = segment.text.trim();
    if (!trimmedText) continue;

    const normalizedSegment = { ...segment, text: trimmedText };
    const previous = merged[merged.length - 1];
    if (!previous || !segmentsAreLikelyDuplicates(previous, normalizedSegment)) {
      merged.push(normalizedSegment);
      continue;
    }

    if (normalizedSegment.text.length > previous.text.length) {
      merged[merged.length - 1] = normalizedSegment;
    }
  }

  return merged;
}

export function buildTranscriptFromStructuredSegments(
  segments: MeetingTranscriptSegment[],
) {
  let nextTranscript = "";
  for (const segment of segments) {
    nextTranscript = appendTranscriptSegment(nextTranscript, segment.text);
  }
  return nextTranscript.trim();
}

export function toAbsoluteMeetingTranscriptSegments(
  job: MeetingSegmentJob,
  segments: NonNullable<Transcription["segments"]>,
): MeetingTranscriptSegment[] {
  const durationMs = Math.max(job.endedAtMs - job.startedAtMs, 1);

  return segments
    .map((segment, index) => {
      const relativeStartMs = Math.max(0, segment.start_ms);
      const relativeEndMs = Math.max(relativeStartMs + 10, segment.end_ms);
      const absoluteStartMs = job.startedAtMs + relativeStartMs;
      const absoluteEndMs = Math.min(job.endedAtMs, job.startedAtMs + relativeEndMs);
      const clampedEndMs = Math.max(
        absoluteStartMs + 10,
        durationMs > 0 ? absoluteEndMs : absoluteStartMs + 10,
      );

      return {
        id: `seg-${job.segmentIndex}-${index}-${segment.speaker.source}`,
        speaker: segment.speaker,
        text: segment.text.trim(),
        start_time: new Date(absoluteStartMs).toISOString(),
        end_time: new Date(clampedEndMs).toISOString(),
      };
    })
    .filter((segment) => Boolean(segment.text));
}

export function toFallbackMeetingTranscriptSegment(
  job: MeetingSegmentJob,
  text: string,
): MeetingTranscriptSegment | null {
  const trimmedText = text.trim();
  if (!trimmedText) return null;

  const source = job.useSystemAudio ? "speaker" : "microphone";

  return {
    id: `seg-${job.segmentIndex}-0-${source}`,
    speaker: { source },
    text: trimmedText,
    start_time: new Date(job.startedAtMs).toISOString(),
    end_time: new Date(Math.max(job.endedAtMs, job.startedAtMs + 1)).toISOString(),
  };
}
