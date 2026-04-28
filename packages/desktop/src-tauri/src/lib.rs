use arboard::Clipboard;
use base64::Engine as _;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
#[cfg(target_os = "windows")]
use std::sync::atomic::AtomicUsize;
#[cfg(target_os = "linux")]
use std::sync::{atomic::AtomicU64, OnceLock};
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_store::StoreExt;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};
use tokio::io::AsyncWriteExt;

mod calendar;
mod filesystem;
mod permissions;
mod system_audio;

#[cfg(target_os = "macos")]
extern "C" {
    fn objc_getClass(name: *const std::ffi::c_char) -> *mut std::ffi::c_void;
    fn sel_registerName(name: *const std::ffi::c_char) -> *mut std::ffi::c_void;
    fn objc_msgSend() -> *mut std::ffi::c_void;
}

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

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGPreflightScreenCaptureAccess() -> bool;
        fn CGRequestScreenCaptureAccess() -> bool;
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

    pub fn is_screen_capture_trusted() -> bool {
        unsafe { CGPreflightScreenCaptureAccess() }
    }

    pub fn request_screen_capture_with_prompt() -> bool {
        unsafe { CGRequestScreenCaptureAccess() }
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

/// HWND (as usize) of the focused window captured at hotkey press on Windows.
/// Used by paste_transcription to re-focus the correct window before Ctrl+V.
#[cfg(target_os = "windows")]
static FOCUSED_WIN_HWND: AtomicUsize = AtomicUsize::new(0);

/// xdotool window ID captured at hotkey press on Linux.
/// Used by paste_transcription to re-focus the correct window before Ctrl+V.
#[cfg(target_os = "linux")]
static FOCUSED_WIN_XID: AtomicU64 = AtomicU64::new(0);

/// System tray indicator used on Linux in place of the pill webview window.
/// Initialised once in setup(); pill functions update its tooltip to show state.
#[cfg(target_os = "linux")]
static LINUX_TRAY: OnceLock<tauri::tray::TrayIcon> = OnceLock::new();

/// Set a pending deep link URL (called from deep link plugin)
pub fn set_pending_deep_link(url: String) {
    if let Ok(mut pending) = PENDING_DEEP_LINK.lock() {
        *pending = Some(url);
    }
}

// ── App State ────────────────────────────────────────────────────────────────

struct AppState {
    whisper_context: Option<WhisperContext>,
    loaded_model_role: Option<String>,
    loaded_model_path: Option<String>,
    meeting_system_audio_segments: HashMap<usize, Vec<f32>>,
}

struct HotkeyState {
    is_recording: Arc<AtomicBool>,
    last_error: Mutex<Option<String>>,
}

#[derive(Serialize, Deserialize)]
struct TranscriptSpeaker {
    source: String,
    diarization_label: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct TranscriptSegmentResult {
    text: String,
    start_ms: i64,
    end_ms: i64,
    speaker: TranscriptSpeaker,
}

#[derive(Serialize, Deserialize)]
struct TranscriptionResult {
    text: String,
    error: Option<String>,
    segments: Option<Vec<TranscriptSegmentResult>>,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct FrontmostContextPayload {
    platform: String,
    app_name: String,
    app_id: Option<String>,
    process_name: Option<String>,
    window_title: Option<String>,
    site_host: Option<String>,
    site_title: Option<String>,
    target_app_name: Option<String>,
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

#[allow(dead_code)]
fn extract_host_from_url(url: &str) -> Option<String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return None;
    }

    let without_scheme = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .unwrap_or(trimmed);

    let host = without_scheme
        .split('/')
        .next()
        .unwrap_or("")
        .split('?')
        .next()
        .unwrap_or("")
        .trim()
        .trim_start_matches("www.")
        .to_string();

    if host.is_empty() {
        None
    } else {
        Some(host)
    }
}

#[cfg(target_os = "macos")]
fn nsstring_to_string(ns_string: *mut std::ffi::c_void) -> Option<String> {
    if ns_string.is_null() {
        return None;
    }

    unsafe {
        let sel_utf8 = sel_registerName(b"UTF8String\0".as_ptr() as *const _);
        type MsgCStr = unsafe extern "C" fn(
            *mut std::ffi::c_void,
            *mut std::ffi::c_void,
        ) -> *const std::ffi::c_char;
        let msg_cstr: MsgCStr = std::mem::transmute(objc_msgSend as *const ());
        let c_str = msg_cstr(ns_string, sel_utf8);
        if c_str.is_null() {
            return None;
        }

        std::ffi::CStr::from_ptr(c_str)
            .to_str()
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
    }
}

#[cfg(target_os = "macos")]
fn get_frontmost_macos_app_identity() -> (String, Option<String>) {
    unsafe {
        let ws_class = objc_getClass(b"NSWorkspace\0".as_ptr() as *const _);
        if ws_class.is_null() {
            return (String::new(), None);
        }

        let sel_shared = sel_registerName(b"sharedWorkspace\0".as_ptr() as *const _);
        let sel_frontmost =
            sel_registerName(b"frontmostApplication\0".as_ptr() as *const _);
        let sel_name = sel_registerName(b"localizedName\0".as_ptr() as *const _);
        let sel_bundle = sel_registerName(b"bundleIdentifier\0".as_ptr() as *const _);

        type MsgId = unsafe extern "C" fn(
            *mut std::ffi::c_void,
            *mut std::ffi::c_void,
        ) -> *mut std::ffi::c_void;
        let msg_id: MsgId = std::mem::transmute(objc_msgSend as *const ());

        let shared = msg_id(ws_class, sel_shared);
        if shared.is_null() {
            return (String::new(), None);
        }

        let frontmost = msg_id(shared, sel_frontmost);
        if frontmost.is_null() {
            return (String::new(), None);
        }

        let app_name = nsstring_to_string(msg_id(frontmost, sel_name)).unwrap_or_default();
        let bundle_id = nsstring_to_string(msg_id(frontmost, sel_bundle));

        (app_name, bundle_id)
    }
}

#[cfg(target_os = "macos")]
fn run_osascript(script: &str) -> Option<String> {
    std::process::Command::new("osascript")
        .args(["-e", script])
        .output()
        .ok()
        .and_then(|output| {
            if !output.status.success() {
                return None;
            }

            Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
        })
        .filter(|value| !value.is_empty())
}

#[cfg(target_os = "macos")]
fn get_browser_site_context(app_name: &str) -> (Option<String>, Option<String>) {
    let lower = app_name.to_lowercase();

    if lower.contains("safari") {
        let url = run_osascript(
            r#"tell application "Safari" to get URL of front document"#,
        );
        let title = run_osascript(
            r#"tell application "Safari" to get name of front document"#,
        );
        return (
            url.as_deref().and_then(extract_host_from_url),
            normalize_optional_string(title),
        );
    }

    let chromium_like = ["chrome", "arc", "brave", "edge", "opera"];
    if chromium_like.iter().any(|candidate| lower.contains(candidate)) {
        let safe_name = app_name.replace('"', "\\\"");
        let url = run_osascript(&format!(
            r#"tell application "{}" to get URL of active tab of front window"#,
            safe_name
        ));
        let title = run_osascript(&format!(
            r#"tell application "{}" to get title of active tab of front window"#,
            safe_name
        ));
        return (
            url.as_deref().and_then(extract_host_from_url),
            normalize_optional_string(title),
        );
    }

    (None, None)
}

#[cfg(target_os = "macos")]
fn get_frontmost_context_payload() -> FrontmostContextPayload {
    let (app_name, native_app_id) = get_frontmost_macos_app_identity();
    let window_title = run_osascript(
        r#"tell application "System Events"
    tell (first application process whose frontmost is true)
        try
            return name of front window
        on error
            return ""
        end try
    end tell
end tell"#,
    );
    let (site_host, site_title) = get_browser_site_context(&app_name);

    FrontmostContextPayload {
        platform: "macos".to_string(),
        app_name: app_name.clone(),
        app_id: normalize_optional_string(native_app_id),
        process_name: None,
        window_title: normalize_optional_string(window_title),
        site_host,
        site_title,
        target_app_name: normalize_optional_string(Some(app_name)),
    }
}

#[cfg(target_os = "windows")]
fn get_frontmost_context_payload() -> FrontmostContextPayload {
    use std::path::Path;
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
    };

    fn wide_to_string(buffer: &[u16], length: usize) -> String {
        String::from_utf16_lossy(&buffer[..length])
            .trim()
            .to_string()
    }

    let hwnd = unsafe { GetForegroundWindow() };
    let window_title = if hwnd == 0 {
        None
    } else {
        let title_len = unsafe { GetWindowTextLengthW(hwnd) };
        if title_len <= 0 {
            None
        } else {
            let mut buffer = vec![0u16; title_len as usize + 1];
            let copied = unsafe { GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32) };
            if copied <= 0 {
                None
            } else {
                normalize_optional_string(Some(wide_to_string(&buffer, copied as usize)))
            }
        }
    };

    let mut pid = 0u32;
    if hwnd != 0 {
        unsafe {
            GetWindowThreadProcessId(hwnd, &mut pid);
        }
    }

    let process_name = if pid == 0 {
        None
    } else {
        let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
        if handle == 0 {
            None
        } else {
            let mut buffer = vec![0u16; 1024];
            let mut buffer_len = buffer.len() as u32;
            let result = unsafe {
                QueryFullProcessImageNameW(handle, 0, buffer.as_mut_ptr(), &mut buffer_len)
            };
            unsafe {
                CloseHandle(handle);
            }

            if result == 0 || buffer_len == 0 {
                None
            } else {
                let path = wide_to_string(&buffer, buffer_len as usize);
                Path::new(&path)
                    .file_name()
                    .map(|name| name.to_string_lossy().to_string())
                    .and_then(|name| normalize_optional_string(Some(name)))
            }
        }
    };

    FrontmostContextPayload {
        platform: "windows".to_string(),
        app_name: process_name.clone().unwrap_or_default(),
        app_id: None,
        process_name,
        window_title,
        site_host: None,
        site_title: None,
        target_app_name: None,
    }
}

#[cfg(target_os = "linux")]
fn get_frontmost_context_payload() -> FrontmostContextPayload {
    FrontmostContextPayload {
        platform: "linux".to_string(),
        ..FrontmostContextPayload::default()
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn get_frontmost_context_payload() -> FrontmostContextPayload {
    FrontmostContextPayload {
        platform: "unknown".to_string(),
        ..FrontmostContextPayload::default()
    }
}

fn recording_shortcut() -> Shortcut {
    Shortcut::new(
        Some(Modifiers::CONTROL),
        tauri_plugin_global_shortcut::Code::Space,
    )
}

fn set_hotkey_error<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    hotkey_state: &HotkeyState,
    message: Option<String>,
) {
    if let Ok(mut last_error) = hotkey_state.last_error.lock() {
        *last_error = message.clone();
    }

    if let Some(msg) = message {
        let _ = app.emit("hotkey-permission-error", msg);
    } else {
        let _ = app.emit("hotkey-registered", ());
    }
}

fn register_recording_hotkey<R: tauri::Runtime>(
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
                        FOCUSED_WIN_HWND.store(hwnd as usize, Ordering::SeqCst);
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
                                    FOCUSED_WIN_XID.store(xid, Ordering::SeqCst);
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
                    let _ = app_handle.emit("hotkey-recording-start", frontmost_context);
                }
            }
            ShortcutState::Released => {
                if is_rec.swap(false, Ordering::SeqCst) {
                    log::info!("[hotkey] Ctrl+Space RELEASED — emitting stop");
                    let _ = app_handle.emit("hotkey-recording-stop", ());
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
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .no_gzip()
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .header("Accept-Encoding", "identity")
        .header("User-Agent", "oscar-desktop/1.0")
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
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    load_whisper_model_inner("dictation", &path, state.inner())
}

fn load_whisper_model_inner(
    role: &str,
    path: &str,
    state: &Arc<Mutex<AppState>>,
) -> Result<String, String> {
    let should_reload = {
        let app_state = state.lock().map_err(|e| e.to_string())?;
        !(
            app_state.whisper_context.is_some()
                && app_state.loaded_model_role.as_deref() == Some(role)
                && app_state.loaded_model_path.as_deref() == Some(path)
        )
    };

    if !should_reload {
        log::info!("[whisper] Model already loaded for role={} path={}", role, path);
        return Ok("Whisper model already loaded".to_string());
    }

    log::info!("[whisper] Loading model from: {}", path);
    let params = WhisperContextParameters::default();
    let context =
        WhisperContext::new_with_params(path, params).map_err(|e| {
            log::error!("[whisper] Failed to load model: {}", e);
            e.to_string()
        })?;
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.whisper_context = Some(context);
    app_state.loaded_model_role = Some(role.to_string());
    app_state.loaded_model_path = Some(path.to_string());
    log::info!("[whisper] Model loaded successfully");
    Ok("Whisper model loaded successfully".to_string())
}

#[tauri::command]
fn ensure_whisper_model_loaded(
    role: String,
    path: String,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    load_whisper_model_inner(&role, &path, state.inner())
}

#[tauri::command]
fn warm_whisper_runtime(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let locked = state.lock().map_err(|e| e.to_string())?;
    let context = locked
        .whisper_context
        .as_ref()
        .ok_or_else(|| "Whisper model not loaded".to_string())?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("en"));
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);

    let mut whisper_state = context.create_state().map_err(|e| e.to_string())?;
    let silence = vec![0.0f32; 16_000];
    whisper_state
        .full(params, &silence)
        .map_err(|e| e.to_string())?;

    Ok("Whisper runtime warmed".to_string())
}

// ── Whisper: Transcribe ───────────────────────────────────────────────────────

/// Shared transcription logic used by both `transcribe_audio` and
/// `transcribe_meeting_audio`.
/// Shared transcription logic used by both `transcribe_audio` and
/// `transcribe_meeting_audio`.
fn transcribe_audio_inner(
    audio_data: &[f32],
    initial_prompt: Option<&str>,
    language: Option<&str>,
    app_state: &Arc<Mutex<AppState>>,
    source: Option<&str>,
) -> Result<TranscriptionResult, String> {
    if audio_data.is_empty() {
        return Ok(TranscriptionResult {
            text: String::new(),
            error: None,
            segments: None,
        });
    }

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
    // Use all available CPU cores (capped at 8) for faster transcription
    let n_threads = (std::thread::available_parallelism()
        .map(|n| n.get() as i32)
        .unwrap_or(4))
    .min(8);
    params.set_n_threads(n_threads);
    log::info!("[whisper] using {} threads", n_threads);

    // Inject personal dictionary words as Whisper initial prompt
    if let Some(prompt) = initial_prompt {
        if !prompt.is_empty() {
            log::debug!("[whisper] Using initial prompt ({} chars)", prompt.len());
            // params.set_initial_prompt(prompt);  // API removed in newer whisper-rs
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
    let mut structured_segments = Vec::new();

    for i in 0..num_segments {
        if let Some(segment) = state.get_segment(i) {
            let text = match segment.to_str() {
                Ok(t) => t.to_string(),
                Err(_) => continue,
            };
            let trimmed = text.trim().to_string();
            if trimmed.is_empty() {
                continue;
            }

            full_text.push_str(&trimmed);
            full_text.push(' ');

            if let Some(segment_source) = source {
                let start_time = segment.start_timestamp();
                let end_time = segment.end_timestamp();

                structured_segments.push(TranscriptSegmentResult {
                    text: trimmed,
                    start_ms: start_time * 10,
                    end_ms: end_time * 10,
                    speaker: TranscriptSpeaker {
                        source: segment_source.to_string(),
                        diarization_label: None,
                    },
                });
            }
        }
    }

    let result_len = full_text.trim().len();
    log::info!("[whisper] Transcription result: {} chars", result_len);

    Ok(TranscriptionResult {
        text: full_text.trim().to_string(),
        error: None,
        segments: if structured_segments.is_empty() {
            None
        } else {
            Some(structured_segments)
        },
    })
}

fn merge_transcription_results(results: Vec<TranscriptionResult>) -> TranscriptionResult {
    let mut segments = Vec::new();
    let mut text_parts = Vec::new();

    for result in results {
        let trimmed_text = result.text.trim();
        if !trimmed_text.is_empty() {
            text_parts.push(trimmed_text.to_string());
        }

        if let Some(mut result_segments) = result.segments {
            segments.append(&mut result_segments);
        }
    }

    segments.sort_by(|left, right| {
        left.start_ms
            .cmp(&right.start_ms)
            .then(left.end_ms.cmp(&right.end_ms))
            .then(left.speaker.source.cmp(&right.speaker.source))
    });

    let text = if segments.is_empty() {
        text_parts.join(" ").trim().to_string()
    } else {
        segments
            .iter()
            .map(|segment| segment.text.trim())
            .filter(|text| !text.is_empty())
            .collect::<Vec<_>>()
            .join(" ")
            .trim()
            .to_string()
    };

    TranscriptionResult {
        text,
        error: None,
        segments: if segments.is_empty() {
            None
        } else {
            Some(segments)
        },
    }
}

#[tauri::command]
fn transcribe_audio(
    audio_data: Vec<f32>,
    initial_prompt: Option<String>,
    language: Option<String>,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<TranscriptionResult, String> {
    transcribe_audio_inner(
        &audio_data,
        initial_prompt.as_deref(),
        language.as_deref(),
        &state,
        None,
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

/// Transcribe meeting audio: receives microphone audio from the frontend,
/// retrieves system audio captured in the background, transcribes each source
/// separately, and merges the segment timelines.
///
/// This avoids transferring large system audio buffers across the IPC boundary.
#[tauri::command]
fn transcribe_meeting_audio(
    mic_audio_data: Vec<f32>,
    initial_prompt: Option<String>,
    language: Option<String>,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<TranscriptionResult, String> {
    // Stop system audio capture and retrieve buffered samples
    system_audio::stop_capture();
    let system_audio_data = system_audio::get_audio_data();

    log::info!(
        "[meeting] mic samples={}, system audio samples={}",
        mic_audio_data.len(),
        system_audio_data.len()
    );

    let mut results = Vec::new();

    if !mic_audio_data.is_empty() {
        results.push(transcribe_audio_inner(
            &mic_audio_data,
            initial_prompt.as_deref(),
            language.as_deref(),
            &state,
            Some("microphone"),
        )?);
    }

    if !system_audio_data.is_empty() {
        results.push(transcribe_audio_inner(
            &system_audio_data,
            initial_prompt.as_deref(),
            language.as_deref(),
            &state,
            Some("speaker"),
        )?);
    }

    Ok(merge_transcription_results(results))
}

fn merge_transcription_prompt(
    initial_prompt: Option<String>,
    previous_tail_text: Option<String>,
) -> Option<String> {
    let mut parts = Vec::new();

    if let Some(prompt) = initial_prompt {
        let trimmed = prompt.trim();
        if !trimmed.is_empty() {
            parts.push(trimmed.to_string());
        }
    }

    if let Some(previous_tail) = previous_tail_text {
        let trimmed = previous_tail.trim();
        if !trimmed.is_empty() {
            parts.push(format!("Previous transcript tail: {}", trimmed));
        }
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n"))
    }
}

#[tauri::command]
fn clear_meeting_segment_buffers(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.meeting_system_audio_segments.clear();
    Ok("Meeting segment buffers cleared".to_string())
}

#[tauri::command]
fn rotate_meeting_system_audio_segment(
    segment_index: usize,
    restart_capture: bool,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    system_audio::stop_capture();
    let segment = system_audio::get_audio_data();
    let sample_count = segment.len();

    {
        let mut app_state = state.lock().map_err(|e| e.to_string())?;
        app_state
            .meeting_system_audio_segments
            .insert(segment_index, segment);
    }

    if restart_capture {
        system_audio::start_capture()?;
    }

    Ok(format!(
        "Stored system audio segment {} ({} samples)",
        segment_index, sample_count
    ))
}

// ── Audio decoding helpers ───────────────────────────────────────────────────

/// Decode MP4/AAC or any symphonia-supported format to 16 kHz mono f32 PCM.
fn decode_with_symphonia(bytes: &[u8], ext: &str) -> Result<Vec<f32>, String> {
    use symphonia::core::audio::SampleBuffer;
    use symphonia::core::codecs::DecoderOptions;
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;
    use symphonia::default::get_probe;

    let cursor = std::io::Cursor::new(bytes.to_vec());
    let mss = MediaSourceStream::new(Box::new(cursor), Default::default());

    let mut hint = Hint::new();
    hint.with_extension(ext);

    let probe = get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| format!("[audio] probe failed: {e}"))?;

    let mut format = probe.format;

    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != symphonia::core::codecs::CODEC_TYPE_NULL)
        .ok_or("[audio] no supported audio track found")?;

    let track_id = track.id;
    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100) as usize;

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| format!("[audio] decoder init failed: {e}"))?;

    let mut raw_samples: Vec<f32> = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(symphonia::core::errors::Error::IoError(e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break
            }
            Err(symphonia::core::errors::Error::ResetRequired) => continue,
            Err(e) => return Err(format!("[audio] packet error: {e}")),
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(_) => continue,
        };

        let spec = *decoded.spec();
        let mut sample_buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
        sample_buf.copy_interleaved_ref(decoded);
        let samples = sample_buf.samples();
        let channels = spec.channels.count();

        // Downmix to mono
        if channels == 1 {
            raw_samples.extend_from_slice(samples);
        } else {
            let frames = samples.len() / channels;
            for f in 0..frames {
                let mut sum = 0f32;
                for c in 0..channels {
                    sum += samples[f * channels + c];
                }
                raw_samples.push(sum / channels as f32);
            }
        }
    }

    log::info!(
        "[audio] symphonia decoded {} mono samples @ {}Hz",
        raw_samples.len(),
        sample_rate
    );

    if sample_rate == 16000 {
        return Ok(raw_samples);
    }

    resample_to_16k(raw_samples, sample_rate)
}

/// Decode WebM/Opus by demuxing with symphonia (MKV container) and decoding
/// Opus frames with the `opus` crate.
fn decode_webm_opus(bytes: &[u8]) -> Result<Vec<f32>, String> {
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;
    use symphonia::default::get_probe;

    let cursor = std::io::Cursor::new(bytes.to_vec());
    let mss = MediaSourceStream::new(Box::new(cursor), Default::default());

    let mut hint = Hint::new();
    hint.with_extension("webm");

    let probe = get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| format!("[audio] webm probe failed: {e}"))?;

    let mut format = probe.format;

    // Find the first track (we'll treat it as Opus)
    let track = format
        .tracks()
        .first()
        .ok_or("[audio] no tracks in webm")?;

    let track_id = track.id;
    let sample_rate = track.codec_params.sample_rate.unwrap_or(48000) as usize;
    let channels = track.codec_params.channels.map(|c| c.count()).unwrap_or(1);

    log::info!(
        "[audio] webm track: rate={}, channels={}",
        sample_rate,
        channels
    );

    let mut decoder = opus::Decoder::new(
        sample_rate as u32,
        if channels == 1 {
            opus::Channels::Mono
        } else {
            opus::Channels::Stereo
        },
    )
    .map_err(|e| format!("[audio] opus decoder init: {e}"))?;

    let mut raw_samples: Vec<f32> = Vec::new();
    // Max frame size: 120ms @ 48kHz stereo
    let max_frame = (sample_rate / 1000 * 120) * channels;
    let mut frame_buf = vec![0f32; max_frame];

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(symphonia::core::errors::Error::IoError(e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break
            }
            Err(symphonia::core::errors::Error::ResetRequired) => continue,
            Err(e) => return Err(format!("[audio] webm packet error: {e}")),
        };

        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode_float(&packet.data, &mut frame_buf, false) {
            Ok(n) => {
                let decoded = &frame_buf[..n * channels];
                if channels == 1 {
                    raw_samples.extend_from_slice(decoded);
                } else {
                    let frames = decoded.len() / channels;
                    for f in 0..frames {
                        let mut sum = 0f32;
                        for c in 0..channels {
                            sum += decoded[f * channels + c];
                        }
                        raw_samples.push(sum / channels as f32);
                    }
                }
            }
            Err(e) => {
                log::warn!("[audio] opus decode error (skipping frame): {e}");
            }
        }
    }

    log::info!(
        "[audio] opus decoded {} mono samples @ {}Hz",
        raw_samples.len(),
        sample_rate
    );

    if sample_rate == 16000 {
        return Ok(raw_samples);
    }
    resample_to_16k(raw_samples, sample_rate)
}

/// Resample arbitrary-rate mono f32 PCM to 16 000 Hz using rubato FastFixedIn.
fn resample_to_16k(samples: Vec<f32>, source_rate: usize) -> Result<Vec<f32>, String> {
    use rubato::{FftFixedIn, Resampler};

    if source_rate == 16000 {
        return Ok(samples);
    }

    let chunk_size = 4096usize;
    let ratio = 16000.0 / source_rate as f64;
    let mut resampler = FftFixedIn::<f32>::new(source_rate, 16000, chunk_size, 2, 1)
        .map_err(|e| format!("[audio] resampler init: {e}"))?;

    let mut output: Vec<f32> = Vec::with_capacity((samples.len() as f64 * ratio) as usize + 1024);
    let mut pos = 0usize;

    while pos < samples.len() {
        let end = (pos + chunk_size).min(samples.len());
        let mut chunk: Vec<f32> = samples[pos..end].to_vec();
        // Pad last chunk if needed
        if chunk.len() < chunk_size {
            chunk.resize(chunk_size, 0.0);
        }
        let resampled = resampler
            .process(&[chunk], None)
            .map_err(|e| format!("[audio] resample chunk: {e}"))?;
        output.extend_from_slice(&resampled[0]);
        pos += chunk_size;
    }

    log::info!(
        "[audio] resampled {} → {} samples ({}Hz → 16kHz)",
        samples.len(),
        output.len(),
        source_rate
    );

    Ok(output)
}

/// Dispatch to the correct decoder based on file extension.
fn decode_audio_to_pcm(bytes: &[u8], ext: &str) -> Result<Vec<f32>, String> {
    match ext {
        "webm" => {
            // Try symphonia first (it may handle vorbis/opus in some builds),
            // fall back to our manual opus path on failure.
            decode_webm_opus(bytes).or_else(|_| decode_with_symphonia(bytes, ext))
        }
        _ => decode_with_symphonia(bytes, ext),
    }
}

#[tauri::command]
async fn transcribe_meeting_segment_bytes(
    bytes: Vec<u8>,
    ext: String,
    use_system_audio: bool,
    initial_prompt: Option<String>,
    language: Option<String>,
    segment_index: usize,
    previous_tail_text: Option<String>,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<TranscriptionResult, String> {
    let state = state.inner().clone();
    let merged_prompt = merge_transcription_prompt(initial_prompt, previous_tail_text);

    tauri::async_runtime::spawn_blocking(move || {
        log::info!(
            "[meeting-segment] received segment {} ({} bytes, ext={})",
            segment_index,
            bytes.len(),
            ext
        );

        let mic_pcm = decode_audio_to_pcm(&bytes, &ext)?;
        log::info!(
            "[meeting-segment] decoded {} mic samples for segment {}",
            mic_pcm.len(),
            segment_index
        );

        let system_audio_data = if use_system_audio {
            let mut app_state = state.lock().map_err(|e| e.to_string())?;
            app_state
                .meeting_system_audio_segments
                .remove(&segment_index)
                .unwrap_or_default()
        } else {
            Vec::new()
        };

        let mut results = Vec::new();

        if !mic_pcm.is_empty() {
            results.push(transcribe_audio_inner(
                &mic_pcm,
                merged_prompt.as_deref(),
                language.as_deref(),
                &state,
                Some("microphone"),
            )?);
        }

        if !system_audio_data.is_empty() {
            results.push(transcribe_audio_inner(
                &system_audio_data,
                merged_prompt.as_deref(),
                language.as_deref(),
                &state,
                Some("speaker"),
            )?);
        }

        Ok(merge_transcription_results(results))
    })
    .await
    .map_err(|e| format!("[meeting-segment] worker join error: {e}"))?
}

/// New IPC command: receive base64-encoded raw audio blob from the frontend,
/// decode entirely in Rust (no renderer AudioContext), resample to 16 kHz,
/// and merge microphone/system transcription timelines if system audio is active.
#[tauri::command]
fn transcribe_meeting_audio_b64(
    audio_b64: String,
    ext: String,
    use_system_audio: bool,
    initial_prompt: Option<String>,
    language: Option<String>,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<TranscriptionResult, String> {
    // Decode base64 → raw compressed bytes
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&audio_b64)
        .map_err(|e| format!("[meeting_b64] base64 decode failed: {e}"))?;

    log::info!(
        "[meeting_b64] received {} bytes (ext={})",
        bytes.len(),
        ext
    );

    // Decode audio to 16 kHz mono f32 PCM — all in Rust, off the renderer thread
    let mic_pcm = decode_audio_to_pcm(&bytes, &ext)?;

    log::info!("[meeting_b64] decoded {} mic samples", mic_pcm.len());

    // Stop system audio capture and retrieve buffered samples
    if use_system_audio {
        system_audio::stop_capture();
    }
    let system_audio_data = system_audio::get_audio_data();

    let mut results = Vec::new();

    if !mic_pcm.is_empty() {
        results.push(transcribe_audio_inner(
            &mic_pcm,
            initial_prompt.as_deref(),
            language.as_deref(),
            &state,
            Some("microphone"),
        )?);
    }

    if !system_audio_data.is_empty() {
        results.push(transcribe_audio_inner(
            &system_audio_data,
            initial_prompt.as_deref(),
            language.as_deref(),
            &state,
            Some("speaker"),
        )?);
    }

    Ok(merge_transcription_results(results))
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

    let pill_w = 72.0_f64;
    let pill_h = 26.0_f64;
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
        if let Some(tray) = LINUX_TRAY.get() {
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
            let _ = w.eval("document.body.classList.remove('processing')");
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
        if let Some(tray) = LINUX_TRAY.get() {
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
        Ok(())
    }
}

#[tauri::command]
fn set_pill_processing(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        if let Some(tray) = LINUX_TRAY.get() {
            tray.set_tooltip(Some("⟳ Processing — Oscar")).ok();
        }
        log::debug!("[pill] set_pill_processing → tray tooltip updated (Linux)");
        let _ = app;
        return Ok(());
    }

    #[cfg(not(target_os = "linux"))]
    {
        log::info!("[pill] set_pill_processing called");
        if let Some(w) = app.get_webview_window("recording-pill") {
            let _ = w.eval("document.body.classList.add('processing')");
        }
        Ok(())
    }
}

#[tauri::command]
fn set_pill_listening(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        if let Some(tray) = LINUX_TRAY.get() {
            tray.set_tooltip(Some("● Recording — Oscar")).ok();
        }
        log::debug!("[pill] set_pill_listening → tray tooltip updated (Linux)");
        let _ = app;
        return Ok(());
    }

    #[cfg(not(target_os = "linux"))]
    {
        log::info!("[pill] set_pill_listening called");
        if let Some(w) = app.get_webview_window("recording-pill") {
            let _ = w.eval("document.body.classList.remove('processing')");
        }
        Ok(())
    }
}

// ── Focus Management ────────────────────────────────────────────────────────

/// Returns the name of the frontmost application (macOS only).
#[tauri::command]
fn get_frontmost_app() -> Result<String, String> {
    let payload = get_frontmost_context_payload();
    if payload.app_name.is_empty() {
        Err("Could not determine frontmost app".to_string())
    } else {
        Ok(payload.app_name)
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
        // Re-focus the window that was active when the hotkey was pressed so
        // that Ctrl+V lands in the right place instead of an Oscar window.
        #[cfg(target_os = "windows")]
        {
            use windows_sys::Win32::UI::WindowsAndMessaging::SetForegroundWindow;
            let hwnd = FOCUSED_WIN_HWND.load(Ordering::SeqCst) as isize;
            if hwnd != 0 {
                unsafe { SetForegroundWindow(hwnd); }
                log::info!("[paste] SetForegroundWindow(0x{:x})", hwnd as usize);
            }
        }
        #[cfg(target_os = "linux")]
        {
            let xid = FOCUSED_WIN_XID.load(Ordering::SeqCst);
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

#[tauri::command]
fn ensure_recording_hotkey_registered(
    app: tauri::AppHandle,
    hotkey_state: tauri::State<'_, HotkeyState>,
) -> Result<bool, String> {
    register_recording_hotkey(&app, &hotkey_state)
}

#[tauri::command]
fn is_recording_hotkey_registered(app: tauri::AppHandle) -> bool {
    app.global_shortcut().is_registered(recording_shortcut())
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
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // When a second instance is launched (e.g. via oscar:// deep link),
            // forward the URL to the existing instance and focus its window.
            if let Some(url) = argv.iter().find(|a| a.starts_with("oscar://")) {
                set_pending_deep_link(url.clone());
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("deep-link", url.clone());
                }
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Arc::new(Mutex::new(AppState {
            whisper_context: None,
            loaded_model_role: None,
            loaded_model_path: None,
            meeting_system_audio_segments: HashMap::new(),
        })))
        .manage(HotkeyState {
            is_recording: is_recording.clone(),
            last_error: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            download_whisper_model,
            load_whisper_model,
            ensure_whisper_model_loaded,
            warm_whisper_runtime,
            transcribe_audio,
            transcribe_meeting_audio,
            clear_meeting_segment_buffers,
            rotate_meeting_system_audio_segment,
            transcribe_meeting_segment_bytes,
            transcribe_meeting_audio_b64,
            paste_transcription,
            show_recording_pill,
            hide_recording_pill,
            set_pill_processing,
            set_pill_listening,
            get_frontmost_app,
            get_pending_deep_link,
            permissions::check_accessibility_permission,
            permissions::request_accessibility_permission,
            permissions::check_system_audio_permission,
            permissions::request_system_audio_permission,
            ensure_recording_hotkey_registered,
            is_recording_hotkey_registered,
            is_system_audio_supported,
            start_system_audio_capture,
            stop_system_audio_capture,
            filesystem::check_file_exists,
            filesystem::delete_file,
            calendar::get_calendar_events,
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

            // Register oscar:// URL scheme in the OS (required on Windows dev builds;
            // production installers handle this, but dev mode needs it explicitly).
            if let Err(e) = app.deep_link().register_all() {
                log::warn!("[setup] Could not register deep link schemes: {:?}", e);
            } else {
                log::info!("[setup] Deep link schemes registered OK");
            }

            // Set up deep link handler (may not be available on all Linux desktops)
            log::info!("[setup] Registering deep link handler...");
            if let Err(e) = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        let url_str = url.to_string();
                        log::info!("[deep-link] received: {}", url_str);
                        set_pending_deep_link(url_str.clone());
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
