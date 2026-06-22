# OSCAR AI Agents

Overview of AI agents and services in OSCAR.

## Overview

OSCAR uses AI agents to transform voice recordings into clean formatted text. **Two providers, split by feature:**

- **Mercury 2 (Inception Labs)** — all Scribble + Stream/dictation text agents: format, title, transform, format-email, translate, publish, and desktop dictation cleanup. Endpoint is OpenAI-compatible (`https://api.inceptionlabs.ai/v1`, model `mercury-2`). Requires `MERCURY_API_KEY` (web `.env` + Supabase secret for the `ai-process` Edge Function).
- **Google Gemini 2.5 Flash** — Minutes (meeting enhance, via the `meeting-enhance` Edge Function) and embeddings (`text-embedding-004`) **only**. Requires `GEMINI_API_KEY`.

> Migrated to Mercury 2 for Scribble in v0.7.30 (this doc previously described an all-Gemini pipeline). Gemini now powers Minutes + embeddings exclusively.

## Architecture

```
Voice Input → Speech Recognition → AI Formatting Agent → AI Title Agent → Formatted Scribble
              (Whisper desktop /        (Mercury 2)         (Mercury 2)
               Web Speech API web)
```

## AI Agents

### 1. Text Formatting Agent

**Purpose**: Converts raw speech-to-text transcripts into clean, well-formatted text.

**Location**: [`packages/web/app/api/ai/format/route.ts`](./packages/web/app/api/ai/format/route.ts) (streams via `packages/web/lib/server/mercury.ts`)

**Key Responsibilities**:

- Remove filler words (um, uh, like, you know, etc.)
- Fix grammar, spelling, punctuation, capitalization
- Break content into readable paragraphs
- Remove repeated sentences or ideas
- Preserve original meaning and intent

**Important Behaviors**:

- ❌ NEVER answers questions in text
- ❌ NEVER adds content not in original
- ❌ NEVER completes incomplete thoughts
- ✓ Only formats what was actually spoken

**Configuration**:

- Model: **Mercury 2** (`mercury-2`) via `packages/web/lib/server/mercury.ts`
- Temperature / top-p / max-tokens tuned in the route + Mercury helper

**Example**:

```
Input:  "um so like how to create a react app you know"
Output: "How to create a React app."
```

### 1a. Other Scribble / Stream text agents (all Mercury 2)

Beyond format + title, the same Mercury 2 backend powers:

- [`packages/web/app/api/ai/transform/route.ts`](./packages/web/app/api/ai/transform/route.ts) — custom text transforms (summary, bullets, etc.), streaming
- [`packages/web/app/api/ai/format-email/route.ts`](./packages/web/app/api/ai/format-email/route.ts) — email-shaped formatting, streaming
- [`packages/web/app/api/ai/translate/route.ts`](./packages/web/app/api/ai/translate/route.ts) — EN/Hi translation
- [`packages/web/app/api/ai/publish/route.ts`](./packages/web/app/api/ai/publish/route.ts) — publish-ready rewrite
- Desktop dictation cleanup — `transcribe_cleanup` mode via the `ai-process` Edge Function (see Desktop Stream Pill below)

### 2. Title Generation Agent

**Purpose**: Generates concise, descriptive titles for formatted Scribbles.

**Location**: [`packages/web/app/api/ai/title/route.ts`](./packages/web/app/api/ai/title/route.ts)

**Key Responsibilities**:

- Short titles (4-10 words preferred)
- Maintain original language (English/Hindi/Hinglish)
- Appropriate casing (Title Case for English)
- Titles under ~60 characters

**Fallback Behavior**:
If AI title generation fails, system uses heuristic:

- Extracts first sentence
- Truncates to 60 characters if needed
- Falls back to "Untitled Scribble" if no content

**Configuration**:

- Model: **Mercury 2** (`mercury-2`) via `packages/web/lib/server/mercury.ts`
- Max title length: 60 chars (heuristic fallback truncates here)

## Service Layer

### AI Service

**Location**: [`packages/web/lib/services/ai.service.ts`](./packages/web/lib/services/ai.service.ts)

Clean interface for interacting with AI agents.

**Methods**:

- `formatText(rawText: string)` - Formats raw transcript text
- `generateTitle(source: string)` - Generates title from text
- `generateFallbackTitle(text: string)` - Creates heuristic title
- `sanitizeTitle(title: string)` - Cleans title output

**Error Handling**:

- Graceful fallbacks for API failures
- Local heuristic formatting when AI unavailable
- Comprehensive error messages and logging

## Prompt Engineering

### Format Agent Prompt

**Location**: [`packages/web/lib/prompts.ts`](./packages/web/lib/prompts.ts) - `SYSTEM_PROMPTS.FORMAT`

Formatting prompt designed to:

1. Establish clear boundaries (formatter ONLY, not assistant)
2. Prevent AI from answering questions in text
3. Preserve original meaning without addition
4. Handle incomplete inputs appropriately
5. Correct obvious speech recognition errors for names/titles

### Title Agent Prompt

**Location**: [`packages/web/lib/prompts.ts`](./packages/web/lib/prompts.ts) - `SYSTEM_PROMPTS.TITLE`

Focused on:

1. Short, descriptive titles
2. Language preservation
3. Appropriate casing conventions
4. Character limits

## React Hooks Integration

### useAIFormatting Hook

**Location**: [`packages/web/lib/hooks/useAIFormatting.ts`](./packages/web/lib/hooks/useAIFormatting.ts)

Provides React components AI formatting capabilities:

- `isFormatting` - Loading state
- `formattingError` - Error state
- `formatText()` - Async formatting function

## Configuration

### API Configuration

Scribble/Stream text agents call **Mercury 2** through the server helper [`packages/web/lib/server/mercury.ts`](./packages/web/lib/server/mercury.ts):

```
MERCURY_API_BASE_URL = "https://api.inceptionlabs.ai/v1"   // OpenAI-compatible
MERCURY_MODEL        = "mercury-2"
```

Gemini config (Minutes + embeddings only) lives in [`packages/shared/src/constants/api.ts`](./packages/shared/src/constants/api.ts) (`gemini-2.5-flash`) and `packages/web/lib/server/embeddings.ts` (`text-embedding-004`).

Desktop dictation cleanup (the `ai-process` Edge Function, used by the Stream pill) also calls Mercury 2 via the OpenAI-compatible endpoint and requires `MERCURY_API_KEY` set as a Supabase secret.

### Environment Variables

Required:

```
MERCURY_API_KEY=your_inception_labs_key   # Scribble + Stream agents (web + ai-process Edge Function)
GEMINI_API_KEY=your_google_key            # Minutes (meeting-enhance) + embeddings only
```

## Error Handling

AI agents implement comprehensive error handling:

1. **API Key Validation**: Checks for missing key before requests
2. **Input Validation**: Validates request bodies and content
3. **Network Errors**: Handles connection and timeout issues
4. **Response Validation**: Verifies API response structure
5. **Graceful Degradation**: Falls back to local heuristics when AI fails

Error messages defined in [`packages/web/lib/constants.ts`](./packages/web/lib/constants.ts) under `ERROR_MESSAGES`.

## Processing Pipeline

1. **Voice Recording**: User speaks into microphone
2. **Speech-to-Text**: web uses the browser Web Speech API (`SpeechRecognition`, wrapped by `speech-to-speech` for VAD/continuity); desktop uses local whisper-rs (Whisper / Oriserve Hinglish models)
3. **AI Formatting**: Raw transcript sent to formatting agent
4. **AI Title Generation**: Formatted text sent to title agent
5. **Storage**: Results saved to sessionStorage, and to Supabase when saved as a Scribble
6. **Display**: User can view, edit, copy, or download
7. **Feedback Collection**: User provides quality feedback on AI formatting

## Desktop Stream (Dictation) Pill

On desktop, the stream / dictation flow has its own dedicated entry point — the always-visible edge-handle pill — distinct from Scribble and Minutes recordings.

**Entry points**:

- **Edge handle (hover/click)**: a 72×5 px handle docked flush to the bottom of the primary monitor. Cursor enters the bottom 56 px hit zone → handle widens with a terracotta glow and shows "Click to dictate" → click starts recording. The full Paper pill is reserved for active feedback states so idle hover never covers the user's app.
- **Global hotkey `Ctrl+Space`** ([`packages/desktop/src-tauri/src/hotkey.rs`](./packages/desktop/src-tauri/src/hotkey.rs)): hold to record, release to stop. Captures frontmost-app context at press time.

**Pipeline (different from the Scribble/Minutes path)**:

```
Pill click / Ctrl+Space
  → capture frontmost app  (frontmost.rs)
  → MediaRecorder (mp4 / webm, 100 ms chunks)
  → whisper-rs transcription  (whisper.rs, local model)
  → aiService.processText(text, "transcribe_cleanup")  — micro Mercury 2 prompt (ai-process Edge Function)
  → paste_transcription  (clipboard + synthetic Cmd/Ctrl+V via paste.rs)
  → pill shows "Inserted into document" toast (1500 ms)
  → pill collapses back to the edge handle
```

The AI cleanup uses the `transcribe_cleanup` mode in [`packages/desktop/src/services/ai.service.ts`](./packages/desktop/src/services/ai.service.ts) — a smaller, faster prompt than the Scribble formatter because stream inserts go directly into the user's focused field. The upstream model is Mercury 2 (Inception Labs) via the `ai-process` Edge Function; reasoning is disabled (`reasoning_effort: "minimal"`) and temperature is pinned to 0.5 so the tight stream-cleanup token budget reaches the output. The Title Agent is **not** invoked for stream inserts (there is no scribble to title).

**Pill state machine** (driven by `set_pill_phase` Tauri command + `pill-set-phase` event in [`packages/desktop/public/pill.html`](./packages/desktop/public/pill.html)):

| Phase | Visual | Window size (W×H) |
|---|---|---|
| `rest` | 72×5 handle flush at edge | 140×16 px |
| `ready` | 96×6 handle, terracotta glow, "Click to dictate" hint | 140×16 px |
| `recording` | 15-bar terracotta-500 (`#B8623D`) waveform, live audio levels | 280×200 px |
| `processing` | 13 pulsing dots (1.1 s `mm-pulse`, 0.07 s stagger); caption cycles transcribing → removing filler → formatting → finalizing | 280×200 px |
| `downloading` | caption + live % while the dictation model downloads (no audio captured; auto-collapses ~2.5 s after progress stops) | 280×200 px |
| `inserted` | terracotta "Inserted into document" toast (1500 ms dwell) | 280×200 px |
| `copied` | terracotta "Copied to clipboard" toast | 280×200 px |
| `error` | rose-700 (`#BE123C`) triangle + "no input" (1500 ms) | 280×200 px |
| `auth` | terracotta "Sign in to enable AI" (gated; not error-red) | 280×200 px |
| `settings` | popover open above the pill | 280×380 px |

The pill's settings popover (Polish / Prompt Engineer / Email Reply transforms, Language, Auto-apply) is wired to the same persisted settings the Settings tab writes (`tonePreset`, `transcriptionLanguage`, `autoPaste`). The pill emits `pill-settings-update` events; the host in [`packages/desktop/src/App.tsx`](./packages/desktop/src/App.tsx) listens and calls `saveSetting`.

**Linux**: secondary webview windows crash tao's event loop, so the pill is not created. Recording state surfaces on the tray-icon tooltip instead (`crate::state::LINUX_TRAY`).

## AI Quality Feedback System

### Overview

Feedback system collects user signals on AI formatting quality for continuous prompt improvement and future model training.

### User Experience

On each formatted Scribble, users see:

- **"Was this formatting helpful?"** with Yes/No buttons
- If "No", optional reason tags:
  - Too short
  - Missed key info
  - Incorrect grammar
  - Wrong tone
  - Poor formatting
  - Other

### Data Storage

**Location**: [`packages/web/lib/types/scribble.types.ts`](./packages/web/lib/types/scribble.types.ts)

Each Scribble stores:

```typescript
feedback_helpful: boolean | null;        // User's yes/no response
feedback_reasons: FeedbackReason[] | null; // Array of reason tags
feedback_timestamp: string | null;        // When feedback was given
```

### Feedback Service

**Location**: [`packages/web/lib/services/feedback.service.ts`](./packages/web/lib/services/feedback.service.ts)

**Methods**:

- `submitFeedback(scribbleId, helpful, reasons?)` - Store user feedback
- `getFeedbackStats()` - Get aggregated statistics:
  - Total feedback count
  - Helpful vs not helpful counts
  - Helpful percentage
  - Breakdown of negative feedback reasons
- `getRecentNegativeFeedback(limit)` - Get recent negative feedback with full context for analysis

### Using Feedback for Prompt Improvement

**Documentation**: [`packages/web/lib/prompts.ts`](./packages/web/lib/prompts.ts) (see FEEDBACK-DRIVEN PROMPT OPTIMIZATION GUIDE)

**Iterative Process**:

1. **Monitor**: Check `getFeedbackStats()` weekly for trends
2. **Identify Patterns**: If reason appears >20%, investigate
3. **Review Examples**: Use `getRecentNegativeFeedback()` to see problem cases
4. **Update Prompt**: Make targeted changes to `SYSTEM_PROMPTS.FORMAT`
5. **Test**: Try updated prompt on previous negative cases
6. **Deploy & Monitor**: Push changes, track if issue decreases

**Example Workflow**:

```typescript
import { feedbackService } from "@/lib/services/feedback.service";

// Get stats
const { data: stats } = await feedbackService.getFeedbackStats();
console.log(`Helpful rate: ${stats.helpfulPercentage}%`);
console.log("Top issues:", stats.reasonBreakdown);

// If "missed_key_info" is high, review examples
const { data: cases } = await feedbackService.getRecentNegativeFeedback(20);
cases.forEach((scribble) => {
  console.log("Raw:", scribble.raw_text);
  console.log("Formatted:", scribble.original_formatted_text);
  console.log("Issues:", scribble.feedback_reasons);
});

// Update SYSTEM_PROMPTS.FORMAT in /lib/prompts.ts
// Add: "Keep every distinct idea, fact, and detail from the original"
```

### Metrics to Track

- **Helpful Rate**: Target >80% positive feedback
- **Top Issues**: Most common negative feedback reasons
- **Trend Over Time**: Helpful rate improving after prompt changes?
- **User Engagement**: What percentage of users provide feedback?

### Components

**FeedbackWidget**: [`packages/web/components/results/FeedbackWidget.tsx`](./packages/web/components/results/FeedbackWidget.tsx)

- Displays Yes/No buttons
- Shows reason tag selection on "No"
- Handles submission and thank you message display
- Integrated into results and Scribble detail pages

### Future Enhancements

- **A/B Testing**: Test prompt variations, track which performs better
- **Automated Alerts**: Notify when helpful rate drops below threshold
- **Training Data Export**: Format feedback for model fine-tuning
- **Prompt Versioning**: Track which prompt version generated each note

## Best Practices

### When Working with AI Agents:

1. **Always validate input** before sending to agents
2. **Handle failures gracefully** with fallback mechanisms
3. **Log errors comprehensively** for debugging
4. **Sanitize outputs** before displaying to users
5. **Implement retry logic** for transient failures
6. **Monitor token usage** to manage costs
7. **Cache results** when appropriate
8. **Collect feedback** to continuously improve prompt quality

## AI Design Workflow

For any meaningful UI, UX, styling, layout, navigation, or motion work in OSCAR:

1. Use `$frontend-skill` while designing or building the interface.
2. Run [`skills/oscar-design-review/SKILL.md`](/Users/souvikdeb/Desktop/oscar/skills/oscar-design-review/SKILL.md) after implementation, or before merging PR, to review hierarchy, design-system alignment, repo consistency, and maintainability.

Use review workflow for:

- landing page or pricing updates
- recording, Scribble, results, settings, or billing UI changes
- shared component or design-token changes
- cross-cutting refactors that can create visual or architectural drift

### Prompt Engineering Guidelines:

1. Explicit about what agent should NOT do
2. Provide concrete examples of correct and incorrect outputs
3. Use clear, imperative language
4. Test prompts with edge cases
5. Document prompt changes and their effects
6. **Use feedback data** to identify and fix prompt issues
7. **Version prompts** and track performance changes

## Future Enhancements

Potential improvements:

- [ ] Multi-language support optimization
- [ ] Custom formatting styles/preferences
- [ ] Streaming responses for real-time feedback
- [ ] Agent performance monitoring and analytics
- [x] **User feedback collection system** ✅
- [ ] A/B testing different prompt variations using feedback data
- [ ] Automated prompt optimization based on feedback trends
- [ ] Custom vocabulary/name recognition
- [ ] Sentiment analysis agent
- [ ] Summary generation agent
- [ ] Tag/category suggestion agent

## Related Files

- [`packages/web/lib/services/ai.service.ts`](./packages/web/lib/services/ai.service.ts) - AI service implementation
- [`packages/web/lib/services/feedback.service.ts`](./packages/web/lib/services/feedback.service.ts) - Feedback collection and analytics
- [`packages/web/lib/prompts.ts`](./packages/web/lib/prompts.ts) - Agent prompts and optimization guide
- [`packages/web/lib/constants.ts`](./packages/web/lib/constants.ts) - Configuration constants
- [`packages/web/lib/types/scribble.types.ts`](./packages/web/lib/types/scribble.types.ts) - Type definitions
- [`packages/web/lib/types/api.types.ts`](./packages/web/lib/types/api.types.ts) - API type definitions
- [`packages/web/app/api/ai/format/route.ts`](./packages/web/app/api/ai/format/route.ts) - Format endpoint
- [`packages/web/app/api/ai/title/route.ts`](./packages/web/app/api/ai/title/route.ts) - Title endpoint
- [`packages/web/components/results/FeedbackWidget.tsx`](./packages/web/components/results/FeedbackWidget.tsx) - Feedback UI component

## Support

For issues with AI agents:

1. Check error messages in browser console
2. Review API logs in terminal
3. Verify `GEMINI_API_KEY` set correctly
4. Test with fallback mechanisms disabled to isolate issues
