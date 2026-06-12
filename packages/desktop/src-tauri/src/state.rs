//! Shared application state, common types, and process-wide statics.
//!
//! Extracted from `lib.rs` — items kept `pub(crate)` so they remain
//! reachable from sibling modules but invisible outside the crate.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{
    atomic::AtomicBool,
    Arc, Mutex, RwLock,
};
#[cfg(target_os = "windows")]
use std::sync::atomic::AtomicUsize;
#[cfg(target_os = "linux")]
use std::sync::{atomic::AtomicU64, OnceLock};
use whisper_rs::WhisperContext;

use crate::models::WhisperModelVariant;

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

/// macOS status-bar (NSStatusItem) tray. Initialised once from `mac_tray::install`
/// during setup(). Pill helpers update its tooltip to reflect recording state.
#[cfg(target_os = "macos")]
pub(crate) static MAC_TRAY: std::sync::OnceLock<tauri::tray::TrayIcon> =
    std::sync::OnceLock::new();

/// Set a pending deep link URL (called from deep link plugin).
pub fn set_pending_deep_link(url: String) {
    if let Ok(mut pending) = PENDING_DEEP_LINK.lock() {
        *pending = Some(url);
    }
}

// ── Whisper runtime ───────────────────────────────────────────────────────────

/// The single resident Whisper model, tagged with the variant + path it was
/// loaded from. The tag is the source of truth for invariant I2: every
/// transcription call declares the variant it expects, and a mismatch against
/// this tag is a typed error rather than a silently wrong-model transcript.
pub(crate) struct LoadedModel {
    pub variant: WhisperModelVariant,
    pub path: String,
    /// Held as `Arc` so a transcription can grab a cheap handle and run
    /// inference under a read guard without blocking unrelated commands.
    pub context: Arc<WhisperContext>,
}

/// Per-variant download cancellation flag. Presence of the key in the registry
/// means "a download for this variant is in flight"; flipping the flag asks the
/// chunk loop to stop, delete its `.partial`, and return the cancelled token.
pub(crate) type DownloadFlag = Arc<AtomicBool>;

/// Whisper model lifecycle state, managed separately from [`AppState`] so a
/// multi-second inference holding a read guard never contends with the
/// `AppState` mutex used by the meeting capture buffers.
///
/// Invariant I3 ("no swap while busy") is enforced here: `transcribe` takes a
/// read guard on `model`, while `ensure_model_loaded` / `unload` take a write
/// guard — so a load can never tear the context out from under an in-flight
/// transcription, and vice versa.
pub(crate) struct WhisperRuntime {
    pub(crate) model: RwLock<Option<LoadedModel>>,
    /// In-flight downloads keyed by variant → cancel flag. Lock is only ever
    /// held for brief insert/remove/check, never across an `.await`.
    pub(crate) downloads: Mutex<HashMap<WhisperModelVariant, DownloadFlag>>,
}

impl WhisperRuntime {
    pub(crate) fn new() -> Self {
        Self {
            model: RwLock::new(None),
            downloads: Mutex::new(HashMap::new()),
        }
    }
}

// ── App State ────────────────────────────────────────────────────────────────

pub(crate) struct AppState {
    /// System-audio PCM captured per meeting segment, keyed by
    /// `(session_id, segment_index)`. The session dimension prevents a slow
    /// rotation task from an abandoned meeting from colliding with a freshly
    /// started meeting at the same segment index. See `meeting.rs`.
    pub(crate) meeting_system_audio_segments: HashMap<(u64, usize), Vec<f32>>,
    /// Session id (monotonic, set by `start_system_audio_capture`) that
    /// currently owns the shared system-audio backend. Rotate/stop commands
    /// carrying a different id are stale and must no-op without touching the
    /// backend, so a late task from an abandoned meeting cannot kill the live
    /// capture of the meeting that replaced it.
    pub(crate) active_meeting_session: u64,
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

#[derive(Serialize, Deserialize, Default, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TranscriptionPerf {
    /// VAD pre-filter wall-clock ms (`filter_speech`).
    pub(crate) vad_ms: u64,
    /// Time to acquire shared context handle + create per-call `WhisperState`.
    pub(crate) state_create_ms: u64,
    /// `state.full(params, audio)` wall-clock ms — the dominant cost.
    pub(crate) inference_ms: u64,
    /// Segment extraction + hallucination filter loop ms.
    pub(crate) segments_ms: u64,
    /// Total wall-clock ms inside `transcribe_audio_inner`.
    pub(crate) total_ms: u64,
    /// Speech-audio length fed to inference, in samples (16 kHz mono).
    pub(crate) speech_samples: u64,
    /// Raw segments Whisper produced before filtering.
    pub(crate) raw_segments: u32,
    /// Segments dropped by `no_speech_probability` gate.
    pub(crate) dropped_no_speech: u32,
    /// Segments dropped by `is_hallucination_segment`.
    pub(crate) dropped_hallucination: u32,
}

#[derive(Serialize, Deserialize)]
pub(crate) struct TranscriptionResult {
    pub(crate) text: String,
    pub(crate) error: Option<String>,
    pub(crate) segments: Option<Vec<TranscriptSegmentResult>>,
    /// Per-stage timing — populated by `transcribe_audio_inner`. `None` when
    /// inference was skipped (empty audio or VAD found no speech).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) perf: Option<TranscriptionPerf>,
}

#[derive(Serialize, Clone, Default, Debug)]
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
