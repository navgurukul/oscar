# CLAUDE.md

Comprehensive reference for AI assistants working in the Oscar codebase.

---

## Project Overview

Oscar is an AI-powered voice note-taking application. Users record audio, which is transcribed (via Whisper on desktop or a browser-based STT engine on web), then formatted and titled by Groq-backed AI agents.

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

**Version:** 0.3.23 | **Node:** v22 (`.nvmrc`) | **Package manager:** pnpm 9

---

## Tech Stack

| Layer | Web | Desktop |
|---|---|---|
| Framework | Next.js 15, React 19 | Tauri 2, Vite, React 19 |
| Language | TypeScript 5.9 | TypeScript + Rust (2021 edition) |
| Styling | Tailwind CSS 3.3, CVA | Tailwind CSS |
| UI primitives | Radix UI + shadcn/ui (New York style) | Radix UI + shadcn/ui |
| Auth & DB | Supabase (PostgreSQL + Auth) | — |
| AI | Groq API (llama-3 variants) | whisper-rs (local Whisper) |
| Payments | Razorpay | — |
| STT | ONNX Runtime Web + speech-to-speech | whisper-rs (CUDA/Vulkan) |
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
GROQ_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_WEB_APP_URL=
```

See `packages/web/.env.example` for the full list.

---

## Package Details

### `packages/web` — Next.js App

**App Router structure:**
```
app/
├── page.tsx            # Landing page
├── auth/               # Auth flows (sign-in, callback)
├── notes/              # Notes list + detail
├── recording/          # Recording interface
├── results/            # Post-recording result view
├── settings/           # User settings (billing, vocabulary, data)
├── pricing/            # Pricing page
├── meetings/           # Meeting notes
├── download/           # Desktop download handler
└── api/
    ├── groq/
    │   ├── format/       # Stream-format transcript → clean note
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
- `ai.service.ts` — Groq API calls (formatting, title, streaming)
- `stt.service.ts` — Browser speech-to-text pipeline
- `notes.service.ts` — Note CRUD (Supabase)
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
- `useNoteStorage.ts` — Note persistence hook

**Components** (`components/`):
```
notes/          # TrashSheet
recording/      # HomeRecordingButton, RecordingControls, RecordingTimer, PermissionErrorModal
results/        # NoteEditor, NoteEditorSkeleton, NoteActions, FeedbackWidget
settings/       # AccountSection, BillingSection, VocabularySection, FolderManagementSection, DataPrivacySection
shared/         # FloatingNavbar, Footer, ProcessingScreen, AuthEdgeButton, NotesListSkeleton
subscription/   # PricingCard, RazorpayCheckout, UpgradePrompt, UsageIndicator
ui/             # shadcn primitives + custom: sparkles, dotted-glow-background, animated-testimonials, lamp
```

**Build scripts:**
- `pnpm dev` — Next.js dev server
- `pnpm build` — Production build
- `pnpm lint` — ESLint (next/core-web-vitals + TypeScript)

---

### `packages/desktop` — Tauri App

Rust backend + Vite/React frontend sharing UI components with the web package.

- STT: **whisper-rs** (local model, GPU-accelerated via CUDA on Windows, Vulkan on Linux)
- Audio pipeline: Symphonia (codec) → Rubato (resampling) → Opus (encoding)
- System integration: WASAPI (Windows), global shortcuts, deep links, auto-updater
- Tauri plugins used: `global-shortcut`, `deep-link`, `updater`, `store`, `process`, `opener`

**Build scripts:**
- `pnpm dev` — Tauri + Vite dev (hot reload)
- `pnpm build` — Full production build (TypeScript → Vite → Rust → binary)
- `pnpm tauri` — Direct Tauri CLI passthrough

---

### `packages/shared` — Shared Library

TypeScript-only. Exports:
- `types` — `Note`, `LocalTranscript`, `FeedbackReason`, `FormattingResult`, `TitleGenerationResult`
- `constants` — Shared configuration values

Import from other packages: `import { Note } from '@oscar/shared/types'`

---

## Conventions

### TypeScript

- Strict mode enabled in all packages
- Path alias `@/*` → `./src/*` (desktop) and `./*` (web)
- Prefer interfaces over type aliases for object shapes
- Export types from `@oscar/shared` for anything shared across web and desktop

### Styling

- **Tailwind first** — use utility classes; avoid bespoke CSS unless animation-specific
- **CVA** (`class-variance-authority`) for component variants
- **cn()** helper (`clsx` + `tailwind-merge`) for conditional class merging
- Design tokens live in `tailwind.config.js` — do not hardcode hex values inline
- Dark mode is class-based (`.dark` on `<html>`)

### Component Authoring

- shadcn/ui components live in `components/ui/` — extend, don't modify originals
- Domain components (notes, recording, results, settings) live in their named folder
- One component per file; filename = component name (PascalCase)
- Prefer composition over props-explosion: use `children` or named slots

### API Routes (web)

- All Groq routes use streaming (`ReadableStream`) where possible
- Rate-limiting middleware wraps AI endpoints — check `lib/rate-limit.ts` before adding new AI routes
- Server actions are not used; all mutations go through Supabase client SDK or API routes

### Git & Commits

- Semantic prefixes: `feat:`, `fix:`, `style:`, `refactor:`, `chore:`, `docs:`
- Feature branches → PR → merge to main
- Tag-based releases: `vMAJOR.MINOR.PATCH` triggers the GitHub Actions release pipeline
- Current working branch for AI: `claude/add-claude-documentation-1CYnF`

### No Testing Framework

There is currently no automated test suite. QA is manual + ESLint + TypeScript type-checking:
- `pnpm lint` (web)
- `pnpm typecheck` (shared)

Do not add Jest/Vitest unless the task explicitly calls for it.

---

## AI Agent Architecture

See [Agents.md](./Agents.md) for the full pipeline specification. Summary:

```
Audio → STT (Whisper/browser) → Text Formatting Agent → Title Agent → Stored Note
```

- **Formatting agent**: `app/api/groq/format/route.ts` — removes filler words, fixes grammar, streams output
- **Title agent**: `app/api/groq/title/route.ts` — generates 4-10 word titles; heuristic fallback on failure
- **Config**: `API_CONFIG` object in `ai.service.ts` (model, temperature, top_p, max_tokens)
- **Feedback loop**: Yes/No + reason tags → `feedback.service.ts` → Supabase → prompt iteration

---

## CI/CD (`.github/workflows/release.yml`)

- Triggered by version tags (`v*`)
- Builds all platforms in parallel: macOS (aarch64 + x86_64), Windows (x64), Linux (x64)
- Artifacts: DMG, App bundle, NSIS installer, AppImage, DEB
- Publishes to GitHub Releases + generates `updates.json` for Tauri auto-updater
- Secrets needed: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, Supabase keys

---

## UI Build Workflow

For any meaningful UI, UX, styling, layout, navigation, motion, or shared component work:

1. Read [DESIGN.md](./DESIGN.md) first.
2. Read [Agents.md](./Agents.md) for product and AI-system context.
3. Build with the same principles used by Codex's `frontend-skill`:
   - favor strong hierarchy over lots of components
   - avoid generic SaaS card grids unless cards are the interaction
   - keep one dominant idea per section or screen
   - preserve OSCAR's cyan-and-cream editorial identity (`#06B6D4` cyan, `#FCFBF2` cream, `#BDADFF` lavender)
   - make mobile layout and first-screen clarity intentional
   - use motion sparingly and purposefully (150-300ms transitions)

**Typography:**
- Headlines: Figtree 500-600
- Body: Inter 400-500
- Mono: JetBrains Mono

**Spacing:** 4px base unit (`xs=4`, `sm=8`, `md=16`, `lg=24`, `xl=32`, `2xl=48`, `3xl=64`)

---

## UI Review Workflow

After implementing UI work, review it using:

- [skills/oscar-design-review/SKILL.md](./skills/oscar-design-review/SKILL.md)
- [skills/oscar-design-review/references/review-checklist.md](./skills/oscar-design-review/references/review-checklist.md)

That review should check:

- visual consistency with the design system
- UX quality across loading, empty, error, and success states
- consistency across web and desktop patterns when both surfaces are affected
- shared-component reuse before introducing one-off patterns
- maintainability, duplication, and architectural drift

## Review Output Format

When reviewing changes:

- present findings first, ordered by severity
- include exact file references
- explain user impact and consistency impact
- prefer focused fixes over broad redesign advice
- explicitly say when no major issues are found, and mention residual risks
