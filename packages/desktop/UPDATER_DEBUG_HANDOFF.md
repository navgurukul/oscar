# Windows Auto‑Update Hang — Debug Handoff

Hand‑off for a **Windows‑equipped engineer**. The Windows in‑app auto‑update
downloads fine but never applies; the app hangs during install. This was chased
remotely (on macOS) across many releases without a fix because it is
**release‑only + Windows‑only** and could not be reproduced on the dev's Mac or
in `pnpm dev:desktop`. This doc has everything needed to finish it locally.

---

## Symptom

- Update **downloads** successfully (progress bar completes).
- User clicks **Restart / Restart to Install** → app **does not restart**.
- In Task Manager: **`oscar.exe` stays alive** and **`msedgewebview2.exe` count keeps climbing**.
- After force‑kill + reopen, still the old version.
- macOS/Linux unaffected. **Windows only.**

## Confirmed (with evidence)

1. **Server side is correct.** `releases/latest/download/updates.json` serves the right version + a valid Windows `.nsis.zip` URL + signature. Verified repeatedly via `curl`.
2. **Version plumbing is correct.** Displayed version = `tauri.conf.json` version (injected from the tag in CI). CI now also injects `Cargo.toml` (was stale at `0.5.1`).
3. **Download works.** The failure is entirely in **install/apply**.
4. **Install never completes.** The file log (see *Logs* below) always dies at
   `tauri_plugin_updater ... running on_before_exit hook` then goes silent —
   `std::process::exit(0)` truncates the log buffer at the hang.
5. **Release‑only.** The always‑visible **recording pill** window + its
   **cursor‑hover poller** are **skipped in debug builds** (a dev‑local change —
   *not* in the repo; CI release builds keep the pill). The bug tracks exactly
   with the pill's presence ⇒ **the pill is central.** `pnpm dev:desktop` cannot
   reproduce it.
6. **Manual install works.** Double‑clicking `OSCAR_x.y.z_x64-setup.exe` installs
   fine. Only the in‑app `/UPDATE` self‑replace fails ⇒ the bug is the
   **running‑app teardown/hand‑off**, not the installer or the binary.

## Root‑cause hypothesis (leading)

During the updater's install, `tauri-plugin-updater` runs its `on_before_exit`
hook = **`app.cleanup_before_exit()`**, which tears down all windows, then
`ShellExecuteW`s the NSIS `/UPDATE` installer and `std::process::exit(0)`s.

On Windows the **pill window teardown deadlocks**: the cursor‑hover poller
([`pill_hover.rs`](src-tauri/src/pill_hover.rs)) touches the `recording-pill`
window every ~45 ms, and/or the WebView2 teardown of the always‑on‑top pill
hangs. `install()` therefore never reaches `ShellExecute`/`exit` — matching
"`oscar.exe` stays + `msedgewebview2.exe` multiplies + log dies at
`on_before_exit`".

## Tauri install path (the exact deadlock site)

`tauri-plugin-updater 2.10.1`, `Update::install_inner` (cargo registry:
`~/.cargo/registry/src/*/tauri-plugin-updater-2.10.1/src/updater.rs`):

```
extract(bytes)                         // unzip the .nsis.zip
if let Some(hook) = on_before_exit { hook() }   // == app.cleanup_before_exit()  ← SUSPECT
ShellExecuteW(installer, "/P /R /UPDATE /ARGS ...")   // never reached
std::process::exit(0)                                  // never reached
```

The app uses the **default** updater builder
([`lib.rs`](src-tauri/src/lib.rs) → `tauri_plugin_updater::Builder::new().build()`),
and the plugin's `updater_builder()` sets `on_before_exit = || app.cleanup_before_exit()`.
There is no app‑level customization of that teardown for the JS `check()` path.

## Key code paths

| File | What |
|---|---|
| [`src/hooks/useUpdater.ts`](src/hooks/useUpdater.ts) | Updater hook. **Currently STOCK** (`check` → `downloadAndInstall` → `relaunch`). |
| [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs) | `tauri-plugin-log` setup (file log + Stdout; `tauri_plugin_updater` at Trace); updater plugin registration; pill creation in `setup()`; `restore_main_window`; `redact_url` (deep‑link token redaction). |
| [`src-tauri/src/pill.rs`](src-tauri/src/pill.rs) | `create_pill_window` (always‑on‑top, `skip_taskbar(true)`, label **`recording-pill`**); `stop_pill_hover` command. |
| [`src-tauri/src/pill_hover.rs`](src-tauri/src/pill_hover.rs) | The ~45 ms poller; `POLLER_RUNNING` flag + `stop()`. |
| [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) | `updater.windows.installMode: passive`; endpoint `releases/latest/download/updates.json`. |
| `.github/workflows/release.yml` | Release pipeline; injects version into `package.json` + `tauri.conf.json` + `Cargo.toml` from the tag. |

## What was tried (and why each failed)

1. **Destroy windows from JS before `install()`** → regressed: "Restart" hung. Same deadlock, hit from the JS side (destroying the pill races the poller).
2. **`pill_hover::stop()` before `install()`** (`stop_pill_hover` command, still in the Rust) → no effect. NOTE: it stopped the poller but **never *closed* the pill window** — and the test was confounded by #3.
3. **Split `download()` / `install()`** → broke install entirely (`install()` never ran; `install()` throws `"called before download"` if the resource doesn't survive the two clicks). **Reverted.**
4. **`installMode: basicUi`** (to make the installer visible) → `/UPDATE` suppresses the NSIS UI; no extra signal.
5. **Live `pnpm dev:desktop` debugging** → blocked: pill is skipped in debug builds, so the deadlock can't occur there.

## Current baseline state — READ THIS

- **`release_Dev` tip (June 2026)**: a fix is now in place — see *Implemented fix* below.
- The "skip pill in debug builds" guard is **dev‑local** (not in the repo).

## Implemented fix (June 2026)

The flow keeps the stock **atomic** `downloadAndInstall` (the split flow from
v0.7.27 stays dead) but tears the pill down *first*, so the plugin's
`cleanup_before_exit` has nothing pill‑related left to wedge on:

1. `useUpdater.downloadAndInstall` → after `check()` succeeds, invokes the new
   `prepare_update_install` command (Windows‑only body; no‑op mac/Linux) before
   `update.downloadAndInstall()`.
2. `prepare_update_install` ([`pill.rs`](src-tauri/src/pill.rs)): sets the
   `UPDATE_TEARDOWN` flag (blocks any pill re‑creation via hotkey/phase
   commands during the update), stops the hover poller
   ([`pill_hover.rs`](src-tauri/src/pill_hover.rs) — now generation‑counter
   based, restartable), waits one poll cycle, **destroys the
   `recording-pill` window on the main thread**, and polls (≤5 s, logged)
   until the window has left the manager.
3. On download/install failure, the JS catch invokes
   `resume_pill_after_update`: clears the flag, restarts the poller and
   re‑creates the pill at rest.

Every step logs under `[updater] prepare:` / `[updater] resume:` to
`%LOCALAPPDATA%\com.souvikdeb.oscar\logs\oscar.log` — if a release still
hangs, the last `prepare` line pinpoints the dying step.

## Reproduce + debug locally (Windows)

The bug needs a **release** build (pill present). `windows_subsystem = "windows"`
means no console in release, so use the **file log** + a **debugger**.

1. Build a local release with a **low version** so it offers an update:
   set `tauri.conf.json` version to e.g. `0.7.0`, `pnpm build` (desktop), install it.
2. Launch it, trigger the in‑app update, click Restart.
3. **Attach WinDbg / Visual Studio to `oscar.exe` when it hangs** and dump **all thread call stacks** — the main/UI thread stack pinpoints the deadlock (expect it inside WebView2/`wry`/`tao` window destroy for the pill, or the poller).
4. Log file (untruncated up to the hang): `%LOCALAPPDATA%\com.souvikdeb.oscar\logs\oscar.log`.

Faster: add **granular per‑step teardown logging** and run it as an explicit
step *before* install (stop poller → log → close `recording-pill` → log → close
main → log). The lines before the hang flush, so the file log shows the exact
dying step without a debugger.

## Likely fixes to try

- **Custom `on_before_exit`**: build the updater via
  `app.updater_builder().on_before_exit(|| { /* ordered, logged teardown */ })`
  in a custom install command, instead of the default plugin builder — so the
  pill poller is stopped **and the pill window is destroyed cleanly** before the
  installer runs.
- Investigate the **WebView2 controller close** of the always‑on‑top pill
  specifically (known WebView2 teardown‑deadlock patterns when closing from a
  non‑UI thread / during process exit).
- Check **`tauri-plugin-single-instance`** interaction with the installer's
  relaunch.

## Verification protocol (important)

The fix lives in the app that **initiates** the update, so it can only be
verified **release‑to‑release**: clean‑install a fixed build, then auto‑update
to the *next* fixed build, and confirm it lands. **Cannot** be verified in
`pnpm dev:desktop` (no pill). Both builds must contain the fix.

## Logs / artifacts

Representative log (release build) always ends like:
```
[tauri_plugin_updater::updater][DEBUG] checking for updates ...
... (download) ...
[tauri_plugin_updater::updater] running on_before_exit hook
<silence — process wedged, oscar.exe alive, msedgewebview2.exe climbing>
```
That `running on_before_exit hook` line being the last is the whole story: the
hang is in `cleanup_before_exit` window teardown, before the installer launches.
