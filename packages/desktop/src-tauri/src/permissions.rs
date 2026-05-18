#[tauri::command]
pub fn check_accessibility_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        crate::macos_paste::is_accessibility_trusted()
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
pub fn request_accessibility_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        crate::macos_paste::request_accessibility_with_prompt()
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

/// Check if macOS Dictation is enabled with the Control key as its trigger shortcut.
/// When Dictation uses "Press Control Key Twice", macOS intercepts every Ctrl key press
/// to watch for a double-tap, which disrupts the Ctrl+Space recording hotkey.
/// Returns false on non-macOS platforms or when the shortcut does not involve Ctrl.
#[tauri::command]
pub fn check_dictation_ctrl_conflict() -> bool {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        // Check if Dictation is enabled
        let enabled = Command::new("defaults")
            .args(["read", "com.apple.HIToolbox", "AppleDictationEnabled"])
            .output()
            .ok()
            .filter(|o| o.status.success())
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim() == "1")
            .unwrap_or(false);

        if !enabled {
            return false;
        }

        // Check if the Dictation shortcut uses the Control key.
        // kVK_Control = 59, kVK_RightControl = 62 (Carbon virtual key codes).
        // If the key cannot be read (default Fn/Globe shortcut stores nothing here),
        // we return false to avoid false positives.
        let keycode = Command::new("defaults")
            .args([
                "read",
                "com.apple.speech.recognition.AppleSpeechRecognition.prefs",
                "DictationImmediateShortcutKeyCode",
            ])
            .output()
            .ok()
            .filter(|o| o.status.success())
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .and_then(|s| s.trim().parse::<i32>().ok())
            .unwrap_or(-1);

        keycode == 59 || keycode == 62
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

#[tauri::command]
pub fn check_system_audio_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        crate::macos_paste::is_screen_capture_trusted()
    }
    #[cfg(not(target_os = "macos"))]
    {
        !crate::system_audio::is_supported()
    }
}

#[tauri::command]
pub fn request_system_audio_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        crate::macos_paste::request_screen_capture_with_prompt()
    }
    #[cfg(not(target_os = "macos"))]
    {
        !crate::system_audio::is_supported()
    }
}
