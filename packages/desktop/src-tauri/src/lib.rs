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

mod system_audio;

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
        static kCFBooleanFalse: *const c_void;
        static kCFTypeDictionaryKeyCallBacks: c_void;
        static kCFTypeDictionaryValueCallBacks: c_void;
    }

    // kCFStringEncodingUTF8
    const CF_STRING_ENCODING_UTF8: u32 = 0x0800_0100;

    pub fn is_accessibility_trusted() -> bool {
        unsafe { AXIsProcessTrusted() }
    }

    /// Re-register the current binary with TCC **without** showing a system
    /// dialog (kAXTrustedCheckOptionPrompt = false).  This is called when
    /// AXIsProcessTrusted() returns false after a rebuild so that the new
    /// binary hash is written to the TCC database.  Returns true if the
    /// process is now trusted (e.g., the user had it toggled on for a
    /// previous build).
    pub fn reregister_without_prompt() -> bool {
        unsafe {
            let key = CFStringCreateWithCString(
                std::ptr::null(),
                b"AXTrustedCheckOptionPrompt\0".as_ptr() as *const _,
                CF_STRING_ENCODING_UTF8,
            );
            // kCFBooleanFalse — re-register the binary hash, no dialog shown
            let value = kCFBooleanFalse;
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

    /// Activate a running macOS app by its display name using NSRunningApplication.
    /// Unlike `open -a`, this does NOT trigger a Space-switch animation, so it is
    /// safe to use with fullscreen apps.  Returns Ok(true) if the app was found and
    /// activated, Ok(false) if the app was not in the running-applications list.
    pub fn activate_app(app_name: &str) -> Result<bool, String> {
        unsafe {
            // NSWorkspace.sharedWorkspace.runningApplications
            let ws_class = objc_getClass(b"NSWorkspace\0".as_ptr() as *const _);
            if ws_class.is_null() { return Err("NSWorkspace class not found".into()); }
            let sel_shared   = sel_registerName(b"sharedWorkspace\0".as_ptr() as *const _);
            let sel_running  = sel_registerName(b"runningApplications\0".as_ptr() as *const _);
            let sel_count    = sel_registerName(b"count\0".as_ptr() as *const _);
            let sel_obj_at   = sel_registerName(b"objectAtIndex:\0".as_ptr() as *const _);
            let sel_loc_name = sel_registerName(b"localizedName\0".as_ptr() as *const _);
            let sel_utf8     = sel_registerName(b"UTF8String\0".as_ptr() as *const _);
            let sel_activate = sel_registerName(b"activateWithOptions:\0".as_ptr() as *const _);

            type MsgId  = unsafe extern "C" fn(*mut c_void, *mut c_void) -> *mut c_void;
            type MsgIdx = unsafe extern "C" fn(*mut c_void, *mut c_void, usize) -> *mut c_void;
            type MsgU64 = unsafe extern "C" fn(*mut c_void, *mut c_void, u64) -> bool;
            type MsgCStr = unsafe extern "C" fn(*mut c_void, *mut c_void) -> *const std::ffi::c_char;
            type MsgCnt = unsafe extern "C" fn(*mut c_void, *mut c_void) -> usize;

            let msg_id:   MsgId   = std::mem::transmute(objc_msgSend as *const ());
            let msg_idx:  MsgIdx  = std::mem::transmute(objc_msgSend as *const ());
            let msg_act:  MsgU64  = std::mem::transmute(objc_msgSend as *const ());
            let msg_cstr: MsgCStr = std::mem::transmute(objc_msgSend as *const ());
            let msg_cnt:  MsgCnt  = std::mem::transmute(objc_msgSend as *const ());

            let shared = msg_id(ws_class, sel_shared);
            let apps   = msg_id(shared, sel_running);
            let count  = msg_cnt(apps, sel_count);

            let target = app_name.to_lowercase();
            for i in 0..count {
                let app = msg_idx(apps, sel_obj_at, i);
                // localizedName returns NSString*, so we must call [nsString UTF8String]
                // to get a C string pointer. Treating NSString* as *const c_char directly
                // causes a SIGSEGV in strlen.
                let ns_string = msg_id(app, sel_loc_name);
                if ns_string.is_null() { continue; }
                let name_ptr = msg_cstr(ns_string, sel_utf8);
                if name_ptr.is_null() { continue; }
                let name = std::ffi::CStr::from_ptr(name_ptr)
                    .to_string_lossy()
                    .to_lowercase();
                if name == target || name.contains(&target) || target.contains(&name) {
                    // NSApplicationActivateIgnoringOtherApps = 1 << 1 = 2
                    msg_act(app, sel_activate, 2);
                    return Ok(true);
                }
            }
            Ok(false)
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
    log::info!("[whisper] Loading model from: {}", path);
    let params = WhisperContextParameters::default();
    let context =
        WhisperContext::new_with_params(&path, params).map_err(|e| {
            log::error!("[whisper] Failed to load model: {}", e);
            e.to_string()
        })?;
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.whisper_context = Some(context);
    log::info!("[whisper] Model loaded successfully");
    Ok("Whisper model loaded successfully".to_string())
}

// ── Whisper: Transcribe ───────────────────────────────────────────────────────

/// Shared transcription logic used by both `transcribe_audio` and
/// `transcribe_meeting_audio`.
fn transcribe_audio_inner(
    audio_data: &[f32],
    initial_prompt: Option<&str>,
    language: Option<&str>,
    app_state: &Mutex<AppState>,
) -> Result<TranscriptionResult, String> {
    log::info!(
        "[whisper] transcribe_audio_inner — {} samples ({:.1}s), lang={:?}",
        audio_data.len(),
        audio_data.len() as f64 / 16000.0,
        language
    );
    let locked = app_state.lock().map_err(|e| e.to_string())?;

    let context = locked
        .whisper_context
        .as_ref()
        .ok_or_else(|| {
            log::error!("[whisper] Model not loaded when transcribe was called");
            "Whisper model not loaded".to_string()
        })?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    // "auto" or None → let Whisper auto-detect the language from the audio
    let lang = language.filter(|l| *l != "auto" && !l.is_empty());
    params.set_language(lang);
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);

    // Inject personal dictionary words as Whisper initial prompt
    if let Some(prompt) = initial_prompt {
        if !prompt.is_empty() {
            log::debug!("[whisper] Using initial prompt ({} chars)", prompt.len());
            params.set_initial_prompt(prompt);
        }
    }

    let mut state = context.create_state().map_err(|e| {
        log::error!("[whisper] Failed to create state: {}", e);
        e.to_string()
    })?;
    log::info!("[whisper] Running inference...");
    state.full(params, audio_data).map_err(|e| {
        log::error!("[whisper] Inference failed: {}", e);
        e.to_string()
    })?;

    let num_segments = state.full_n_segments();
    log::info!("[whisper] Inference complete — {} segments", num_segments);
    let mut full_text = String::new();

    for i in 0..num_segments {
        if let Some(segment) = state.get_segment(i) {
            if let Ok(text) = segment.to_str() {
                full_text.push_str(text.trim());
                full_text.push(' ');
            }
        }
    }

    let result_len = full_text.trim().len();
    log::info!("[whisper] Transcription result: {} chars", result_len);

    Ok(TranscriptionResult {
        text: full_text.trim().to_string(),
        error: None,
    })
}

#[tauri::command]
fn transcribe_audio(
    audio_data: Vec<f32>,
    initial_prompt: Option<String>,
    language: Option<String>,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<TranscriptionResult, String> {
    transcribe_audio_inner(
        &audio_data,
        initial_prompt.as_deref(),
        language.as_deref(),
        &state,
    )
}

// ── System Audio: Tauri Commands ─────────────────────────────────────────────

#[tauri::command]
fn is_system_audio_supported() -> bool {
    system_audio::is_supported()
}

#[tauri::command]
fn start_system_audio_capture() -> Result<String, String> {
    log::info!("[system-audio] start_system_audio_capture called");
    system_audio::start_capture()?;
    Ok("System audio capture started".to_string())
}

#[tauri::command]
fn stop_system_audio_capture() -> Result<String, String> {
    log::info!("[system-audio] stop_system_audio_capture called");
    system_audio::stop_capture();
    Ok("System audio capture stopped".to_string())
}

/// Mix two audio buffers (same sample rate) by adding them sample-by-sample
/// and clamping to [-1.0, 1.0].
fn mix_audio(a: &[f32], b: &[f32]) -> Vec<f32> {
    let max_len = a.len().max(b.len());
    let mut mixed = Vec::with_capacity(max_len);
    for i in 0..max_len {
        let sa = if i < a.len() { a[i] } else { 0.0 };
        let sb = if i < b.len() { b[i] } else { 0.0 };
        mixed.push((sa + sb).clamp(-1.0, 1.0));
    }
    mixed
}

/// Transcribe meeting audio: receives microphone audio from the frontend,
/// retrieves system audio captured in the background, mixes them together,
/// and runs Whisper inference on the combined audio.
///
/// This avoids transferring large system audio buffers across the IPC boundary.
#[tauri::command]
fn transcribe_meeting_audio(
    mic_audio_data: Vec<f32>,
    initial_prompt: Option<String>,
    language: Option<String>,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<TranscriptionResult, String> {
    // Stop system audio capture and retrieve buffered samples
    system_audio::stop_capture();
    let system_audio_data = system_audio::get_audio_data();

    log::info!(
        "[meeting] mic samples={}, system audio samples={}",
        mic_audio_data.len(),
        system_audio_data.len()
    );

    // Mix microphone + system audio (both are 16 kHz mono)
    let audio_to_transcribe = if system_audio_data.is_empty() {
        log::info!("[meeting] No system audio — transcribing mic only");
        mic_audio_data
    } else {
        log::info!(
            "[meeting] Mixing mic ({:.1}s) + system audio ({:.1}s)",
            mic_audio_data.len() as f64 / 16000.0,
            system_audio_data.len() as f64 / 16000.0
        );
        mix_audio(&mic_audio_data, &system_audio_data)
    };

    transcribe_audio_inner(
        &audio_to_transcribe,
        initial_prompt.as_deref(),
        language.as_deref(),
        &state,
    )
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
    log::info!("[enhance] enhance_text called — {} chars, tone={}", text.len(), tone);
    if text.trim().is_empty() {
        log::debug!("[enhance] Empty text, returning as-is");
        return Ok(text);
    }

    // If user provided their own API key, call DeepSeek directly
    if let Some(key) = api_key {
        log::info!("[enhance] Using direct DeepSeek API key");
        return enhance_with_deepseek(text, tone, &key).await;
    }

    // Otherwise, use the Supabase Edge Function (requires auth)
    log::info!("[enhance] Using Supabase Edge Function");
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

// ── DeepSeek AI: Text Processing ─────────────────────────────────────────────

// API key embedded at build time via DEEPSEEK_API_KEY env var; falls back to
// the hardcoded value so release builds work without extra CI configuration.
const DEEPSEEK_API_KEY: &str = match option_env!("DEEPSEEK_API_KEY") {
    Some(k) => k,
    None => "sk-4a59b3ee436944f5b3d1ef4e49b7ddc4",
};
const DEEPSEEK_API_URL: &str = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL: &str = "deepseek-chat";

fn build_ai_prompt(mode: &str, text: &str) -> (String, String) {
    let system = "You are a precise transcript assistant. Follow instructions exactly. \
                  Output only the requested content with no preamble, no explanations, \
                  no meta-commentary. The transcript may contain Hinglish (Hindi words \
                  written in Roman script mixed with English). Understand both languages \
                  and always produce the output in clear English."
        .to_string();
    let user = match mode {
        "transcribe_cleanup" => format!(
            "Fix any transcription errors, grammar, punctuation, and remove filler words \
             (um, uh, like, you know) in the text below. Preserve the original meaning \
             and wording as much as possible. Output only the corrected text:\n\n{text}"
        ),
        "cleanup" => format!(
            "Clean up the following text — fix grammar, remove filler words, improve \
             readability. Keep the meaning intact. Output only the cleaned text:\n\n{text}"
        ),
        "summary" => format!(
            "Write a 3–5 sentence summary of the following text. \
             Output only the summary:\n\n{text}"
        ),
        "bullets" => format!(
            "Extract the key points from the following text as a concise bullet list. \
             Output only the bullets:\n\n{text}"
        ),
        "email" => format!(
            "Rewrite the following text as a clear, professional, ready-to-send email. \
             Output only the email body:\n\n{text}"
        ),
        // ── Meeting templates ──────────────────────────────────────────────
        "meeting_general" => format!(
            "You are a meeting notes assistant. The transcript may be in Hinglish (Hindi words \
             in Roman script mixed with English) — understand both and produce notes in clear English.\n\n\
             Analyze the following meeting transcript and produce structured meeting notes with these sections:\n\
             ## Key Discussion Points\n\
             ## Decisions Made\n\
             ## Action Items\n(include owner if mentioned and deadline if mentioned)\n\
             ## Follow-ups\n\n\
             Output only the structured notes in markdown format:\n\n{text}"
        ),
        "meeting_standup" => format!(
            "You are a standup meeting notes assistant. The transcript may be in Hinglish (Hindi words \
             in Roman script mixed with English) — understand both and produce notes in clear English.\n\n\
             Analyze the following standup transcript and produce structured notes with these sections:\n\
             ## What Was Done (Yesterday/Recently)\n\
             ## What's Being Worked On (Today/Next)\n\
             ## Blockers & Risks\n\n\
             If multiple people spoke, organize by person. Output only the structured notes in markdown:\n\n{text}"
        ),
        "meeting_1on1" => format!(
            "You are a 1:1 meeting notes assistant. The transcript may be in Hinglish (Hindi words \
             in Roman script mixed with English) — understand both and produce notes in clear English.\n\n\
             Analyze the following 1:1 meeting transcript and produce structured notes with these sections:\n\
             ## Discussion Points\n\
             ## Feedback & Recognition\n\
             ## Action Items\n(include owner and deadline if mentioned)\n\
             ## Follow-ups for Next Meeting\n\n\
             Output only the structured notes in markdown format:\n\n{text}"
        ),
        "meeting_brainstorm" => format!(
            "You are a brainstorming session notes assistant. The transcript may be in Hinglish (Hindi words \
             in Roman script mixed with English) — understand both and produce notes in clear English.\n\n\
             Analyze the following brainstorm transcript and produce structured notes with these sections:\n\
             ## Ideas Generated\n(list each idea with a brief description)\n\
             ## Key Themes\n\
             ## Top Ideas (Ranked by Discussion Energy)\n\
             ## Next Steps\n\n\
             Output only the structured notes in markdown format:\n\n{text}"
        ),
        "meeting_custom" => format!(
            "You are a meeting notes assistant. The transcript may be in Hinglish (Hindi words \
             in Roman script mixed with English) — understand both and produce notes in clear English.\n\n\
             Analyze the following meeting transcript and produce structured meeting notes following \
             the instructions included in the text. \
             Output only the structured notes in markdown format:\n\n{text}"
        ),
        _ => format!("Process the following text:\n\n{text}"),
    };
    (system, user)
}

/// Process text with DeepSeek AI. Streams tokens via "ai-token" events.
#[tauri::command]
async fn ai_process_text(
    text: String,
    mode: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    use futures_util::StreamExt;

    let (system_prompt, user_prompt) = build_ai_prompt(&mode, &text);

    let body = serde_json::json!({
        "model": DEEPSEEK_MODEL,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user",   "content": user_prompt   }
        ],
        "stream": true,
        "max_tokens": 2048,
        "temperature": 0.3
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let response = client
        .post(DEEPSEEK_API_URL)
        .header("Authorization", format!("Bearer {DEEPSEEK_API_KEY}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("DeepSeek request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("DeepSeek API error {status}: {body}"));
    }

    let mut full_text = String::new();
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream read error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process complete SSE lines
        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() || line == "data: [DONE]" {
                continue;
            }
            if let Some(json_str) = line.strip_prefix("data: ") {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(json_str) {
                    if let Some(content) = json
                        .pointer("/choices/0/delta/content")
                        .and_then(|v| v.as_str())
                    {
                        full_text.push_str(content);
                        let _ = app.emit("ai-token", content);
                    }
                }
            }
        }
    }

    Ok(full_text)
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
    // On Linux, creating a secondary webview window causes tao's event loop
    // to panic (unwrap on None window handle at event_loop.rs:448).
    // Skip the pill entirely — recording state is shown in the main window.
    #[cfg(target_os = "linux")]
    {
        log::debug!("[pill] show_recording_pill skipped on Linux");
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
                        macos_paste::set_window_above_fullscreen(
                            ptr as *mut std::ffi::c_void,
                        );
                    });
                }
            }
        }
        Ok(())
    }
}

#[tauri::command]
fn hide_recording_pill(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        log::debug!("[pill] hide_recording_pill skipped on Linux");
        let _ = app;
        return Ok(());
    }

    #[cfg(not(target_os = "linux"))]
    {
        log::info!("[pill] hide_recording_pill called");
        if let Some(w) = app.get_webview_window("recording-pill") {
            w.hide().map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

#[tauri::command]
fn set_pill_processing(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        log::debug!("[pill] set_pill_processing skipped on Linux");
        let _ = app;
        return Ok(());
    }

    #[cfg(not(target_os = "linux"))]
    {
        log::info!("[pill] set_pill_processing called");
        let _ = app.emit_to("recording-pill", "pill-set-processing", ());
        Ok(())
    }
}

#[tauri::command]
fn set_pill_listening(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        log::debug!("[pill] set_pill_listening skipped on Linux");
        let _ = app;
        return Ok(());
    }

    #[cfg(not(target_os = "linux"))]
    {
        log::info!("[pill] set_pill_listening called");
        let _ = app.emit_to("recording-pill", "pill-set-listening", ());
        Ok(())
    }
}

// ── Calendar Integration ─────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
struct CalendarEvent {
    title: String,
    start_time: String,
    end_time: String,
    attendees: Vec<String>,
    calendar_name: String,
}

/// Fetch calendar events from the Google Calendar API using the user's OAuth provider token.
///
/// - `token`    – Google OAuth access token (provider_token from Supabase)
/// - `time_min` – RFC3339 start of the window, e.g. "2024-06-01T00:00:00Z"
/// - `time_max` – RFC3339 end of the window
///
/// Returns `Err("NEEDS_RECONNECT")` on HTTP 401 so the frontend can prompt the user
/// to reconnect their Google account.
#[tauri::command]
async fn get_calendar_events(
    token: String,
    time_min: String,
    time_max: String,
) -> Result<Vec<CalendarEvent>, String> {
    if token.is_empty() {
        return Ok(vec![]);
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events\
         ?timeMin={}&timeMax={}&singleEvents=true&orderBy=startTime&maxResults=30",
        time_min, time_max
    );

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| format!("Calendar API request failed: {e}"))?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("NEEDS_RECONNECT".into());
    }

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Calendar API error {status}: {body}"));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse calendar response: {e}"))?;

    let items = match body.get("items").and_then(|v| v.as_array()) {
        Some(arr) => arr.clone(),
        None => return Ok(vec![]),
    };

    let mut events: Vec<CalendarEvent> = items
        .iter()
        .filter_map(|item| {
            let title = item.get("summary")?.as_str()?.trim().to_string();
            if title.is_empty() {
                return None;
            }

            // Skip non-default event types (working location, focus time, out of office)
            let event_type = item.get("eventType").and_then(|v| v.as_str()).unwrap_or("default");
            if event_type != "default" {
                return None;
            }

            // Skip all-day events (no dateTime, only date)
            if item.pointer("/start/dateTime").is_none() {
                return None;
            }

            // Prefer dateTime (timed events) over date (all-day events)
            let start_time = item
                .pointer("/start/dateTime")
                .and_then(|v| v.as_str())
                .map(format_rfc3339_time)
                .or_else(|| {
                    item.pointer("/start/date")
                        .and_then(|v| v.as_str())
                        .map(|d| d.to_string())
                })
                .unwrap_or_default();

            let end_time = item
                .pointer("/end/dateTime")
                .and_then(|v| v.as_str())
                .map(format_rfc3339_time)
                .or_else(|| {
                    item.pointer("/end/date")
                        .and_then(|v| v.as_str())
                        .map(|d| d.to_string())
                })
                .unwrap_or_default();

            // Attendees: prefer displayName, fall back to email
            let attendees: Vec<String> = item
                .get("attendees")
                .and_then(|a| a.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|att| {
                            att.get("displayName")
                                .and_then(|v| v.as_str())
                                .map(str::to_string)
                                .or_else(|| {
                                    att.get("email")
                                        .and_then(|v| v.as_str())
                                        .map(str::to_string)
                                })
                        })
                        .collect()
                })
                .unwrap_or_default();

            Some(CalendarEvent {
                title,
                start_time,
                end_time,
                attendees,
                calendar_name: "Google Calendar".into(),
            })
        })
        .collect();

    events.sort_by(|a, b| a.start_time.cmp(&b.start_time));
    Ok(events)
}

/// Extract "HH:MM" from an RFC3339 datetime string like "2024-06-01T14:30:00+05:30".
fn format_rfc3339_time(dt: &str) -> String {
    // The time part starts at index 11 (after "YYYY-MM-DDT")
    if dt.len() >= 16 {
        dt[11..16].to_string()
    } else {
        dt.to_string()
    }
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
                    Ok(true)  => {
                        // Brief wait for the window manager to finish activating
                        std::thread::sleep(std::time::Duration::from_millis(120));
                    }
                    Ok(false) => log::warn!("[paste] app '{}' not found in running apps", app_name),
                    Err(e)    => log::warn!("[paste] activate_app failed: {}", e),
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
        .manage(Mutex::new(AppState {
            whisper_context: None,
        }))
        .invoke_handler(tauri::generate_handler![
            download_whisper_model,
            load_whisper_model,
            transcribe_audio,
            transcribe_meeting_audio,
            paste_transcription,
            enhance_text,
            show_recording_pill,
            hide_recording_pill,
            set_pill_processing,
            set_pill_listening,
            get_frontmost_app,
            get_pending_deep_link,
            check_accessibility_permission,
            request_accessibility_permission,
            is_system_audio_supported,
            start_system_audio_capture,
            stop_system_audio_capture,
            check_file_exists,
            delete_file,
            ai_process_text,
            get_calendar_events,
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

                        // Emit to frontend
                        let _ = app_handle.emit("deep-link", url_str);
                    }
                });
            })) {
                log::warn!("[setup] Deep link handler not available on this platform: {:?}", e);
            } else {
                log::info!("[setup] Deep link handler registered OK");
            }

            // Right Ctrl as hold-to-record hotkey (avoids conflicts on both macOS & Windows)
            log::info!("[setup] Registering global shortcut (Ctrl+Space)...");
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
            #[cfg(target_os = "linux")]
            log::info!("[setup] Skipping pill window on Linux (tao secondary window bug)");

            log::info!("[setup] ✓ Setup complete — app ready");
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
        .unwrap_or_else(|e| {
            log::error!("========================================");
            log::error!("FATAL: Tauri application crashed: {}", e);
            log::error!("========================================");
            panic!("error while running tauri application: {}", e);
        });
}
