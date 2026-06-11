//! Whisper model registry.
//!
//! Central source-of-truth for every Whisper model variant the desktop app
//! can download/load. Adding a new model = one entry here. Hardware-aware
//! tier selection lives in `hardware.rs` and only references variants by
//! their `WhisperModelVariant` enum.

use serde::{Deserialize, Serialize};

// `Deserialize` on `WhisperModelVariant` lets the frontend pass it back as a
// command argument; `ModelSpec` is intentionally Serialize-only so its
// `&'static str` fields don't have to be owned `String`s.

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WhisperModelVariant {
    Tiny,
    Base,
    Small,
    Medium,
    #[serde(rename = "large-v3-turbo")]
    LargeV3Turbo,
    #[serde(rename = "large-v3-turbo-q5_0")]
    LargeV3TurboQ5,
    // Oriserve Whisper-Hindi2Hinglish fine-tunes (Apache-2.0). Specialised for
    // Hindi-dominant code-switching with *romanized Latin* output (e.g. "kal
    // meeting hai"), so they are NEVER part of the general accuracy ladder in
    // `hardware.rs::recommend` — they are selected only when the user picks the
    // "hi-en" (Hinglish) transcription language. Apex (0.8B) is the fast
    // dictation tier; Prime (1.55B) the higher-accuracy meetings tier.
    #[serde(rename = "hindi2hinglish-apex")]
    Hindi2HinglishApex,
    #[serde(rename = "hindi2hinglish-prime")]
    Hindi2HinglishPrime,
}

impl WhisperModelVariant {
    pub fn all() -> &'static [WhisperModelVariant] {
        use WhisperModelVariant::*;
        &[
            Tiny,
            Base,
            Small,
            Medium,
            LargeV3TurboQ5,
            LargeV3Turbo,
            Hindi2HinglishApex,
            Hindi2HinglishPrime,
        ]
    }

    pub fn spec(&self) -> ModelSpec {
        use WhisperModelVariant::*;
        match self {
            Tiny => ModelSpec {
                variant: *self,
                filename: "ggml-tiny.bin",
                url: "https://djpsaiqyvjjg7.cloudfront.net/ggml-tiny.bin",
                sha256: "be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21",
                size_bytes: 77_700_000,
                min_ram_gb: 2,
                quality: 1,
                supports_multilingual: true,
            },
            Base => ModelSpec {
                variant: *self,
                filename: "ggml-base.bin",
                url: "https://djpsaiqyvjjg7.cloudfront.net/ggml-base.bin",
                sha256: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe",
                size_bytes: 147_900_000,
                min_ram_gb: 2,
                quality: 2,
                supports_multilingual: true,
            },
            Small => ModelSpec {
                variant: *self,
                filename: "ggml-small.bin",
                url: "https://djpsaiqyvjjg7.cloudfront.net/ggml-small.bin",
                sha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
                size_bytes: 487_600_000,
                min_ram_gb: 4,
                quality: 3,
                supports_multilingual: true,
            },
            Medium => ModelSpec {
                variant: *self,
                filename: "ggml-medium.bin",
                url: "https://djpsaiqyvjjg7.cloudfront.net/ggml-medium.bin",
                sha256: "6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208",
                size_bytes: 1_530_000_000,
                min_ram_gb: 6,
                quality: 4,
                supports_multilingual: true,
            },
            LargeV3TurboQ5 => ModelSpec {
                variant: *self,
                filename: "ggml-large-v3-turbo-q5_0.bin",
                url: "https://djpsaiqyvjjg7.cloudfront.net/ggml-large-v3-turbo-q5_0.bin",
                sha256: "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2",
                size_bytes: 574_000_000,
                min_ram_gb: 4,
                quality: 5,
                supports_multilingual: true,
            },
            LargeV3Turbo => ModelSpec {
                variant: *self,
                filename: "ggml-large-v3-turbo.bin",
                url: "https://djpsaiqyvjjg7.cloudfront.net/ggml-large-v3-turbo.bin",
                sha256: "07617879c4a257c3e119b7cc5f8ab95146811f9e59933abefebbd1f4da6b8037",
                size_bytes: 1_620_000_000,
                min_ram_gb: 8,
                quality: 6,
                supports_multilingual: true,
            },
            // Oriserve Whisper-Hindi2Hinglish-Apex (0.8B, distilled large-v3),
            // q5_0. Fast tier for Hinglish dictation — same on-disk footprint as
            // the turbo q5 model. `quality` only orders the two Hinglish models
            // against each other (Apex < Prime); they are never compared against
            // the general ladder because the Hinglish path is language-gated.
            Hindi2HinglishApex => ModelSpec {
                variant: *self,
                filename: "ggml-hindi2hinglish-apex-q5_0.bin",
                url: "https://djpsaiqyvjjg7.cloudfront.net/ggml-hindi2hinglish-apex-q5_0.bin",
                sha256: "9d877151b15cec1feb9110cfbc0a3162cf377bcc0ab1935174226f461cf60f13",
                size_bytes: 574_041_195,
                min_ram_gb: 4,
                quality: 5,
                supports_multilingual: true,
            },
            // Oriserve Whisper-Hindi2Hinglish-Prime (1.55B, full large-v3), q5_0.
            // Higher-accuracy tier for Hinglish meetings.
            Hindi2HinglishPrime => ModelSpec {
                variant: *self,
                filename: "ggml-hindi2hinglish-prime-q5_0.bin",
                url: "https://djpsaiqyvjjg7.cloudfront.net/ggml-hindi2hinglish-prime-q5_0.bin",
                sha256: "ccd4e5e48de189f9be887007f96744cb51a3ee086d97ab8787b132f94055fda3",
                size_bytes: 1_081_140_203,
                min_ram_gb: 6,
                quality: 6,
                supports_multilingual: true,
            },
        }
    }
}

/// Static metadata for one Whisper model variant.
///
/// `quality` is an ordinal rank used only for tier comparison — higher means
/// better transcription accuracy. `min_ram_gb` is the conservative floor
/// (model weights + whisper-rs runtime + room for OS).
///
/// Only ever flows Rust → frontend, so we derive `Serialize` and skip
/// `Deserialize` (which would force the static string fields to be owned).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelSpec {
    pub variant: WhisperModelVariant,
    pub filename: &'static str,
    pub url: &'static str,
    pub sha256: &'static str,
    pub size_bytes: u64,
    pub min_ram_gb: u32,
    pub quality: u8,
    pub supports_multilingual: bool,
}
