# Formatting Regression Tests

Formatter quality changes must add or update cases in:

`packages/shared/format-regressions/cases.json`

Each case stores:

- `raw`: original transcript
- `badOutputs`: outputs seen from STT or AI that must be corrected
- `expected`: accepted final text
- `tags`: issue class for trend tracking
- `promptMustContain`: prompt anchors that protect known issue classes
- `desktopPromptMustContain`: optional anchors for desktop Stream cleanup prompt

Run deterministic checks:

```bash
pnpm test:format-regressions
```

Run optional live Gemini checks:

```bash
GEMINI_API_KEY=... pnpm --filter @oscar/shared test:format-regressions:live
```

Use live checks before prompt/model changes. Use deterministic checks in normal development and CI.
