// system_audio.rs — Cross-platform system audio capture.
//
// macOS:   Uses ScreenCaptureKit via a compiled Swift helper (SystemAudioCapture.swift).
// Windows: Not yet implemented (TODO: WASAPI loopback capture).
// Linux:   Not yet implemented (TODO: PulseAudio monitor source).

#[cfg(target_os = "macos")]
mod platform {
    // FFI bindings to the Swift SystemAudioCapture helper.
    // These functions are defined with @_cdecl in swift/SystemAudioCapture.swift
    // and compiled into a static library by build.rs.
    extern "C" {
        fn sck_is_supported() -> bool;
        fn sck_is_capturing() -> bool;
        fn sck_start_capture() -> i32;
        fn sck_stop_capture();
        fn sck_get_audio_data(out_count: *mut i32) -> *mut f32;
        fn sck_free_audio_data(ptr: *mut f32, count: i32);
    }

    /// Check if system audio capture is supported on this OS version (macOS 13.0+).
    pub fn is_supported() -> bool {
        unsafe { sck_is_supported() }
    }

    /// Check if system audio capture is currently active.
    pub fn is_capturing() -> bool {
        unsafe { sck_is_capturing() }
    }

    /// Start capturing system audio. On first call, macOS may show a Screen Recording
    /// permission dialog. The user must grant this permission for capture to work.
    pub fn start_capture() -> Result<(), String> {
        let code = unsafe { sck_start_capture() };
        match code {
            0 => {
                log::info!("[system-audio] Capture started successfully");
                Ok(())
            }
            1 => Err("System audio capture is already active".to_string()),
            2 => Err(
                "System audio capture requires macOS 13.0 or later".to_string(),
            ),
            3 => Err(
                "Screen Recording permission is required. \
                 Please grant permission in System Settings → Privacy & Security → Screen & System Audio Recording, \
                 then restart OSCAR."
                    .to_string(),
            ),
            4 => Err(
                "Failed to start system audio capture. \
                 Ensure Screen Recording permission is granted in \
                 System Settings → Privacy & Security → Screen & System Audio Recording."
                    .to_string(),
            ),
            _ => Err(format!("Unknown system audio error (code {})", code)),
        }
    }

    /// Stop the active system audio capture session.
    pub fn stop_capture() {
        unsafe { sck_stop_capture() };
        log::info!("[system-audio] Capture stopped");
    }

    /// Retrieve all buffered audio samples (16 kHz mono Float32) and clear the
    /// internal buffer. Returns an empty Vec if no audio was captured.
    pub fn get_audio_data() -> Vec<f32> {
        let mut count: i32 = 0;
        let ptr = unsafe { sck_get_audio_data(&mut count) };
        if ptr.is_null() || count <= 0 {
            return Vec::new();
        }
        // Copy data into a Rust Vec, then free the Swift-allocated buffer.
        let data = unsafe { std::slice::from_raw_parts(ptr, count as usize) }.to_vec();
        unsafe { sck_free_audio_data(ptr, count) };
        log::info!(
            "[system-audio] Retrieved {} samples ({:.1}s at 16 kHz)",
            data.len(),
            data.len() as f64 / 16000.0
        );
        data
    }
}

#[cfg(not(target_os = "macos"))]
mod platform {
    pub fn is_supported() -> bool {
        // TODO: Implement WASAPI loopback for Windows
        false
    }

    pub fn is_capturing() -> bool {
        false
    }

    pub fn start_capture() -> Result<(), String> {
        Err("System audio capture is not yet supported on this platform".to_string())
    }

    pub fn stop_capture() {}

    pub fn get_audio_data() -> Vec<f32> {
        Vec::new()
    }
}

pub use platform::*;
