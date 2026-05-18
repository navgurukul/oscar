//! Clipboard-based paste-after-transcription flow.
//! Sets text in clipboard, re-focuses the originally-active app or window
//! (captured at hotkey press), then synthesizes Cmd+V (macOS) / Ctrl+V
//! (Windows/Linux). On macOS, falls back to "CLIPBOARD_ONLY" if accessibility
//! permission is missing.

use arboard::Clipboard;

use crate::frontmost::get_frontmost_context_payload;
use crate::state::PENDING_DEEP_LINK;

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
pub fn paste_transcription(text: String, target_app: Option<String>) -> Result<String, String> {
    // 1. Set clipboard
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(&text).map_err(|e| e.to_string())?;
    log::info!("[paste] clipboard set ({} chars)", text.len());

    #[cfg(target_os = "macos")]
    {
        use crate::macos_paste;

        // Check Accessibility permission.
        // AXIsProcessTrusted() can return false after a new build because macOS
        // TCC stores a cryptographic hash of the binary — any rebuild invalidates
        // the hash even if the user's System Settings toggle is still ON.
        // When that happens, call AXIsProcessTrustedWithOptions(prompt=false) to
        // re-register the new binary hash silently, then re-check once.  If it
        // is still false, fall back to CLIPBOARD_ONLY and let the frontend guide
        // the user.
        let mut trusted = macos_paste::is_accessibility_trusted();
        if !trusted {
            // Re-register current binary with TCC (no dialog shown)
            trusted = macos_paste::reregister_without_prompt();
            log::info!("[paste] re-registered binary, AXIsProcessTrusted = {}", trusted);
        }
        log::info!("[paste] AXIsProcessTrusted = {}", trusted);

        if !trusted {
            return Ok("CLIPBOARD_ONLY".into());
        }

        // 2. Re-activate the target app using NSRunningApplication so that
        //    Cmd+V lands in the correct window even if the Tauri IPC call
        //    caused Oscar's process to become active on the main thread.
        //    We use NSRunningApplication (not `open -a`) because `open -a`
        //    triggers a Space-switch animation which breaks fullscreen apps.
        if let Some(ref app_name) = target_app {
            if !app_name.is_empty() {
                log::info!("[paste] re-activating '{}' via NSRunningApplication", app_name);
                match macos_paste::activate_app(app_name) {
                    Ok(true) => {
                        // Brief wait for the window manager to finish activating
                        std::thread::sleep(std::time::Duration::from_millis(120));
                    }
                    Ok(false) => log::warn!("[paste] app '{}' not found in running apps", app_name),
                    Err(e) => log::warn!("[paste] activate_app failed: {}", e),
                }
            }
        }

        // 3. Post Cmd+V via CGEvent (from main thread)
        macos_paste::post_cmd_v()?;
        log::info!("[paste] CGEvent Cmd+V posted");

        return Ok(format!("paste OK: trusted=true, target={:?}", target_app));
    }

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        // Re-focus the window that was active when the hotkey was pressed so
        // that Ctrl+V lands in the right place instead of an Oscar window.
        #[cfg(target_os = "windows")]
        {
            use std::sync::atomic::Ordering;
            use windows_sys::Win32::UI::WindowsAndMessaging::SetForegroundWindow;
            let hwnd = crate::state::FOCUSED_WIN_HWND.load(Ordering::SeqCst) as isize;
            if hwnd != 0 {
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
        let mut enigo = Enigo::new(&Settings::default())
            .map_err(|e| format!("enigo init failed: {e}"))?;
        enigo
            .key(Key::Control, Direction::Press)
            .map_err(|e| format!("ctrl down failed: {e}"))?;
        enigo
            .key(Key::Unicode('v'), Direction::Click)
            .map_err(|e| format!("v click failed: {e}"))?;
        enigo
            .key(Key::Control, Direction::Release)
            .map_err(|e| format!("ctrl up failed: {e}"))?;
        Ok("pasted".to_string())
    }
}

#[tauri::command]
pub fn get_pending_deep_link() -> Option<String> {
    let mut pending = PENDING_DEEP_LINK.lock().ok()?;
    pending.take()
}
