//! Voice Activity Detection pre-filter for Whisper input.
//!
//! Strips silent regions from a buffered audio clip before feeding to
//! Whisper. Cuts inference cost and silence-triggered hallucinations.
//!
//! Two backends, selected via trait:
//! - `EnergyVad` (default): frame-level RMS gate w/ hangover. No deps.
//! - `SileroVad` (feature `silero-vad`): ONNX Silero model. Better quality,
//!   pulls in `ort` runtime (binary size hit).

#[cfg(feature = "silero-vad")]
use std::sync::Mutex;

/// Required sample rate. Whisper runs at 16kHz; upstream resamples to this.
#[allow(dead_code)]
pub const SAMPLE_RATE: u32 = 16_000;

/// Frame size for VAD decisions. 32ms @ 16kHz = 512 samples — matches
/// Silero's preferred window and is cheap for the energy detector too.
pub const FRAME_SAMPLES: usize = 512;

/// Padding around detected speech regions (samples). Keeps short word-final
/// consonants and breath that the detector might otherwise clip.
pub const HANGOVER_FRAMES: usize = 6; // ~192ms

pub trait VoiceActivityDetector: Send {
    /// Returns true if the given frame (`FRAME_SAMPLES` samples) contains
    /// speech. Implementations may be stateful (model carries hidden state).
    fn frame_is_speech(&mut self, frame: &[f32]) -> bool;

    /// Reset any per-clip state. Called once at the start of a new buffer.
    fn reset(&mut self) {}
}

/// Energy-based VAD: classifies a frame as speech when its RMS exceeds an
/// empirical floor. Cheap, deterministic, no external deps.
pub struct EnergyVad {
    threshold: f32,
}

impl EnergyVad {
    pub fn new() -> Self {
        Self { threshold: 0.003 }
    }
}

impl Default for EnergyVad {
    fn default() -> Self {
        Self::new()
    }
}

impl VoiceActivityDetector for EnergyVad {
    fn frame_is_speech(&mut self, frame: &[f32]) -> bool {
        if frame.is_empty() {
            return false;
        }
        let sum_squares: f64 = frame
            .iter()
            .map(|sample| (*sample as f64) * (*sample as f64))
            .sum();
        let rms = (sum_squares / frame.len() as f64).sqrt() as f32;
        rms > self.threshold
    }
}

#[cfg(feature = "silero-vad")]
pub struct SileroVad {
    detector: Mutex<voice_activity_detector::VoiceActivityDetector>,
    threshold: f32,
}

#[cfg(feature = "silero-vad")]
impl SileroVad {
    pub fn new() -> Result<Self, String> {
        let detector = voice_activity_detector::VoiceActivityDetector::builder()
            .sample_rate(SAMPLE_RATE as i64)
            .chunk_size(FRAME_SAMPLES)
            .build()
            .map_err(|e| format!("Silero init failed: {}", e))?;
        Ok(Self {
            detector: Mutex::new(detector),
            threshold: 0.5,
        })
    }
}

#[cfg(feature = "silero-vad")]
impl VoiceActivityDetector for SileroVad {
    fn frame_is_speech(&mut self, frame: &[f32]) -> bool {
        if frame.len() != FRAME_SAMPLES {
            return EnergyVad::new().frame_is_speech(frame);
        }
        match self.detector.lock() {
            Ok(mut det) => {
                let prob = det.predict(frame.iter().copied());
                prob >= self.threshold
            }
            Err(_) => false,
        }
    }

    fn reset(&mut self) {
        if let Ok(mut det) = self.detector.lock() {
            det.reset();
        }
    }
}

/// Build the active VAD backend. Silero when feature-enabled and init
/// succeeds; otherwise the energy fallback.
pub fn make_default() -> Box<dyn VoiceActivityDetector> {
    #[cfg(feature = "silero-vad")]
    {
        if let Ok(silero) = SileroVad::new() {
            log::info!("[vad] Using Silero VAD");
            return Box::new(silero);
        }
        log::warn!("[vad] Silero init failed, falling back to energy VAD");
    }
    log::info!("[vad] Using energy VAD");
    Box::new(EnergyVad::new())
}

/// Keep only the speech regions of `audio`, padded by `HANGOVER_FRAMES`
/// frames on each side. Returns the concatenated speech samples.
///
/// Returns the input untouched when fewer than one frame is available.
pub fn keep_speech_only(
    audio: &[f32],
    detector: &mut dyn VoiceActivityDetector,
) -> Vec<f32> {
    if audio.len() < FRAME_SAMPLES {
        return audio.to_vec();
    }

    detector.reset();

    let frame_count = audio.len() / FRAME_SAMPLES;
    let mut speech_flags = Vec::with_capacity(frame_count);

    for i in 0..frame_count {
        let start = i * FRAME_SAMPLES;
        let frame = &audio[start..start + FRAME_SAMPLES];
        speech_flags.push(detector.frame_is_speech(frame));
    }

    // Apply hangover: any frame within HANGOVER_FRAMES of a speech frame
    // is also kept. Avoids clipping word-edges and breath.
    let mut kept = vec![false; frame_count];
    for (i, &is_speech) in speech_flags.iter().enumerate() {
        if is_speech {
            let start = i.saturating_sub(HANGOVER_FRAMES);
            let end = (i + HANGOVER_FRAMES + 1).min(frame_count);
            for slot in kept.iter_mut().take(end).skip(start) {
                *slot = true;
            }
        }
    }

    let speech_frame_count = kept.iter().filter(|&&k| k).count();
    if speech_frame_count == 0 {
        return Vec::new();
    }

    let mut out = Vec::with_capacity(speech_frame_count * FRAME_SAMPLES);
    for (i, &keep) in kept.iter().enumerate() {
        if keep {
            let start = i * FRAME_SAMPLES;
            out.extend_from_slice(&audio[start..start + FRAME_SAMPLES]);
        }
    }

    // Append the tail (samples that didn't form a full frame). If preceded
    // by speech, keep them; otherwise drop.
    let tail_start = frame_count * FRAME_SAMPLES;
    if tail_start < audio.len() && kept.last().copied().unwrap_or(false) {
        out.extend_from_slice(&audio[tail_start..]);
    }

    out
}
