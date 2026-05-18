# Oscar Roadmap

Product ideas, planned features. Not prioritized — ordering loose.

---

## Context-Aware Dictation

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