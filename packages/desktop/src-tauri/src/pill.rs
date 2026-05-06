//! Recording pill overlay window (macOS/Windows) and Linux tray fallback.
//! Pill is pre-created at startup so the first hotkey press doesn't steal
//! focus by spawning a new window. On Linux, secondary webview windows
//! crash tao's event loop, so we surface state via a tray-icon tooltip.

use tauri::{Emitter, Manager};

/// Create the pill window (hidden) at app startup so it's ready instantly.
/// Called from `.setup()` which runs on the main thread — this is critical
/// because NSWindow methods (setLevel, setCollectionBehavior) are main-thread-only.
pub(crate) fn create_pill_window(app: &tauri::AppHandle) {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    if app.get_webview_window("recording-pill").is_some() {
        return; // already exists
    }

    let pill_w = 48.0_f64;
    let pill_h = 32.0_f64;
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
            (lx + lw / 2.0 - pill_w / 2.0, ly + lh - pill_h - 80.0)
        })
        .unwrap_or((800.0, 900.0));

    match WebviewWindowBuilder::new(
        app,
        "recording-pill",
        WebviewUrl::App("pill.html".into()),
    )
    .title("")
    .inner_size(pill_w, pill_h)
    .position(pos_x, pos_y)
    .decorations(false)
    .transparent(true)
    .resizable(false)
    .skip_taskbar(true)
    .focused(false)
    .visible(false) // start hidden — will be shown on first hotkey
    // NOTE: do NOT use .always_on_top(true) — it sets NSFloatingWindowLevel (3)
    // which is too low and can override our manual level. We set level 1000 below.
    .build()
    {
        Ok(w) => {
            let _ = w.set_ignore_cursor_events(true);
            let _ = w.set_visible_on_all_workspaces(true);

            // Set NSWindow level + collection behavior + NonactivatingPanel style.
            // This runs on the main thread (called from .setup()) which is required
            // for NSWindow property changes to take effect.
            #[cfg(target_os = "macos")]
            {
                if let Ok(ns_win) = w.ns_window() {
                    crate::macos_paste::set_window_above_fullscreen(
                        ns_win as *mut std::ffi::c_void,
                    );
                }
            }

            // On Windows/Linux, use always_on_top to float above other windows
            #[cfg(not(target_os = "macos"))]
            {
                let _ = w.set_always_on_top(true);
            }

            log::info!("[pill] pre-created pill window (hidden)");
        }
        Err(e) => {
            log::warn!("[pill] failed to pre-create pill window: {}", e);
        }
    }
}

#[tauri::command]
pub fn show_recording_pill(app: tauri::AppHandle) -> Result<(), String> {
    // On Linux, creating a secondary webview window causes tao's event loop
    // to panic (unwrap on None window handle at event_loop.rs:448).
    // Skip the pill entirely — recording state is shown in the main window.
    #[cfg(target_os = "linux")]
    {
        if let Some(tray) = crate::state::LINUX_TRAY.get() {
            tray.set_tooltip(Some("● Recording — Oscar")).ok();
        }
        log::debug!("[pill] show_recording_pill → tray tooltip updated (Linux)");
        let _ = app;
        return Ok(());
    }

    #[cfg(not(target_os = "linux"))]
    {
        log::info!("[pill] show_recording_pill called");
        // Ensure the pill exists (no-op if already created at startup)
        create_pill_window(&app);

        if let Some(w) = app.get_webview_window("recording-pill") {
            let _ = app.emit_to("recording-pill", "pill-set-listening", ());
            w.show().map_err(|e| e.to_string())?;
            log::info!("[pill] pill window shown");

            // Re-apply window level AFTER show() — macOS can reset level on show.
            #[cfg(target_os = "macos")]
            {
                if let Ok(ns_win) = w.ns_window() {
                    let ptr = ns_win as usize;
                    let _ = app.run_on_main_thread(move || {
                        crate::macos_paste::set_window_above_fullscreen(
                            ptr as *mut std::ffi::c_void,
                        );
                    });
                }
            }
        }

        #[cfg(target_os = "macos")]
        crate::mac_tray::set_tooltip_recording();

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
        log::debug!("[pill] hide_recording_pill → tray tooltip reset (Linux)");
        let _ = app;
        return Ok(());
    }

    #[cfg(not(target_os = "linux"))]
    {
        log::info!("[pill] hide_recording_pill called");
        if let Some(w) = app.get_webview_window("recording-pill") {
            w.hide().map_err(|e| e.to_string())?;
        }

        #[cfg(target_os = "macos")]
        crate::mac_tray::set_tooltip_idle();

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
        log::debug!("[pill] set_pill_processing → tray tooltip updated (Linux)");
        let _ = app;
        return Ok(());
    }

    #[cfg(not(target_os = "linux"))]
    {
        log::info!("[pill] set_pill_processing called");
        let _ = app.emit_to("recording-pill", "pill-set-processing", ());

        #[cfg(target_os = "macos")]
        crate::mac_tray::set_tooltip_processing();

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
        log::debug!("[pill] set_pill_listening → tray tooltip updated (Linux)");
        let _ = app;
        return Ok(());
    }

    #[cfg(not(target_os = "linux"))]
    {
        log::info!("[pill] set_pill_listening called");
        let _ = app.emit_to("recording-pill", "pill-set-listening", ());

        #[cfg(target_os = "macos")]
        crate::mac_tray::set_tooltip_recording();

        Ok(())
    }
}
