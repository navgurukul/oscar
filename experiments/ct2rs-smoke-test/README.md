# ct2rs Smoke Test — Stage 2 KILL SWITCH

Standalone Rust binary that exists for one purpose: prove `ct2rs` (Rust
binding for CTranslate2 / Faster-Whisper) builds + links on a real MSVC
Windows CI runner.

This is Stage 2 of the Faster-Whisper feasibility spike. If this binary
does NOT build in CI, the entire Faster-Whisper path is dead for Windows
and we pivot to whisper.cpp + Silero VAD as the Windows perf fix instead.

## What this does (and does NOT do)

- ✅ Verifies `ct2rs` crate compiles with the `whisper` feature
- ✅ Verifies CTranslate2 C++ library links on Windows MSVC
- ✅ Verifies the Whisper FFI surface is callable from Rust
- ❌ Does NOT measure transcription quality (that's Stage 3)
- ❌ Does NOT measure transcription speed (that's Stage 4)
- ❌ Does NOT load Oscar's existing ggml models (different format)

## Running locally

Without a model (verifies build + link only):

```bash
cargo run --release
```

With a converted CT2-format model (optional sanity check):

```bash
cargo run --release -- /path/to/ct2-whisper-model-folder
```

A CT2-format model is a **folder** (not a single file) containing
`model.bin`, `config.json`, `tokenizer.json`, etc. — produced by
`ct2-transformers-converter`. We don't have any yet; Stage 3 produces them.

## CI

See `.github/workflows/ct2rs-smoke-test.yml`. Triggered on push to any
`spike/ct2rs-smoke-*` branch or via workflow_dispatch.

## Kill-switch outcome

- **Build green** → Continue to Stage 3 (convert models, measure WER).
- **Build red** → Faster-Whisper is dead for Windows. Pivot to backup plan
  (whisper.cpp + Silero VAD). Delete this directory.
