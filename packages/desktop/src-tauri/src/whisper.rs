//! Whisper model lifecycle (download, load, warm) and core transcription
//! pipeline shared between dictation and meeting flows.

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::events::{DownloadProgress, DownloadRetry, OscarEvent};
use crate::hardware::HardwareProfile;
use crate::state::{
    AppState, TranscriptSegmentResult, TranscriptSpeaker, TranscriptionPerf, TranscriptionResult,
};

// ── Download tuning ─────────────────────────────────────────────────────────
//
// These constants are picked for the realistic worst case: ~500 MB pulled
// from HuggingFace over a slow / lossy connection (rural India hotel WiFi,
// metered tether, etc.). The old code had a single 30-minute wall-clock
// timeout and no retry — one TCP hiccup near the end meant a full restart.
//
// Per-chunk timeout is the primary stall detector; the total client timeout
// is a safety net for the pathological "TCP keeps holding the connection
// open but bytes never arrive" case where keep-alive masks a dead socket.

const MAX_ATTEMPTS: u32 = 4;
const CHUNK_TIMEOUT: Duration = Duration::from_secs(30);
const TOTAL_TIMEOUT: Duration = Duration::from_secs(3600);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
const RETRY_DELAYS: [Duration; 3] = [
    Duration::from_secs(2),
    Duration::from_secs(8),
    Duration::from_secs(30),
];
const MIN_VALID_MODEL_BYTES: u64 = 1_000_000;
const GGML_MAGIC: u32 = 0x67676d6c;
const MODEL_SIZE_TOLERANCE_PERCENT: u64 = 25;

/// Classified download outcome — drives the retry decision. A `Permanent`
/// error (4xx that's not 416, bad checksum on a fresh download, filesystem
/// failure on a path we control) means "stop retrying, the next attempt will
/// fail the same way." `Transient` means "wait then retry."
#[derive(Debug)]
enum DownloadError {
    Transient(String),
    Permanent(String),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelFileValidation {
    valid: bool,
    reason: Option<String>,
    size_bytes: u64,
    expected_size_bytes: Option<u64>,
}

impl ModelFileValidation {
    fn valid(size_bytes: u64, expected_size_bytes: Option<u64>) -> Self {
        Self {
            valid: true,
            reason: None,
            size_bytes,
            expected_size_bytes,
        }
    }

    fn invalid(
        reason: impl Into<String>,
        size_bytes: u64,
        expected_size_bytes: Option<u64>,
    ) -> Self {
        Self {
            valid: false,
            reason: Some(reason.into()),
            size_bytes,
            expected_size_bytes,
        }
    }
}

/// Cached hardware profile — detection is cheap but we still want a single
/// source of truth for things like `whisper_thread_count` across all
/// transcription calls in a session.
fn hardware_profile() -> &'static HardwareProfile {
    static PROFILE: OnceLock<HardwareProfile> = OnceLock::new();
    PROFILE.get_or_init(HardwareProfile::detect)
}

fn expected_model_size(path: &Path) -> Option<u64> {
    let filename = path.file_name()?.to_str()?;
    crate::models::WhisperModelVariant::all()
        .iter()
        .find_map(|variant| {
            let spec = variant.spec();
            (spec.filename == filename).then_some(spec.size_bytes)
        })
}

fn validate_whisper_model_file_inner(path: &str) -> ModelFileValidation {
    let path = Path::new(path);
    let expected_size_bytes = expected_model_size(path);

    if !path.exists() {
        return ModelFileValidation::invalid("model file missing", 0, expected_size_bytes);
    }

    let metadata = match path.metadata() {
        Ok(metadata) => metadata,
        Err(err) => {
            return ModelFileValidation::invalid(
                format!("model metadata unreadable: {}", err),
                0,
                expected_size_bytes,
            );
        }
    };

    if !metadata.is_file() {
        return ModelFileValidation::invalid(
            "model path is not a file",
            metadata.len(),
            expected_size_bytes,
        );
    }

    let size_bytes = metadata.len();
    if size_bytes < MIN_VALID_MODEL_BYTES {
        return ModelFileValidation::invalid(
            format!("model file too small: {} bytes", size_bytes),
            size_bytes,
            expected_size_bytes,
        );
    }

    if let Some(expected) = expected_size_bytes {
        let lower = expected.saturating_mul(100 - MODEL_SIZE_TOLERANCE_PERCENT) / 100;
        let upper = expected.saturating_mul(100 + MODEL_SIZE_TOLERANCE_PERCENT) / 100;
        if size_bytes < lower || size_bytes > upper {
            return ModelFileValidation::invalid(
                format!(
                    "model size mismatch: got {} bytes, expected about {} bytes",
                    size_bytes, expected
                ),
                size_bytes,
                expected_size_bytes,
            );
        }
    }

    let mut file = match std::fs::File::open(path) {
        Ok(file) => file,
        Err(err) => {
            return ModelFileValidation::invalid(
                format!("model file unreadable: {}", err),
                size_bytes,
                expected_size_bytes,
            );
        }
    };
    let mut magic = [0u8; 4];
    if let Err(err) = file.read_exact(&mut magic) {
        return ModelFileValidation::invalid(
            format!("model header unreadable: {}", err),
            size_bytes,
            expected_size_bytes,
        );
    }

    if u32::from_le_bytes(magic) != GGML_MAGIC {
        return ModelFileValidation::invalid(
            "model header is not a Whisper GGML file",
            size_bytes,
            expected_size_bytes,
        );
    }

    ModelFileValidation::valid(size_bytes, expected_size_bytes)
}

#[tauri::command]
pub fn validate_whisper_model_file(path: String) -> ModelFileValidation {
    validate_whisper_model_file_inner(&path)
}

#[tauri::command]
pub async fn download_whisper_model(
    url: String,
    path: String,
    sha256: Option<String>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Idempotent — if the final file already landed from a previous run,
    // skip the network entirely. Callers (App.tsx, SetupScreen) check
    // installed paths before calling, but a concurrent invocation could
    // race past that check.
    if std::path::Path::new(&path).exists() {
        let validation = validate_whisper_model_file_inner(&path);
        if validation.valid {
            return Ok(format!("Model already present at {}", path));
        }

        log::warn!(
            "[whisper] Removing invalid existing model at {}: {}",
            path,
            validation.reason.as_deref().unwrap_or("failed validation")
        );
        std::fs::remove_file(&path)
            .map_err(|e| format!("Failed to remove invalid model: {}", e))?;
    }

    // Atomic write: stream to `{path}.partial`, fsync, then rename. Crash or
    // network drop leaves only the .partial sidecar — the final path is never
    // half-written. The partial also survives across retries so a failed
    // attempt resumes from the last byte rather than starting from zero.
    let partial_path = format!("{}.partial", path);

    let client = reqwest::Client::builder()
        .timeout(TOTAL_TIMEOUT)
        .connect_timeout(CONNECT_TIMEOUT)
        .tcp_keepalive(Duration::from_secs(60))
        .pool_idle_timeout(Duration::from_secs(90))
        .user_agent("Mozilla/5.0 (compatible; Oscar/1.0)")
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let mut last_error: Option<String> = None;

    for attempt in 1..=MAX_ATTEMPTS {
        log::info!(
            "[whisper] Download attempt {}/{} for {}",
            attempt,
            MAX_ATTEMPTS,
            url
        );

        match attempt_download(&client, &url, &partial_path, sha256.as_deref(), &app).await {
            Ok(downloaded) => {
                std::fs::rename(&partial_path, &path)
                    .map_err(|e| format!("Failed to finalise download: {}", e))?;
                let validation = validate_whisper_model_file_inner(&path);
                if !validation.valid {
                    let reason = validation
                        .reason
                        .unwrap_or_else(|| "failed validation".to_string());
                    let _ = std::fs::remove_file(&path);
                    return Err(format!("Downloaded model is invalid: {}", reason));
                }
                log::info!(
                    "[whisper] Download complete: {} bytes → {}",
                    downloaded,
                    path
                );
                return Ok(format!("Downloaded {} bytes to {}", downloaded, path));
            }
            Err(DownloadError::Permanent(msg)) => {
                let _ = std::fs::remove_file(&partial_path);
                log::error!("[whisper] Download failed permanently: {}", msg);
                return Err(msg);
            }
            Err(DownloadError::Transient(msg)) => {
                log::warn!(
                    "[whisper] Download attempt {}/{} failed transiently: {}",
                    attempt,
                    MAX_ATTEMPTS,
                    msg
                );
                last_error = Some(msg.clone());

                if attempt < MAX_ATTEMPTS {
                    let delay = RETRY_DELAYS[(attempt - 1) as usize];
                    OscarEvent::DownloadRetry(DownloadRetry {
                        attempt: attempt + 1,
                        max_attempts: MAX_ATTEMPTS,
                        delay_secs: delay.as_secs(),
                        reason: msg,
                    })
                    .dispatch(&app);
                    tokio::time::sleep(delay).await;
                }
            }
        }
    }

    Err(format!(
        "Download failed after {} attempts: {}",
        MAX_ATTEMPTS,
        last_error.unwrap_or_else(|| "unknown error".to_string())
    ))
}

/// One pass of the HTTP download. Resumes from `{partial_path}` if it exists
/// and the server honours `Range`; otherwise starts fresh. Returns the total
/// byte count on success, or a classified error so the caller can decide
/// whether to retry.
async fn attempt_download(
    client: &reqwest::Client,
    url: &str,
    partial_path: &str,
    sha256: Option<&str>,
    app: &tauri::AppHandle,
) -> Result<u64, DownloadError> {
    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    let existing_size = tokio::fs::metadata(partial_path)
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    let mut request = client.get(url);
    if existing_size > 0 {
        request = request.header(reqwest::header::RANGE, format!("bytes={}-", existing_size));
    }

    let response = request.send().await.map_err(classify_send_error)?;
    let status = response.status();

    // Decide whether this response actually resumes or starts over. A server
    // that ignores `Range` and returns 200 OK means we must restart from
    // byte 0, regardless of what's on disk.
    let resume = if existing_size > 0 {
        match status {
            reqwest::StatusCode::PARTIAL_CONTENT => true,
            reqwest::StatusCode::OK => false,
            reqwest::StatusCode::RANGE_NOT_SATISFIABLE => {
                // .partial is at-or-past the server's file size — likely
                // corrupt or stale. Wipe and let the retry start fresh.
                let _ = tokio::fs::remove_file(partial_path).await;
                return Err(DownloadError::Transient(
                    "Server rejected resume range (HTTP 416); restarting".to_string(),
                ));
            }
            s if s.is_server_error() => {
                return Err(DownloadError::Transient(format!(
                    "Server error on resume: HTTP {}",
                    s
                )));
            }
            s if s.is_client_error() => {
                return Err(DownloadError::Permanent(format!(
                    "Download failed: HTTP {}",
                    s
                )));
            }
            s => {
                return Err(DownloadError::Transient(format!(
                    "Unexpected status on resume: HTTP {}",
                    s
                )));
            }
        }
    } else {
        match status {
            reqwest::StatusCode::OK => false,
            s if s.is_server_error() => {
                return Err(DownloadError::Transient(format!(
                    "Server error: HTTP {}",
                    s
                )));
            }
            s if s.is_client_error() => {
                return Err(DownloadError::Permanent(format!(
                    "Download failed: HTTP {}",
                    s
                )));
            }
            s => {
                return Err(DownloadError::Transient(format!(
                    "Unexpected status: HTTP {}",
                    s
                )));
            }
        }
    };

    // total_size is the FULL file size for progress display. On a 206 the
    // Content-Length header reflects the *remaining* bytes, not the whole
    // file, so we parse the total out of Content-Range instead.
    let total_size = if resume {
        response
            .headers()
            .get(reqwest::header::CONTENT_RANGE)
            .and_then(|v| v.to_str().ok())
            .and_then(parse_content_range_total)
            .unwrap_or(0)
    } else {
        response.content_length().unwrap_or(0)
    };

    let (mut file, mut downloaded, mut hasher) = if resume {
        let file = tokio::fs::OpenOptions::new()
            .append(true)
            .open(partial_path)
            .await
            .map_err(|e| DownloadError::Transient(format!("Open partial: {}", e)))?;

        // Replay existing bytes through the hasher so the final digest covers
        // the whole file, not just the resumed tail. Skipped when no checksum
        // was requested (the common case from SetupScreen).
        let hasher = if sha256.is_some() {
            Some(rehash_partial(partial_path).await?)
        } else {
            None
        };

        (file, existing_size, hasher)
    } else {
        // Either no partial existed, or the server ignored our Range header.
        // Truncate any stale partial and start over.
        let file = tokio::fs::File::create(partial_path)
            .await
            .map_err(|e| DownloadError::Transient(format!("Create partial: {}", e)))?;
        let hasher = sha256.map(|_| Sha256::new());
        (file, 0u64, hasher)
    };

    let mut stream = response.bytes_stream();
    let mut last_emit_pct: u8 = if total_size > 0 {
        ((downloaded as f64 / total_size as f64) * 100.0) as u8
    } else {
        0
    };

    // Emit a progress event up front so the UI reflects the resumed offset
    // immediately rather than appearing to start at 0%.
    if downloaded > 0 && total_size > 0 {
        OscarEvent::DownloadProgress(DownloadProgress {
            downloaded,
            total: total_size,
            percentage: last_emit_pct,
        })
        .dispatch(app);
    }

    loop {
        // Per-chunk stall guard. reqwest's own timeout is wall-clock for the
        // entire request, which masks a stalled stream — we need to abort
        // any single chunk wait that exceeds CHUNK_TIMEOUT so the retry
        // loop can take over with a fresh connection.
        let next = match tokio::time::timeout(CHUNK_TIMEOUT, stream.next()).await {
            Ok(n) => n,
            Err(_) => {
                return Err(DownloadError::Transient(format!(
                    "No data received for {}s",
                    CHUNK_TIMEOUT.as_secs()
                )));
            }
        };

        let chunk = match next {
            Some(Ok(c)) => c,
            Some(Err(e)) => {
                return Err(DownloadError::Transient(format!("Read error: {}", e)));
            }
            None => break,
        };

        file.write_all(&chunk)
            .await
            .map_err(|e| DownloadError::Transient(format!("Write: {}", e)))?;

        if let Some(h) = hasher.as_mut() {
            h.update(&chunk);
        }

        downloaded += chunk.len() as u64;

        let pct = if total_size > 0 {
            ((downloaded as f64 / total_size as f64) * 100.0).min(100.0) as u8
        } else {
            0
        };

        // Throttle emit to whole-percent changes — avoids flooding the
        // webview IPC channel on fast networks.
        if pct != last_emit_pct {
            last_emit_pct = pct;
            OscarEvent::DownloadProgress(DownloadProgress {
                downloaded,
                total: total_size,
                percentage: pct,
            })
            .dispatch(app);
        }
    }

    file.flush()
        .await
        .map_err(|e| DownloadError::Transient(format!("Flush: {}", e)))?;
    file.sync_all()
        .await
        .map_err(|e| DownloadError::Transient(format!("Fsync: {}", e)))?;
    drop(file);

    // Guard against silently truncated downloads — Content-Length said N
    // but the connection closed at M < N. Treat as transient so the next
    // attempt resumes the tail.
    if total_size > 0 && downloaded != total_size {
        return Err(DownloadError::Transient(format!(
            "Incomplete download: {}/{} bytes",
            downloaded, total_size
        )));
    }

    if let (Some(expected), Some(h)) = (sha256, hasher) {
        let actual = format!("{:x}", h.finalize());
        if !actual.eq_ignore_ascii_case(expected) {
            let _ = std::fs::remove_file(partial_path);
            return Err(DownloadError::Permanent(format!(
                "Checksum mismatch: expected {}, got {}",
                expected, actual
            )));
        }
    }

    Ok(downloaded)
}

/// Stream the existing `.partial` through a fresh SHA256 so a resumed
/// download still produces a checksum over the whole file. Only called when
/// the caller requested checksum validation AND we're resuming.
async fn rehash_partial(partial_path: &str) -> Result<Sha256, DownloadError> {
    use tokio::io::AsyncReadExt;

    let mut file = tokio::fs::File::open(partial_path)
        .await
        .map_err(|e| DownloadError::Transient(format!("Re-open partial: {}", e)))?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let n = file
            .read(&mut buf)
            .await
            .map_err(|e| DownloadError::Transient(format!("Read partial: {}", e)))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hasher)
}

/// Map a reqwest send-phase error to our retry classification. Network /
/// timeout / connection errors are always transient; HTTP-status errors
/// follow the 4xx-permanent / 5xx-transient split.
fn classify_send_error(e: reqwest::Error) -> DownloadError {
    if e.is_timeout() || e.is_connect() || e.is_request() {
        return DownloadError::Transient(format!("Network error: {}", e));
    }
    if let Some(status) = e.status() {
        if status.is_server_error() {
            return DownloadError::Transient(format!("HTTP {}: {}", status, e));
        }
        if status.is_client_error() {
            return DownloadError::Permanent(format!("HTTP {}: {}", status, e));
        }
    }
    DownloadError::Transient(format!("Request error: {}", e))
}

/// Parse the total file size out of a `Content-Range: bytes A-B/TOTAL`
/// response header. Returns `None` when the server reports `*` (unknown).
fn parse_content_range_total(header: &str) -> Option<u64> {
    let slash_idx = header.rfind('/')?;
    let total_str = header[slash_idx + 1..].trim();
    if total_str == "*" {
        return None;
    }
    total_str.parse::<u64>().ok()
}

//Run on the blocking pool, same pattern as transcribe_audio below.
#[tauri::command]
pub async fn load_whisper_model(
    path: String,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        load_whisper_model_inner("dictation", &path, &state)
    })
    .await
    .map_err(|e| format!("Model load task failed: {}", e))?
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

    let validation = validate_whisper_model_file_inner(path);
    if !validation.valid {
        let reason = validation
            .reason
            .unwrap_or_else(|| "failed validation".to_string());
        log::error!("[whisper] Refusing to load invalid model: {}", reason);
        return Err(format!(
            "Whisper model file is invalid or incomplete: {}",
            reason
        ));
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
pub async fn ensure_whisper_model_loaded(
    role: String,
    path: String,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        load_whisper_model_inner(&role, &path, &state)
    })
    .await
    .map_err(|e| format!("Model load task failed: {}", e))?
}

//off the main thread for the same Not-Responding reason as the loads above.
#[tauri::command]
pub async fn warm_whisper_runtime(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || warm_whisper_runtime_inner(&state))
        .await
        .map_err(|e| format!("Warmup task failed: {}", e))?
}

fn warm_whisper_runtime_inner(state: &Arc<Mutex<AppState>>) -> Result<String, String> {
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

    // Wrong-script detection. Whisper emits stray foreign-script tokens on
    // silence / cross-talk (e.g. the Hebrew "אג" that surfaced in the meeting
    // that prompted this). For a Latin/Devanagari target (en, hi, Hinglish)
    // ANY unrelated script — CJK, Hangul, Kana, Hebrew, Arabic, Cyrillic,
    // Greek, Thai — is junk; Latin and Devanagari both count as "expected" so
    // real Hindi and English survive. Under "auto" (or any other target) we
    // stay conservative and drop only CJK — the original behaviour — so a
    // genuinely CJK auto-detected clip isn't wiped.
    let mut expected_chars = 0usize; // Latin + Devanagari
    let mut cjk_chars = 0usize;
    let mut foreign_chars = 0usize; // CJK + other non-Latin/Devanagari scripts
    for c in trimmed.chars() {
        let code = c as u32;
        let is_cjk = (0xAC00..=0xD7AF).contains(&code) // Hangul
            || (0x3040..=0x30FF).contains(&code) // Hiragana / Katakana
            || (0x4E00..=0x9FFF).contains(&code) // CJK Unified
            || (0x3400..=0x4DBF).contains(&code); // CJK Ext A
        let is_other_foreign = (0x0590..=0x05FF).contains(&code) // Hebrew
            || (0x0600..=0x06FF).contains(&code) // Arabic
            || (0x0400..=0x04FF).contains(&code) // Cyrillic
            || (0x0370..=0x03FF).contains(&code) // Greek
            || (0x0E00..=0x0E7F).contains(&code); // Thai
        if is_cjk {
            cjk_chars += 1;
            foreign_chars += 1;
        } else if is_other_foreign {
            foreign_chars += 1;
        } else if c.is_ascii_alphabetic() || (0x0900..=0x097F).contains(&code) {
            expected_chars += 1; // Latin or Devanagari
        }
    }
    let latin_deva_target = matches!(language, "en" | "hi");
    if latin_deva_target && foreign_chars > 0 && foreign_chars >= expected_chars {
        return true;
    }
    let target_is_cjk = matches!(language, "ko" | "ja" | "zh");
    if !target_is_cjk && cjk_chars > 0 && cjk_chars >= expected_chars {
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

    // ── Anti-repetition / anti-hallucination decoding controls ──────────────
    //
    // The dominant meeting failure mode is a decoder repetition loop: on
    // silence, cross-talk, or low-level room noise Whisper emits the same
    // phrase for dozens of consecutive segments (the "I will do all of my PR
    // marks" ×30 incident). Two mechanisms guard against it:
    //
    //   • no_context(true): each internal 30s window decodes WITHOUT the
    //     previous window's *decoded* text as context, so a loop that starts
    //     in one window cannot self-propagate forward across the clip. The
    //     app-level cross-chunk continuity hint still flows through
    //     initial_prompt below (we keep the transcript tail deduped upstream),
    //     so proper-noun carryover is preserved without the runaway feedback.
    //
    //   • Temperature fallback: when a window decodes as low-entropy
    //     (repetitive — high compression ratio) or low-confidence (gibberish),
    //     whisper.cpp re-decodes it at a higher temperature instead of
    //     committing the loop. We pin whisper.cpp's own defaults explicitly so
    //     the fallback can't silently switch off on a crate/upstream bump.
    //
    // suppress_nst drops non-speech tokens ([music], [noise], applause) that
    // otherwise surface as hallucinated text on noisy meeting audio.
    params.set_no_context(true);
    params.set_suppress_nst(true);
    params.set_temperature(0.0);
    params.set_temperature_inc(0.2);
    params.set_entropy_thold(2.4);
    params.set_logprob_thold(-1.0);
    params.set_no_speech_thold(0.6);

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
    // Consecutive-repetition collapse. A decoder loop emits the same phrase as
    // many adjacent segments from one source ("I will do all of my PR marks"
    // ×30). The per-segment hallucination check can't see it — each line is
    // individually well-formed — and the frontend overlap-dedup misses it
    // because mic/speaker loops arrive interleaved by timestamp. This runs
    // per-source (transcribe_audio_inner handles one source per call), so the
    // repeats ARE adjacent here and a normalized equality check collapses them.
    let mut dropped_repetition = 0usize;
    let mut last_kept_norm: Option<String> = None;

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

                // Collapse a run of identical adjacent segments to one. Compare
                // on a normalized form (lowercased, punctuation stripped) so
                // "PR marks." and "pr marks" count as the same loop iteration.
                let normalized: String = trimmed
                    .to_lowercase()
                    .chars()
                    .filter(|c| c.is_alphanumeric() || c.is_whitespace())
                    .collect::<String>()
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ");
                if !normalized.is_empty()
                    && last_kept_norm.as_deref() == Some(normalized.as_str())
                {
                    dropped_repetition += 1;
                    log::debug!(
                        "[whisper] Collapsing repeated segment {}: {:?}",
                        i,
                        trimmed
                    );
                    continue;
                }
                last_kept_norm = Some(normalized);

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

    if dropped_repetition > 0 {
        log::info!(
            "[whisper] Collapsed {} consecutive repeated segment(s)",
            dropped_repetition
        );
        // Fold into the hallucination tally so perf/telemetry reflects total
        // junk removed without a schema change across the Rust/TS boundary.
        dropped_hallucination += dropped_repetition;
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
