//! Whisper model lifecycle (download, load, warm) and core transcription
//! pipeline shared between dictation and meeting flows.

use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex, OnceLock};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::events::{DownloadProgress, OscarEvent};
use crate::hardware::HardwareProfile;
use crate::state::{
    AppState, TranscriptSegmentResult, TranscriptSpeaker, TranscriptionPerf, TranscriptionResult,
};

/// Cached hardware profile — detection is cheap but we still want a single
/// source of truth for things like `whisper_thread_count` across all
/// transcription calls in a session.
fn hardware_profile() -> &'static HardwareProfile {
    static PROFILE: OnceLock<HardwareProfile> = OnceLock::new();
    PROFILE.get_or_init(HardwareProfile::detect)
}

#[tauri::command]
pub async fn download_whisper_model(
    url: String,
    path: String,
    sha256: Option<String>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    use tokio::io::AsyncWriteExt;

    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Atomic write: stream to `{path}.partial`, fsync, then rename. Crash or
    // network drop leaves only the .partial sidecar — the final path is never
    // half-written, so the existence check in JS doubles as a validity check.
    let partial_path = format!("{}.partial", path);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(1800))
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

    let mut file = tokio::fs::File::create(&partial_path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    let mut hasher = sha256.as_ref().map(|_| Sha256::new());
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut last_emit_pct: u8 = 0;

    use futures_util::StreamExt;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Failed to read chunk: {}", e))?;

        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write file: {}", e))?;

        if let Some(h) = hasher.as_mut() {
            h.update(&chunk);
        }

        downloaded += chunk.len() as u64;

        let percentage = if total_size > 0 {
            ((downloaded as f64 / total_size as f64) * 100.0) as u8
        } else {
            0
        };

        // Throttle emit to whole-percent changes — avoids flooding the
        // webview IPC channel on fast networks.
        if percentage != last_emit_pct {
            last_emit_pct = percentage;
            OscarEvent::DownloadProgress(DownloadProgress {
                downloaded,
                total: total_size,
                percentage,
            })
            .dispatch(&app);
        }
    }

    file.flush().await.map_err(|e| format!("Failed to flush file: {}", e))?;
    file.sync_all()
        .await
        .map_err(|e| format!("Failed to fsync file: {}", e))?;
    drop(file);

    if let (Some(expected), Some(h)) = (sha256.as_ref(), hasher) {
        let actual = format!("{:x}", h.finalize());
        if !actual.eq_ignore_ascii_case(expected) {
            let _ = std::fs::remove_file(&partial_path);
            return Err(format!(
                "Checksum mismatch: expected {}, got {}",
                expected, actual
            ));
        }
    }

    std::fs::rename(&partial_path, &path)
        .map_err(|e| format!("Failed to finalise download: {}", e))?;

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
    let already_loaded = {
        let app_state = state.lock().map_err(|e| e.to_string())?;
        app_state.whisper_context.is_some()
            && app_state.loaded_model_path.as_deref() == Some(path)
    };

    if already_loaded {
        log::info!(
            "[whisper] Model already loaded (role={} path={})",
            role,
            path,
        );
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
    app_state.whisper_context = Some(Arc::new(context));
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
    let context = {
        let locked = state.lock().map_err(|e| e.to_string())?;
        locked
            .whisper_context
            .as_ref()
            .ok_or_else(|| "Whisper model not loaded".to_string())?
            .clone()
    };

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("en"));
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_n_threads(hardware_profile().whisper_thread_count());

    let mut whisper_state = context.create_state().map_err(|e| e.to_string())?;
    let silence = vec![0.0f32; 16_000];
    whisper_state
        .full(params, &silence)
        .map_err(|e| e.to_string())?;

    Ok("Whisper runtime warmed".to_string())
}

/// Known Whisper hallucination phrases that surface on silence, music,
/// background noise, or cross-talk. Match on lowercased trimmed segment.
const HALLUCINATION_PHRASES: &[&str] = &[
    "thank you.",
    "thank you",
    "thanks for watching.",
    "thanks for watching",
    "thanks for watching!",
    "subscribe to the channel.",
    "please subscribe.",
    "please subscribe to the channel.",
    "you",
    "...",
    "bye.",
    "bye",
    "bye!",
    "i'm not going to read the text",
    "i'm not going to read the text.",
    "ruins fat is here!",
    "ruins fat is here",
];

/// Audio duration (seconds) at or below which a segment is treated as a
/// short intentional utterance — e.g. a single-word dictation like "yes",
/// "bye", "you". The phrase-list match is suppressed in this range so user
/// speech is not silently dropped as a silence-hallucination.
const SHORT_UTTERANCE_SECS: f32 = 2.5;

/// `no_speech_probability` ceiling below which Whisper is confident the
/// segment contains speech. Combined with `SHORT_UTTERANCE_SECS`, this
/// distinguishes a deliberate one-word dictation from idle-silence noise.
const SHORT_UTTERANCE_CONFIDENT_NO_SPEECH: f32 = 0.2;

/// Mark a Whisper segment as a likely hallucination so the caller can drop it
/// before downstream summarization sees it. We are deliberately conservative:
/// only flag clear-cut noise patterns (stock phrases, repetition loops,
/// wrong-script-for-target-language) rather than anything ambiguous.
fn is_hallucination_segment(
    trimmed: &str,
    language: &str,
    segment_secs: f32,
    no_speech_prob: f32,
) -> bool {
    let lower = trimmed.to_lowercase();

    // Short, confidently-voiced segments are almost always intentional
    // single-word dictation ("you", "bye", "thanks") rather than silence
    // hallucinations. Skip the exact phrase-list match in that case; the
    // structural drops (repetition, foreign-loop, wrong-script, pure-punct)
    // still apply below.
    let trust_short_utterance = segment_secs > 0.0
        && segment_secs <= SHORT_UTTERANCE_SECS
        && no_speech_prob <= SHORT_UTTERANCE_CONFIDENT_NO_SPEECH;

    if !trust_short_utterance
        && HALLUCINATION_PHRASES.iter().any(|phrase| lower == *phrase)
    {
        return true;
    }

    let condensed: String = lower
        .chars()
        .filter(|c| !c.is_whitespace() && !c.is_ascii_punctuation())
        .collect();

    let words: Vec<&str> = lower.split_whitespace().collect();

    // `foreign foreign foreign ...` style — Whisper's "unknown language" loop.
    if !words.is_empty() && words.iter().all(|w| *w == "foreign") {
        return true;
    }

    // Same single word repeated 4+ times with no other content.
    if words.len() >= 4 {
        let first = words[0];
        if words.iter().all(|w| *w == first) {
            return true;
        }
    }

    // CJK / Hangul / Hiragana / Katakana segments in a non-CJK target
    // language are almost always hallucinations on Indian English / Hinglish
    // meetings.
    let mut script_counts = (0usize, 0usize); // (cjk_like, latin_like)
    for c in trimmed.chars() {
        let code = c as u32;
        if (0xAC00..=0xD7AF).contains(&code) // Hangul
            || (0x3040..=0x30FF).contains(&code) // Hiragana / Katakana
            || (0x4E00..=0x9FFF).contains(&code) // CJK Unified
            || (0x3400..=0x4DBF).contains(&code) // CJK Ext A
        {
            script_counts.0 += 1;
        } else if c.is_ascii_alphabetic() {
            script_counts.1 += 1;
        }
    }
    let target_is_cjk = matches!(language, "ko" | "ja" | "zh");
    if !target_is_cjk && script_counts.0 > 0 && script_counts.0 >= script_counts.1 {
        return true;
    }

    // Pure-punctuation segments slipped through Whisper's filter occasionally.
    if !condensed.is_empty() && condensed.chars().all(|c| !c.is_alphanumeric()) {
        return true;
    }

    false
}

/// Frame-level VAD pre-filter. Returns a speech-only audio buffer with
/// interior silence stripped, plus a flag indicating whether any speech
/// survived. Replaces the old whole-clip energy gate — interior gaps no
/// longer feed silent samples into Whisper, which is the strongest
/// mitigation for silence-triggered hallucinations.
fn filter_speech(audio_data: &[f32]) -> (Vec<f32>, bool) {
    if audio_data.is_empty() {
        return (Vec::new(), false);
    }
    let mut detector = crate::vad::make_default();
    let filtered = crate::vad::keep_speech_only(audio_data, detector.as_mut());
    let has_speech = !filtered.is_empty();
    (filtered, has_speech)
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
    // Wall-clock for the whole inner call — caller already times the IPC
    // boundary in JS, so this lets us separate "Rust work" from "IPC + JSON".
    let t_inner_start = std::time::Instant::now();

    if audio_data.is_empty() {
        return Ok(TranscriptionResult {
            text: String::new(),
            error: None,
            segments: None,
            perf: None,
        });
    }

    let t_vad = std::time::Instant::now();
    let (speech_audio, has_speech) = filter_speech(audio_data);
    let vad_ms = t_vad.elapsed().as_millis() as u64;
    if !has_speech {
        log::info!(
            "[whisper] Skipping inference — VAD found no speech in {} samples",
            audio_data.len()
        );
        return Ok(TranscriptionResult {
            text: String::new(),
            error: None,
            segments: None,
            perf: None,
        });
    }

    log::info!(
        "[whisper] transcribe_audio_inner — input {} samples ({:.1}s) → speech {} samples ({:.1}s), lang={:?}",
        audio_data.len(),
        audio_data.len() as f64 / 16000.0,
        speech_audio.len(),
        speech_audio.len() as f64 / 16000.0,
        language
    );
    let speech_samples = speech_audio.len() as u64;
    let audio_data: &[f32] = &speech_audio;

    // Lock briefly to grab a handle to the shared context, then release —
    // otherwise the AppState mutex is held for the whole inference (multiple
    // seconds on long meetings) and other commands stall behind it.
    let t_state = std::time::Instant::now();
    let context = {
        let locked = app_state.lock().map_err(|e| e.to_string())?;
        locked
            .whisper_context
            .as_ref()
            .ok_or_else(|| {
                log::error!("[whisper] Model not loaded when transcribe was called");
                "Whisper model not loaded".to_string()
            })?
            .clone()
    };

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    // "auto" or None → let Whisper auto-detect the language from the audio
    let lang = language.filter(|l| *l != "auto" && !l.is_empty());
    params.set_language(lang);
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_n_threads(hardware_profile().whisper_thread_count());

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
    let state_create_ms = t_state.elapsed().as_millis() as u64;

    log::info!("[whisper] Running inference...");
    let t_infer = std::time::Instant::now();
    state.full(params, audio_data).map_err(|e| {
        log::error!("[whisper] Inference failed: {}", e);
        e.to_string()
    })?;
    let inference_ms = t_infer.elapsed().as_millis() as u64;

    let t_segments = std::time::Instant::now();
    let num_segments = state.full_n_segments();
    log::info!("[whisper] Inference complete — {} segments", num_segments);
    let mut full_text = String::new();
    let mut structured_segments = Vec::new();
    let mut dropped_no_speech = 0usize;
    let mut dropped_hallucination = 0usize;

    // Tightened from whisper.cpp default 0.6 → 0.5 to cut hallucinations on
    // borderline-silent or cross-talk segments more aggressively. Whisper's
    // per-segment estimate is noisy on tiny segments, so single-word
    // utterances get a relaxed threshold — VAD upstream already vouched
    // that speech is present.
    const NO_SPEECH_THRESHOLD: f32 = 0.5;
    const SHORT_SEGMENT_NO_SPEECH_THRESHOLD: f32 = 0.8;
    let effective_language = lang.unwrap_or("");

    for i in 0..num_segments {
        if let Some(segment) = state.get_segment(i) {
            let no_speech_prob = segment.no_speech_probability();
            // Whisper timestamps are in centiseconds.
            let segment_secs =
                (segment.end_timestamp() - segment.start_timestamp()) as f32 / 100.0;
            let no_speech_ceiling = if segment_secs > 0.0
                && segment_secs <= SHORT_UTTERANCE_SECS
            {
                SHORT_SEGMENT_NO_SPEECH_THRESHOLD
            } else {
                NO_SPEECH_THRESHOLD
            };
            if no_speech_prob > no_speech_ceiling {
                dropped_no_speech += 1;
                log::debug!(
                    "[whisper] Dropping segment {} (no_speech_prob={:.2}, ceiling={:.2}, secs={:.2})",
                    i,
                    no_speech_prob,
                    no_speech_ceiling,
                    segment_secs
                );
                continue;
            }

            if let Ok(text) = segment.to_str() {
                let trimmed = text.trim();
                if trimmed.is_empty() {
                    continue;
                }

                if is_hallucination_segment(
                    trimmed,
                    effective_language,
                    segment_secs,
                    no_speech_prob,
                ) {
                    dropped_hallucination += 1;
                    log::debug!(
                        "[whisper] Dropping hallucination segment {}: {:?} (secs={:.2}, no_speech={:.2})",
                        i,
                        trimmed,
                        segment_secs,
                        no_speech_prob,
                    );
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
    if dropped_hallucination > 0 {
        log::info!(
            "[whisper] Dropped {} hallucination segment(s)",
            dropped_hallucination,
        );
    }

    let segments_ms = t_segments.elapsed().as_millis() as u64;
    let total_ms = t_inner_start.elapsed().as_millis() as u64;

    let result_len = full_text.trim().len();
    log::info!("[whisper] Transcription result: {} chars", result_len);
    log::info!(
        "[whisper-perf] vad={}ms state={}ms infer={}ms segments={}ms total={}ms raw_seg={} drop_no_speech={} drop_hallu={} speech_samples={}",
        vad_ms,
        state_create_ms,
        inference_ms,
        segments_ms,
        total_ms,
        num_segments,
        dropped_no_speech,
        dropped_hallucination,
        speech_samples,
    );

    let perf = TranscriptionPerf {
        vad_ms,
        state_create_ms,
        inference_ms,
        segments_ms,
        total_ms,
        speech_samples,
        raw_segments: num_segments as u32,
        dropped_no_speech: dropped_no_speech as u32,
        dropped_hallucination: dropped_hallucination as u32,
    };

    Ok(TranscriptionResult {
        text: full_text.trim().to_string(),
        error: None,
        segments: if structured_segments.is_empty() {
            None
        } else {
            Some(structured_segments)
        },
        perf: Some(perf),
    })
}

pub(crate) fn merge_transcription_results(
    results: Vec<TranscriptionResult>,
) -> TranscriptionResult {
    let mut segments = Vec::new();
    let mut text_parts = Vec::new();
    // Aggregate per-chunk perf so meeting flow reports stage totals across all
    // segments. Dictation only ever produces a single inner result, so this
    // path is a no-op there.
    let mut perf_acc = TranscriptionPerf::default();
    let mut perf_any = false;

    for result in results {
        let trimmed_text = result.text.trim();
        if !trimmed_text.is_empty() {
            text_parts.push(trimmed_text.to_string());
        }

        if let Some(mut result_segments) = result.segments {
            segments.append(&mut result_segments);
        }

        if let Some(p) = result.perf {
            perf_any = true;
            perf_acc.vad_ms += p.vad_ms;
            perf_acc.state_create_ms += p.state_create_ms;
            perf_acc.inference_ms += p.inference_ms;
            perf_acc.segments_ms += p.segments_ms;
            perf_acc.total_ms += p.total_ms;
            perf_acc.speech_samples += p.speech_samples;
            perf_acc.raw_segments += p.raw_segments;
            perf_acc.dropped_no_speech += p.dropped_no_speech;
            perf_acc.dropped_hallucination += p.dropped_hallucination;
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
        perf: if perf_any { Some(perf_acc) } else { None },
    }
}

#[tauri::command]
pub async fn transcribe_audio(
    audio_data: Vec<f32>,
    initial_prompt: Option<String>,
    language: Option<String>,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<TranscriptionResult, String> {
    // Whisper inference is CPU-bound and can run for many seconds on large
    // models. Run on the blocking thread pool so the Tauri IPC executor stays
    // free to service UI commands (otherwise the webview locks up on long
    // transcripts).
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        transcribe_audio_inner(
            &audio_data,
            initial_prompt.as_deref(),
            language.as_deref(),
            &state,
            None,
        )
    })
    .await
    .map_err(|e| format!("Transcription task failed: {}", e))?
}
