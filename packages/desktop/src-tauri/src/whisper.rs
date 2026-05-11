//! Whisper model lifecycle (download, load, warm) and core transcription
//! pipeline shared between dictation and meeting flows.

use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::state::{
    AppState, TranscriptSegmentResult, TranscriptSpeaker, TranscriptionResult,
};

#[derive(Clone, Serialize)]
struct DownloadProgress {
    downloaded: u64,
    total: u64,
    percentage: u8,
}

#[tauri::command]
pub async fn download_whisper_model(
    url: String,
    path: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    use tokio::io::AsyncWriteExt;

    // Create parent directories if they don't exist
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Download the file using async client with progress
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
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

        let _ = app.emit(
            "download-progress",
            DownloadProgress {
                downloaded,
                total: total_size,
                percentage,
            },
        );
    }

    file.flush().await.map_err(|e| format!("Failed to flush file: {}", e))?;

    Ok(format!("Downloaded {} bytes to {}", downloaded, path))
}

#[tauri::command]
pub fn load_whisper_model(
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
pub fn ensure_whisper_model_loaded(
    role: String,
    path: String,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    load_whisper_model_inner(&role, &path, state.inner())
}

#[tauri::command]
pub fn warm_whisper_runtime(
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

/// Shared transcription logic used by both `transcribe_audio` and
/// `transcribe_meeting_audio`.
pub(crate) fn transcribe_audio_inner(
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

    // Inject personal dictionary words as Whisper initial prompt
    if let Some(prompt) = initial_prompt {
        if !prompt.is_empty() {
            log::debug!("[whisper] Using initial prompt ({} chars)", prompt.len());
            params.set_initial_prompt(prompt);
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
    let mut dropped_no_speech = 0usize;

    // Whisper emits a per-segment probability that the segment contains no
    // speech. Drop segments above this threshold to suppress stock-phrase
    // hallucinations on silent audio ("you", "Thank you.", "...").
    // 0.6 matches whisper.cpp's default no_speech_thold.
    const NO_SPEECH_THRESHOLD: f32 = 0.6;

    for i in 0..num_segments {
        if let Some(segment) = state.get_segment(i) {
            let no_speech_prob = segment.no_speech_probability();
            if no_speech_prob > NO_SPEECH_THRESHOLD {
                dropped_no_speech += 1;
                log::debug!(
                    "[whisper] Dropping segment {} (no_speech_prob={:.2})",
                    i,
                    no_speech_prob
                );
                continue;
            }

            if let Ok(text) = segment.to_str() {
                let trimmed = text.trim();
                if trimmed.is_empty() {
                    continue;
                }

                full_text.push_str(trimmed);
                full_text.push(' ');

                if let Some(segment_source) = source {
                    structured_segments.push(TranscriptSegmentResult {
                        text: trimmed.to_string(),
                        start_ms: segment.start_timestamp() * 10,
                        end_ms: segment.end_timestamp() * 10,
                        speaker: TranscriptSpeaker {
                            source: segment_source.to_string(),
                            diarization_label: None,
                        },
                    });
                }
            }
        }
    }

    if dropped_no_speech > 0 {
        log::info!(
            "[whisper] Dropped {} segment(s) above no_speech threshold {:.2}",
            dropped_no_speech,
            NO_SPEECH_THRESHOLD
        );
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

pub(crate) fn merge_transcription_results(
    results: Vec<TranscriptionResult>,
) -> TranscriptionResult {
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
pub fn transcribe_audio(
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
