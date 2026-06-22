//! Audio container decoders for meeting-segment ingest.
//! - `decode_with_symphonia` handles MP4/AAC/Vorbis (anything symphonia probes).
//! - `decode_webm_opus` demuxes WebM via symphonia and decodes Opus frames.
//! - `resample_to_16k` normalizes mono PCM to whisper's expected 16 kHz.

/// Decode MP4/AAC or any symphonia-supported format to 16 kHz mono f32 PCM.
pub(crate) fn decode_with_symphonia(bytes: &[u8], ext: &str) -> Result<Vec<f32>, String> {
    use symphonia::core::audio::SampleBuffer;
    use symphonia::core::codecs::DecoderOptions;
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;
    use symphonia::default::get_probe;

    let cursor = std::io::Cursor::new(bytes.to_vec());
    let mss = MediaSourceStream::new(Box::new(cursor), Default::default());

    let mut hint = Hint::new();
    hint.with_extension(ext);

    let probe = get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| format!("[audio] probe failed: {e}"))?;

    let mut format = probe.format;

    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != symphonia::core::codecs::CODEC_TYPE_NULL)
        .ok_or("[audio] no supported audio track found")?;

    let track_id = track.id;
    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100) as usize;

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| format!("[audio] decoder init failed: {e}"))?;

    let mut raw_samples: Vec<f32> = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(symphonia::core::errors::Error::IoError(e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break
            }
            Err(symphonia::core::errors::Error::ResetRequired) => continue,
            Err(e) => return Err(format!("[audio] packet error: {e}")),
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(_) => continue,
        };

        let spec = *decoded.spec();
        let mut sample_buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
        sample_buf.copy_interleaved_ref(decoded);
        let samples = sample_buf.samples();
        let channels = spec.channels.count();

        // Downmix to mono
        if channels == 1 {
            raw_samples.extend_from_slice(samples);
        } else {
            let frames = samples.len() / channels;
            for f in 0..frames {
                let mut sum = 0f32;
                for c in 0..channels {
                    sum += samples[f * channels + c];
                }
                raw_samples.push(sum / channels as f32);
            }
        }
    }

    log::info!(
        "[audio] symphonia decoded {} mono samples @ {}Hz",
        raw_samples.len(),
        sample_rate
    );

    if sample_rate == 16000 {
        return Ok(raw_samples);
    }

    resample_to_16k(raw_samples, sample_rate)
}

/// Decode WebM/Opus by demuxing with symphonia (MKV container) and decoding
/// Opus frames with the `opus` crate.
pub(crate) fn decode_webm_opus(bytes: &[u8]) -> Result<Vec<f32>, String> {
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;
    use symphonia::default::get_probe;

    let cursor = std::io::Cursor::new(bytes.to_vec());
    let mss = MediaSourceStream::new(Box::new(cursor), Default::default());

    let mut hint = Hint::new();
    hint.with_extension("webm");

    let probe = get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| format!("[audio] webm probe failed: {e}"))?;

    let mut format = probe.format;

    // Find the first track (we'll treat it as Opus)
    let track = format
        .tracks()
        .first()
        .ok_or("[audio] no tracks in webm")?;

    let track_id = track.id;
    let sample_rate = track.codec_params.sample_rate.unwrap_or(48000) as usize;
    let channels = track.codec_params.channels.map(|c| c.count()).unwrap_or(1);

    log::info!(
        "[audio] webm track: rate={}, channels={}",
        sample_rate,
        channels
    );

    let mut decoder = opus::Decoder::new(
        sample_rate as u32,
        if channels == 1 {
            opus::Channels::Mono
        } else {
            opus::Channels::Stereo
        },
    )
    .map_err(|e| format!("[audio] opus decoder init: {e}"))?;

    let mut raw_samples: Vec<f32> = Vec::new();
    // Max frame size: 120ms @ 48kHz stereo
    let max_frame = (sample_rate / 1000 * 120) * channels;
    let mut frame_buf = vec![0f32; max_frame];

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(symphonia::core::errors::Error::IoError(e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break
            }
            Err(symphonia::core::errors::Error::ResetRequired) => continue,
            Err(e) => return Err(format!("[audio] webm packet error: {e}")),
        };

        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode_float(&packet.data, &mut frame_buf, false) {
            Ok(n) => {
                let decoded = &frame_buf[..n * channels];
                if channels == 1 {
                    raw_samples.extend_from_slice(decoded);
                } else {
                    let frames = decoded.len() / channels;
                    for f in 0..frames {
                        let mut sum = 0f32;
                        for c in 0..channels {
                            sum += decoded[f * channels + c];
                        }
                        raw_samples.push(sum / channels as f32);
                    }
                }
            }
            Err(e) => {
                log::warn!("[audio] opus decode error (skipping frame): {e}");
            }
        }
    }

    log::info!(
        "[audio] opus decoded {} mono samples @ {}Hz",
        raw_samples.len(),
        sample_rate
    );

    if sample_rate == 16000 {
        return Ok(raw_samples);
    }
    resample_to_16k(raw_samples, sample_rate)
}

/// Resample arbitrary-rate mono f32 PCM to 16 000 Hz using rubato FastFixedIn.
pub(crate) fn resample_to_16k(samples: Vec<f32>, source_rate: usize) -> Result<Vec<f32>, String> {
    use rubato::{FftFixedIn, Resampler};

    if source_rate == 16000 {
        return Ok(samples);
    }

    let chunk_size = 4096usize;
    let ratio = 16000.0 / source_rate as f64;
    let mut resampler = FftFixedIn::<f32>::new(source_rate, 16000, chunk_size, 2, 1)
        .map_err(|e| format!("[audio] resampler init: {e}"))?;

    let mut output: Vec<f32> = Vec::with_capacity((samples.len() as f64 * ratio) as usize + 1024);
    let mut pos = 0usize;

    while pos < samples.len() {
        let end = (pos + chunk_size).min(samples.len());
        let mut chunk: Vec<f32> = samples[pos..end].to_vec();
        // Pad last chunk if needed
        if chunk.len() < chunk_size {
            chunk.resize(chunk_size, 0.0);
        }
        let resampled = resampler
            .process(&[chunk], None)
            .map_err(|e| format!("[audio] resample chunk: {e}"))?;
        output.extend_from_slice(&resampled[0]);
        pos += chunk_size;
    }

    log::info!(
        "[audio] resampled {} → {} samples ({}Hz → 16kHz)",
        samples.len(),
        output.len(),
        source_rate
    );

    Ok(output)
}

/// Dispatch to the correct decoder based on file extension.
pub(crate) fn decode_audio_to_pcm(bytes: &[u8], ext: &str) -> Result<Vec<f32>, String> {
    match ext {
        "webm" => {
            // Try symphonia first (it may handle vorbis/opus in some builds),
            // fall back to our manual opus path on failure.
            decode_webm_opus(bytes).or_else(|_| decode_with_symphonia(bytes, ext))
        }
        _ => decode_with_symphonia(bytes, ext),
    }
}

/// Decode a recorded dictation blob (mp4/AAC or webm/opus) from the webview to
/// 16 kHz mono f32 PCM, in Rust via symphonia.
///
/// The dictation pill used to decode the MediaRecorder blob in the webview with
/// `AudioContext.decodeAudioData`, but WKWebView on macOS 26/27 throws
/// `EncodingError: Decoding failed` on the very mp4/AAC its own MediaRecorder
/// produces — so every dictation silently lost its audio (recording fine, decode
/// dead). This routes dictation through the same decoder the meeting-segment path
/// already uses (`decode_audio_to_pcm`), which is unaffected by the WebKit bug.
#[tauri::command]
pub async fn decode_audio_blob(bytes: Vec<u8>, ext: String) -> Result<Vec<f32>, String> {
    // Symphonia decode + Rubato resample of a whole recording is CPU-heavy and
    // can run for a noticeable fraction of a second on long clips — run it on
    // the blocking pool so the main thread stays responsive (I8).
    tauri::async_runtime::spawn_blocking(move || decode_audio_to_pcm(&bytes, &ext))
        .await
        .map_err(|e| format!("Audio decode task failed: {}", e))?
}
