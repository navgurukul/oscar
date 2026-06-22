# Windows Vulkan — On-Device Test Checklist

Vulkan GPU acceleration for whisper-rs on Windows. The **build recipe is CI-validated**
(it compiles + bundles green from a Mac, no Windows box needed). What is **NOT yet
validated** is runtime behaviour on a real GPU — that is the gate this checklist clears
before any `v*` release tag ships Vulkan to users via the auto-updater.

- Branch: `feat/windows-vulkan`
- Recipe (the 3 CI-confirmed fixes): `CMAKE_GENERATOR=Ninja` (ExternalProject inherits the
  MSVC env — the v0.5.26 blocker), `CARGO_TARGET_DIR=C:\t` (past Windows MAX_PATH), `--release`
  (single CRT). See `.github/workflows/vulkan-build-test.yml`.
- GPU detect arm: `src-tauri/src/hardware.rs` → `GpuBackend::detect()` returns `Vulkan` under
  `#[cfg(all(target_os = "windows", feature = "vulkan"))]`.

---

## 0. Get the test build (no public release)

- [ ] Push to `feat/windows-vulkan` (or run **vulkan-build-test** via *workflow_dispatch*).
- [ ] Open the green run → **Artifacts** → download **`oscar-windows-vulkan-nsis`**.
- [ ] Unzip → run the `.exe` NSIS installer on the Windows GPU box.

This artifact is built **with** `CARGO_TARGET_DIR=C:\t`, so it always materialises. It does
**not** publish a GitHub release and does **not** touch the auto-updater.

## 1. GPU detection (the core check)

- [ ] Fresh install → first-run onboarding (`SetupScreen`). The hardware line should read
      **"· VULKAN acceleration"** (`hardware.gpuBackend === "vulkan"`).
- [ ] Confirm on a box that actually has a Vulkan-capable GPU + current driver (Vulkan ICD present).

## 2. Transcription works + is faster

- [ ] Record a Scribble / dictation → transcript is correct (no garbage, no hang).
- [ ] Transcription is **noticeably faster** than the current CPU-only Windows build
      (same model, same clip). Note rough wall-clock vs the shipped build.
- [ ] Run a Minutes / longer clip too (larger model path).

## 3. CPU fallback (no Vulkan ICD)

- [ ] On a box with **no** Vulkan driver (or a VM without GPU passthrough): app still launches,
      still transcribes via CPU, does **not** crash. (whisper.cpp falls back when no ICD loads.)
- [ ] Onboarding line should NOT claim Vulkan acceleration there.

## 4. Smoke the rest of the app

- [ ] Stream pill (`Ctrl+Space`), global shortcut, tray, deep links all fire.
- [ ] Model download / load / unload flow normal (Vulkan changes the compute backend, not the
      model catalog).

---

## ⚠ Before tagging a `v*` release — the release.yml MAX_PATH risk

`release.yml` enables Vulkan on the Windows row (`--features vulkan` + Ninja + MSVC + Vulkan SDK
steps) but **deliberately does NOT set `CARGO_TARGET_DIR=C:\t`** — its sign/bundle/upload steps
hardcode `src-tauri/target/$TARGET/release/bundle`, and moving the target root would break them.

The probe proved the **default** target path is ~290 chars (> 260 MAX_PATH) → `vulkan-shaders-gen`
fails with `cl.exe C1083`. So the first tagged release **may fail to compile Vulkan on Windows**.

- [ ] First `v*` run: watch the Windows job at the `vulkan-shaders-gen` compile.
- [ ] If it hits **C1083 / MAX_PATH**, apply a short-path fix that keeps the bundle paths intact —
      e.g. set `CARGO_TARGET_DIR=C:\t` on Windows **and** point the Windows sign/upload steps at it
      (or junction `C:\t` → the target dir). macOS/Linux rows must stay untouched.

## Sign-off → ship

- [ ] Steps 1–4 pass on the artifact build.
- [ ] When ready to ship, cut the tag from `release_Dev` as usual. The release Windows installer
      auto-updates all Windows users — only tag after the GPU runtime test above passes.
