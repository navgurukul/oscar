//! Global recording hotkey (Ctrl+Space): registration, error reporting,
//! and the press/release handler that captures frontmost-app context and
//! emits `hotkey-recording-{start,stop}` events.

use std::sync::atomic::{AtomicU64, Ordering};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::events::OscarEvent;
use crate::state::HotkeyState;

/// Monotonic dictation-session counter. Each press (hotkey or pill) takes the
/// next id; the async context-enrichment event carries it so the frontend can
/// drop a late result whose dictation has already been superseded.
static DICTATION_SESSION: AtomicU64 = AtomicU64::new(1);

/// Capture only the fast, subprocess-free app identity, dispatch the
/// recording-start event immediately (so the pill arms without waiting), then —
/// on macOS — run the slow AppleScript window/site capture on a background
/// thread and deliver it via a session-tagged `hotkey-context-enrich` event.
/// Shared by the global hotkey and the pill-click record path.
pub(crate) fn dispatch_recording_start<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let session_id = DICTATION_SESSION.fetch_add(1, Ordering::SeqCst);
    let payload = crate::frontmost::get_frontmost_identity_payload(session_id);
    let app_id = payload.app_id.clone();
    log::info!(
        "[hotkey] start session={} app='{}'",
        session_id,
        payload.app_name
    );
    OscarEvent::HotkeyRecordingStart(payload).dispatch(app);

    // Defer the AppleScript-derived context off the press path. It is only
    // needed later (cleanup-time routing + pill label), so it can land a few ms
    // after recording has already started.
    #[cfg(target_os = "macos")]
    {
        let enrich_app = app.clone();
        std::thread::spawn(move || {
            let (window_title, site_host, site_title) =
                crate::frontmost::get_frontmost_enrichment(app_id.as_deref());
            if window_title.is_some() || site_host.is_some() || site_title.is_some() {
                OscarEvent::HotkeyContextEnrich(crate::events::HotkeyContextEnrichment {
                    session_id,
                    window_title,
                    site_host,
                    site_title,
                })
                .dispatch(&enrich_app);
            }
        });
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app_id;
    }
}

pub(crate) fn recording_shortcut() -> Shortcut {
    Shortcut::new(
        Some(Modifiers::CONTROL),
        tauri_plugin_global_shortcut::Code::Space,
    )
}

pub(crate) fn set_hotkey_error<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    hotkey_state: &HotkeyState,
    message: Option<String>,
) {
    if let Ok(mut last_error) = hotkey_state.last_error.lock() {
        *last_error = message.clone();
    }

    if let Some(msg) = message {
        OscarEvent::HotkeyPermissionError(msg).dispatch(app);
    } else {
        OscarEvent::HotkeyRegistered.dispatch(app);
    }
}

pub(crate) fn register_recording_hotkey<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    hotkey_state: &HotkeyState,
) -> Result<bool, String> {
    let shortcut = recording_shortcut();

    if app.global_shortcut().is_registered(shortcut) {
        set_hotkey_error(app, hotkey_state, None);
        return Ok(true);
    }

    let app_handle = app.clone();
    let is_rec = hotkey_state.is_recording.clone();

    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _sc, event| match event.state {
            ShortcutState::Pressed => {
                // Stream disabled (logged out / pre-setup): hotkey no-ops. The
                // shortcut stays registered to avoid re-registration churn.
                if !crate::pill::pill_enabled() {
                    return;
                }
                if !is_rec.swap(true, Ordering::SeqCst) {
                    log::info!("[hotkey] Ctrl+Space PRESSED");
                    // Fast OS focus capture for paste targeting — these are
                    // cheap (Win32 call / one xdotool spawn) and must stay
                    // synchronous so the correct window is recorded at press.
                    #[cfg(target_os = "windows")]
                    {
                        use windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow;
                        let hwnd = unsafe { GetForegroundWindow() };
                        crate::state::FOCUSED_WIN_HWND.store(hwnd as usize, Ordering::SeqCst);
                        log::info!("[hotkey] captured HWND=0x{:x}", hwnd as usize);
                    }

                    #[cfg(target_os = "linux")]
                    {
                        match std::process::Command::new("xdotool")
                            .arg("getactivewindow")
                            .output()
                        {
                            Ok(o) => {
                                let xid_str = String::from_utf8_lossy(&o.stdout).trim().to_string();
                                if let Ok(xid) = xid_str.parse::<u64>() {
                                    crate::state::FOCUSED_WIN_XID.store(xid, Ordering::SeqCst);
                                    log::info!("[hotkey] captured xdotool XID={}", xid);
                                } else {
                                    log::warn!("[hotkey] xdotool returned non-numeric: {:?}", xid_str);
                                }
                            }
                            Err(e) => log::warn!("[hotkey] xdotool not available: {}", e),
                        }
                    }

                    // Identity-only dispatch + deferred AppleScript enrichment.
                    dispatch_recording_start(&app_handle);
                }
            }
            ShortcutState::Released => {
                if is_rec.swap(false, Ordering::SeqCst) {
                    log::info!("[hotkey] Ctrl+Space RELEASED — emitting stop");
                    OscarEvent::HotkeyRecordingStop.dispatch(&app_handle);
                }
            }
        })
        .map_err(|e| {
            let message = format!(
                "Could not register hotkey: {e}. Grant Accessibility and close conflicting shortcuts, then retry."
            );
            set_hotkey_error(app, hotkey_state, Some(message.clone()));
            message
        })?;

    log::info!("Global shortcut (Ctrl+Space) registered successfully");
    set_hotkey_error(app, hotkey_state, None);

    Ok(true)
}

#[tauri::command]
pub fn ensure_recording_hotkey_registered(
    app: tauri::AppHandle,
    hotkey_state: tauri::State<'_, HotkeyState>,
) -> Result<bool, String> {
    register_recording_hotkey(&app, &hotkey_state)
}

#[tauri::command]
pub fn is_recording_hotkey_registered(app: tauri::AppHandle) -> bool {
    app.global_shortcut().is_registered(recording_shortcut())
}
