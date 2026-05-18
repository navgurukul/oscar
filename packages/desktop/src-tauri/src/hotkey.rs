//! Global recording hotkey (Ctrl+Space): registration, error reporting,
//! and the press/release handler that captures frontmost-app context and
//! emits `hotkey-recording-{start,stop}` events.

use std::sync::atomic::Ordering;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::events::OscarEvent;
use crate::frontmost::get_frontmost_context_payload;
use crate::state::HotkeyState;

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
                if !is_rec.swap(true, Ordering::SeqCst) {
                    log::info!("[hotkey] Ctrl+Space PRESSED — capturing frontmost context");
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

                    let frontmost_context = get_frontmost_context_payload();
                    log::info!(
                        "[hotkey] frontmost app='{}' site_host={:?} window_title={:?}",
                        frontmost_context.app_name,
                        frontmost_context.site_host.as_deref(),
                        frontmost_context.window_title.as_deref()
                    );
                    OscarEvent::HotkeyRecordingStart(frontmost_context).dispatch(&app_handle);
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
