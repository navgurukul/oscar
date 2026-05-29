// Cleanup style presets for desktop dictation.
//
// `CleanupStyle` is the persisted, user-chosen tone applied to cleaned-up
// dictation. It composes with context-aware routing (which adapts by detected
// app) and is applied on every dictation regardless of trigger source.
//
// Prompt Engineer is intentionally NOT a CleanupStyle: it is an ephemeral,
// per-session rewrite mode toggled from the recording pill. It maps to the wire
// value "prompt-engineer", which the ai-process edge function handles by
// swapping the cleanup system prompt for one that may restructure / expand.
export type CleanupStyle = "faithful" | "polished" | "concise";

/** Value sent to the ai-process edge function: the persisted tone style OR the
 *  ephemeral prompt-engineer override. */
export type CleanupStyleWire = CleanupStyle | "prompt-engineer";

export const DEFAULT_CLEANUP_STYLE: CleanupStyle = "faithful";

export interface CleanupStyleOption {
  value: CleanupStyle;
  label: string;
  hint: string;
}

export const CLEANUP_STYLE_OPTIONS: ReadonlyArray<CleanupStyleOption> = [
  {
    value: "faithful",
    label: "Faithful",
    hint: "Clean up only — fix grammar and filler, keep your wording.",
  },
  {
    value: "polished",
    label: "Polished",
    hint: "Smooth the phrasing into clean, professional prose.",
  },
  {
    value: "concise",
    label: "Concise",
    hint: "Tighten and shorten while keeping every point.",
  },
];
