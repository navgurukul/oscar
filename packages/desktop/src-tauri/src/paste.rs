//! Clipboard-based paste-after-transcription flow.
//! Sets text in clipboard, re-focuses the originally-active app or window
//! (captured at hotkey press), then synthesizes Cmd+V (macOS) / Ctrl+V
//! (Windows/Linux). On macOS, falls back to "CLIPBOARD_ONLY" if accessibility
//! permission is missing.

use arboard::Clipboard;

use crate::frontmost::get_frontmost_context_payload;
use crate::state::PENDING_DEEP_LINK;

/// Writes `text` to the system clipboard without simulating any paste keystroke.
/// Used on the no-auto-paste branch so the user can manually press ⌘V / Ctrl+V
/// wherever they want.
#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(&text).map_err(|e| e.to_string())?;
    log::info!("[clipboard] set ({} chars, no paste)", text.len());
    Ok(())
}

/// Returns the name of the frontmost application.
#[tauri::command]
pub fn get_frontmost_app() -> Result<String, String> {
    let payload = get_frontmost_context_payload();
    if payload.app_name.is_empty() {
        Err("Could not determine frontmost app".to_string())
    } else {
        Ok(payload.app_name)
    }
}

/// Writes `text` to the system clipboard and simulates Cmd+V (macOS) or Ctrl+V (Windows/Linux).
/// If `target_app` is provided, activates that app first to ensure paste goes to the right window.
///
/// This is a SYNC command — Tauri 2 runs it on the main thread. This is intentional:
/// CGEvent posting and NSRunningApplication activation are most reliable from the main thread.
#[tauri::command]
pub fn paste_transcription(
    text: String,
    target_app: Option<String>,
    target_bundle_id: Option<String>,
) -> Result<String, String> {
    let paste_started = std::time::Instant::now();

    // 1. Set clipboard
    let clipboard_started = std::time::Instant::now();
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(&text).map_err(|e| e.to_string())?;
    let clipboard_ms = clipboard_started.elapsed().as_millis() as u64;
    log::info!("[paste] clipboard set ({} chars)", text.len());

    #[cfg(target_os = "macos")]
    {
        use crate::macos_paste;

        let bundle_id = target_bundle_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty());
        let app_name = target_app
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty());

        // Check Accessibility permission.
        // AXIsProcessTrusted() can return false after a new build because macOS
        // TCC stores a cryptographic hash of the binary — any rebuild invalidates
        // the hash even if the user's System Settings toggle is still ON.
        // When that happens, call AXIsProcessTrustedWithOptions(prompt=false) to
        // re-register the new binary hash silently, then re-check once.  If it
        // is still false, fall back to CLIPBOARD_ONLY and let the frontend guide
        // the user.
        let accessibility_started = std::time::Instant::now();
        let mut trusted = macos_paste::is_accessibility_trusted();
        if !trusted {
            // Re-register current binary with TCC (no dialog shown)
            trusted = macos_paste::reregister_without_prompt();
            log::info!(
                "[paste] re-registered binary, AXIsProcessTrusted = {}",
                trusted
            );
        }
        let accessibility_ms = accessibility_started.elapsed().as_millis() as u64;
        log::info!("[paste] AXIsProcessTrusted = {}", trusted);

        if !trusted {
            let payload = serde_json::json!({
                "kind": "paste-metrics",
                "status": "clipboard_only",
                "trusted": trusted,
                "targetBundleId": bundle_id,
                "targetApp": app_name,
                "activated": false,
                "targetFound": false,
                "timings": {
                    "clipboardMs": clipboard_ms,
                    "accessibilityMs": accessibility_ms,
                    "activateMs": 0,
                    "activationSleepMs": 0,
                    "cmdVMs": 0,
                    "rustTotalMs": paste_started.elapsed().as_millis() as u64,
                },
            });
            log::info!("[paste-perf] {}", payload);
            return Ok(payload.to_string());
        }

        // 2. Re-activate the target app using NSRunningApplication so that
        //    Cmd+V lands in the correct window even if the Tauri IPC call
        //    caused Oscar's process to become active on the main thread.
        //    We match by bundle identifier when one was captured (unique, and
        //    immune to two running apps sharing a localized name) and fall back
        //    to an exact display-name match otherwise. We use
        //    NSRunningApplication (not `open -a`) because `open -a` triggers a
        //    Space-switch animation which breaks fullscreen apps.
        let mut activate_ms = 0;
        let mut activation_sleep_ms = 0;
        let mut activated = false;
        let mut target_found = false;
        let mut activation_skipped = false;
        if bundle_id.is_some() || app_name.is_some() {
            // Skip activation when the target is ALREADY frontmost. The
            // NSRunningApplication activation (and its 120ms settle sleep) is the
            // dominant, highly variable paste cost — measured 1ms–2.5s for the
            // same target — and it's pure overhead when the app the user dictated
            // into never lost focus, which is the common case (the pill is a
            // non-activating NSPanel). The frontmost check is a cheap NSWorkspace
            // read; we only activate + pay the sleep on a real mismatch.
            //
            // Bundle id is authoritative (matches activate_app's own rule): when
            // one was captured, only skip on a confirmed bundle match and never
            // fall back to a name match — a name fallback could mis-skip when two
            // apps share a localized name. With no bundle id, match on name.
            let current = crate::frontmost::get_frontmost_identity_payload(0);
            let already_frontmost = if let Some(want) = bundle_id {
                current
                    .app_id
                    .as_deref()
                    .is_some_and(|have| want.eq_ignore_ascii_case(have))
            } else if let Some(want) = app_name {
                !current.app_name.is_empty() && want.eq_ignore_ascii_case(&current.app_name)
            } else {
                false
            };

            if already_frontmost {
                activation_skipped = true;
                target_found = true;
                log::info!(
                    "[paste] target already frontmost (bundle={:?}, name={:?}) — skipping activation",
                    bundle_id,
                    app_name,
                );
            } else {
                log::info!(
                    "[paste] re-activating target (bundle={:?}, name={:?}) via NSRunningApplication",
                    bundle_id,
                    app_name,
                );
                let activate_started = std::time::Instant::now();
                match macos_paste::activate_app(bundle_id, app_name.unwrap_or("")) {
                    Ok(true) => {
                        target_found = true;
                        activated = true;
                        activate_ms = activate_started.elapsed().as_millis() as u64;

                        // Brief wait for the window manager to finish activating
                        let activation_sleep_started = std::time::Instant::now();
                        std::thread::sleep(std::time::Duration::from_millis(120));
                        activation_sleep_ms = activation_sleep_started.elapsed().as_millis() as u64;
                    }
                    Ok(false) => {
                        activate_ms = activate_started.elapsed().as_millis() as u64;
                        log::warn!(
                            "[paste] target not found in running apps (bundle={:?}, name={:?})",
                            bundle_id,
                            app_name,
                        );
                    }
                    Err(e) => {
                        activate_ms = activate_started.elapsed().as_millis() as u64;
                        log::warn!("[paste] activate_app failed: {}", e);
                    }
                }
            }
        }

        // 3. Post Cmd+V via CGEvent (from main thread)
        let cmd_v_started = std::time::Instant::now();
        macos_paste::post_cmd_v()?;
        let cmd_v_ms = cmd_v_started.elapsed().as_millis() as u64;
        log::info!("[paste] CGEvent Cmd+V posted");

        let payload = serde_json::json!({
            "kind": "paste-metrics",
            "status": "pasted",
            "trusted": trusted,
            "targetBundleId": bundle_id,
            "targetApp": app_name,
            "activated": activated,
            "activationSkipped": activation_skipped,
            "targetFound": target_found,
            "timings": {
                "clipboardMs": clipboard_ms,
                "accessibilityMs": accessibility_ms,
                "activateMs": activate_ms,
                "activationSleepMs": activation_sleep_ms,
                "cmdVMs": cmd_v_ms,
                "rustTotalMs": paste_started.elapsed().as_millis() as u64,
            },
        });
        log::info!("[paste-perf] {}", payload);
        return Ok(payload.to_string());
    }

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        // Re-focus the window that was active when the hotkey was pressed so
        // that Ctrl+V lands in the right place instead of an Oscar window.
        #[cfg(target_os = "windows")]
        {
            use std::sync::atomic::Ordering;
            use windows_sys::Win32::UI::WindowsAndMessaging::{IsWindow, SetForegroundWindow};
            let hwnd = crate::state::FOCUSED_WIN_HWND.load(Ordering::SeqCst) as isize;
            if hwnd != 0 {
                // The captured HWND can go stale — the target window may be
                // closed between hotkey press and paste. Foregrounding and
                // pasting then lands Ctrl+V in whatever window inherited focus
                // (often Oscar itself). Bail to clipboard-only so the user
                // pastes where they actually intend.
                if unsafe { IsWindow(hwnd) } == 0 {
                    log::warn!(
                        "[paste] captured HWND 0x{:x} is no longer valid — clipboard only",
                        hwnd as usize
                    );
                    return Ok("CLIPBOARD_ONLY".into());
                }
                unsafe {
                    SetForegroundWindow(hwnd);
                }
                log::info!("[paste] SetForegroundWindow(0x{:x})", hwnd as usize);
            }
        }
        #[cfg(target_os = "linux")]
        {
            use std::sync::atomic::Ordering;
            let xid = crate::state::FOCUSED_WIN_XID.load(Ordering::SeqCst);
            if xid != 0 {
                let _ = std::process::Command::new("xdotool")
                    .args(["windowfocus", "--sync", &xid.to_string()])
                    .status();
                log::info!("[paste] xdotool windowfocus {}", xid);
            }
        }

        use enigo::{Direction, Enigo, Key, Keyboard, Settings};
        std::thread::sleep(std::time::Duration::from_millis(150));
        let mut enigo =
            Enigo::new(&Settings::default()).map_err(|e| format!("enigo init failed: {e}"))?;
        enigo
            .key(Key::Control, Direction::Press)
            .map_err(|e| format!("ctrl down failed: {e}"))?;
        // Always attempt to release Ctrl, even if the V click errors —
        // returning early on a failed click would leave Ctrl logically held
        // down system-wide, breaking every subsequent keystroke.
        let click = enigo.key(Key::Unicode('v'), Direction::Click);
        let release = enigo.key(Key::Control, Direction::Release);
        click.map_err(|e| format!("v click failed: {e}"))?;
        release.map_err(|e| format!("ctrl up failed: {e}"))?;
        Ok("pasted".to_string())
    }
}

#[tauri::command]
pub fn get_pending_deep_link() -> Option<String> {
    let mut pending = PENDING_DEEP_LINK.lock().ok()?;
    pending.take()
}
