export type TranscriptPostProcessIssue = "combined-use-cum";

export interface TranscriptPostProcessChange {
  issue: TranscriptPostProcessIssue;
  before: string;
  after: string;
}

export interface TranscriptPostProcessResult {
  text: string;
  changes: TranscriptPostProcessChange[];
}

const COMBINED_USE_TERMS = [
  "walk-in wardrobe",
  "changing room",
  "powder room",
  "guest room",
  "kids room",
  "children room",
  "living room",
  "dining room",
  "puja room",
  "pooja room",
  "utility room",
  "storage room",
  "study room",
  "master bedroom",
  "bedroom",
  "bathroom",
  "kitchen",
  "wardrobe",
  "closet",
  "office",
  "study",
  "living",
  "dining",
  "pantry",
  "laundry",
  "foyer",
  "lounge",
  "library",
  "cabinet",
  "dresser",
  "mandir",
  "toilet",
] as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const combinedUseTermPattern = COMBINED_USE_TERMS
  .slice()
  .sort((left, right) => right.length - left.length)
  .map(escapeRegex)
  .join("|");

const COMBINED_USE_CONNECTOR_RE = new RegExp(
  `\\b(${combinedUseTermPattern})\\s*,?\\s+(?:come|cum)\\s+(${combinedUseTermPattern})\\b`,
  "gi",
);

function normalizeTerm(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function applyTranscriptPostProcessingWithChanges(
  input: string,
): TranscriptPostProcessResult {
  if (!input) {
    return { text: "", changes: [] };
  }

  const changes: TranscriptPostProcessChange[] = [];
  const text = input.replace(COMBINED_USE_CONNECTOR_RE, (match, left, right) => {
    const after = `${normalizeTerm(left)}-cum-${normalizeTerm(right)}`;
    changes.push({
      issue: "combined-use-cum",
      before: match,
      after,
    });
    return after;
  });

  return { text, changes };
}

export function applyTranscriptPostProcessing(input: string): string {
  return applyTranscriptPostProcessingWithChanges(input).text;
}
