//! Shared application state, common types, and process-wide statics.
//!
//! Extracted from `lib.rs` — items kept `pub(crate)` so they remain
//! reachable from sibling modules but invisible outside the crate.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{
    atomic::AtomicBool,
    Arc, Mutex,
};
#[cfg(target_os = "windows")]
use std::sync::atomic::AtomicUsize;
#[cfg(target_os = "linux")]
use std::sync::{atomic::AtomicU64, OnceLock};
use whisper_rs::WhisperContext;

// ── Deep Link / Focus / Tray Statics ─────────────────────────────────────────

pub(crate) static PENDING_DEEP_LINK: Mutex<Option<String>> = Mutex::new(None);

/// HWND (as usize) of the focused window captured at hotkey press on Windows.
/// Used by paste_transcription to re-focus the correct window before Ctrl+V.
#[cfg(target_os = "windows")]
pub(crate) static FOCUSED_WIN_HWND: AtomicUsize = AtomicUsize::new(0);

/// xdotool window ID captured at hotkey press on Linux.
/// Used by paste_transcription to re-focus the correct window before Ctrl+V.
#[cfg(target_os = "linux")]
pub(crate) static FOCUSED_WIN_XID: AtomicU64 = AtomicU64::new(0);

/// System tray indicator used on Linux in place of the pill webview window.
/// Initialised once in setup(); pill functions update its tooltip to show state.
#[cfg(target_os = "linux")]
pub(crate) static LINUX_TRAY: OnceLock<tauri::tray::TrayIcon> = OnceLock::new();

/// Set a pending deep link URL (called from deep link plugin).
pub fn set_pending_deep_link(url: String) {
    if let Ok(mut pending) = PENDING_DEEP_LINK.lock() {
        *pending = Some(url);
    }
}

// ── App State ────────────────────────────────────────────────────────────────

pub(crate) struct AppState {
    pub(crate) whisper_context: Option<WhisperContext>,
    pub(crate) loaded_model_role: Option<String>,
    pub(crate) loaded_model_path: Option<String>,
    pub(crate) meeting_system_audio_segments: HashMap<usize, Vec<f32>>,
}

pub(crate) struct HotkeyState {
    pub(crate) is_recording: Arc<AtomicBool>,
    pub(crate) last_error: Mutex<Option<String>>,
}

#[derive(Serialize, Deserialize)]
pub(crate) struct TranscriptSpeaker {
    pub(crate) source: String,
    pub(crate) diarization_label: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub(crate) struct TranscriptSegmentResult {
    pub(crate) text: String,
    pub(crate) start_ms: i64,
    pub(crate) end_ms: i64,
    pub(crate) speaker: TranscriptSpeaker,
}

#[derive(Serialize, Deserialize)]
pub(crate) struct TranscriptionResult {
    pub(crate) text: String,
    pub(crate) error: Option<String>,
    pub(crate) segments: Option<Vec<TranscriptSegmentResult>>,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FrontmostContextPayload {
    pub(crate) platform: String,
    pub(crate) app_name: String,
    pub(crate) app_id: Option<String>,
    pub(crate) process_name: Option<String>,
    pub(crate) window_title: Option<String>,
    pub(crate) site_host: Option<String>,
    pub(crate) site_title: Option<String>,
    pub(crate) target_app_name: Option<String>,
}
