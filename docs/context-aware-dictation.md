# Context-Aware Dictation

Context-aware dictation adapts Oscar's cleanup prompt to the place where the
recording started. The same spoken phrase can become a terse coding instruction,
a polished email paragraph, a compact chat message, or a lightly cleaned browser
query depending on active app/site context.

## Current Desktop Flow Audit

1. **Context capture**
   - Global hotkey and macOS tray recording both call
     `get_frontmost_context_payload()` in Rust before recording starts.
   - macOS captures app name, bundle id, window title, target app name, and
     browser site host/title for common browsers.
   - Windows captures foreground process/window title but does not yet capture
     browser tab host/title.
   - Linux currently returns a fallback platform payload.

2. **Frontend snapshot**
   - `App.tsx` listens for `hotkey-recording-start`.
   - If Oscar itself is frontmost, context is discarded.
   - Otherwise the payload is normalized into `DictationContextSnapshot` and
     stored in `dictationContextRef`.

3. **Routing**
   - `routeDictationContext()` maps site hosts and app/process names to a
     `DictationRoutingResult`.
   - Routing currently supports `default`, `ide`, `email`, `docs`, `chat`, and
     `browser`.
   - Routing attaches the shared prompt version `context-v1`.

4. **AI processing**
   - Desktop dictation calls `aiService.processText()` with mode
     `transcribe_cleanup`.
   - If context-aware dictation is enabled, context and routing are sent to the
     Supabase `ai-process` function.
   - The edge function chooses cleanup instructions from an explicit category
     map and includes the prompt version in the user prompt.

5. **Current persistence**
   - Local desktop transcripts include dictation metadata via
     `buildDictationMetadata()`.
   - Full saved-note persistence still needs a dedicated pass to ensure the same
     metadata is written consistently wherever notes are created or updated.

## Category Contract

The shared category contract lives in
`packages/shared/src/types/dictation.types.ts`.

| Category | Intended use | Output behavior |
| --- | --- | --- |
| `default` | No reliable app/site context | Faithful cleanup without changing tone or structure more than needed |
| `ide` | Cursor, VS Code, Zed, JetBrains, coding agents | Terse task-like output; preserve code tokens, paths, errors, commands, filenames, stack traces |
| `email` | Gmail, Outlook, Apple Mail, Superhuman | Professional prose; explicit requests/action items; no invented salutation or sign-off |
| `docs` | Notion, Google Docs, Word, Obsidian, Craft, Confluence | Polished prose with paragraphs, bullets, or sections when implied |
| `chat` | Slack, Discord, Teams, Messages, WhatsApp, AI chat apps | Compact conversational text ready to send |
| `browser` | Generic browser input without a known site category | Minimal cleanup for search queries, forms, and short browser input |

## Prompt Versioning

The active context-aware dictation prompt version is `context-v1`.

Versioning rules:

- Bump the version when category instructions materially change.
- Keep the version stable for small routing-list additions that do not change
  prompt behavior.
- Store the prompt version with notes so feedback can be grouped by prompt
  behavior.
- Use old versions when analyzing historical feedback; do not assume a bad
  result from `context-v1` applies to future versions.

## Requirements For Phase 4: Metadata Persistence

Goal: every saved note that came from context-aware desktop dictation should
store the same routing metadata as the local transcript.

Requirements:

- Confirm the production `notes` table has the dictation metadata columns in all
  active Supabase migration paths.
- Thread `DictationRoutingResult` metadata through any desktop save-to-note flow,
  not only local transcript history.
- Ensure updates preserve existing dictation metadata unless the user explicitly
  regenerates/reprocesses the note.
- Treat missing context as valid: store `default`, `fallback`, and the active
  prompt version when routing runs without a snapshot.
- Add a manual QA checklist for saved notes created from IDE, email, chat, docs,
  generic browser, and fallback contexts.

## Requirements For Phase 5: Feedback Analytics By Context

Goal: make feedback useful for prompt iteration by grouping quality signals by
category, app key, context source, and prompt version.

Requirements:

- Extend the feedback stats surface to show helpful rate by:
  - `dictation_category`
  - `dictation_app_key`
  - `dictation_context_source`
  - `dictation_prompt_version`
- Preserve raw negative examples with their context metadata so prompt changes
  can be tested against real failures.
- Identify thresholds for action, such as a category falling below the overall
  helpful rate or one negative reason exceeding a chosen percentage.
- Keep analytics read-only for the first pass; no automated prompt changes.

## Requirements For Phase 6: User-Facing Context Indicator

Goal: give users confidence that Oscar understood the target context without
making the interface noisy.

Requirements:

- Show a small passive label in desktop results/local transcript history, such
  as "Optimized for Gmail" or "Optimized for Cursor".
- Use `dictation_app_key` when known, otherwise fall back to the category label.
- Provide a neutral fallback state only when useful, such as "Standard cleanup".
- Do not add a large settings surface in the MVP.
- Avoid implying certainty when routing confidence is low.
