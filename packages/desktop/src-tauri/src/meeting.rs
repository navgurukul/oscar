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
pub async fn start_system_audio_capture() -> Result<String, String> {
    log::info!("[system-audio] start_system_audio_capture called");
    // The macOS backend blocks on a ScreenCaptureKit semaphore (up to 15s) and
    // Windows/Linux spawn capture threads. Run off the main thread so a slow or
    // hung start never freezes the UI ("recording did not start") — sync Tauri
    // commands execute on the event-loop thread.
    tauri::async_runtime::spawn_blocking(|| system_audio::backend().start_capture())
        .await
        .map_err(|e| format!("[system-audio] start worker join error: {e}"))??;
    Ok("System audio capture started".to_string())
}

#[tauri::command]
pub async fn stop_system_audio_capture() -> Result<String, String> {
    log::info!("[system-audio] stop_system_audio_capture called");
    // stop_capture blocks on a stop semaphore (up to 5s on macOS); keep it off
    // the main thread for the same reason as start.
    tauri::async_runtime::spawn_blocking(|| system_audio::backend().stop_capture())
        .await
        .map_err(|e| format!("[system-audio] stop worker join error: {e}"))?;
    Ok("System audio capture stopped".to_string())
}

/// Transcribe meeting audio: receives microphone audio from the frontend,
/// retrieves system audio captured in the background, transcribes each source
/// separately, and merges the segment timelines.
///
/// This avoids transferring large system audio buffers across the IPC boundary.
#[tauri::command]
pub async fn transcribe_meeting_audio(
    mic_audio_data: Vec<f32>,
    initial_prompt: Option<String>,
    language: Option<String>,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<TranscriptionResult, String> {
    let state = Arc::clone(&state);
    // Inference runs for many seconds on meeting-length audio; a sync command
    // would hold the main thread and freeze the UI ("Not Responding").
    tauri::async_runtime::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| format!("[meeting] transcribe worker join error: {e}"))?
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
    segment_index: usize,
    restart_capture: bool,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    // Rotation runs at every segment boundary and calls blocking stop (+ start
    // when restarting). Keep it off the main thread so recording does not hitch.
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let backend = system_audio::backend();
        backend.stop_capture();
        let segment = backend.drain();
        let sample_count = segment.len();

        {
            let mut app_state = state.lock().map_err(|e| e.to_string())?;
            app_state
                .meeting_system_audio_segments
                .insert(segment_index, segment);
        }

        if restart_capture {
            backend.start_capture()?;
        }

        Ok(format!(
            "Stored system audio segment {} ({} samples)",
            segment_index, sample_count
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
pub async fn transcribe_meeting_audio_b64(
    audio_b64: String,
    ext: String,
    use_system_audio: bool,
    initial_prompt: Option<String>,
    language: Option<String>,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<TranscriptionResult, String> {
    // base64 decode + symphonia decode + inference — all CPU-bound; keep off
    // the main thread so the UI stays responsive during long clips.
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| format!("[meeting_b64] transcribe worker join error: {e}"))?
}
