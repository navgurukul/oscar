use arboard::Clipboard;
use serde::{Deserialize, Serialize};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_store::StoreExt;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};
use tokio::io::AsyncWriteExt;

#[cfg(target_os = "macos")]
mod macos_paste {
    use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation};
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
    use std::ffi::c_void;

    extern "C" {
        fn objc_getClass(name: *const std::ffi::c_char) -> *mut c_void;
        fn sel_registerName(name: *const std::ffi::c_char) -> *mut c_void;
        fn objc_msgSend() -> *mut c_void;
    }

    // Accessibility check
    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn AXIsProcessTrusted() -> bool;
    }

    pub fn is_accessibility_trusted() -> bool {
        unsafe { AXIsProcessTrusted() }
    }

    /// Activate a macOS app by name using NSRunningApplication (in-process, no osascript).
    /// Returns true if the app was found and activated.
    pub fn activate_app(app_name: &str) -> Result<bool, String> {
        unsafe {
            let ws_class = objc_getClass(b"NSWorkspace\0".as_ptr() as *const _);
            let sel_shared = sel_registerName(b"sharedWorkspace\0".as_ptr() as *const _);
            let sel_running = sel_registerName(b"runningApplications\0".as_ptr() as *const _);
            let sel_count = sel_registerName(b"count\0".as_ptr() as *const _);
            let sel_object_at = sel_registerName(b"objectAtIndex:\0".as_ptr() as *const _);
            let sel_localized_name = sel_registerName(b"localizedName\0".as_ptr() as *const _);
            let sel_activate =
                sel_registerName(b"activateWithOptions:\0".as_ptr() as *const _);

            type NoArgFn =
                unsafe extern "C" fn(*mut c_void, *mut c_void) -> *mut c_void;
            type CountFn =
                unsafe extern "C" fn(*mut c_void, *mut c_void) -> usize;
            type IndexFn =
                unsafe extern "C" fn(*mut c_void, *mut c_void, usize) -> *mut c_void;
            type ActivateFn =
                unsafe extern "C" fn(*mut c_void, *mut c_void, usize) -> bool;
            type UTF8Fn =
                unsafe extern "C" fn(*mut c_void, *mut c_void) -> *const std::ffi::c_char;

            let shared: NoArgFn = std::mem::transmute(objc_msgSend as *const ());
            let ws = shared(ws_class, sel_shared);
            if ws.is_null() {
                return Err("NSWorkspace.sharedWorkspace is null".into());
            }

            let running_fn: NoArgFn = std::mem::transmute(objc_msgSend as *const ());
            let apps = running_fn(ws, sel_running);
            if apps.is_null() {
                return Err("runningApplications is null".into());
            }

            let count_fn: CountFn = std::mem::transmute(objc_msgSend as *const ());
            let count = count_fn(apps, sel_count);

            let obj_at: IndexFn = std::mem::transmute(objc_msgSend as *const ());
            let name_fn: NoArgFn = std::mem::transmute(objc_msgSend as *const ());
            let sel_utf8 = sel_registerName(b"UTF8String\0".as_ptr() as *const _);
            let utf8_fn: UTF8Fn = std::mem::transmute(objc_msgSend as *const ());
            let activate_fn: ActivateFn = std::mem::transmute(objc_msgSend as *const ());

            for i in 0..count {
                let app = obj_at(apps, sel_object_at, i);
                if app.is_null() {
                    continue;
                }
                let ns_name = name_fn(app, sel_localized_name);
                if ns_name.is_null() {
                    continue;
                }
                let cstr = utf8_fn(ns_name, sel_utf8);
                if cstr.is_null() {
                    continue;
                }
                let name = std::ffi::CStr::from_ptr(cstr).to_string_lossy();
                if name == app_name {
                    // NSApplicationActivateIgnoringOtherApps = 1 << 1 = 2
                    let activated = activate_fn(app, sel_activate, 2);
                    log::info!(
                        "[paste] NSRunningApplication.activate({}) = {}",
                        app_name,
                        activated
                    );
                    return Ok(activated);
                }
            }
            Err(format!("App '{}' not found in running apps", app_name))
        }
    }

    /// Simulate Cmd+V using CGEvents. Must be called from main thread for reliability.
    pub fn post_cmd_v() -> Result<(), String> {
        let source = CGEventSource::new(CGEventSourceStateID::CombinedSessionState)
            .map_err(|_| "Failed to create CGEventSource")?;

        // keycode 9 = 'v'
        let key_down = CGEvent::new_keyboard_event(source.clone(), 9, true)
            .map_err(|_| "Failed to create key-down event")?;
        let key_up = CGEvent::new_keyboard_event(source, 9, false)
            .map_err(|_| "Failed to create key-up event")?;

        key_down.set_flags(CGEventFlags::CGEventFlagCommand);
        key_up.set_flags(CGEventFlags::CGEventFlagCommand);

        key_down.post(CGEventTapLocation::HID);
        std::thread::sleep(std::time::Duration::from_millis(50));
        key_up.post(CGEventTapLocation::HID);

        Ok(())
    }
}

// ── Deep Link State ───────────────────────────────────────────────────────────

static PENDING_DEEP_LINK: Mutex<Option<String>> = Mutex::new(None);

/// Set a pending deep link URL (called from deep link plugin)
pub fn set_pending_deep_link(url: String) {
    if let Ok(mut pending) = PENDING_DEEP_LINK.lock() {
        *pending = Some(url);
    }
}

// ── App State ────────────────────────────────────────────────────────────────

struct AppState {
    whisper_context: Option<WhisperContext>,
}

#[derive(Serialize, Deserialize)]
struct TranscriptionResult {
    text: String,
    error: Option<String>,
}

// ── Whisper: Model Download ───────────────────────────────────────────────────

#[derive(Clone, Serialize)]
struct DownloadProgress {
    downloaded: u64,
    total: u64,
    percentage: u8,
}

#[tauri::command]
async fn download_whisper_model(
    url: String,
    path: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    // Create parent directories if they don't exist
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    // Download the file using async client with progress
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }
    
    let total_size = response.content_length().unwrap_or(0);
    
    // Create the file for async writing
    let mut file = tokio::fs::File::create(&path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    // Stream the response and write chunks with progress
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    
    use futures_util::StreamExt;
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Failed to read chunk: {}", e))?;
        
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write file: {}", e))?;
        
        downloaded += chunk.len() as u64;
        
        // Emit progress event
        let percentage = if total_size > 0 {
            ((downloaded as f64 / total_size as f64) * 100.0) as u8
        } else {
            0
        };
        
        let _ = app.emit("download-progress", DownloadProgress {
            downloaded,
            total: total_size,
            percentage,
        });
    }
    
    file.flush().await.map_err(|e| format!("Failed to flush file: {}", e))?;
    
    Ok(format!("Downloaded {} bytes to {}", downloaded, path))
}

// ── Whisper: Load Model ───────────────────────────────────────────────────────

#[tauri::command]
fn load_whisper_model(
    path: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let params = WhisperContextParameters::default();
    let context =
        WhisperContext::new_with_params(&path, params).map_err(|e| e.to_string())?;
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.whisper_context = Some(context);
    Ok("Whisper model loaded successfully".to_string())
}

// ── Whisper: Transcribe ───────────────────────────────────────────────────────

#[tauri::command]
fn transcribe_audio(
    audio_data: Vec<f32>,
    initial_prompt: Option<String>,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<TranscriptionResult, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;

    let context = app_state
        .whisper_context
        .as_ref()
        .ok_or("Whisper model not loaded")?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("en"));
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);

    // Inject personal dictionary words as Whisper initial prompt
    if let Some(prompt) = initial_prompt {
        if !prompt.is_empty() {
            params.set_initial_prompt(&prompt);
        }
    }

    let mut state = context.create_state().map_err(|e| e.to_string())?;
    state
        .full(params, &audio_data)
        .map_err(|e| e.to_string())?;

    let num_segments = state.full_n_segments();
    let mut full_text = String::new();

    for i in 0..num_segments {
        if let Some(segment) = state.get_segment(i) {
            if let Ok(text) = segment.to_str() {
                full_text.push_str(text.trim());
                full_text.push(' ');
            }
        }
    }

    Ok(TranscriptionResult {
        text: full_text.trim().to_string(),
        error: None,
    })
}

// ── AI Text Enhancement ──────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ProxyResponse {
    enhanced: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct DeepSeekResponse {
    choices: Option<Vec<DeepSeekChoice>>,
    error: Option<DeepSeekError>,
}

#[derive(Deserialize)]
struct DeepSeekChoice {
    message: DeepSeekMessage,
}

#[derive(Deserialize)]
struct DeepSeekMessage {
    content: String,
}

#[derive(Deserialize)]
struct DeepSeekError {
    message: String,
}

#[tauri::command]
async fn enhance_text(
    text: String,
    tone: String,
    edge_function_url: Option<String>,
    jwt: Option<String>,
    api_key: Option<String>,
) -> Result<String, String> {
    if text.trim().is_empty() {
        return Ok(text);
    }

    // If user provided their own API key, call DeepSeek directly
    if let Some(key) = api_key {
        return enhance_with_deepseek(text, tone, &key).await;
    }

    // Otherwise, use the Supabase Edge Function (requires auth)
    let url = edge_function_url.ok_or("No Edge Function URL configured")?;
    let token = jwt.ok_or("No auth token — please sign in or provide an API key")?;
    
    enhance_with_edge_function(text, tone, &url, &token).await
}

async fn enhance_with_deepseek(text: String, tone: String, api_key: &str) -> Result<String, String> {
    #[derive(Serialize)]
    struct DeepSeekRequest {
        model: String,
        messages: Vec<DeepSeekMessageReq>,
        temperature: f32,
        max_tokens: i32,
    }

    #[derive(Serialize)]
    struct DeepSeekMessageReq {
        role: String,
        content: String,
    }

    let tone_instruction = match tone.as_str() {
        "professional" => "Make this text more professional and polished",
        "casual" => "Make this text more casual and conversational",
        "friendly" => "Make this text warmer and friendlier",
        _ => "Clean up this text while preserving its original meaning",
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post("https://api.deepseek.com/chat/completions")
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&DeepSeekRequest {
            model: "deepseek-chat".to_string(),
            messages: vec![
                DeepSeekMessageReq {
                    role: "system".to_string(),
                    content: tone_instruction.to_string(),
                },
                DeepSeekMessageReq {
                    role: "user".to_string(),
                    content: text,
                },
            ],
            temperature: 0.3,
            max_tokens: 2000,
        })
        .send()
        .await
        .map_err(|e| format!("DeepSeek API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("DeepSeek API error {}: {}", status, body));
    }

    let parsed: DeepSeekResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse DeepSeek response: {}", e))?;

    if let Some(err) = parsed.error {
        return Err(format!("DeepSeek API error: {}", err.message));
    }

    parsed
        .choices
        .and_then(|choices| choices.into_iter().next())
        .map(|choice| choice.message.content)
        .ok_or_else(|| "Empty response from DeepSeek API".to_string())
}

async fn enhance_with_edge_function(
    text: String,
    tone: String,
    edge_function_url: &str,
    jwt: &str,
) -> Result<String, String> {
    #[derive(Serialize)]
    struct Body {
        text: String,
        tone: String,
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post(edge_function_url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", jwt))
        .json(&Body { text: text.clone(), tone })
        .send()
        .await
        .map_err(|e| format!("Request to Edge Function failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Edge Function error {}: {}", status, body));
    }

    let parsed: ProxyResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Edge Function response: {}", e))?;

    if let Some(err) = parsed.error {
        return Err(err);
    }

    parsed
        .enhanced
        .ok_or_else(|| "Empty response from Edge Function".to_string())
}

// ── Recording Pill Overlay ───────────────────────────────────────────────────

#[tauri::command]
fn show_recording_pill(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    // If the pill window already exists, just show it
    if let Some(w) = app.get_webview_window("recording-pill") {
        w.show().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Determine bottom-center position from the primary monitor
    let (pos_x, pos_y): (f64, f64) = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| {
            let size = m.size();
            let pos = m.position();
            let scale = m.scale_factor();
            // Physical -> logical pixels
            let lw = size.width as f64 / scale;
            let lh = size.height as f64 / scale;
            let lx = pos.x as f64 / scale;
            let ly = pos.y as f64 / scale;
            // Bottom-center: pill is 160x36, placed 80px above the dock/taskbar
            (lx + lw / 2.0 - 80.0, ly + lh - 116.0)
        })
        .unwrap_or((800.0, 900.0));

    let w = WebviewWindowBuilder::new(
        &app,
        "recording-pill",
        WebviewUrl::App("pill.html".into()),
    )
    .title("")
    .inner_size(160.0, 36.0)
    .position(pos_x, pos_y)
    .decorations(false)
    .always_on_top(true)
    .transparent(true)
    .resizable(false)
    .skip_taskbar(true)
    .focused(false)
    .build()
    .map_err(|e: tauri::Error| e.to_string())?;

    let _ = w.set_ignore_cursor_events(true);
    // Show pill on all macOS Spaces (including fullscreen app Spaces)
    let _ = w.set_visible_on_all_workspaces(true);
    Ok(())
}

#[tauri::command]
fn hide_recording_pill(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("recording-pill") {
        w.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── Focus Management ────────────────────────────────────────────────────────

/// Returns the name of the frontmost application (macOS only).
#[tauri::command]
fn get_frontmost_app() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("osascript")
            .args([
                "-e",
                r#"tell application "System Events" to get name of first application process whose frontmost is true"#,
            ])
            .output()
            .map_err(|e| format!("Failed to get frontmost app: {}", e))?;

        let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if name.is_empty() {
            Err("Could not determine frontmost app".to_string())
        } else {
            Ok(name)
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("get_frontmost_app is only supported on macOS".to_string())
    }
}

/// Activates (brings to front) the application with the given name.
#[tauri::command]
fn activate_app(app_name: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let script = format!(
            r#"tell application "{}" to activate"#,
            app_name.replace('\\', "\\\\").replace('"', "\\\"")
        );
        std::process::Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| format!("Failed to activate {}: {}", app_name, e))?;
        // Allow time for the app to come to the foreground and Space to switch
        std::thread::sleep(std::time::Duration::from_millis(300));
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app_name;
        Ok(())
    }
}

// ── Paste Transcription ───────────────────────────────────────────────────────

/// Writes `text` to the system clipboard and simulates Cmd+V (macOS) or Ctrl+V (Windows/Linux).
/// If `target_app` is provided, activates that app first to ensure paste goes to the right window.
///
/// This is a SYNC command — Tauri 2 runs it on the main thread. This is intentional:
/// CGEvent posting and NSRunningApplication activation are most reliable from the main thread.
#[tauri::command]
fn paste_transcription(text: String, target_app: Option<String>) -> Result<String, String> {
    // 1. Set clipboard
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(&text).map_err(|e| e.to_string())?;
    log::info!("[paste] clipboard set ({} chars)", text.len());

    #[cfg(target_os = "macos")]
    {
        // Check Accessibility permission
        let trusted = macos_paste::is_accessibility_trusted();
        log::info!("[paste] AXIsProcessTrusted = {}", trusted);
        if !trusted {
            return Err(
                "Oscar needs Accessibility permission. \
                 Go to System Settings → Privacy & Security → Accessibility and enable Oscar."
                    .into(),
            );
        }

        // 2. Activate target app (in-process via NSRunningApplication — no osascript)
        if let Some(ref app_name) = target_app {
            if !app_name.is_empty() {
                match macos_paste::activate_app(app_name) {
                    Ok(activated) => {
                        log::info!("[paste] activated '{}': {}", app_name, activated);
                    }
                    Err(e) => {
                        log::warn!("[paste] activate_app failed: {}, trying osascript", e);
                        // Fallback to osascript for activation
                        let safe = app_name.replace('\\', "\\\\").replace('"', "\\\"");
                        let script = format!(r#"tell application "{safe}" to activate"#);
                        let _ = std::process::Command::new("osascript")
                            .args(["-e", &script])
                            .output();
                    }
                }
                // Wait for the target app to fully become frontmost
                std::thread::sleep(std::time::Duration::from_millis(300));
            }
        }

        // 3. Post Cmd+V via CGEvent (from main thread)
        macos_paste::post_cmd_v()?;
        log::info!("[paste] CGEvent Cmd+V posted from main thread");

        return Ok(format!(
            "paste OK: trusted={}, target={:?}",
            trusted,
            target_app
        ));
    }

    #[cfg(target_os = "windows")]
    {
        std::thread::sleep(std::time::Duration::from_millis(100));
        std::process::Command::new("powershell")
            .args([
                "-Command",
                "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
            ])
            .output()
            .map_err(|e| e.to_string())?;
        return Ok("pasted".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        std::thread::sleep(std::time::Duration::from_millis(100));
        std::process::Command::new("xdotool")
            .args(["key", "ctrl+v"])
            .output()
            .map_err(|e| e.to_string())?;
        return Ok("pasted".to_string());
    }
}

// ── Deep Link Commands ───────────────────────────────────────────────────────

#[tauri::command]
fn get_pending_deep_link() -> Option<String> {
    let mut pending = PENDING_DEEP_LINK.lock().ok()?;
    pending.take()
}

// ── App Entry Point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    let is_recording = Arc::new(AtomicBool::new(false));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Mutex::new(AppState {
            whisper_context: None,
        }))
        .invoke_handler(tauri::generate_handler![
            download_whisper_model,
            load_whisper_model,
            transcribe_audio,
            paste_transcription,
            enhance_text,
            show_recording_pill,
            hide_recording_pill,
            get_frontmost_app,
            activate_app,
            get_pending_deep_link,
        ])
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // Set up deep link handler
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    let url_str = url.to_string();
                    log::info!("Deep link received: {}", url_str);
                    
                    // Store the deep link
                    set_pending_deep_link(url_str.clone());
                    
                    // Emit to frontend
                    let _ = app_handle.emit("deep-link", url_str);
                }
            });

            // Right Ctrl as hold-to-record hotkey (avoids conflicts on both macOS & Windows)
            let shortcut = Shortcut::new(
                Some(Modifiers::CONTROL),
                tauri_plugin_global_shortcut::Code::Space,
            );
            let app_handle = app.handle().clone();
            let is_rec = is_recording.clone();

            if let Err(e) = app.global_shortcut().on_shortcut(shortcut, move |_app, _sc, event| {
                match event.state {
                    ShortcutState::Pressed => {
                        if !is_rec.swap(true, Ordering::SeqCst) {
                            // Capture the frontmost app NOW, before Oscar's webview steals focus
                            #[cfg(target_os = "macos")]
                            let frontmost_app = {
                                std::process::Command::new("osascript")
                                    .args([
                                        "-e",
                                        r#"tell application "System Events" to get name of first application process whose frontmost is true"#,
                                    ])
                                    .output()
                                    .ok()
                                    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                                    .unwrap_or_default()
                            };
                            #[cfg(not(target_os = "macos"))]
                            let frontmost_app = String::new();

                            let _ = app_handle.emit("hotkey-recording-start", frontmost_app);
                        }
                    }
                    ShortcutState::Released => {
                        if is_rec.swap(false, Ordering::SeqCst) {
                            let _ = app_handle.emit("hotkey-recording-stop", ());
                        }
                    }
                }
            }) {
                log::warn!("Could not register global shortcut: {e}");
                let _ = app.handle().emit(
                    "hotkey-permission-error",
                    format!("Could not register hotkey: {e}. Check Accessibility permission in System Settings."),
                );
            } else {
                log::info!("Global shortcut (Ctrl+Space) registered successfully");
                let _ = app.handle().emit("hotkey-registered", ());
            }

            // Initialize the persistent store (creates file on first run)
            let _store = app.store("app-settings.json")
                .map_err(|e| log::warn!("Could not open store: {e}"))
                .ok();

            Ok(())
        })
        .on_window_event(|window, event| {
            // Handle deep link when app is already running
            if let tauri::WindowEvent::Focused(true) = event {
                if let Ok(mut pending) = PENDING_DEEP_LINK.lock() {
                    if let Some(url) = pending.take() {
                        let _ = window.emit("deep-link", url);
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
