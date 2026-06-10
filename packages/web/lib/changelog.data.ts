// ─────────────────────────────────────────────────────────────────────────
// Changelog — single source of truth for the /changelog page.
//
// HOW TO ADD A RELEASE (do this when you cut a vX.Y.Z tag):
//   1. Prepend a new entry to the top of RELEASES (newest first).
//   2. `version` = the git tag (e.g. "v0.7.36"). `date` = release date,
//      formatted "DD MON YYYY" (e.g. "10 JUN 2026").
//   3. Pull the change lines straight from the GitHub release body — they're
//      already tagged NEW: / FIX: / FAST: by git-cliff (see cliff.toml).
//      Map them to `kind`:  NEW → "new",  FIX → "fixed",  FAST → "improved".
//   4. `area` is the product surface the change touches (used by the filter
//      chips): STREAM | MINUTES | SCRIBBLE | DESKTOP | WEB | TEAMS.
//   5. Optional editorial fields — `title` (a human headline), `lede` (one
//      sentence of context), `featured` (terracotta node + larger title),
//      `vignette` (the Stream-pill visual; reserve for Stream releases).
//
// Keep it honest: every change here shipped in a real release. The terse
// release-body wording is lightly polished for reading, not invented.
// Full version history lives at github.com/navgurukul/oscar/releases.
// ─────────────────────────────────────────────────────────────────────────

export type ChangeKind = "new" | "improved" | "fixed";

export type ChangeArea =
  | "STREAM"
  | "MINUTES"
  | "SCRIBBLE"
  | "DESKTOP"
  | "WEB"
  | "TEAMS";

export interface Change {
  kind: ChangeKind;
  area: ChangeArea;
  text: string;
}

export interface Release {
  version: string;
  date: string;
  /** Dominant surface for this release — drives the left-rail tag. */
  tag: string;
  title: string;
  lede?: string;
  featured?: boolean;
  vignette?: boolean;
  changes: Change[];
}

export const RELEASES: Release[] = [
  {
    version: "v0.7.38",
    date: "10 JUN 2026",
    tag: "TEAMS",
    title: "Team auto-join & tougher sign-in",
    lede: "Claim your email domain so teammates land in your workspace automatically, sign-in only trusts a flow you started, and a shaky network no longer logs you out.",
    changes: [
      { kind: "new", area: "TEAMS", text: "Claim an email domain for your org so anyone who signs up with that domain joins your workspace automatically." },
      { kind: "improved", area: "DESKTOP", text: "Desktop sign-in fails closed — only the exact sign-in you started on this device is accepted." },
      { kind: "improved", area: "DESKTOP", text: "A flaky or offline network no longer signs you out; your session is kept and retried." },
      { kind: "fixed", area: "SCRIBBLE", text: "Deleting a note updates Trash immediately instead of lagging behind." },
    ],
  },
  {
    version: "v0.7.37",
    date: "10 JUN 2026",
    tag: "WEB",
    title: "Security & editing hardening",
    lede: "Sign-in and shared links are tougher, editing reshaped notes no longer loses work, and your free monthly limit now reads true.",
    changes: [
      { kind: "fixed", area: "SCRIBBLE", text: "Editing a note in bullet, summary, or email view no longer does nothing or overwrites your original — edits land where you expect." },
      { kind: "fixed", area: "WEB", text: "Free plan now shows the correct monthly Scribble limit, matching what's enforced." },
      { kind: "improved", area: "DESKTOP", text: "Hardened sign-in so only a sign-in you started is accepted." },
      { kind: "improved", area: "WEB", text: "Hardened redirect handling and added browser security headers across the app." },
    ],
  },
  {
    version: "v0.7.36",
    date: "10 JUN 2026",
    tag: "DESKTOP",
    title: "Sharper dictation, steadier sign-in",
    lede: "Whisper handles repetition and Hinglish more gracefully, expired desktop sessions send you back to sign-in cleanly, and this changelog is new.",
    changes: [
      { kind: "fixed", area: "DESKTOP", text: "Transcription is more robust against repetition loops, hallucinations, and Hinglish speech." },
      { kind: "fixed", area: "DESKTOP", text: "An expired session now lands you on the sign-in screen instead of a stuck recording pill." },
      { kind: "new", area: "WEB", text: "Added this changelog page with a release timeline." },
    ],
  },
  {
    version: "v0.7.35",
    date: "10 JUN 2026",
    tag: "STREAM",
    featured: true,
    vignette: true,
    title: "Stream goes local-first",
    lede: "Dictation now stays on your machine and behind sign-in, you can leave feedback on any result, and Minutes are ready to share with a link.",
    changes: [
      { kind: "new", area: "STREAM", text: "Stream is now local-only and sign-in gated — dictations never leave your machine or reach the web." },
      { kind: "new", area: "STREAM", text: "Leave free-text feedback on any dictation; submitting it persists the stream." },
      { kind: "new", area: "MINUTES", text: "Meetings are public-by-default, so sharing Minutes is a single step." },
      { kind: "new", area: "MINUTES", text: "Shared Minutes now link straight back to the full minutes in Oscar." },
      { kind: "fixed", area: "STREAM", text: "Shortened the stream row's “Save as Scribble” action to just “Save”." },
    ],
  },
  {
    version: "v0.7.34",
    date: "09 JUN 2026",
    tag: "STREAM",
    title: "Sharper context, safer transcripts",
    changes: [
      { kind: "fixed", area: "STREAM", text: "The Stream pill now shows a context label for both known and unknown apps." },
      { kind: "fixed", area: "SCRIBBLE", text: "Transcripts are saved before AI distillation and recover gracefully from quota failures." },
      { kind: "fixed", area: "STREAM", text: "Whisper reads the language from a ref, fixing stale state when switching pills." },
    ],
  },
  {
    version: "v0.7.33",
    date: "09 JUN 2026",
    tag: "DESKTOP",
    title: "macOS packaging & audio, hardened",
    lede: "The macOS bundle is sealed and verified at build time, and recorded audio is decoded natively for fewer surprises.",
    changes: [
      { kind: "fixed", area: "DESKTOP", text: "macOS builds now produce a valid signature seal, gated by a verify step." },
      { kind: "fixed", area: "DESKTOP", text: "Recorded audio is decoded in Rust rather than the WKWebView." },
    ],
  },
  {
    version: "v0.7.31",
    date: "09 JUN 2026",
    tag: "DESKTOP",
    title: "Windows audio capture fix",
    changes: [
      { kind: "fixed", area: "DESKTOP", text: "Prefer WebM over MP4 to dodge the AAC decoder gap on Windows." },
    ],
  },
  {
    version: "v0.7.30",
    date: "09 JUN 2026",
    tag: "SCRIBBLE",
    title: "Scribble on Mercury 2 — faster, sturdier",
    lede: "Scribble generation moves to Mercury 2 for lower latency, alongside a wide sweep of reliability fixes across saving, translation, recording, and billing.",
    changes: [
      { kind: "new", area: "SCRIBBLE", text: "Scribble generation migrated to Mercury 2 — noticeably lower latency." },
      { kind: "new", area: "STREAM", text: "Added a microphone-only mute capability." },
      { kind: "fixed", area: "SCRIBBLE", text: "More resilient Scribble saving when the database suppresses a returning row." },
      { kind: "fixed", area: "SCRIBBLE", text: "Confirm before trashing a Scribble." },
      { kind: "fixed", area: "SCRIBBLE", text: "Fixed bidirectional translation, including English → Hindi." },
      { kind: "fixed", area: "SCRIBBLE", text: "Continue Recording resumes only once speech-to-text is ready." },
      { kind: "fixed", area: "SCRIBBLE", text: "Restart the WebKit STT session to capture the full transcript." },
      { kind: "fixed", area: "STREAM", text: "Dictation cleanup now honors the selected language." },
      { kind: "fixed", area: "TEAMS", text: "Restored back navigation on gated org analytics & audit pages." },
      { kind: "fixed", area: "WEB", text: "Library list syncs via the React Query cache after writes." },
      { kind: "fixed", area: "WEB", text: "Missing-API-key errors are now provider-neutral." },
      { kind: "fixed", area: "WEB", text: "Recreate a stale Razorpay customer when keys rotate." },
      { kind: "fixed", area: "WEB", text: "Refresh a stale Supabase token before user-scoped writes." },
      { kind: "fixed", area: "DESKTOP", text: "Restored the stock updater install flow." },
      { kind: "fixed", area: "DESKTOP", text: "Stop the pill hover poller before installing an update — fixes a hung Restart." },
      { kind: "fixed", area: "DESKTOP", text: "Reopen the main window after closing on Windows & macOS." },
    ],
  },
  {
    version: "v0.7.21",
    date: "03 JUN 2026",
    tag: "MINUTES",
    title: "Share a meeting with a link",
    changes: [
      { kind: "new", area: "MINUTES", text: "Public shareable links in meeting summaries." },
    ],
  },
  {
    version: "v0.7.20",
    date: "03 JUN 2026",
    tag: "WEB",
    title: "Settings, redesigned",
    lede: "The Settings screens are rebuilt in the v2 editorial system, with a couple of layout and titling fixes alongside.",
    changes: [
      { kind: "new", area: "WEB", text: "Settings screens rebuilt in the v2 editorial design system." },
      { kind: "fixed", area: "MINUTES", text: "Minutes result columns stack cleanly below ~1040px." },
      { kind: "fixed", area: "SCRIBBLE", text: "Disabled 2.5-flash thinking on the title route so titles generate reliably." },
    ],
  },
  {
    version: "v0.7.19",
    date: "02 JUN 2026",
    tag: "SCRIBBLE",
    title: "Recordings survive navigation",
    changes: [
      { kind: "fixed", area: "SCRIBBLE", text: "A recording stays alive across back navigation and tab switches." },
    ],
  },
];

/** Filter chips for the changelog hero — "All" plus every area in use. */
export const CHANGELOG_FILTERS: Array<{ label: string; area: ChangeArea | null }> = [
  { label: "All", area: null },
  { label: "Stream", area: "STREAM" },
  { label: "Minutes", area: "MINUTES" },
  { label: "Scribble", area: "SCRIBBLE" },
  { label: "Desktop", area: "DESKTOP" },
  { label: "Web", area: "WEB" },
  { label: "Teams", area: "TEAMS" },
];
