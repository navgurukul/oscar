# OSCAR Speech-Model Pipeline — Production-Hardening Spec (Implementation Handoff)

You are implementing a hardening + UX overhaul of the desktop speech-model pipeline
(download, storage, loading, role handling, language/preset changes, onboarding,
clear-local-data) in the OSCAR monorepo. This document is the complete spec. It was
produced by a code audit of the current pipeline; every file/line reference was
verified against the working tree at the time of writing.

**Branch:** `claude/amazing-mayer-fi7drt` (develop, commit, and push here; do NOT open a PR).
**Commits:** conventional prefixes (`feat(desktop):`, `fix(desktop):`, `refactor(desktop):`…),
one workstream per commit or small commit series. Read `CLAUDE.md` and `DESIGN.md` first.
**No new test frameworks** (repo convention). Rust unit tests are allowed and expected
(`hardware.rs` already has them). QA = `pnpm lint` (web), `tsc` via the desktop build,
`cargo check`/`cargo test` in `packages/desktop/src-tauri`, plus the manual QA matrix below.

---

## 1. Read these files before writing any code

| Area | Files |
|---|---|
| Model registry (Rust, source of truth) | `packages/desktop/src-tauri/src/models.rs` |
| Hardware detect + recommendation ladder | `packages/desktop/src-tauri/src/hardware.rs` |
| Download / validate / load / transcribe | `packages/desktop/src-tauri/src/whisper.rs` |
| Meeting segment transcription | `packages/desktop/src-tauri/src/meeting.rs` |
| Shared app state (single context slot) | `packages/desktop/src-tauri/src/state.rs`, `lib.rs:167-224` |
| File helpers (model path, perf log) | `packages/desktop/src-tauri/src/filesystem.rs` |
| Events | `packages/desktop/src-tauri/src/events.rs` |
| FE model manager | `packages/desktop/src/lib/whisper-model-manager.ts`, `lib/whisper-models.ts`, `lib/whisper.ts` |
| FE orchestration (App) | `packages/desktop/src/App.tsx` — esp. lines ~1222-1483 (prepare/download), ~1550 (hotkey gate), ~2200-2430 (scribble), ~2682-2713 (minutes pre-download), ~3087-3121 (language change), ~3149-3195 (clear data) |
| Minutes recorder | `packages/desktop/src/hooks/useMinutesRecorder.ts` |
| Onboarding | `packages/desktop/src/components/onboarding/SetupScreen.tsx` (flow: AuthScreen → PermissionsScreen → SetupScreen) |
| Settings UI | `packages/desktop/src/components/SettingsTab.tsx` (model rows ~556-623, languages `LANGUAGES` ~63, clear-data ~1162) |
| Stream pill | `packages/desktop/public/pill.html` (phases: idle/rest, ready, expanded, recording, processing, inserted, copied, error, auth), `src-tauri/src/pill.rs` |
| Types | `packages/desktop/src/lib/app-types.ts` (`RoleModelState`, `DownloadProgress`, `DownloadRetry`) |
| Release matrix (GPU features) | `.github/workflows/release.yml` (~90-160, build at ~260), `src-tauri/Cargo.toml` features |

Key current facts (verified):
- One global `whisper_context: Option<Arc<WhisperContext>>` + `loaded_model_path` in `AppState`; `ensure_whisper_model_loaded(role, path)` ignores `role` except for logging.
- Downloads are resumable (`.partial` + Range), checksum-verified, retried (4 attempts, classified transient/permanent), atomic rename, fsync. This logic is GOOD — keep it.
- FE dedupes downloads per variant + serializes via a promise queue (`App.tsx:1249-1293`).
- `tauri_plugin_single_instance` is registered (no cross-process races).
- Default `transcriptionLanguage` is `"hi-en"` (`App.tsx:274,784`); `"hi-en"` routes to Oriserve Hinglish models (Apex 574 MB dictation / Prime 1.08 GB minutes); all other languages use the general ladder. Family substitution is blocked both directions in `pickInstalledFallback` (`whisper-model-manager.ts:125`).
- Windows/Linux release builds compile **without** `cuda`/`vulkan` features (`extra_cargo_args: ""`), so `GpuBackend::detect()` returns `None` there; only macOS has GPU (Metal).
- Sync Tauri commands run on the main thread: `ensure_whisper_model_loaded`, `load_whisper_model`, `warm_whisper_runtime`, `decode_audio_blob` block the UI for seconds.
- Web package has no local model (browser SpeechRecognition); ONNX runtime is CDN-loaded unpinned in `packages/web/app/layout.tsx:80-84`.

---

## 2. Invariants the finished system must satisfy

I1. **Rust owns the registry.** The webview references models only by `WhisperModelVariant`.
    No URL or filesystem path for models crosses IPC in either direction (paths may be
    returned for display/debug, never accepted as input).
I2. **Tagged context.** The loaded Whisper context is tagged `{variant, path}`. Every
    transcription call declares its expected variant; a mismatch is a typed error
    (`"model-mismatch"`), never a silently wrong-model result.
I3. **No swap while busy.** A model load/unload never happens while any transcription is
    in flight or queued. Enforced twice: FE busy-gates AND a Rust `RwLock` around the
    context slot (transcribe = read guard, load/unload = write guard).
I4. **Rust owns the bytes.** Everything under `~/.oscar/models` (final files, `.partial`
    sidecars, legacy phi files) is created and deleted by Rust commands only.
I5. **One download per variant process-wide**, resumable, checksum-verified, cancellable,
    with progress events that carry the `variant`.
I6. **Truthful readiness on every surface.** Anywhere the user can trigger STT (pill,
    Minutes start button, Scribble record button, Settings, onboarding) shows
    ready / downloading-with-% / error-with-retry. No generic spinner hiding a download.
I7. **Explicit choices converge; Auto reuses.** Fast/Balanced/Best presets always converge
    to their recommended variant (download if missing; keep serving the installed
    substitute until the target is ready). Only `auto` applies the reuse-floor heuristic.
I8. **No heavy work on the main thread.** Model load, warmup inference, and audio decode
    run via `async` command + `spawn_blocking` (pattern already used by `transcribe_audio`).
I9. **Clear-local-data leaves nothing.** Zero model bytes (incl. `.partial`), zero
    transcript bytes (perf logs), zero in-flight downloads, zero loaded contexts, and the
    UI must not be able to trigger it while recording/transcribing.
I10. **Hinglish one-way valve.** General-language requests never use Hinglish models
    (they emit romanized Hinglish). A Hinglish request may degrade to an installed
    general model only behind an explicit flag (offline/download-failed path) with a
    user-visible notice, and upgrades to the proper model automatically once downloaded
    (swap deferred to idle per I3).

---

## 3. Workstreams

Implement in order. P0 = correctness/privacy, P1 = UX, P2 = perf/hardening.

### WS-A (P0, Rust): variant-addressed model service

Replace the path/URL-based IPC with variant-addressed commands. New/changed commands
(register in `lib.rs`, remove superseded ones):

- `model_status(variant) -> { installed: bool, valid: bool, sizeBytes: u64, expectedBytes: u64, path: String }`
  — wraps `validate_whisper_model_file_inner` against the registry path.
- `list_model_statuses() -> Vec<...>` — all variants in one call (FE `listInstalledModels` replacement; avoids 8 round-trips).
- `download_model(variant) -> path`
  - Resolves URL/filename/sha256 from `models.rs` internally. **Always** verifies sha256.
  - Per-variant in-flight lock in `AppState` (e.g. `Mutex<HashMap<WhisperModelVariant, …>>`):
    a second call for the same variant joins/awaits the first (or returns a typed
    "already-downloading" the FE treats as join) — protects even if FE dedupe misses.
  - Cancellation: per-download `Arc<AtomicBool>` (or `CancellationToken`) stored in state,
    checked in the chunk loop; cancel ⇒ stop, delete `.partial`, return typed `"cancelled"`.
  - Disk-space preflight: `sysinfo::Disks` free space at the models dir must be ≥
    `spec.size_bytes - existing_partial_len + 200MB headroom`, else Permanent error
    `"Not enough disk space: need ~X MB free"`.
  - Completeness hardening: if NOT resuming and the server sends no Content-Length
    (`total_size == 0`), fail transient (`"server did not report file size"`) rather than
    skipping the `downloaded != total_size` guard (`whisper.rs:506`).
  - Progress/retry events gain the variant: `DownloadProgress { variant, downloaded, total, percentage }`,
    `DownloadRetry { variant, attempt, max_attempts, delay_secs, reason }` (`events.rs`).
    Update all FE listeners (`App.tsx`, `SetupScreen.tsx`) and `app-types.ts`.
- `cancel_model_downloads()` — cancels all in-flight downloads, deletes their partials.
- `delete_model(variant)` — unloads first if it is the loaded variant, then deletes file + its `.partial`.
- `clear_local_models() -> { bytesFreed: u64 }` — cancel all downloads → unload context →
  remove the entire `~/.oscar/models` directory recursively (then recreate empty). This
  inherently covers `.partial` files and the legacy phi files
  (`phi-3.5-mini-Q4_K_M.gguf`, `phi-3.5-tokenizer.json`).
- `unload_whisper_model()` — drops context + tag (frees RAM; needed by clear-data and delete_model).
- `ensure_model_loaded(role, variant) -> { variant, path }` — replaces
  `ensure_whisper_model_loaded(role, path)`. Validates file, then loads. **Drop the old
  context before constructing the new one** (avoid the 2× RAM spike at `whisper.rs:622-628`);
  on load failure the slot is empty and the error surfaces (acceptable).
- `transcribe_audio` and `transcribe_meeting_segment_bytes` gain `expected_variant: WhisperModelVariant`.
  Rust compares against the context tag; mismatch ⇒ `Err` containing the literal token
  `model-mismatch` so the FE can detect it, re-`ensure`, and retry exactly once.
- **Remove from `invoke_handler`** (dead or superseded): `load_whisper_model`,
  `transcribe_meeting_audio`, `transcribe_meeting_audio_b64`, `delete_file`,
  `check_file_exists`, `get_model_path`. First grep the FE for remaining callers and
  migrate them (`whisper-model-manager.ts` uses all three filesystem ones; clear-data uses
  `check_file_exists`/`delete_file`). `validate_whisper_model_file` becomes internal-only.
- Startup janitor (spawned async after setup, best-effort, logged): delete legacy phi
  files; delete `*.partial` with mtime older than 14 days (younger partials are kept —
  they enable resume across launches).

Rust context slot redesign (`state.rs`):
```rust
pub(crate) struct LoadedModel {
    pub variant: WhisperModelVariant,
    pub path: String,
    pub context: Arc<WhisperContext>,
}
// AppState: whisper: tokio::sync::RwLock<Option<LoadedModel>> (or std RwLock used from
// spawn_blocking). transcribe takes read(); ensure/unload take write().
```
Keep a single resident model (8 GB machines are the norm). Do NOT add a second slot.

Rust tests to add: registry integrity (`WhisperModelVariant::all()` covers every enum
variant; filenames unique; sha256 non-empty + 64 hex chars), content-range parser (exists),
janitor age rule, mismatch error token stability.

### WS-B (P0, Rust): main-thread stalls

Make `ensure_model_loaded` (model load can be seconds for 0.5–1.6 GB),
`warm_whisper_runtime` (runs a real inference), and `decode_audio_blob` (Symphonia decode
+ Rubato resample of whole recordings) `async fn` + `tauri::async_runtime::spawn_blocking`,
mirroring `transcribe_audio` (`whisper.rs:1191-1214`). Audit any other sync command doing
file/CPU-heavy work.

### WS-C (P0, FE): ModelOrchestrator + busy gating

Consolidate the logic currently spread across `whisper-model-manager.ts` and
`App.tsx:1222-1483` into one module (suggest `src/lib/model-orchestrator.ts`) owning a
per-role state machine:

```
unconfigured → resolving → ready(variant,path)            // installed & acceptable
                         → needs-download → downloading(variant, pct)
                           → verifying → ready
                           → error(message, retryable)
ready → loading → loaded(variant)        // loaded = the Rust context tag matches
```

Rules:
1. **Resolution** (replaces `resolveModelForRole` semantics):
   - `preset != "auto"` (explicit): target = recommendation; if not installed →
     needs-download, AND if any same-family installed model exists, expose it as
     `interim` so transcription keeps working until the target is ready (then swap at
     idle). This fixes "Fast/Balanced are no-ops when a bigger model is installed"
     (today's `sufficient = quality >= min(recQ, 3)` check at
     `whisper-model-manager.ts:199` only ever upgrades, never converges downward).
   - `preset == "auto"`: keep today's reuse heuristic (floor = `min(recQ, 3)`).
   - Hinglish valve per I10: general target never matches Hinglish installs. A `hi-en`
     target may use an installed general model ONLY as `interim` when the download
     errored (offline), with `crossFamilyInterim: true` so the UI can show
     "Using the general model until the Hinglish model finishes downloading — accuracy
     for Hinglish is reduced." Never the reverse direction.
2. **Language change** (`App.tsx:3087`): prepare BOTH roles for the new language
   immediately (today the minutes branch is gated on `currentWhisperRoleRef === "minutes"`
   at `App.tsx:3111` — remove that gate), and reset `minutesPredownloadStartedRef`
   (`App.tsx:2701`) so the Meetings-tab pre-download re-arms. Downloads stay serialized
   (dictation first) via the existing per-variant queue.
3. **Deferred swap:** if a `loaded`-state change is requested while busy (recording,
   dictation processing, minutes queue draining), download eagerly but queue the
   `ensure_model_loaded` until idle. Track a `pendingLoad` per role; apply on idle.
4. **Busy gates (close the wrong-model window):**
   - Export `isPipelineBusyRef` from `useMinutesRecorder` = recording OR
     `segmentQueueRef.length > 0` OR `segmentWorkerRunningRef` OR status in
     {recording, transcribing, finalizing}. (Today `stopRecording` flips
     `isRecordingRef` false immediately at `useMinutesRecorder.ts:710` while segments
     still drain.)
   - `startHotkeyRecording` (`App.tsx:1550`) and `startScribbleRecording`
     (`App.tsx:2428`) must also block on minutes-finalizing (show pill caption / status
     "Finishing meeting notes…" instead of silently ignoring).
   - `canStartMeetingRecordingRef` (`App.tsx:1426`) must also block while dictation is
     processing (`isProcessing`).
   - Clear-data and "delete model" buttons disabled while any of the above are busy.
5. **Auto-retry:** on `window` `online` event, retry any role in `error`; also each
   user-initiated record attempt re-resolves (already the case). Cap automatic retries
   (e.g. 3 per network-restore) to avoid storms.
6. **Mismatch defense:** on a `model-mismatch` error from any transcribe call,
   re-`ensure` the declared variant and retry the call once; if it mismatches again,
   surface the error.
7. Keep `modelDownloadPromisesRef`-style dedupe and the serialized queue, now keyed by
   variant and driven by variant-tagged progress events (no more "match by current
   recommendation" heuristic in `syncDownloadProgress`, `App.tsx:1237`).
8. Delete `cleanupLegacyModels`/`LEGACY_FILENAMES` from the FE (the Rust janitor +
   `clear_local_models` replace them).

### WS-D (P1, FE + pill): readiness UX on every surface

- **Pill:** add phase `downloading` to `pill.html` (same 200 px expanded height), with a
  caption + percentage fed by a new `pill-download-progress` event (host forwards the
  variant-tagged Rust events for the *dictation* role only). Behavior: hotkey or
  hover-expand while the dictation model is not `loaded`/`ready` ⇒ show `downloading`
  phase (do NOT start recording, do NOT capture audio), auto-collapse after ~2.5 s if
  the user does nothing; when the model becomes ready, return to normal `rest`/`ready`.
  If the role is in `error`, show the existing `error` glyph with a short caption.
  Follow the existing Paper-pill tokens (white gradient, cyan-400 accent — see
  `CLAUDE.md` pill section + `DESIGN.md`).
  Linux note: the pill is a tray fallback; ensure the main-window status line carries the
  same downloading/error text so Linux users aren't blind.
- **Minutes:** the start button's "Preparing…" state must show download progress
  ("Downloading speech model — 42%") and, on failure, surface a visible error with a
  Retry action — today `useMinutesRecorder.ts:607-613` swallows the error
  (`console.error` + `return`) and the button silently resets. Reuse the
  `systemAudioWarning` banner pattern or add a sibling.
- **Scribble:** record button/status line shows the same downloading % and error states
  (it shares the dictation role).
- **Settings model rows** (`SettingsTab.tsx:556-623`): show the active model display name
  + size when ready (today `activeVariant` renders nothing at line 573); keep download %
  (now exact via variant-tagged events); on `error`, add a Retry button; optional:
  "Remove model" per role via `delete_model`.
- Copy fix: `App.tsx:1471` "Whisper model not found. Set the path in Settings." → there
  is no path setting; replace with accurate copy ("Speech model isn't downloaded yet —
  check Settings → Speech models or reconnect to the internet.").
- Fix the startup race where the `autoDownload:false` inspection effect
  (`App.tsx:1476-1483`) can overwrite a live `downloading` state from `initWhisper` —
  the orchestrator's single state machine should make stale writes impossible
  (state transitions only, no blind patches).

### WS-E (P1, FE): onboarding language step

Add a language selector to `SetupScreen.tsx` (extract the `LANGUAGES` list from
`SettingsTab.tsx:63` into a shared module), shown in the `ready` phase above the
Download button, defaulting to the current `transcriptionLanguage` (`hi-en`). On change:
re-run `resolveModelForRole("dictation", "auto", lang)` and update the displayed
recommendation/size. On download/complete: persist via `saveSetting("transcriptionLanguage", lang)`
and ensure `App` state + refs pick it up (today `SetupScreen` only *receives* the
language). This removes the guaranteed wrong-model download for non-Hinglish users after
a fresh install or clear-data (574 MB Apex followed by another ~500 MB on switching to
English, with the pill blocked in between — the exact reported incident).

### WS-F (P0, FE): clear-local-data rewrite (`App.tsx:3149-3195`)

New order, all steps awaited, each best-effort with `console.warn` on failure, reload last:
1. Refuse/disable while busy (see WS-C gate 4).
2. `cancel_model_downloads()`
3. `unload_whisper_model()`
4. `clear_local_models()`  ← replaces the FE path-string loop (also fixes Windows `/`
   separators and the delete-while-loaded edge, since unload happens first)
5. `clear_perf_log()`  ← **privacy**: `perf.jsonl` can contain raw + AI-cleaned
   transcripts when "Log transcripts to diagnostics" is on; today clear-data leaves it.
6. `signOutLocally()`; 7. `store.clear()+save()`; 8. `localStorage.clear()`; 9. `reload()`.
Update the Settings description if needed so "remove downloaded models, cached data"
stays truthful (after this change it is).

### WS-G (P2, perf): binary IPC for audio

Today audio crosses IPC as JSON number arrays: `Array.from(audioData)` (Float32Array,
~1M numbers/min) at `App.tsx:1812` and `App.tsx:2224`, and
`Array.from(new Uint8Array(blob))` at `useMinutesRecorder.ts:359`; `decode_audio_blob`
returns `Vec<f32>` as JSON. Use Tauri 2 raw payloads: `invoke(cmd, arrayBuffer, { headers })`
with scalar params (language, prompt, variant, session ids) in headers, command taking
`tauri::ipc::Request` (raw body) and returning `tauri::ipc::Response::new(Vec<u8>)` where
the response is PCM (reinterpret f32le on each side). Keep this in its own commit; verify
with the existing `audio-array` perf timing before/after. If header plumbing fights you,
an acceptable fallback is a small JSON envelope + base64 — but measure first.

### WS-H (P2, docs/build): GPU truth

Decide ONE of (default = first):
- **Document reality:** Windows/Linux ship CPU-only. Update `CLAUDE.md` ("whisper-rs
  (CUDA/Vulkan)" claim), `hardware.rs` module comment, and the `recommend` comments so
  nobody relies on the `gpu && ram >= 8` tier on those OSes. Note Vulkan was deliberately
  reverted (workflow comment ~line 117); CUDA appears unintentionally unshipped.
- **Enable CUDA on Windows:** add `--features cuda` to the Windows matrix entry — only if
  you also solve CUDA toolkit install on the runner and runtime DLL distribution to end
  users. Do not attempt casually; if chosen, it is its own task.

Also update `CLAUDE.md` for everything this spec changes (commands, clear-data behavior,
pill phase list, onboarding step).

### WS-I (P2, web, small): pin ONNX runtime

`packages/web/app/layout.tsx:80-84` loads `onnxruntime-web` from jsdelivr unpinned, no
SRI. Pin the exact version matching `package.json` (`^1.24.1` → concrete version) and add
an `integrity` hash, or serve it from `/public`. Keep the `window.onnxruntime = window.ort`
shim.

---

## 4. Edge-case matrix (every row must demonstrably work)

| # | Scenario | Expected behavior |
|---|---|---|
| 1 | Fresh install, no network | Setup shows error + Retry; app never half-initializes; retry after network restore works |
| 2 | Setup download killed at ~80% (quit app) | Relaunch resumes from `.partial`; progress starts at ~80%, not 0 |
| 3 | Clear data while a model download is mid-flight | Download cancelled, `.partial` deleted, models dir empty, RAM released; no model file "reappears" afterwards |
| 4 | Clear data attempted during recording/processing (any of pill/scribble/minutes incl. minutes finalizing) | Button disabled (or refuses with notice) |
| 5 | **The reported incident:** clear data → onboard (hi-en default) → switch language to English → immediately hotkey-dictate | Pill shows `downloading` with live %; no audio captured; when ready, hotkey records normally. Settings shows the same % |
| 6 | Same as 5 but open Meetings and press Start | Start button shows "Downloading speech model — N%", then proceeds; on download failure a visible error + Retry (no silent reset) |
| 7 | Language switch while meeting is recording | Downloads start in background; loaded context does NOT swap until the meeting fully finalizes (queue drained); remaining segments transcribed by the original model |
| 8 | Stop a meeting, then hotkey-dictate while segments still draining | Dictation blocked with "Finishing meeting notes…" feedback; works right after drain; the drain still uses the minutes model |
| 9 | Preset Fast selected while turbo-q5 installed | Base downloads; turbo keeps serving as interim until base ready; then swap at idle; Settings reflects active=Base afterwards |
| 10 | hi-en selected, Apex download fails (offline), general `small` installed | Dictation degrades to `small` with visible notice (Devanagari output, downstream cleanup romanizes); auto-upgrades to Apex when network returns |
| 11 | English selected, only Hinglish models installed | NEVER substitutes Hinglish; shows downloading/blocked state until general model lands |
| 12 | Checksum mismatch (corrupt CDN object) | Permanent error surfaced with message; `.partial` removed; manual Retry restarts clean |
| 13 | Disk full | Clear "need ~X MB free" error; no retry storm |
| 14 | Model file deleted externally while app running | In-RAM model keeps working this session; next launch detects missing/invalid and re-downloads |
| 15 | Second app instance launched | Forwarded to first instance (existing plugin); no concurrent download corruption; Rust per-variant lock as backstop |
| 16 | Windows: clear data while model loaded | Succeeds (unload-first removes any file-lock concern) |
| 17 | Sleep/resume mid-download | Chunk timeout → retry → resume from offset (existing logic; verify events still render with variant tags) |
| 18 | Download completes while pill shows `downloading` | Pill transitions to rest/ready automatically |
| 19 | Forced `model-mismatch` (load A, request B) | Transcribe returns typed error → orchestrator re-ensures → retried call succeeds; never a silent wrong-model transcript |
| 20 | Onboarding: pick English in the new language step | Downloads a general model once; no Hinglish download ever happens; total ≤ 1 model fetched |
| 21 | Settings "Remove model" (if implemented) for the loaded variant | Unloads, deletes, role state → needs-download; next record re-downloads with full UX |
| 22 | Rapid preset flipping during a download | No duplicate downloads (per-variant join), no stuck UI states; final state matches last selection |

## 5. Manual QA script (after each workstream, minimum after P0 and P1)

1. `pnpm install`; `pnpm dev:desktop` builds and launches; `cargo test` green in `src-tauri`.
2. Walk matrix rows relevant to the workstream. Simulate offline via OS network toggle;
   simulate slow network by throttling (or temporarily pointing the registry URL at a
   local slow server — do not commit such changes).
3. Verify `~/.oscar/models` contents at each step (`ls -la`), incl. absence of `.partial`
   after clear-data, and RAM via Activity Monitor/Task Manager after unload.
4. `pnpm lint` in `packages/web` if web files touched (WS-I).
5. Re-read your diff against the invariants I1–I10 before each push.

## 6. Out of scope — do not touch

- Registry URLs/checksums in `models.rs` (except adding fields if needed), the
  recommendation ladder tiers, VAD, hallucination filtering, decoding params.
- Release signing/notarization steps in `release.yml` (only the documented feature-flag
  change if WS-H option 2 is explicitly chosen).
- Web STT pipeline behavior (only the script pinning in WS-I).
- No Jest/Vitest; no UI redesign beyond the states specified (keep the cyan editorial
  identity; reuse existing tokens/components).

## 7. Open decisions (defaults pre-chosen; change only with explicit user sign-off)

1. GPU on Win/Linux → **document CPU-only** (WS-H option 1).
2. Pill while model downloading → **block recording + show %** (not record-and-queue).
3. Hinglish offline interim → **enabled, one-way, with notice + auto-upgrade**.
4. Second resident context on ≥16 GB RAM machines → **no** (future option).
5. Clear-data language reset → mitigated by the onboarding language step (WS-E), so
   resetting to default is acceptable.
