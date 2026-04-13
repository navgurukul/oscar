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
