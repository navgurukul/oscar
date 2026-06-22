# Oscar Roadmap

Product ideas, planned features. Not prioritized — ordering loose.

## Plan Status Snapshot

- **Context-aware dictation**: In progress. Desktop capture, routing, prompt versioning, settings toggle, Stream cleanup wiring, and saved-note metadata persistence exist. Remaining work: feedback analytics by context, and user-facing context labels on web.
- **Vibe Coding Mode**: Planned. Design mocks exist; no dedicated API route, hook, or mode selector shipped. The unwired settings stub was **removed** (commit `d5448aa`) — only the pill's `prompt-engineer` cleanup-style preset exists today as a partial stand-in. Note: Mercury 2, not Gemini, would back this.
- **VAD for hands-free dictation**: Partly shipped. Whisper now has a VAD pre-filter to strip silence before inference, and Stream has a 200 ms release tail buffer. Hands-free auto-arm / auto-finalize is still planned.
- **Littlebird.ai-style work memory clone**: Added below as a product-flow bet. Scope should stay Oscar-native: voice-first, explicit privacy controls, no invisible capture by default.
- **Observability**: Planned. No error tracking, no analytics, no AI-quality telemetry wired today. Production runs blind. Detail below.

---

## Context-Aware Dictation

**Status**: In progress.

**Shipped**:

- Desktop hotkey / pill / tray capture frontmost app context before recording starts.
- Shared `DictationContextSnapshot` / `DictationRoutingResult` contract exists.
- Routing supports `default`, `ide`, `email`, `docs`, `chat`, and `browser` categories.
- Desktop Stream passes context/routing into `transcribe_cleanup`.
- Settings expose context-aware dictation behind AI cleanup.
- Routing metadata is persisted on every desktop save path: the Stream history record and promoting a local transcript to a saved Scribble both carry category, app key, context source, and prompt version. (Web has no record-time context — context awareness is desktop-only by design.)

**Remaining**:

- Add feedback analytics grouped by category, app key, context source, and prompt version.
- Add small user-facing context labels on the web scribble list/detail (desktop already renders them via `ContextLabel`).

**Problem**: Oscar formats all notes same way regardless of where user works. Note dictated inside VS Code needs different treatment than Gmail or Notion.

**Idea**: Detect active app at recording time (desktop) or active browser tab/domain (web), use context to:

- Pick right formatting style automatically (code comments vs prose vs bullet list vs email)
- Preserve domain-specific terminology (function names, ticket IDs, brand names)
- Adjust tone (technical/terse for dev tools, conversational for messaging apps)
- Feed context into system prompt of formatting agent so outputs immediately usable in that environment

**Surfaces affected**:
- Desktop: Tauri can query OS for frontmost app via Rust command
- Web extension (future): `chrome.tabs.query` gives active tab URL/title

**Rough flow**:
```
Record → [active app / tab context captured] → STT → Format Agent (context-aware prompt) → Note
```

**Implementation touch points**:
- Desktop: new Tauri command in `src-tauri/` to get frontmost app name/bundle ID
- Shared context type in `@oscar/shared/types`
- `AI_CONFIG` / prompt selection logic in `lib/services/ai.service.ts`
- New prompt variants in `lib/prompts.ts` keyed by app category (ide, browser, email, docs, chat)
- Pass context through recording hook → format API route → Mercury 2 call (Gemini is Minutes/embeddings only)

---

## Vibe Coding Mode

**Status**: Planned.

**Problem**: When using Oscar as voice interface for coding agents (Claude, Cursor, Copilot, etc.), users speak casually and incompletely. Raw-to-formatted pipeline preserves fidelity — but for coding prompts, fidelity to lazy input is wrong goal. Prompt itself should improve, not just clean.

**Idea**: Dedicated "Vibe Coding" mode that:

1. **Understands coding context** — recognizes library names, CLI flags, file paths, error messages, dev jargon even when mumbled or abbreviated
2. **Prompt-engineers output** — takes vague spoken intent, rewrites as high-quality specific prompt ready to paste into coding agent
3. **Fills in blanks** — if user says "make that function faster", agent infers likely language, looks at context (if available), produces prompt like: "Refactor the `processItems` function in `utils/data.ts` to improve performance — consider memoization or early exits. Explain the changes."
4. **Does not format passively** — unlike base formatting agent which only cleans what was said, Vibe Coding mode allowed to add, restructure, strengthen prompt

**Activation**: Toggle in settings or dedicated recording mode (e.g., long-press recording button → mode picker). On desktop, could bind to separate global shortcut.

**Key distinction from base formatting agent**:

| Base Agent | Vibe Coding Agent |
|---|---|
| Never adds content | Actively expands + strengthens |
| Preserves original intent verbatim | Infers and clarifies intent |
| Removes filler words | Restructures entire prompt |
| Output = clean note | Output = effective coding prompt |

**Rough flow**:
```
Record (Vibe Coding mode) → STT → Prompt Enhancement Agent → Ready-to-paste coding prompt → Clipboard / note
```

**Implementation touch points**:
- New API route: `app/api/ai/vibe-code/route.ts`
- New system prompt in `lib/prompts.ts`: `SYSTEM_PROMPTS.VIBE_CODE` — aggressive prompt engineering, coding-aware
- New hook: `useVibeCoding.ts` in `lib/hooks/`
- Mode selector UI on recording screen (web + desktop)
- Optional: active file/editor context from desktop Tauri command (feeds into prompt)
- Shared type `RecordingMode = 'note' | 'vibe-coding'` in `@oscar/shared/types`
- Settings toggle to set default mode

**Example**:
```
User says:  "uh make that like, the loading thing faster or whatever, it's janky"
Output:     "The loading state in the dashboard feels sluggish. Investigate why the skeleton 
             screen flickers — likely a race condition between data fetch and render. Optimize 
             the fetch waterfall and ensure the loading state transitions smoothly. Suggest 
             fixes with code."
```

---

## Voice Activity Detection (VAD) for Hands-Free Dictation

**Status**: Partly shipped.

**Shipped**:

- Whisper path has a frame-level VAD pre-filter that strips silence before inference and skips empty/no-speech clips.
- VAD backend supports energy VAD by default and optional Silero VAD behind a feature flag.
- Stream stop now waits 200 ms after release before stopping `MediaRecorder`, preserving the recording visual during the tail buffer and flushing final audio.

**Still planned**:

- Live VAD while recording.
- Hands-free `armed` phase.
- Auto-start on speech and auto-finalize on silence.
- User settings for `vadEnabled`, `vadSilenceMs`, and confidence thresholds.

**Problem**: Today the desktop dictation pill needs an explicit start/stop — hold `Ctrl+Space`, or click the pill, click again. That's fine for a quick burst but breaks the flow for longer dictation: the user has to keep a finger on the hotkey, and accidental releases truncate the recording. There's also no way to skip the "click to stop" step — the pill always sits at processing only when the user tells it to.

**Idea**: Run a Voice Activity Detection model on the live mic stream so the pill auto-arms on speech and auto-finalizes on silence. The user enters the hit zone (or hits the hotkey once as a toggle), then just speaks. When silence runs past a configurable threshold (~700–1200 ms), the pill transitions to processing on its own.

**Why VAD over a simple amplitude gate**:

- Amplitude gates fire on keyboard noise, fan hum, AC hiss. Real VAD models (Silero v5, WebRTC VAD, ONNX-based) classify speech-vs-noise per ~20–30 ms frame and stay robust across noisy rooms.
- Silero v5 is ~1.8 MB, ONNX-runnable, runs at >100× realtime on a single CPU core — cheap to bundle in the Tauri binary.
- WebRTC VAD is even smaller (built into most browser stacks) but more false-positive prone on music / TV background.

**Surfaces affected**:

- **Desktop only initially.** The pill is the natural entry point — we already have the mic stream warm.
- Web could follow if a meaningful streaming flow ships, but no plans yet.

**Rough flow**:

```
Pill ready / hotkey toggle on
  → MediaRecorder + VAD analyser run in parallel on the same stream
  → VAD: speech-start → flip pill to recording
  → VAD: silence > threshold → flip pill to processing, finalize
  → existing transcribe_cleanup → paste pipeline
```

**Open questions** (to settle before implementation):

- **Push-to-talk vs hands-free as default?** Likely a setting in the pill's gear popover — "Hands-free dictation" toggle. Default off so existing users aren't surprised.
- **Silence threshold tuning** — too short and pauses-for-thought truncate; too long and the user waits. Start at 900 ms, expose as a slider.
- **Confidence floor** — VAD output is probabilistic. Don't transition out of recording on a single silence frame; require N consecutive silence frames.
- **Wake on what?** Only flip to recording when speech is detected AFTER the user has hit the ready/expanded state — never spontaneously when the user is just hovering near the bottom edge.
- **Pre-roll buffer**: VAD detects speech ~100–200 ms after it starts. Keep a rolling 300 ms buffer so we don't clip the first syllable.

**Implementation touch points**:

- Add Silero v5 ONNX model to [`packages/desktop/src-tauri/resources/`](./packages/desktop/src-tauri); load via `ort` (already a transitive whisper-rs dep) or expose a small JS wrapper running in the pill's webview.
- New Rust command `vad_analyze_frame(samples: &[f32]) -> f32` returning speech probability; called from the same audio pipeline that feeds whisper-rs in [`packages/desktop/src/App.tsx`](./packages/desktop/src/App.tsx) `startHotkeyRecording`.
- Pill state machine ([`packages/desktop/public/pill.html`](./packages/desktop/public/pill.html)): add `armed` phase between `expanded` and `recording`. New events: `pill-set-phase: armed`, transitions driven by VAD probability from the host.
- Setting: `vadEnabled` + `vadSilenceMs` persisted alongside `tonePreset` / `transcriptionLanguage` / `autoPaste`.
- Surface the toggle in the existing pill settings popover and in `SettingsTab`.

**Example**:

```
User hits Ctrl+Space once (toggle), or hovers the edge handle
  → pill expands, sits in "armed" with a soft terracotta ring
  → user speaks: "draft a reply to that email about the demo"
  → pill flips to recording on first detected speech frame
  → user pauses 1 s past their last word
  → pill flips to processing → cleanup → pastes into Gmail
```

**Out of scope for v1**: speaker diarization (Murmur is single-speaker dictation), barge-in (interrupting a paste), continuous transcription with rolling final segments. Park those behind separate roadmap items if needed.

---

## Littlebird.ai-Style Work Memory Clone

**Status**: Planned.

**Reference**: [littlebird.ai](https://littlebird.ai/) positions around ambient work context: active-window awareness, meeting memory, recall, creation from prior work, scheduled updates, and privacy controls. Oscar version should borrow the flow, not copy brand/UI.

**Problem**: Oscar captures high-quality voice moments, but it does not yet feel like a work memory that already knows what user saw, said, and decided across apps. User still has to re-explain context when asking for drafts, recaps, or follow-ups.

**Idea**: Add a Littlebird-style memory layer to Oscar's desktop flow:

1. **Consent + visibility setup** — user chooses which apps/sites Oscar may observe. Default to off for passive capture.
2. **Ambient context capture** — while Stream or Minutes run, Oscar records active app/site, window title, selected text/OCR text when explicitly enabled, meeting transcript, and user dictation.
3. **Work memory timeline** — normalize captured events into a searchable personal/workspace memory: screen context, meetings, Scribbles, Streams, documents, and follow-up tasks.
4. **Ask / recall** — user asks "what did I decide about pricing?" or "find the Slack thread I mentioned in the meeting"; Oscar answers with cited source snippets.
5. **Create from memory** — user dictates or clicks "draft reply / doc / plan"; Oscar uses memory, current app context, and user voice/tone to generate output ready to paste.
6. **Routines** — scheduled briefs: daily digest, meeting prep, unresolved asks, follow-up reminders.
7. **Action loop** — output lands through existing Stream paste pipeline or saved as Scribble/Minute/doc, with source links retained.

**Rough flow**:

```
Install desktop
  → choose app visibility + retention
  → capture context during Stream / Minutes / explicit memory sessions
  → index events + transcripts + source metadata
  → ask, recall, draft, or schedule routines
  → paste into active app / save to Oscar
```

**Implementation touch points**:

- New local-first `work_events` model for observed context, transcripts, source refs, retention state, and embeddings.
- Desktop capture layer for app/site/window metadata plus optional screen text extraction.
- Memory search API with hybrid keyword/vector retrieval and source-level citations.
- New "Memory" surface in desktop/web with filters by app, meeting, date, person, and source type.
- Extend `ai-process` with `memory_recall`, `memory_create`, and `routine_digest` modes.
- Reuse context-aware routing so creation output matches Gmail, Slack, docs, IDEs, and browser inputs.
- Privacy controls: app denylist, pause capture, delete last hour/day/all, cloud sync opt-in, org policy controls.

**Risks / constraints**:

- Screen capture and OCR require explicit permission and trust copy.
- Cloud storage costs can explode without retention and summarization.
- Recall answers must cite sources; uncited memory output should be treated as low confidence.
- Workspace memory must separate personal and org data cleanly.

**MVP cut**:

- No always-on screenshots.
- Capture only Stream, Minutes, active app/site metadata, and optional selected text.
- Search + answer over saved Oscar artifacts first.
- Add routines after recall quality is reliable.

---

## Observability

**Status**: Planned. Highest-leverage foundational gap — nothing else on this list is safe to optimize without it.

**Problem**: Oscar runs in production with no error tracking, no funnel analytics, and no AI-quality telemetry. Failures only surface when users complain. Regressions in formatting quality, recording reliability, or billing flows are invisible until churn shows up in MRR. Prompt iteration is blind: feedback table exists but no dashboard. Rate-limit blocks, 5xx spikes, Whisper crashes on edge devices, Razorpay webhook drops, slow Gemini calls — all silent today.

**Idea**: Three layers stitched together, each with a clear ownership boundary:

1. **Errors + traces** — every server route, edge function, desktop Rust panic, frontend exception lands in one place with stack + user/org context.
2. **Product analytics** — funnel events from landing → signup → first record → first save → first share → retention cohorts. Per-tier (free/pro) breakdowns.
3. **AI quality telemetry** — per-call latency, token cost, retry count, helpful-rate, feedback reason tags, prompt version. Drives prompt iteration.

**Recommended stack** (cheap, batteries-included):

| Layer | Tool | Why |
|---|---|---|
| Errors + traces | Sentry | Free tier covers Oscar's scale, supports Next.js + Tauri + Rust + Edge Functions in one project, source maps + release tracking already match `vX.Y.Z` tag flow. |
| Product analytics | PostHog (self-hosted or cloud) | Event + funnel + cohort + session replay in one tool. EU host option for data residency. Free up to 1M events/mo. |
| AI quality telemetry | PostHog `$ai` events or Helicone | PostHog handles it if we want one tool; Helicone is purpose-built for LLM observability with caching/rate-limit insights baked in. |

Decide between PostHog-only and PostHog + Helicone after first month based on whether AI-specific signals (token cost per user, prompt regression detection) need richer tooling than generic events provide.

**Surfaces affected**:

- **Web (`packages/web`)**: Sentry Next.js SDK, PostHog browser client, server-side PostHog for API route events.
- **Desktop (`packages/desktop`)**: Sentry Tauri (JS frontend) + `sentry-rust` (backend), PostHog desktop client.
- **Edge functions (`supabase/functions/*`)**: Sentry Deno SDK, PostHog Node-style client.
- **Shared (`packages/shared`)**: thin `analytics` wrapper exposing `track(event, props)` + `captureError(err, ctx)` so app code stays platform-agnostic.

**Key events to track** (canonical names; keep stable):

- `auth.signed_up`, `auth.signed_in`, `auth.signed_out`
- `recording.started`, `recording.finished`, `recording.cancelled`, `recording.failed`
- `scribble.saved`, `scribble.deleted`, `scribble.shared`
- `meeting.started`, `meeting.ended`, `meeting.enhanced`
- `stream.dictation.fired`, `stream.dictation.pasted`
- `ai.format.requested`, `ai.format.succeeded`, `ai.format.failed`, `ai.format.retried`
- `ai.title.requested`, `ai.title.succeeded`, `ai.title.failed`
- `feedback.submitted` (with `helpful`, `reason`, `prompt_version`)
- `billing.checkout.opened`, `billing.subscribed`, `billing.cancelled`, `billing.payment_failed`
- `usage.limit_hit` (per-tier abuse signal)
- `rate_limit.blocked` (security signal)

**Properties on every event** (auto-attached by wrapper):

- `user_id`, `org_id`, `plan_tier`, `platform` (`web` / `desktop` / `edge`), `version`, `route`, `session_id`.

**AI-call telemetry shape**:

```ts
analytics.track('ai.format.succeeded', {
  prompt_version,
  model: 'gemini-2.5-flash',
  input_tokens,
  output_tokens,
  latency_ms,
  retry_count,
  stream_chunks,
  context_profile, // scribble | minutes | stream
  org_id,
})
```

**Dashboards / alerts day-one**:

- Funnel: landing → signup → first save (retention week 1).
- AI error rate by route + by `prompt_version` (alert if > 2 % over 1 h).
- Rate-limit hit rate by endpoint (alert if > 50 hits / 5 min — abuse signal).
- p95 latency for `/api/ai/format`, `/api/ai/title`, `meeting-enhance`.
- Razorpay webhook delivery success (alert on any failure).
- Whisper crash rate per OS/arch.
- Helpful-rate trend per prompt version (alert if 7-day average drops > 5 pp).

**Privacy + compliance**:

- Never log raw transcripts, audio buffers, or PII.
- Hash `user_id` if PostHog data residency requires it; keep mapping server-side.
- Honor opt-out: respect `Do Not Track`; expose a "share usage data" toggle in Settings → Data & Privacy.
- Strip query strings + bodies in Sentry breadcrumbs for AI/billing routes.

**Implementation touch points**:

- New env vars: `SENTRY_DSN_WEB`, `SENTRY_DSN_DESKTOP`, `SENTRY_DSN_EDGE`, `POSTHOG_KEY`, `POSTHOG_HOST`.
- New helper: `packages/shared/src/analytics/` with `track()`, `captureError()`, `identify()`, `setOrgContext()`.
- Wire Sentry in `packages/web/instrumentation.ts` (Next.js convention) and `app/error.tsx` / `app/global-error.tsx`.
- Wire Sentry in `packages/desktop/src-tauri/src/lib.rs` (panic hook + `sentry::init`) and `packages/desktop/src/main.tsx` (JS SDK).
- Add Sentry release upload step to `.github/workflows/release.yml` keyed off the `vX.Y.Z` tag (source maps for web, debug files for desktop).
- Thread `analytics.track()` into existing AI service paths in `packages/web/lib/services/ai.service.ts` and `packages/desktop/src/services/ai.service.ts`.
- Wrap `applyRateLimit()` result so blocks emit `rate_limit.blocked` automatically.
- Add `Settings → Data & Privacy` toggle that disables PostHog (Sentry stays on for crash-fixing).

**MVP cut** (one week of work):

1. Sentry on web + Edge Functions only. Skip desktop Rust + Tauri until web stabilizes.
2. PostHog with the 12 canonical events above. Skip session replay for now.
3. Two dashboards: signup funnel + AI error rate. Skip alerts until baseline is known.
4. Privacy toggle in settings.

**Phase 2** (after MVP signals are trusted):

- Desktop Sentry (Rust + JS) with crash dumps from auto-updater.
- AI-specific dashboard: token cost per user, helpful-rate per prompt version, prompt-regression alerts.
- Session replay scoped to error sessions only (cost control).
- Synthetic monitoring on critical paths (login, record, save, share).

**Out of scope**:

- Full APM (Datadog/New Relic). Sentry's perf monitoring is enough at this stage.
- Custom event warehouse (BigQuery/Snowflake) — defer until PostHog limits bite.
- User-level cost attribution dashboards — needs Stripe migration first if global.

---

## Other Backlog Items

From `Agents.md` future enhancements, consolidated here:

- [ ] A/B testing prompt variants using feedback data
- [ ] Automated prompt optimization triggered by feedback trends
- [~] Multi-language support tuning (Hindi, Hinglish edge cases) — Hinglish landed v0.8.1 via on-device Oriserve Whisper-Hindi2Hinglish models (Apex/Prime), language-gated on `hi-en`; further edge-case tuning ongoing
- [ ] Custom formatting styles per user preference
- [ ] Streaming responses for real-time formatting preview
- [ ] Agent performance monitoring and analytics dashboard
- [ ] Summary generation agent
- [ ] Tag/category suggestion agent
- [ ] Sentiment analysis agent
- [x] Prompt versioning — track which prompt version generated each note (shipped: `DICTATION_PROMPT_VERSION = "context-v1"`, persisted on scribbles + streams, queryable in feedback stats)
- [ ] Automated alerts when helpful-rate drops below threshold
- [ ] Training data export for fine-tuning
