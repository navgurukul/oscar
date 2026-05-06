//! macOS status-bar (NSStatusItem) tray icon with a control menu.
//!
//! Mirrors the spirit of the existing Linux tray fallback (see `state::LINUX_TRAY`)
//! but surfaces a first-class macOS menu with Open / Start Recording /
//! Stop Recording / Quit. Reactive tooltip is driven from the pill window
//! lifecycle helpers in `pill.rs` via `set_tray_tooltip_*`.
//!
//! Additive — does NOT replace the pill window or any Linux-specific code.

#![cfg(target_os = "macos")]

use std::sync::atomic::Ordering;
use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager};

use crate::frontmost::get_frontmost_context_payload;
use crate::state::{HotkeyState, MAC_TRAY};

const ID_OPEN: &str = "tray:open";
const ID_START: &str = "tray:start_recording";
const ID_STOP: &str = "tray:stop_recording";
const ID_QUIT: &str = "tray:quit";

const TOOLTIP_IDLE: &str = "Oscar";
const TOOLTIP_RECORDING: &str = "● Recording — Oscar";
const TOOLTIP_PROCESSING: &str = "⟳ Processing — Oscar";

/// Build and install the macOS tray icon. Idempotent — second call is a no-op
/// if the tray is already initialized. Called from `lib.rs` setup hook on the
/// main thread (NSStatusItem creation must be on the main thread).
pub(crate) fn install(app: &tauri::AppHandle) {
    if MAC_TRAY.get().is_some() {
        log::warn!("[mac-tray] install called twice — ignoring");
        return;
    }

    let menu = match build_menu(app) {
        Ok(m) => m,
        Err(e) => {
            log::warn!("[mac-tray] could not build menu: {}", e);
            return;
        }
    };

    let mut builder = TrayIconBuilder::new()
        .tooltip(TOOLTIP_IDLE)
        .menu(&menu)
        .on_menu_event(handle_menu_event);

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    match builder.build(app) {
        Ok(tray) => {
            if MAC_TRAY.set(tray).is_err() {
                log::warn!("[mac-tray] MAC_TRAY was already initialised");
            } else {
                log::info!("[mac-tray] macOS tray icon created OK");
            }
        }
        Err(e) => log::warn!("[mac-tray] could not create tray icon: {}", e),
    }
}

fn build_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let open = MenuItem::with_id(app, ID_OPEN, "Open Oscar", true, None::<&str>)?;
    let start = MenuItem::with_id(app, ID_START, "Start Recording", true, None::<&str>)?;
    let stop = MenuItem::with_id(app, ID_STOP, "Stop Recording", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, ID_QUIT, "Quit Oscar", true, None::<&str>)?;

    Menu::with_items(app, &[&open, &start, &stop, &sep, &quit])
}

fn handle_menu_event(app: &tauri::AppHandle, event: MenuEvent) {
    match event.id.as_ref() {
        ID_OPEN => open_main_window(app),
        ID_START => start_recording(app),
        ID_STOP => stop_recording(app),
        ID_QUIT => {
            log::info!("[mac-tray] Quit clicked");
            app.exit(0);
        }
        other => log::debug!("[mac-tray] unhandled menu id: {}", other),
    }
}

fn open_main_window(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
        log::info!("[mac-tray] Open Oscar — main window focused");
    } else {
        log::warn!("[mac-tray] Open Oscar — main window not found");
    }
}

/// Mirror the hotkey-press path: flip the recording AtomicBool and emit
/// `hotkey-recording-start` with frontmost-app context. Frontend listeners are
/// the same ones that handle the global shortcut.
fn start_recording(app: &tauri::AppHandle) {
    let hotkey_state = app.state::<HotkeyState>();
    if hotkey_state.is_recording.swap(true, Ordering::SeqCst) {
        log::info!("[mac-tray] Start clicked but already recording — ignoring");
        return;
    }

    let payload = get_frontmost_context_payload();
    log::info!(
        "[mac-tray] Start Recording — frontmost='{}' site_host={:?}",
        payload.app_name,
        payload.site_host.as_deref()
    );
    let _ = app.emit("hotkey-recording-start", payload);
}

fn stop_recording(app: &tauri::AppHandle) {
    let hotkey_state = app.state::<HotkeyState>();
    if !hotkey_state.is_recording.swap(false, Ordering::SeqCst) {
        log::info!("[mac-tray] Stop clicked but not recording — ignoring");
        return;
    }
    log::info!("[mac-tray] Stop Recording — emitting hotkey-recording-stop");
    let _ = app.emit("hotkey-recording-stop", ());
}

// ── Tooltip helpers — called from pill.rs to keep tray state in sync ─────────

pub(crate) fn set_tooltip_idle() {
    if let Some(tray) = MAC_TRAY.get() {
        let _ = tray.set_tooltip(Some(TOOLTIP_IDLE));
    }
}

pub(crate) fn set_tooltip_recording() {
    if let Some(tray) = MAC_TRAY.get() {
        let _ = tray.set_tooltip(Some(TOOLTIP_RECORDING));
    }
}

pub(crate) fn set_tooltip_processing() {
    if let Some(tray) = MAC_TRAY.get() {
        let _ = tray.set_tooltip(Some(TOOLTIP_PROCESSING));
    }
}
