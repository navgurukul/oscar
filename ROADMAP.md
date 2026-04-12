# Oscar Roadmap

Product ideas and planned features. Not prioritized — ordering within sections is loose.

---

## Context-Aware Dictation

**Problem**: Oscar formats all notes the same way regardless of where the user is working. A note dictated inside VS Code needs different treatment than one inside Gmail or Notion.

**Idea**: Detect the active application at recording time (desktop) or active browser tab/domain (web), and use that context to:

- Pick the right formatting style automatically (code comments vs prose vs bullet list vs email)
- Preserve domain-specific terminology (function names, ticket IDs, brand names)
- Adjust tone (technical/terse for dev tools, conversational for messaging apps)
- Feed context into the system prompt of the formatting agent so outputs are immediately usable in that environment

**Surfaces affected**:
- Desktop: Tauri can query the OS for the frontmost app via a Rust command
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
- Pass context through recording hook → format API route → Groq call

---

## Vibe Coding Mode

**Problem**: When using Oscar as a voice interface for coding agents (Claude, Cursor, Copilot, etc.), users speak casually and incompletely. The raw-to-formatted pipeline preserves fidelity — but for coding prompts, fidelity to the lazy input is the wrong goal. The prompt itself should be improved, not just cleaned.

**Idea**: A dedicated "Vibe Coding" mode that:

1. **Understands coding context** — recognizes library names, CLI flags, file paths, error messages, and dev jargon even when mumbled or abbreviated
2. **Prompt-engineers the output** — takes a vague spoken intent and rewrites it as a high-quality, specific prompt ready to paste into a coding agent
3. **Fills in the blanks** — if the user says "make that function faster", the agent infers the likely language, looks at context (if available), and produces a prompt like: "Refactor the `processItems` function in `utils/data.ts` to improve performance — consider memoization or early exits. Explain the changes."
4. **Does not format passively** — unlike the base formatting agent which only cleans what was said, Vibe Coding mode is allowed to add, restructure, and strengthen the prompt

**Activation**: Toggle in settings or a dedicated recording mode (e.g., long-press recording button → mode picker). On desktop, could bind to a separate global shortcut.

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
- New API route: `app/api/groq/vibe-code/route.ts`
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
