//! Centralised Tauri event dispatch.
//!
//! Replaces ad-hoc `app.emit("string-name", payload)` calls scattered across
//! the codebase with a single tagged enum. Adding or renaming an event is a
//! compile error at every call site, not a silent string drift between Rust
//! and the webview.
//!
//! Wire format is unchanged: each variant maps to the same event name and
//! payload shape the frontend already listens for. This is a refactor, not a
//! protocol change.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};

use crate::models::WhisperModelVariant;
use crate::state::FrontmostContextPayload;

/// Frontend window labels that receive targeted emits. Anything that goes to
/// the main app uses `EventTarget::App`.
enum EventTarget {
    App,
    Window(&'static str),
}

/// All cross-process events Oscar's Rust side fires.
#[derive(Debug)]
pub(crate) enum OscarEvent {
    DeepLink(String),
    HotkeyRegistered,
    HotkeyPermissionError(String),
    HotkeyRecordingStart(FrontmostContextPayload),
    HotkeyRecordingStop,
    PillSetPhase(String),
    PillSettingsInit(serde_json::Value),
    DownloadProgress(DownloadProgress),
    DownloadRetry(DownloadRetry),
}

/// Download progress for the Whisper model download command. Lives here so
/// other model downloads can reuse it. The `variant` tag lets the frontend
/// route progress to the correct role without guessing from the current
/// recommendation (which races during preset/language flips).
#[derive(Clone, Serialize, Debug)]
pub(crate) struct DownloadProgress {
    pub variant: WhisperModelVariant,
    pub downloaded: u64,
    pub total: u64,
    pub percentage: u8,
}

/// Fired between download attempts when the previous attempt failed with a
/// transient error and we're about to wait `delay_secs` then retry. UI uses
/// this to surface "retrying… (N/M)" instead of a frozen progress bar.
#[derive(Clone, Serialize, Debug)]
pub(crate) struct DownloadRetry {
    pub variant: WhisperModelVariant,
    pub attempt: u32,
    pub max_attempts: u32,
    pub delay_secs: u64,
    pub reason: String,
}

fn fire<R: Runtime, T: Serialize + Clone>(
    app: &AppHandle<R>,
    target: &EventTarget,
    name: &str,
    payload: T,
) {
    match target {
        EventTarget::App => {
            let _ = app.emit(name, payload);
        }
        EventTarget::Window(label) => {
            let _ = app.emit_to(*label, name, payload);
        }
    }
}

impl OscarEvent {
    fn name(&self) -> &'static str {
        match self {
            OscarEvent::DeepLink(_) => "deep-link",
            OscarEvent::HotkeyRegistered => "hotkey-registered",
            OscarEvent::HotkeyPermissionError(_) => "hotkey-permission-error",
            OscarEvent::HotkeyRecordingStart(_) => "hotkey-recording-start",
            OscarEvent::HotkeyRecordingStop => "hotkey-recording-stop",
            OscarEvent::PillSetPhase(_) => "pill-set-phase",
            OscarEvent::PillSettingsInit(_) => "pill-settings-init",
            OscarEvent::DownloadProgress(_) => "download-progress",
            OscarEvent::DownloadRetry(_) => "download-retry",
        }
    }

    fn target(&self) -> EventTarget {
        match self {
            OscarEvent::PillSetPhase(_) | OscarEvent::PillSettingsInit(_) => {
                EventTarget::Window("recording-pill")
            }
            _ => EventTarget::App,
        }
    }

    pub fn dispatch<R: Runtime>(self, app: &AppHandle<R>) {
        let name = self.name();
        let target = self.target();
        match self {
            OscarEvent::DeepLink(url) => fire(app, &target, name, url),
            OscarEvent::HotkeyRegistered | OscarEvent::HotkeyRecordingStop => {
                fire(app, &target, name, ())
            }
            OscarEvent::HotkeyPermissionError(msg) => fire(app, &target, name, msg),
            OscarEvent::HotkeyRecordingStart(ctx) => fire(app, &target, name, ctx),
            OscarEvent::PillSetPhase(phase) => fire(app, &target, name, phase),
            OscarEvent::PillSettingsInit(value) => fire(app, &target, name, value),
            OscarEvent::DownloadProgress(progress) => fire(app, &target, name, progress),
            OscarEvent::DownloadRetry(retry) => fire(app, &target, name, retry),
        }
    }
}
