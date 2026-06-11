//! Frontmost-application context capture for hotkey events.
//! macOS uses NSWorkspace + osascript; Windows uses Win32 GetForegroundWindow;
//! Linux returns a placeholder; other targets return "unknown".

use crate::state::FrontmostContextPayload;

pub(crate) fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

pub(crate) fn extract_host_from_url(url: &str) -> Option<String> {
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
mod mac {
    use super::{extract_host_from_url, normalize_optional_string, FrontmostContextPayload};

    extern "C" {
        fn objc_getClass(name: *const std::ffi::c_char) -> *mut std::ffi::c_void;
        fn sel_registerName(name: *const std::ffi::c_char) -> *mut std::ffi::c_void;
        fn objc_msgSend() -> *mut std::ffi::c_void;
    }

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

    fn get_browser_site_context(bundle_id: Option<&str>) -> (Option<String>, Option<String>) {
        // (bundle id, url script, title script). Every script addresses the app
        // by a STATIC `application id` literal — the runtime bundle id only
        // selects a row, it is never interpolated into the script body. This
        // closes an AppleScript-injection hole: the previous code formatted the
        // app's `localizedName` (attacker-influenceable via the app's Info.plist
        // / window chrome) directly into the script with only `"` escaped, so a
        // crafted name could break out and run arbitrary AppleScript.
        const BROWSERS: &[(&str, &str, &str)] = &[
            (
                "com.apple.Safari",
                r#"tell application id "com.apple.Safari" to get URL of front document"#,
                r#"tell application id "com.apple.Safari" to get name of front document"#,
            ),
            (
                "com.google.Chrome",
                r#"tell application id "com.google.Chrome" to get URL of active tab of front window"#,
                r#"tell application id "com.google.Chrome" to get title of active tab of front window"#,
            ),
            (
                "company.thebrowser.Browser",
                r#"tell application id "company.thebrowser.Browser" to get URL of active tab of front window"#,
                r#"tell application id "company.thebrowser.Browser" to get title of active tab of front window"#,
            ),
            (
                "com.brave.Browser",
                r#"tell application id "com.brave.Browser" to get URL of active tab of front window"#,
                r#"tell application id "com.brave.Browser" to get title of active tab of front window"#,
            ),
            (
                "com.microsoft.edgemac",
                r#"tell application id "com.microsoft.edgemac" to get URL of active tab of front window"#,
                r#"tell application id "com.microsoft.edgemac" to get title of active tab of front window"#,
            ),
            (
                "com.operasoftware.Opera",
                r#"tell application id "com.operasoftware.Opera" to get URL of active tab of front window"#,
                r#"tell application id "com.operasoftware.Opera" to get title of active tab of front window"#,
            ),
        ];

        let bundle = match bundle_id {
            Some(value) => value,
            None => return (None, None),
        };

        let scripts = BROWSERS
            .iter()
            .find(|(id, _, _)| *id == bundle)
            .map(|(_, url_script, title_script)| (*url_script, *title_script));

        let (url_script, title_script) = match scripts {
            Some(pair) => pair,
            None => return (None, None),
        };

        let url = run_osascript(url_script);
        let title = run_osascript(title_script);
        (
            url.as_deref().and_then(extract_host_from_url),
            normalize_optional_string(title),
        )
    }

    pub(super) fn get_frontmost_context_payload() -> FrontmostContextPayload {
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
        let (site_host, site_title) = get_browser_site_context(native_app_id.as_deref());

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
}

#[cfg(target_os = "windows")]
mod win {
    use super::{normalize_optional_string, FrontmostContextPayload};
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

    pub(super) fn get_frontmost_context_payload() -> FrontmostContextPayload {
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
}

#[cfg(target_os = "macos")]
pub(crate) fn get_frontmost_context_payload() -> FrontmostContextPayload {
    mac::get_frontmost_context_payload()
}

#[cfg(target_os = "windows")]
pub(crate) fn get_frontmost_context_payload() -> FrontmostContextPayload {
    win::get_frontmost_context_payload()
}

#[cfg(target_os = "linux")]
pub(crate) fn get_frontmost_context_payload() -> FrontmostContextPayload {
    FrontmostContextPayload {
        platform: "linux".to_string(),
        ..FrontmostContextPayload::default()
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
pub(crate) fn get_frontmost_context_payload() -> FrontmostContextPayload {
    FrontmostContextPayload {
        platform: "unknown".to_string(),
        ..FrontmostContextPayload::default()
    }
}
