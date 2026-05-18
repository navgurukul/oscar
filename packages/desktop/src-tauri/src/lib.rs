//! Oscar desktop entry point.
//!
//! All concrete behavior lives in the focused submodules below; this file is
//! limited to module declarations, Tauri builder wiring, and the `run()` entry
//! point invoked by `main.rs`.

use std::collections::HashMap;
use std::sync::{atomic::AtomicBool, Arc, Mutex};
use tauri::Manager;
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_store::StoreExt;

mod audio_decode;
mod calendar;
mod events;
mod filesystem;
mod frontmost;
mod hardware;
mod hotkey;
mod models;
#[cfg(target_os = "macos")]
mod mac_tray;
#[cfg(target_os = "macos")]
mod macos_paste;
mod meeting;
mod paste;
mod permissions;
mod pill;
mod state;
mod system_audio;
mod vad;
mod whisper;

use crate::events::OscarEvent;
use crate::hotkey::register_recording_hotkey;
use crate::pill::create_pill_window;
use crate::state::{set_pending_deep_link, AppState, HotkeyState, PENDING_DEEP_LINK};

#[cfg(target_os = "linux")]
use crate::state::LINUX_TRAY;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    log::info!("========================================");
    log::info!("OSCAR v{} starting", env!("CARGO_PKG_VERSION"));
    log::info!("OS: {} {}", std::env::consts::OS, std::env::consts::ARCH);
    log::info!("DISPLAY={}", std::env::var("DISPLAY").unwrap_or_else(|_| "(not set)".into()));
    log::info!("XDG_SESSION_TYPE={}", std::env::var("XDG_SESSION_TYPE").unwrap_or_else(|_| "(not set)".into()));
    log::info!("WAYLAND_DISPLAY={}", std::env::var("WAYLAND_DISPLAY").unwrap_or_else(|_| "(not set)".into()));
    log::info!("========================================");

    let is_recording = Arc::new(AtomicBool::new(false));

    log::info!("[init] Initializing Tauri plugins...");
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Arc::new(Mutex::new(AppState {
            whisper_context: None,
            loaded_model_path: None,
            meeting_system_audio_segments: HashMap::new(),
        })))
        .manage(HotkeyState {
            is_recording: is_recording.clone(),
            last_error: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            whisper::download_whisper_model,
            whisper::load_whisper_model,
            whisper::ensure_whisper_model_loaded,
            whisper::warm_whisper_runtime,
            whisper::transcribe_audio,
            meeting::transcribe_meeting_audio,
            meeting::clear_meeting_segment_buffers,
            meeting::rotate_meeting_system_audio_segment,
            meeting::transcribe_meeting_segment_bytes,
            meeting::transcribe_meeting_audio_b64,
            meeting::is_system_audio_supported,
            meeting::start_system_audio_capture,
            meeting::stop_system_audio_capture,
            paste::paste_transcription,
            paste::get_frontmost_app,
            paste::get_pending_deep_link,
            pill::show_recording_pill,
            pill::hide_recording_pill,
            pill::set_pill_processing,
            pill::set_pill_listening,
            pill::set_pill_phase,
            pill::get_pill_phase,
            pill::pill_push_settings,
            pill::pill_request_record_start,
            pill::pill_request_record_stop,
            permissions::check_accessibility_permission,
            permissions::request_accessibility_permission,
            permissions::check_dictation_ctrl_conflict,
            permissions::check_system_audio_permission,
            permissions::request_system_audio_permission,
            hotkey::ensure_recording_hotkey_registered,
            hotkey::is_recording_hotkey_registered,
            filesystem::check_file_exists,
            filesystem::delete_file,
            calendar::get_calendar_events,
            hardware::detect_hardware,
            hardware::recommend_whisper_model,
            hardware::list_whisper_models,
        ])
        .setup(move |app| {
            log::info!("[setup] Tauri setup started");

            // Set overlay titlebar on macOS only (not supported on Linux/GTK)
            #[cfg(target_os = "macos")]
            {
                if let Some(main_window) = app.get_webview_window("main") {
                    use tauri::TitleBarStyle;
                    let _ = main_window.set_title_bar_style(TitleBarStyle::Overlay);
                    log::info!("[setup] macOS overlay titlebar set");
                }
            }

            let app_handle = app.handle().clone();

            // Set up deep link handler (may not be available on all Linux desktops)
            log::info!("[setup] Registering deep link handler...");
            if let Err(e) = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        let url_str = url.to_string();
                        log::info!("[deep-link] received: {}", url_str);

                        // Store the deep link
                        set_pending_deep_link(url_str.clone());

                        // Bring the main window to the foreground so the user
                        // sees Oscar after returning from the browser callback.
                        if let Some(main_window) = app_handle.get_webview_window("main") {
                            let _ = main_window.unminimize();
                            let _ = main_window.show();
                            let _ = main_window.set_focus();
                        }

                        // Emit to frontend
                        OscarEvent::DeepLink(url_str).dispatch(&app_handle);
                    }
                });
            })) {
                log::warn!("[setup] Deep link handler not available on this platform: {:?}", e);
            } else {
                log::info!("[setup] Deep link handler registered OK");
            }

            // Right Ctrl as hold-to-record hotkey (avoids conflicts on both macOS & Windows)
            log::info!("[setup] Registering global shortcut (Ctrl+Space)...");
            let hotkey_state = app.state::<HotkeyState>();
            if let Err(e) = register_recording_hotkey(&app.handle().clone(), &hotkey_state) {
                log::warn!("Could not register global shortcut: {e}");
            }

            // Initialize the persistent store (creates file on first run)
            log::info!("[setup] Initializing persistent store...");
            let _store = app.store("app-settings.json")
                .map_err(|e| log::warn!("[setup] Could not open store: {e}"))
                .ok();
            log::info!("[setup] Store initialized OK");

            // Pre-create the recording pill window (hidden) so that the first
            // hotkey press doesn't steal focus by creating a new window.
            // On Linux/GTK, creating a secondary webview window causes tao's
            // event loop to panic (unwrap on None window handle). Skip entirely.
            #[cfg(not(target_os = "linux"))]
            {
                log::info!("[setup] Pre-creating pill window...");
                create_pill_window(app.handle());
            }

            // Install the macOS status-bar tray (additive — pill window remains
            // the primary recording indicator; tray adds menu access + tooltip).
            #[cfg(target_os = "macos")]
            {
                log::info!("[setup] Installing macOS tray icon...");
                mac_tray::install(app.handle());
            }
            #[cfg(target_os = "linux")]
            {
                log::info!("[setup] Skipping pill window on Linux (tao secondary window bug) — using tray instead");
                let mut tray_builder = tauri::tray::TrayIconBuilder::new()
                    .tooltip("Oscar");
                if let Some(icon) = app.default_window_icon() {
                    tray_builder = tray_builder.icon(icon.clone());
                }
                match tray_builder.build(app.handle()) {
                    Ok(tray) => {
                        if LINUX_TRAY.set(tray).is_err() {
                            log::warn!("[setup] LINUX_TRAY was already initialised");
                        } else {
                            log::info!("[setup] Linux tray icon created OK");
                        }
                    }
                    Err(e) => log::warn!("[setup] Could not create tray icon on Linux: {}", e),
                }
            }

            log::info!("[setup] ✓ Setup complete — app ready");
            Ok(())
        })
        .on_window_event(|window, event| {
            // Handle deep link when app is already running
            if let tauri::WindowEvent::Focused(true) = event {
                if let Ok(mut pending) = PENDING_DEEP_LINK.lock() {
                    if let Some(url) = pending.take() {
                        OscarEvent::DeepLink(url).dispatch(window.app_handle());
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            log::error!("========================================");
            log::error!("FATAL: Tauri application crashed: {}", e);
            log::error!("========================================");
            panic!("error while running tauri application: {}", e);
        });
}
