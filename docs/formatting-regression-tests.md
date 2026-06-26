# Formatting Regression Tests

Formatter quality changes must add or update cases in:

`packages/shared/format-regressions/cases.json`

Each case stores:

- `raw`: original transcript
- `badOutputs`: outputs seen from STT or AI that must be corrected
- `expected`: accepted final text
- `tags`: issue class for trend tracking
- `source`: optional note linking the case to a shipped failure class
- `promptMustContain`: prompt anchors that protect known issue classes
- `desktopPromptMustContain`: optional anchors for desktop Stream cleanup prompt

Run deterministic checks:

```bash
pnpm test:format-regressions
```

Run optional live Mercury checks:

```bash
MERCURY_API_KEY=... pnpm test:format-regressions:live
```

Optional overrides:

```bash
MERCURY_API_BASE_URL=https://api.inceptionlabs.ai/v1
MERCURY_MODEL=mercury-2
```

CI runs deterministic checks on every pull request and push. Push builds also run
the live Mercury checks when repository variable `RUN_LIVE_AI_REGRESSIONS=1` and
secret `MERCURY_API_KEY` are both present; otherwise that step logs a skip. CI
also runs the Deno unit tests for the `ai-process` Edge Function cleanup prompt
wiring.

Current regression bank has 2 cases for the recent Indian English/Hinglish
combined-use failure where STT or AI writes `X come Y`, but Oscar must preserve
the intended `X-cum-Y` form. Add broader cases only after more verified failure
classes appear. Use live checks before prompt/model changes. Use deterministic
checks in normal development.
