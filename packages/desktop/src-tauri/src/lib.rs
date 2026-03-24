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
        fn object_setClass(obj: *mut c_void, cls: *mut c_void) -> *mut c_void;
    }

    // Accessibility check
    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn AXIsProcessTrusted() -> bool;
        fn AXIsProcessTrustedWithOptions(options: *const c_void) -> bool;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFDictionaryCreate(
            allocator: *const c_void,
            keys: *mut *const c_void,
            values: *mut *const c_void,
            num_values: isize,
            key_callbacks: *const c_void,
            value_callbacks: *const c_void,
        ) -> *mut c_void;
        fn CFStringCreateWithCString(
            alloc: *const c_void,
            c_str: *const std::ffi::c_char,
            encoding: u32,
        ) -> *mut c_void;
        fn CFRelease(cf: *mut c_void);
        static kCFBooleanTrue: *const c_void;
        static kCFTypeDictionaryKeyCallBacks: c_void;
        static kCFTypeDictionaryValueCallBacks: c_void;
    }

    // kCFStringEncodingUTF8
    const CF_STRING_ENCODING_UTF8: u32 = 0x0800_0100;

    pub fn is_accessibility_trusted() -> bool {
        unsafe { AXIsProcessTrusted() }
    }

    /// Request accessibility permission with a system prompt.
    /// Uses AXIsProcessTrustedWithOptions which registers the current binary
    /// with macOS and opens System Settings if not already trusted.
    pub fn request_accessibility_with_prompt() -> bool {
        unsafe {
            let key = CFStringCreateWithCString(
                std::ptr::null(),
                b"AXTrustedCheckOptionPrompt\0".as_ptr() as *const _,
                CF_STRING_ENCODING_UTF8,
            );
            let value = kCFBooleanTrue;
            let mut keys_arr: *const c_void = key as *const c_void;
            let mut vals_arr: *const c_void = value;
            let dict = CFDictionaryCreate(
                std::ptr::null(),
                &mut keys_arr as *mut _,
                &mut vals_arr as *mut _,
                1,
                &kCFTypeDictionaryKeyCallBacks as *const c_void,
                &kCFTypeDictionaryValueCallBacks as *const c_void,
            );
            let trusted = AXIsProcessTrustedWithOptions(dict);
            CFRelease(dict);
            CFRelease(key as *mut c_void);
            trusted
        }
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

    /// Convert an NSWindow to NSPanel and configure it to float above fullscreen apps.
    /// NSPanel is the only window type macOS allows to appear over fullscreen Spaces.
    /// MUST be called on the main thread — NSWindow/NSPanel methods are main-thread-only.
    pub fn set_window_above_fullscreen(ns_window_ptr: *mut c_void) {
        unsafe {
            // 0. Convert NSWindow → NSPanel via isa-swizzle.
            //    NSPanel is a subclass of NSWindow with identical memory layout,
            //    so changing the class pointer is safe. This is what tauri-nspanel does.
            let ns_panel_class = objc_getClass(b"NSPanel\0".as_ptr() as *const _);
            if !ns_panel_class.is_null() {
                object_setClass(ns_window_ptr, ns_panel_class);
                log::info!("[pill] converted NSWindow → NSPanel via isa-swizzle");
            } else {
                log::warn!("[pill] could not find NSPanel class!");
            }

            // 1. Set window level to kCGScreenSaverWindowLevel (1000)
            //    This is above fullscreen app windows (~level 8-14)
            let sel_set_level = sel_registerName(b"setLevel:\0".as_ptr() as *const _);
            type SetLevelFn = unsafe extern "C" fn(*mut c_void, *mut c_void, i64);
            let set_level: SetLevelFn = std::mem::transmute(objc_msgSend as *const ());
            set_level(ns_window_ptr, sel_set_level, 1000);

            // 2. Set collection behavior flags for fullscreen Space compatibility
            let sel_set_behavior =
                sel_registerName(b"setCollectionBehavior:\0".as_ptr() as *const _);
            type SetBehaviorFn = unsafe extern "C" fn(*mut c_void, *mut c_void, u64);
            let set_behavior: SetBehaviorFn = std::mem::transmute(objc_msgSend as *const ());
            // NSWindowCollectionBehaviorCanJoinAllSpaces          = 1 << 0 = 1
            // NSWindowCollectionBehaviorStationary                = 1 << 4 = 16
            // NSWindowCollectionBehaviorIgnoresCycle              = 1 << 6 = 64
            // NSWindowCollectionBehaviorFullScreenAuxiliary       = 1 << 8 = 256
            set_behavior(ns_window_ptr, sel_set_behavior, 1 | 16 | 64 | 256);

            // 3. Set NSPanel-specific properties:
            //    - setFloatingPanel: YES — stays above other windows
            //    - setWorksWhenModal: YES — works even during modal dialogs
            //    - setHidesOnDeactivate: NO — don't hide when app loses focus
            let sel_set_floating =
                sel_registerName(b"setFloatingPanel:\0".as_ptr() as *const _);
            let sel_set_works_modal =
                sel_registerName(b"setWorksWhenModal:\0".as_ptr() as *const _);
            let sel_set_hides =
                sel_registerName(b"setHidesOnDeactivate:\0".as_ptr() as *const _);
            type SetBoolFn = unsafe extern "C" fn(*mut c_void, *mut c_void, bool);
            let set_bool: SetBoolFn = std::mem::transmute(objc_msgSend as *const ());
            set_bool(ns_window_ptr, sel_set_floating, true);
            set_bool(ns_window_ptr, sel_set_works_modal, true);
            set_bool(ns_window_ptr, sel_set_hides, false);

            // 4. Add NSNonactivatingPanel style (bit 7 = 128) so showing the
            //    panel doesn't activate the app or steal focus from fullscreen apps.
            let sel_style = sel_registerName(b"styleMask\0".as_ptr() as *const _);
            type GetStyleFn = unsafe extern "C" fn(*mut c_void, *mut c_void) -> u64;
            let get_style: GetStyleFn = std::mem::transmute(objc_msgSend as *const ());
            let current_style = get_style(ns_window_ptr, sel_style);

            let sel_set_style = sel_registerName(b"setStyleMask:\0".as_ptr() as *const _);
            type SetStyleFn = unsafe extern "C" fn(*mut c_void, *mut c_void, u64);
            let set_style: SetStyleFn = std::mem::transmute(objc_msgSend as *const ());
            // NSWindowStyleMaskNonactivatingPanel = 1 << 7 = 128
            set_style(ns_window_ptr, sel_set_style, current_style | 128);

            log::info!(
                "[pill] NSPanel configured: level=1000, floating=YES, hidesOnDeactivate=NO, \
                 behavior=canJoinAll|stationary|ignoresCycle|fullScreenAux, style |= NonactivatingPanel"
            );
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
    language: Option<String>,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<TranscriptionResult, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;

    let context = app_state
        .whisper_context
        .as_ref()
        .ok_or("Whisper model not loaded")?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    // "auto" or None → let Whisper auto-detect the language from the audio
    let lang = language.as_deref().filter(|l| *l != "auto" && !l.is_empty());
    params.set_language(lang);
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

/// Create the pill window (hidden) at app startup so it's ready instantly.
/// Called from `.setup()` which runs on the main thread — this is critical
/// because NSWindow methods (setLevel, setCollectionBehavior) are main-thread-only.
fn create_pill_window(app: &tauri::AppHandle) {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    if app.get_webview_window("recording-pill").is_some() {
        return; // already exists
    }

    let pill_w = 120.0_f64;
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
                    macos_paste::set_window_above_fullscreen(
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
fn show_recording_pill(app: tauri::AppHandle) -> Result<(), String> {
    // Ensure the pill exists (no-op if already created at startup)
    create_pill_window(&app);

    if let Some(w) = app.get_webview_window("recording-pill") {
        let _ = app.emit_to("recording-pill", "pill-set-listening", ());
        w.show().map_err(|e| e.to_string())?;

        // Re-apply window level AFTER show() — macOS can reset level on show.
        // This runs from a Tauri command (may not be main thread), so dispatch
        // the NSWindow calls to the main thread.
        #[cfg(target_os = "macos")]
        {
            if let Ok(ns_win) = w.ns_window() {
                let ptr = ns_win as usize; // safe to send across threads
                let _ = app.run_on_main_thread(move || {
                    macos_paste::set_window_above_fullscreen(
                        ptr as *mut std::ffi::c_void,
                    );
                });
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn hide_recording_pill(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("recording-pill") {
        w.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_pill_processing(app: tauri::AppHandle) -> Result<(), String> {
    let _ = app.emit_to("recording-pill", "pill-set-processing", ());
    Ok(())
}

#[tauri::command]
fn set_pill_listening(app: tauri::AppHandle) -> Result<(), String> {
    let _ = app.emit_to("recording-pill", "pill-set-listening", ());
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
        // On Windows/Linux, return empty string — paste still works because
        // enigo simulates Ctrl+V on whatever window is currently focused.
        Ok(String::new())
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
        // Check Accessibility permission.
        // NOTE: Without Apple Developer ID code signing, AXIsProcessTrusted()
        // will return false after every app update because macOS TCC stores a
        // cryptographic code signature hash (csreq) that changes with each
        // ad-hoc signed build. The toggle in System Settings may show ON but
        // the actual check fails. We gracefully fall back to clipboard-only.
        let trusted = macos_paste::is_accessibility_trusted();
        log::info!("[paste] AXIsProcessTrusted = {}", trusted);

        if !trusted {
            // Text is already on the clipboard from step 1.
            // Return a special status so the frontend can show a helpful hint
            // instead of an error. Do NOT prompt every time — it's disruptive.
            return Ok("CLIPBOARD_ONLY".into());
        }

        // 2. Activate target app via `open -a` (Launch Services).
        //    Unlike NSRunningApplication.activate, `open -a` properly navigates
        //    to fullscreen Spaces without breaking macOS window management.
        if let Some(ref app_name) = target_app {
            if !app_name.is_empty() {
                log::info!("[paste] activating '{}' via open -a", app_name);
                match std::process::Command::new("open")
                    .args(["-a", app_name])
                    .output()
                {
                    Ok(out) => {
                        log::info!(
                            "[paste] open -a exit={}, stderr={}",
                            out.status,
                            String::from_utf8_lossy(&out.stderr).trim()
                        );
                    }
                    Err(e) => log::warn!("[paste] open -a failed: {}", e),
                }
                // Wait for macOS to switch to the correct Space / bring app forward
                log::info!("[paste] sleeping 400ms for Space switch...");
                std::thread::sleep(std::time::Duration::from_millis(400));
                log::info!("[paste] sleep done, about to post Cmd+V");
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

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        use enigo::{Direction, Enigo, Key, Keyboard, Settings};
        std::thread::sleep(std::time::Duration::from_millis(150));
        let mut enigo = Enigo::new(&Settings::default())
            .map_err(|e| format!("enigo init failed: {e}"))?;
        enigo.key(Key::Control, Direction::Press)
            .map_err(|e| format!("ctrl down failed: {e}"))?;
        enigo.key(Key::Unicode('v'), Direction::Click)
            .map_err(|e| format!("v click failed: {e}"))?;
        enigo.key(Key::Control, Direction::Release)
            .map_err(|e| format!("ctrl up failed: {e}"))?;
        return Ok("pasted".to_string());
    }
}

// ── Deep Link Commands ───────────────────────────────────────────────────────

#[tauri::command]
fn get_pending_deep_link() -> Option<String> {
    let mut pending = PENDING_DEEP_LINK.lock().ok()?;
    pending.take()
}

// ── Accessibility Commands ────────────────────────────────────────────────────

#[tauri::command]
fn check_accessibility_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        macos_paste::is_accessibility_trusted()
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

/// Trigger the macOS system prompt to grant Accessibility access.
/// Uses AXIsProcessTrustedWithOptions which registers the current binary
/// and opens System Settings → Privacy & Security → Accessibility.
#[tauri::command]
fn request_accessibility_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        macos_paste::request_accessibility_with_prompt()
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

// ── File Utilities ────────────────────────────────────────────────────────────

#[tauri::command]
fn check_file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
fn delete_file(path: String) -> Result<String, String> {
    if std::path::Path::new(&path).exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))?;
        Ok(format!("Deleted {}", path))
    } else {
        Ok(format!("File not found: {}", path))
    }
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
            set_pill_processing,
            set_pill_listening,
            get_frontmost_app,
            activate_app,
            get_pending_deep_link,
            check_accessibility_permission,
            request_accessibility_permission,
            check_file_exists,
            delete_file,
        ])
        .setup(move |app| {
            // Set overlay titlebar on macOS only (not supported on Linux/GTK)
            #[cfg(target_os = "macos")]
            {
                if let Some(main_window) = app.get_webview_window("main") {
                    use tauri::TitleBarStyle;
                    let _ = main_window.set_title_bar_style(TitleBarStyle::Overlay);
                }
            }

            let app_handle = app.handle().clone();

            // Set up deep link handler (may not be available on all Linux desktops)
            if let Err(e) = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
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
            })) {
                log::warn!("Deep link handler not available on this platform: {:?}", e);
            }

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
                            log::info!("[hotkey] Ctrl+Space PRESSED — capturing frontmost app");
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

                            log::info!("[hotkey] frontmost app = '{}'", frontmost_app);
                            let _ = app_handle.emit("hotkey-recording-start", frontmost_app);
                        }
                    }
                    ShortcutState::Released => {
                        if is_rec.swap(false, Ordering::SeqCst) {
                            log::info!("[hotkey] Ctrl+Space RELEASED — emitting stop");
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

            // Pre-create the recording pill window (hidden) so that the first
            // hotkey press doesn't steal focus by creating a new window.
            create_pill_window(app.handle());

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
