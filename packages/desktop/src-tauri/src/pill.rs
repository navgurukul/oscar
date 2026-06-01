//! Recording pill overlay window (macOS/Windows) and Linux tray fallback.
//!
//! The pill is the edge-handle dictation overlay: a 72×5 handle docked flush
//! against the screen's bottom edge, expanding upward into the full Paper
//! pill on hover or hotkey. Window resizes dynamically based on the visible
//! state so clicks pass through to apps below outside the active surface.
//!
//! Linux: secondary webview windows crash tao's event loop, so state lands on
//! the tray-icon tooltip instead.

use std::sync::Mutex;
use tauri::{LogicalPosition, LogicalSize, Manager};

use crate::events::OscarEvent;

// Both width and height grow per state. At rest the NSPanel is sized to
// hug the visible handle (with a small hover buffer) so transparent pixels
// don't capture cursor events and block clicks on apps underneath. macOS
// NSPanel with `set_ignore_cursor_events(false)` still claims the cursor
// across its full frame regardless of pixel alpha — the only reliable way
// to let clicks pass through is to shrink the frame itself.
const PILL_W_REST: f64 = 140.0;         // handle (~96px) + small hover buffer
const PILL_W_EXPANDED: f64 = 280.0;     // full Paper pill + actions (≤280 per v2 design)
const PILL_H_REST: f64 = 16.0;          // 5–6 px handle + ~10 px hover buffer
const PILL_H_EXPANDED: f64 = 200.0;     // pill + toast space
const PILL_H_SETTINGS: f64 = 380.0;     // pill + settings popover
static CURRENT_PILL_PHASE: Mutex<&'static str> = Mutex::new("rest");

fn normalize_phase(phase: &str) -> &'static str {
    match phase {
        "rest" => "rest",
        "ready" => "ready",
        "expanded" => "expanded",
        "recording" => "recording",
        "processing" => "processing",
        "inserted" => "inserted",
        "copied" => "copied",
        "error" => "error",
        "auth" => "auth",
        "settings" => "settings",
        _ => "rest",
    }
}

fn phase_size(phase: &str) -> (f64, f64) {
    match phase {
        "rest" | "ready" => (PILL_W_REST, PILL_H_REST),
        "settings" => (PILL_W_EXPANDED, PILL_H_SETTINGS),
        _ => (PILL_W_EXPANDED, PILL_H_EXPANDED),
    }
}

pub(crate) fn current_pill_phase() -> &'static str {
    CURRENT_PILL_PHASE
        .lock()
        .map(|phase| *phase)
        .unwrap_or("rest")
}

/// Called from background threads (e.g. the macOS cursor-hover poller) to
/// drive the pill into a new phase without going through the JS layer.
/// Hops to the main thread because NSWindow/NSPanel resizes are not safe
/// off-thread.
pub(crate) fn apply_phase_from_rust(app: &tauri::AppHandle, phase: &str) {
    let normalized = normalize_phase(phase);
    let app_clone = app.clone();
    let _ = app.run_on_main_thread(move || {
        sync_pill_phase(&app_clone, normalized);
    });
}

fn store_pill_phase(phase: &'static str) {
    if matches!(phase, "ready" | "expanded" | "settings") {
        return;
    }

    if let Ok(mut current) = CURRENT_PILL_PHASE.lock() {
        *current = phase;
    }
}

fn apply_phase_script<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>, phase: &str) {
    let Ok(serialized_phase) = serde_json::to_string(phase) else {
        return;
    };
    let script = format!(
        "window.__oscarSetPillPhase && window.__oscarSetPillPhase({});",
        serialized_phase
    );
    let _ = window.eval(&script);
}

fn sync_pill_phase(app: &tauri::AppHandle, phase: &'static str) {
    create_pill_window(app);

    if let Some(w) = app.get_webview_window("recording-pill") {
        let (pw, ph) = phase_size(phase);
        resize_pill(&w, pw, ph);
        let _ = w.show();
        if phase != "settings" {
            apply_phase_script(&w, phase);
        }
    }

    if phase != "settings" {
        store_pill_phase(phase);
        OscarEvent::PillSetPhase(phase.into()).dispatch(app);
    }
}

fn sync_tray_phase(phase: &str) {
    #[cfg(target_os = "macos")]
    match phase {
        "recording" => crate::mac_tray::set_tooltip_recording(),
        "processing" => crate::mac_tray::set_tooltip_processing(),
        _ => crate::mac_tray::set_tooltip_idle(),
    }
}

/// Reposition the pill so its bottom edge sits flush with the primary
/// monitor's bottom edge. Called after every resize.
fn reposition_flush_bottom<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
    width: f64,
    height: f64,
) {
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let size = monitor.size();
        let pos = monitor.position();
        let scale = monitor.scale_factor();
        let lw = size.width as f64 / scale;
        let lh = size.height as f64 / scale;
        let lx = pos.x as f64 / scale;
        let ly = pos.y as f64 / scale;
        let x = lx + lw / 2.0 - width / 2.0;
        let y = ly + lh - height;
        let _ = window.set_position(LogicalPosition::new(x, y));
    }
}

/// Create the pill window at app startup. Always-visible at rest, sized to a
/// thin bottom-flush strip so clicks above the handle pass through.
pub(crate) fn create_pill_window(app: &tauri::AppHandle) {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    if app.get_webview_window("recording-pill").is_some() {
        return;
    }

    let (pos_x, pos_y): (f64, f64) = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| {
            let size = m.size();
            let pos = m.position();
            let scale = m.scale_factor();
            let lw = size.width as f64 / scale;
            let lh = size.height as f64 / scale;
            let lx = pos.x as f64 / scale;
            let ly = pos.y as f64 / scale;
            (lx + lw / 2.0 - PILL_W_REST / 2.0, ly + lh - PILL_H_REST)
        })
        .unwrap_or((800.0, 900.0));

    match WebviewWindowBuilder::new(
        app,
        "recording-pill",
        WebviewUrl::App("pill.html".into()),
    )
    .title("")
    .inner_size(PILL_W_REST, PILL_H_REST)
    .position(pos_x, pos_y)
    .decorations(false)
    .transparent(true)
    .shadow(false) // disable NSWindow shadow — we draw our own on the pill
    .resizable(false)
    .skip_taskbar(true)
    .focused(false)
    .visible(false) // shown explicitly after NSPanel level is applied
    .build()
    {
        Ok(w) => {
            // Cursor events flow into the pill — hover & click drive the flow.
            let _ = w.set_ignore_cursor_events(false);
            let _ = w.set_visible_on_all_workspaces(true);

            #[cfg(target_os = "macos")]
            {
                if let Ok(ns_win) = w.ns_window() {
                    crate::macos_paste::set_window_above_fullscreen(
                        ns_win as *mut std::ffi::c_void,
                    );
                }
            }

            #[cfg(not(target_os = "macos"))]
            {
                let _ = w.set_always_on_top(true);
            }

            // Now show the always-present edge handle.
            let _ = w.show();

            // Re-apply on macOS — show() can re-trigger window realization which
            // sometimes resets the NSPanel level back to default.
            #[cfg(target_os = "macos")]
            reapply_macos_level(&w);

            log::info!("[pill] pre-created always-visible edge handle pill");
        }
        Err(e) => {
            log::warn!("[pill] failed to pre-create pill window: {}", e);
        }
    }
}

/// Re-apply the macOS NSPanel level + collection behavior. Resizes and
/// repositioning can cause the level to revert on some macOS versions, so we
/// call this after every state change to keep the pill above the Dock and
/// fullscreen Spaces.
#[cfg(target_os = "macos")]
fn reapply_macos_level<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    if let Ok(ns_win) = window.ns_window() {
        let ptr = ns_win as usize;
        let app = window.app_handle().clone();
        let _ = app.run_on_main_thread(move || {
            crate::macos_paste::set_window_above_fullscreen(
                ptr as *mut std::ffi::c_void,
            );
        });
    }
}

/// Resize the pill to one of three phase sizes and keep its bottom edge flush.
fn resize_pill<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>, width: f64, height: f64) {
    let _ = window.set_size(LogicalSize::new(width, height));
    reposition_flush_bottom(window, width, height);
    #[cfg(target_os = "macos")]
    reapply_macos_level(window);
}

#[tauri::command]
pub fn show_recording_pill(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        if let Some(tray) = crate::state::LINUX_TRAY.get() {
            tray.set_tooltip(Some("● Recording — Oscar")).ok();
        }
        let _ = app;
        return Ok(());
    }

    #[cfg(not(target_os = "linux"))]
    {
        log::info!("[pill] show_recording_pill called");
        sync_pill_phase(&app, "recording");
        sync_tray_phase("recording");
        Ok(())
    }
}

#[tauri::command]
pub fn hide_recording_pill(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        if let Some(tray) = crate::state::LINUX_TRAY.get() {
            tray.set_tooltip(Some("Oscar")).ok();
        }
        let _ = app;
        return Ok(());
    }

    #[cfg(not(target_os = "linux"))]
    {
        // We never actually hide the pill — it's the always-visible edge handle.
        // Collapse back to the rest height so clicks above the handle pass through.
        log::info!("[pill] hide_recording_pill → collapse to rest");
        sync_pill_phase(&app, "rest");
        sync_tray_phase("rest");
        Ok(())
    }
}

#[tauri::command]
pub fn set_pill_processing(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        if let Some(tray) = crate::state::LINUX_TRAY.get() {
            tray.set_tooltip(Some("⟳ Processing — Oscar")).ok();
        }
        let _ = app;
        return Ok(());
    }

    #[cfg(not(target_os = "linux"))]
    {
        log::info!("[pill] set_pill_processing called");
        sync_pill_phase(&app, "processing");
        sync_tray_phase("processing");
        Ok(())
    }
}

#[tauri::command]
pub fn set_pill_listening(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        if let Some(tray) = crate::state::LINUX_TRAY.get() {
            tray.set_tooltip(Some("● Recording — Oscar")).ok();
        }
        let _ = app;
        return Ok(());
    }

    #[cfg(not(target_os = "linux"))]
    {
        log::info!("[pill] set_pill_listening called");
        sync_pill_phase(&app, "recording");
        sync_tray_phase("recording");
        Ok(())
    }
}

/// Set the pill phase explicitly. Callers pass one of:
/// "rest" | "ready" | "expanded" | "recording" | "processing" | "inserted" | "error"
/// The window height is adjusted to fit the phase.
#[tauri::command]
pub fn set_pill_phase(app: tauri::AppHandle, phase: String) -> Result<(), String> {
    let phase = normalize_phase(&phase);

    #[cfg(target_os = "linux")]
    {
        if let Some(tray) = crate::state::LINUX_TRAY.get() {
            let label = match phase {
                "recording" => "● Recording — Oscar",
                "processing" => "⟳ Processing — Oscar",
                "inserted" => "✓ Inserted — Oscar",
                "error" => "⚠ Oscar",
                "auth" => "Sign in to enable AI — Oscar",
                _ => "Oscar",
            };
            tray.set_tooltip(Some(label)).ok();
        }
        store_pill_phase(phase);
        let _ = app;
        return Ok(());
    }

    #[cfg(not(target_os = "linux"))]
    {
        log::debug!("[pill] set_pill_phase → {}", phase);
        sync_pill_phase(&app, phase);
        sync_tray_phase(phase);
        Ok(())
    }
}

#[tauri::command]
pub fn get_pill_phase() -> String {
    current_pill_phase().to_string()
}

/// User clicked the pill to start recording. Mirrors the hotkey-press path so
/// the existing `hotkey-recording-start` handler in the frontend fires with
/// the correct frontmost-app context captured BEFORE Oscar's pill takes focus.
#[tauri::command]
pub fn pill_request_record_start(app: tauri::AppHandle) -> Result<(), String> {
    log::info!("[pill] pill_request_record_start");

    #[cfg(target_os = "windows")]
    {
        use std::sync::atomic::Ordering;
        use windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow;
        let hwnd = unsafe { GetForegroundWindow() };
        crate::state::FOCUSED_WIN_HWND.store(hwnd as usize, Ordering::SeqCst);
    }

    let payload = crate::frontmost::get_frontmost_context_payload();
    OscarEvent::HotkeyRecordingStart(payload).dispatch(&app);
    Ok(())
}

/// User clicked the pill again to stop. Emits the same stop event the hotkey
/// uses so the existing handler processes the recording.
#[tauri::command]
pub fn pill_request_record_stop(app: tauri::AppHandle) -> Result<(), String> {
    log::info!("[pill] pill_request_record_stop");
    OscarEvent::HotkeyRecordingStop.dispatch(&app);
    Ok(())
}

/// Push current dictation settings (language, auto-paste, ai-transform) into
/// the pill so the settings popover renders the user's actual state.
#[tauri::command]
pub fn pill_push_settings(
    app: tauri::AppHandle,
    language: String,
    auto_paste: bool,
    ai_improvement: bool,
    cleanup_style: String,
    prompt_mode: bool,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let _ = (
            app,
            language,
            auto_paste,
            ai_improvement,
            cleanup_style,
            prompt_mode,
        );
        return Ok(());
    }

    #[cfg(not(target_os = "linux"))]
    {
        let payload = serde_json::json!({
            "language": language,
            "autoPaste": auto_paste,
            "aiImprovement": ai_improvement,
            "cleanupStyle": cleanup_style,
            "promptMode": prompt_mode,
        });
        OscarEvent::PillSettingsInit(payload).dispatch(&app);
        Ok(())
    }
}
