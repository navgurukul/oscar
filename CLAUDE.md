# CLAUDE.md

Reference for AI assistants in Oscar codebase.

---

## Project Overview

Oscar = AI voice note app. Users record audio → transcribed (Whisper on desktop, browser STT on web) → formatted + titled by Mercury 2 AI agents. Gemini remains for Minutes + embeddings only.

**Monorepo layout (pnpm workspaces):**

```
oscar/
├── packages/
│   ├── web/        # Next.js 15 web app  (@oscar/web)
│   ├── desktop/    # Tauri 2 desktop app (@oscar/desktop)
│   └── shared/     # Shared types & constants (@oscar/shared)
├── skills/         # Claude Code design-review skill
├── .github/workflows/release.yml  # Multi-platform release pipeline
├── DESIGN.md       # Design system specification
├── Agents.md       # AI pipeline & agent architecture
└── CLAUDE.md       # This file
```

**Version:** 0.7.30 (workspace-wide; latest shipped release v0.10.1 — releases are tag-driven, CI injects the version from the `v*` tag and does **not** bump these files) | **Node:** v22 (`.nvmrc`) | **Package manager:** pnpm 9

---

## Tech Stack

| Layer | Web | Desktop |
|---|---|---|
| Framework | Next.js 15, React 19 | Tauri 2, Vite, React 19 |
| Language | TypeScript 5.9 | TypeScript + Rust (2021 edition) |
| Styling | Tailwind CSS 3.3, CVA | Tailwind CSS |
| UI primitives | Radix UI + shadcn/ui (New York style) | Radix UI + shadcn/ui |
| Auth & DB | Supabase (PostgreSQL + Auth) | — |
| AI | Mercury 2 (Inception Labs) for Scribble format/title/transform/email/translate/publish + doc ingestion; Google Gemini 2.5 Flash for Minutes (meeting enhance) + embeddings only | whisper-rs (local Whisper) + Mercury 2 (dictation cleanup via the Amplify web route `/api/ai/dictation-cleanup` since the v0.11.0 cutover — `ai-process` Edge Function retired from the dictation path, kept for Scribble-transform + meeting-fallback modes) + Google Gemini 2.5 Flash (meeting enhance) |
| Payments | Razorpay | — |
| STT | Browser **Web Speech API** (`SpeechRecognition`), wrapped by `speech-to-speech@0.1.5` for transcript continuity + VAD. ONNX Runtime Web (CDN-pinned, SRI) powers the wrapper's VAD model — **not** transcription (Piper TTS is bundled but unused). | whisper-rs (Metal on macOS; **CPU-only on Windows/Linux** — see GPU note below) |
| Animation | motion, tsparticles | — |

---

## Development Setup

```bash
# Install all workspace dependencies
pnpm install

# Web dev server (Next.js)
pnpm dev:web          # http://localhost:3000

# Desktop dev server (Tauri + Vite)
pnpm dev:desktop      # launches native window
```

**Required environment variables** (create `packages/web/.env.local`):

```
MERCURY_API_KEY=
GEMINI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_WEB_APP_URL=
```

See `packages/web/.env.example` for full list.

**Quality checks:**

```bash
pnpm test:format-regressions
pnpm test:edge-functions
MERCURY_API_KEY=... pnpm test:format-regressions:live
```

---

## Package Details

### `packages/web` — Next.js App

**App Router structure:**
```
app/
├── page.tsx            # Landing page
├── auth/               # Auth flows (sign-in, callback)
├── scribble/              # Notes list + detail
├── recording/          # Recording interface
├── results/            # Post-recording result view
├── settings/           # User settings (billing, vocabulary, data)
├── pricing/            # Pricing page
├── meetings/           # Meeting Minutes
├── download/           # Desktop download handler
└── api/
    ├── ai/
    │   ├── format/       # Stream-format transcript → clean Scribble
    │   ├── format-email/ # Email-specific formatting
    │   ├── title/        # Generate 4-10 word title
    │   ├── transform/    # Custom text transforms
    │   └── translate/    # Translation endpoint
    ├── razorpay/
    │   ├── create-subscription/
    │   ├── cancel/
    │   ├── verify/
    │   └── webhook/
    └── usage/
        ├── check/
        ├── increment/
        └── stats/
```

**Services** (`lib/services/`):
- `ai.service.ts` — Client wrapper for Mercury-backed Scribble routes and Gemini-backed Minutes/embedding routes
- `stt.service.ts` — Browser STT pipeline
- `scribbles.service.ts` — Scribble CRUD (Supabase)
- `subscription.service.ts` — Subscription state & checks
- `razorpay.service.ts` — Payment initiation
- `feedback.service.ts` — User feedback collection
- `usage.service.ts` — Usage tracking & limits
- `storage.service.ts` — LocalStorage utilities
- `vocabulary.service.ts` — Custom vocabulary management
- `localFormatter.service.ts` — Offline fallback formatting
- `meetings.service.ts` — Meeting note handling
- `browser.service.ts` — Browser capability detection
- `permission.service.ts` — Microphone permission management

**Hooks** (`lib/hooks/`):
- `useRecording.ts` — Recording lifecycle state machine
- `useAIFormatting.ts` — Format streaming hook
- `useAIEmailFormatting.ts` — Email format hook
- `useScribbleStorage.ts` — Scribble persistence hook

**Components** (`components/`):
```
scribble/          # TrashSheet
recording/      # RecordingControls, RecordingTimer, PermissionErrorModal
results/        # ScribbleEditor, ScribbleEditorSkeleton, ScribbleActions, FeedbackWidget
settings/       # AccountSection, BillingSection, VocabularySection, FolderManagementSection, DataPrivacySection
shared/         # Footer
meetings/       # MeetingSearchBar, MeetingNotesEditor, MeetingMetadataEditor, MarkdownView, DeleteMeetingDialog, CopyShareLinkButton
v2/             # V2Primitives (V2AppHeader/V2WebHeader/V2TeamHeader/V2MarketingHeader, wordmark, caps), V2AccountMenu, V2LegalLayout, V2OrgSettingsShell
subscription/   # PricingCard, RazorpayCheckout, UpgradePrompt, UsageIndicator
ui/             # shadcn primitives + custom: sparkles, dotted-glow-background, animated-testimonials, lamp
```

**Build scripts:**
- `pnpm dev` — Next.js dev server
- `pnpm build` — Production build
- `pnpm lint` — ESLint (next/core-web-vitals + TypeScript)

---

### `packages/desktop` — Tauri App

Rust backend + Vite/React frontend, shares UI components with web package.

- STT: **whisper-rs** (local model). **GPU reality:** only macOS is GPU-accelerated (Metal, always on). Windows/Linux **release builds ship CPU-only** — `release.yml` compiles them with `extra_cargo_args: ""`, so the `cuda`/`vulkan` Cargo features are NOT enabled and `GpuBackend::detect()` returns `None` there. Vulkan was deliberately reverted; CUDA is unintentionally unshipped (enabling it needs runner toolchain + DLL distribution — a separate task). Do **not** rely on the `gpu && ram >= 8` recommendation tier on Windows/Linux.
- Audio pipeline: Symphonia (codec) → Rubato (resampling) → Opus (encoding)
- **Speech-model pipeline (Rust-owned, variant-addressed):** the webview references models only by `WhisperModelVariant` — no URL or filesystem path crosses IPC as input. Commands: `model_status` / `list_model_statuses`, `download_model(variant)` (resumable, checksum-always, per-variant in-flight lock, disk-space preflight, cancellable), `ensure_model_loaded(role, variant)`, `unload_whisper_model`, `delete_model(variant)`, `cancel_model_downloads`, `clear_local_models`. The single resident context is tagged `{variant, path}` behind an `RwLock`; `transcribe_audio` / `transcribe_meeting_segment_bytes` take an `expected_variant` and return a `model-mismatch` error on a tag mismatch (the FE re-ensures + retries once). Model load / warmup / audio decode run via `spawn_blocking` (never the main thread). A startup janitor sweeps the legacy phi files + stale (>14-day) `.partial`s. Clear-local-data order: `cancel_model_downloads` → `unload_whisper_model` → `clear_local_models` → `clear_perf_log` → sign out → clear store + localStorage → reload (refused while any pipeline is busy). Onboarding (`SetupScreen`) has a language selector so the first download is the correct model for the chosen language. Explicit presets (Fast/Balanced/Best) always converge to their recommended variant (an installed model serves as an interim until the target downloads, then swaps at idle); only Auto reuses an installed substitute.
- **Model catalog** ([models.rs](./packages/desktop/src-tauri/src/models.rs), all GGML, served from CloudFront `djpsaiqyvjjg7.cloudfront.net`, SHA256-checked): generic Whisper `Tiny`/`Base`/`Small`/`Medium`/`LargeV3TurboQ5`/`LargeV3Turbo`, plus two **Oriserve Whisper-Hindi2Hinglish** fine-tunes that emit romanized Hinglish (Latin, not Devanagari): `Hindi2HinglishApex` (0.8B distilled, ~574 MB, Q5 — fast dictation) and `Hindi2HinglishPrime` (1.55B large-v3, ~1.08 GB, Q5 — high-accuracy Minutes). The Oriserve models are selected **only** when transcription language is `hi-en` (language-gated; never ranked against the generic accuracy ladder).
- System: WASAPI (Windows), global shortcuts, deep links, auto-updater
- Tauri plugins: `global-shortcut`, `deep-link`, `updater`, `store`, `process`, `opener`

**Stream / dictation pill (`recording-pill` window):**

Always-visible edge-handle overlay docked flush to the bottom of the screen — the entry point for the desktop stream/dictation feature (not used for Scribbles or Minutes).

- Rust window setup: [packages/desktop/src-tauri/src/pill.rs](./packages/desktop/src-tauri/src/pill.rs). Transparent, decoration-free `NSPanel` (macOS) / always-on-top floating window (Windows). Window resizes per phase via `set_size` (`PILL_W`/`PILL_H` constants): **140×16 px** at rest/ready (handle ~96px + hover buffer), **280×200 px** when expanded (recording/processing/inserted/copied/error/auth), **280×380 px** when settings open — so clicks pass through to apps below outside the active surface. Bottom edge stays flush with the primary monitor on every resize. macOS NSPanel level 1000 is re-applied after every resize so the pill stays above the Dock and fullscreen Spaces.
- UI: [packages/desktop/public/pill.html](./packages/desktop/public/pill.html) — vanilla JS/CSS, Figtree font, Paper-pill tokens (white→`#F8FAFC` gradient, **terracotta-500 `#B8623D` accent**, terracotta toast). State machine: `rest → ready → expanded → recording → processing → inserted → rest` plus `error`, `copied`, `auth` (terracotta "Sign in to enable AI", not error-red), and `downloading` (shown when the hotkey/hover fires while the dictation model isn't ready yet — caption + live %, no audio captured; auto-collapses ~2.5s after progress stops). The host feeds it via the `pill-download-progress` event for the dictation role.
- Triggers: hover the bottom 56 px hit zone (180 ms hold → expand → click to record), or press the global hotkey `Ctrl+Space` (`hotkey.rs`). Both paths capture frontmost-app context so paste lands on the correct OS app.
- Tauri commands: `show_recording_pill`, `hide_recording_pill`, `set_pill_phase`, `set_pill_listening`, `set_pill_processing`, `pill_push_settings`, `pill_request_record_start`, `pill_request_record_stop` (registered in [src-tauri/src/lib.rs](./packages/desktop/src-tauri/src/lib.rs)). Linux falls back to a tray-icon tooltip — secondary webview windows crash tao's event loop.
- Settings popover (chevron button on the pill) wires Polish / Prompt Engineer / Email Reply / Auto-apply / Language to the same persisted settings the Settings tab uses (`tonePreset`, `transcriptionLanguage`, `autoPaste`). The pill emits `pill-settings-update` events; [packages/desktop/src/App.tsx](./packages/desktop/src/App.tsx) listens, updates state, and calls `saveSetting`. On startup the pill emits `pill-ready` and the host pushes current values back via `pill_push_settings`.
- Inserted-toast dwell: 1500 ms after paste completes, then the pill collapses back to the handle. Errors during processing surface as the error glyph for 1500 ms before collapsing.

**Build scripts:**
- `pnpm dev` — Tauri + Vite dev (hot reload). Note: a dev binary is signed differently than the release; macOS Accessibility / Input Monitoring permissions must be granted to the dev binary separately before the global hotkey will fire.
- `pnpm build` — Full production build (TypeScript → Vite → Rust → binary)
- `pnpm tauri` — Direct Tauri CLI passthrough

---

### `packages/shared` — Shared Library

TypeScript-only. Exports:
- `types` — `Note`, `LocalTranscript`, `FeedbackReason`, `FormattingResult`, `TitleGenerationResult`
- `constants` — Shared config values

Import: `import { Note } from '@oscar/shared/types'`

---

## Conventions

### TypeScript

- Strict mode in all packages
- Path alias `@/*` → `./src/*` (desktop), `./*` (web)
- Prefer interfaces over type aliases for object shapes
- Export shared types from `@oscar/shared`

### Styling

- **Tailwind first** — utility classes; avoid bespoke CSS unless animation-specific
- **CVA** (`class-variance-authority`) for component variants
- **cn()** helper (`clsx` + `tailwind-merge`) for conditional class merging
- Design tokens in `tailwind.config.js` — no hardcoded hex inline
- Dark mode class-based (`.dark` on `<html>`)

### Component Authoring

- shadcn/ui in `components/ui/` — extend, don't modify originals
- Domain components in named folder
- One component per file; filename = component name (PascalCase)
- Prefer composition over props-explosion: use `children` or named slots

### API Routes (web)

- All AI routes use streaming (`ReadableStream`) where possible
- Rate-limiting middleware wraps AI endpoints — check `lib/rate-limit.ts` before adding new AI routes
- No server actions; mutations go through Supabase client SDK or API routes

### Git & Commits

- Semantic prefixes: `feat:`, `fix:`, `style:`, `refactor:`, `chore:`, `docs:`
- Feature branches → PR → merge to main
- Tag-based releases: `vMAJOR.MINOR.PATCH` triggers GitHub Actions release pipeline
- Active release branch: `release_Dev` (feature commits and `chore(release): vX.Y.Z` bumps land here; tags are cut from this branch)

### No Testing Framework

No automated test suite. QA = manual + ESLint + TypeScript type-checking:
- `pnpm lint` (web)
- `pnpm typecheck` (shared)

Don't add Jest/Vitest unless task explicitly calls for it.

---

## AI Agent Architecture

See [Agents.md](./Agents.md) for full pipeline spec. Summary:

```
Audio → STT (Whisper/browser) → Text Formatting Agent → Title Agent → Stored Note
```

- **Formatting agent**: `app/api/ai/format/route.ts` — removes filler words, fixes grammar, streams output
- **Title agent**: `app/api/ai/title/route.ts` — generates 4-10 word titles; heuristic fallback on failure
- **Config**: `API_CONFIG` object in `ai.service.ts` (model, temperature, top_p, max_tokens)
- **Feedback loop**: Yes/No + reason tags → `feedback.service.ts` → Supabase → prompt iteration

---

## CI/CD (`.github/workflows/release.yml`)

- Triggered by version tags (`v*`)
- Builds all platforms in parallel: macOS (aarch64 + x86_64), Windows (x64), Linux (x64)
- Artifacts: DMG, App bundle, NSIS installer, AppImage, DEB
- Publishes to GitHub Releases + generates `updates.json` for Tauri auto-updater
- Updater-signing secrets (minisign, all platforms): `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, Supabase keys
- macOS code signing (`Sign & repackage macOS bundle` step): re-seals the `.app` and rebuilds the `.app.tar.gz` updater artifact. `tauri build` alone leaves the bundle without a valid `_CodeSignature` seal, which macOS 15/26+ launches **degraded** (no Stream pill, no tray, dropped TCC grants) — the v0.7.32 incident.
  - **Ad-hoc, default, free** (no Apple account): `codesign -s -` produces a valid seal → app launches fully. Caveats: first DMG install needs a one-time Gatekeeper bypass (right-click Open / "Open Anyway" / `xattr -dr com.apple.quarantine`); TCC grants reset on each auto-update (ad-hoc cdhash changes per build).
  - **Developer ID, optional** (stable cdhash → TCC persists across updates): set repo secrets `APPLE_SIGNING_IDENTITY` (`Developer ID Application: NAME (TEAMID)`), `APPLE_CERTIFICATE` (base64 .p12), `APPLE_CERTIFICATE_PASSWORD`. Frictionless (bypass-free) installs additionally need notarization (`xcrun notarytool` + `stapler`, paid account) — documented in the step but not yet wired.
  - The `Verify macOS signature seal` step hard-fails the release if the seal is invalid or doesn't survive the `.app.tar.gz` round-trip (guards the v0.7.32 regression).

---

## UI Build Workflow

For UI, UX, styling, layout, navigation, motion, or shared component work:

1. Read [DESIGN.md](./DESIGN.md) first.
2. Read [Agents.md](./Agents.md) for product and AI-system context.
3. Build with these principles:
   - favor strong hierarchy over lots of components
   - avoid generic SaaS card grids unless cards are the interaction
   - one dominant idea per section or screen
   - preserve OSCAR's terracotta-and-cream editorial identity
   - mobile layout and first-screen clarity intentional
   - motion sparse and purposeful (150-300ms transitions)

**Typography (actually loaded in code):**
- Headlines (`h1/h2/h3`, `font-serif`): **EB Garamond** — weights 400/500/600/700, loaded via `next/font/google` in [packages/web/app/layout.tsx](./packages/web/app/layout.tsx). Auto-applied via [globals.css](./packages/web/app/globals.css).
- Body / UI / sans default (`font-sans`, `<body>`): **Figtree** — weights 400/500/600/700, also via `next/font/google`.
- Mono (`font-mono`): **IBM Plex Mono** — loaded via `next/font/google` (`--font-ibm-plex-mono` / `--font-mono`) in [layout.tsx](./packages/web/app/layout.tsx); desktop mirrors it.
- Desktop app mirrors the web fonts (EB Garamond + Figtree + IBM Plex Mono) via a Google Fonts `@import` in [packages/desktop/src/styles/app-base.css](./packages/desktop/src/styles/app-base.css).
- DESIGN.md still names **Inter** (body) and **JetBrains Mono** in its font table — stale spec only; neither is loaded. The real stack is **EB Garamond** (serif/headlines), **Figtree** (body/sans), **IBM Plex Mono** (mono).

**Colors (actually in code — v2 cream/ink/terracotta palette):**
- **Brand terracotta** ([packages/web/tailwind.config.js](./packages/web/tailwind.config.js)): `#b8623d` (DEFAULT/500, primary), `#f7e6dd` (50), `#e8c9b8` (100), `#a25234` (600). This is the brand/CTA/accent color on both web and the desktop pill.
- **App surface is a light CREAM theme, not dark.** `<body>` is `bg-cream text-ink` ([layout.tsx](./packages/web/app/layout.tsx)). `cream` ramp `#faf8f3`→`#d8d2c4` (DEFAULT `#f7f4ee`); `ink` text `#1a1816` (soft `#5a5852`, faint `#8b8780`, night `#0f0d0a`). shadcn HSL theme tokens in [globals.css](./packages/web/app/globals.css) are mapped onto cream/ink (e.g. `--background: 40 36% 95%` = cream).
- **`::selection`:** `#e8c9b8` (terracotta-100) on `#1a1816` ink.
- **PWA theme color:** `#f7f4ee` (cream) ([layout.tsx](./packages/web/app/layout.tsx)).
- **Not in code:** `#BDADFF` lavender and the `#22D3EE`/`#06B6D4` cyan ramp (an older identity) are **not** referenced anywhere in `packages/`. The product shipped on terracotta+cream — do not reintroduce cyan or slate-950 surfaces.

**Spacing:** 4px base unit (`xs=4`, `sm=8`, `md=16`, `lg=24`, `xl=32`, `2xl=48`, `3xl=64`)

---

## UI Review Workflow

After UI work, review with:

- [skills/oscar-design-review/SKILL.md](./skills/oscar-design-review/SKILL.md)
- [skills/oscar-design-review/references/review-checklist.md](./skills/oscar-design-review/references/review-checklist.md)

Review checks:

- visual consistency with design system
- UX across loading, empty, error, success states
- consistency across web and desktop when both affected
- shared-component reuse before one-off patterns
- maintainability, duplication, architectural drift

## Review Output Format

When reviewing changes:

- findings first, ordered by severity
- exact file references
- user impact + consistency impact
- focused fixes over broad redesign advice
- explicitly say when no major issues found; note residual risks
