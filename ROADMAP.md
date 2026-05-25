# Oscar Roadmap

Product ideas, planned features. Not prioritized — ordering loose.

## Plan Status Snapshot

- **Context-aware dictation**: In progress. Desktop capture, routing, prompt versioning, settings toggle, and Stream cleanup wiring exist. Remaining work: saved-note metadata consistency, feedback analytics by context, and user-facing context labels.
- **Vibe Coding Mode**: Planned. Design mocks exist; no dedicated API route, hook, or mode selector shipped yet.
- **VAD for hands-free dictation**: Partly shipped. Whisper now has a VAD pre-filter to strip silence before inference, and Stream has a 200 ms release tail buffer. Hands-free auto-arm / auto-finalize is still planned.
- **Littlebird.ai-style work memory clone**: Added below as a product-flow bet. Scope should stay Oscar-native: voice-first, explicit privacy controls, no invisible capture by default.

---

## Context-Aware Dictation

**Status**: In progress.

**Shipped**:

- Desktop hotkey / pill / tray capture frontmost app context before recording starts.
- Shared `DictationContextSnapshot` / `DictationRoutingResult` contract exists.
- Routing supports `default`, `ide`, `email`, `docs`, `chat`, and `browser` categories.
- Desktop Stream passes context/routing into `transcribe_cleanup`.
- Settings expose context-aware dictation behind AI cleanup.

**Remaining**:

- Persist routing metadata consistently on every saved note path.
- Add feedback analytics grouped by category, app key, context source, and prompt version.
- Add small user-facing context labels where useful.

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
- Pass context through recording hook → format API route → Gemini call

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
  → pill expands, sits in "armed" with a soft cyan ring
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

## Other Backlog Items

From `Agents.md` future enhancements, consolidated here:

- [ ] A/B testing prompt variants using feedback data
- [ ] Automated prompt optimization triggered by feedback trends
- [ ] Multi-language support tuning (Hindi, Hinglish edge cases)
- [ ] Custom formatting styles per user preference
- [ ] Streaming responses for real-time formatting preview
- [ ] Agent performance monitoring and analytics dashboard
- [ ] Summary generation agent
- [ ] Tag/category suggestion agent
- [ ] Sentiment analysis agent
- [ ] Prompt versioning — track which prompt version generated each note
- [ ] Automated alerts when helpful-rate drops below threshold
- [ ] Training data export for fine-tuning
