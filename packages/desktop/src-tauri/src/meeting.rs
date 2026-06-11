//! Meeting-mode IPC commands: system-audio capture controls and the
//! per-segment transcription pipeline that merges microphone + speaker
//! timelines into a single ordered transcript.

use base64::Engine as _;
use std::sync::{Arc, Mutex};

use crate::audio_decode::decode_audio_to_pcm;
use crate::state::{AppState, TranscriptionResult};
use crate::system_audio;
use crate::whisper::{merge_transcription_results, transcribe_audio_inner};

#[tauri::command]
pub fn is_system_audio_supported() -> bool {
    system_audio::backend().is_supported()
}

#[tauri::command]
pub async fn start_system_audio_capture(
    session_id: u64,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    log::info!("[system-audio] start_system_audio_capture called (session {session_id})");
    // The macOS backend blocks on a ScreenCaptureKit semaphore (up to 15s) and
    // Windows/Linux spawn capture threads. Run off the main thread so a slow or
    // hung start never freezes the UI ("recording did not start") — sync Tauri
    // commands execute on the event-loop thread.
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let backend = system_audio::backend();
        // Hold the AppState lock across the backend calls so a concurrent
        // rotate/stop (which check `active_meeting_session` under the same
        // lock) cannot interleave and steal this session's capture.
        let mut app_state = state.lock().map_err(|e| e.to_string())?;
        // Take ownership of the shared backend for this session and clear any
        // stale capture left running by an abandoned prior session (component
        // unmount, hot-reload, or a rotation error that never stopped). The
        // backend's stop_capture is idempotent on every platform, so this
        // doubles as the pre-flight cleanup the caller used to issue itself.
        backend.stop_capture();
        app_state.active_meeting_session = session_id;
        backend.start_capture()?;
        Ok("System audio capture started".to_string())
    })
    .await
    .map_err(|e| format!("[system-audio] start worker join error: {e}"))?
}

#[tauri::command]
pub async fn stop_system_audio_capture(
    session_id: u64,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    log::info!("[system-audio] stop_system_audio_capture called (session {session_id})");
    // stop_capture blocks on a stop semaphore (up to 5s on macOS); keep it off
    // the main thread for the same reason as start.
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let backend = system_audio::backend();
        // Only the session that currently owns the backend may stop it. A late
        // stop from an abandoned meeting must not kill the capture of the
        // meeting that replaced it. Hold the lock across the backend call to
        // close the check → stop TOCTOU against start/rotate.
        let app_state = state.lock().map_err(|e| e.to_string())?;
        if app_state.active_meeting_session != session_id {
            return Ok(format!(
                "stop ignored: session {session_id} is not the active meeting session"
            ));
        }
        backend.stop_capture();
        Ok("System audio capture stopped".to_string())
    })
    .await
    .map_err(|e| format!("[system-audio] stop worker join error: {e}"))?
}

/// Transcribe meeting audio: receives microphone audio from the frontend,
/// retrieves system audio captured in the background, transcribes each source
/// separately, and merges the segment timelines.
///
/// This avoids transferring large system audio buffers across the IPC boundary.
#[tauri::command]
pub fn transcribe_meeting_audio(
    mic_audio_data: Vec<f32>,
    initial_prompt: Option<String>,
    language: Option<String>,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<TranscriptionResult, String> {
    // Stop system audio capture and retrieve buffered samples
    let backend = system_audio::backend();
    backend.stop_capture();
    let system_audio_data = backend.drain();

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
pub fn clear_meeting_segment_buffers(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.meeting_system_audio_segments.clear();
    Ok("Meeting segment buffers cleared".to_string())
}

#[tauri::command]
pub async fn rotate_meeting_system_audio_segment(
    session_id: u64,
    segment_index: usize,
    restart_capture: bool,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    // Rotation runs at every segment boundary and calls blocking stop (+ start
    // when restarting). Keep it off the main thread so recording does not hitch.
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let backend = system_audio::backend();
        // Verify ownership and perform stop/drain/insert/restart while holding
        // the lock, so a stale rotation from an abandoned meeting can neither
        // stop the new meeting's live capture nor insert PCM at a colliding
        // (session, index) key. Bailing before any backend call is the whole
        // point — touching the singleton backend here is what corrupts state.
        let mut app_state = state.lock().map_err(|e| e.to_string())?;
        if app_state.active_meeting_session != session_id {
            return Ok(format!(
                "rotate ignored: session {session_id} is not the active meeting session"
            ));
        }
        backend.stop_capture();
        let segment = backend.drain();
        let sample_count = segment.len();
        app_state
            .meeting_system_audio_segments
            .insert((session_id, segment_index), segment);

        if restart_capture {
            backend.start_capture()?;
        }

        Ok(format!(
            "Stored system audio segment {segment_index} ({sample_count} samples) for session {session_id}"
        ))
    })
    .await
    .map_err(|e| format!("[meeting] rotate worker join error: {e}"))?
}

#[tauri::command]
pub async fn transcribe_meeting_segment_bytes(
    bytes: Vec<u8>,
    ext: String,
    use_system_audio: bool,
    initial_prompt: Option<String>,
    language: Option<String>,
    session_id: u64,
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
                .remove(&(session_id, segment_index))
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
pub fn transcribe_meeting_audio_b64(
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
    let backend = system_audio::backend();
    if use_system_audio {
        backend.stop_capture();
    }
    let system_audio_data = backend.drain();

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
