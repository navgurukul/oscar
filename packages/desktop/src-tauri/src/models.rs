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
}

impl WhisperModelVariant {
    pub fn all() -> &'static [WhisperModelVariant] {
        use WhisperModelVariant::*;
        &[Tiny, Base, Small, Medium, LargeV3TurboQ5, LargeV3Turbo]
    }

    pub fn from_filename(filename: &str) -> Option<Self> {
        use WhisperModelVariant::*;
        match filename {
            "ggml-tiny.bin" => Some(Tiny),
            "ggml-base.bin" => Some(Base),
            "ggml-small.bin" => Some(Small),
            "ggml-medium.bin" => Some(Medium),
            "ggml-large-v3-turbo.bin" => Some(LargeV3Turbo),
            "ggml-large-v3-turbo-q5_0.bin" => Some(LargeV3TurboQ5),
            _ => None,
        }
    }

    pub fn spec(&self) -> ModelSpec {
        use WhisperModelVariant::*;
        match self {
            Tiny => ModelSpec {
                variant: *self,
                filename: "ggml-tiny.bin",
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
                size_bytes: 77_700_000,
                min_ram_gb: 2,
                quality: 1,
                supports_multilingual: true,
            },
            Base => ModelSpec {
                variant: *self,
                filename: "ggml-base.bin",
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
                size_bytes: 147_900_000,
                min_ram_gb: 2,
                quality: 2,
                supports_multilingual: true,
            },
            Small => ModelSpec {
                variant: *self,
                filename: "ggml-small.bin",
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
                size_bytes: 487_600_000,
                min_ram_gb: 4,
                quality: 3,
                supports_multilingual: true,
            },
            Medium => ModelSpec {
                variant: *self,
                filename: "ggml-medium.bin",
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
                size_bytes: 1_530_000_000,
                min_ram_gb: 6,
                quality: 4,
                supports_multilingual: true,
            },
            LargeV3TurboQ5 => ModelSpec {
                variant: *self,
                filename: "ggml-large-v3-turbo-q5_0.bin",
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin",
                size_bytes: 574_000_000,
                min_ram_gb: 4,
                quality: 5,
                supports_multilingual: true,
            },
            LargeV3Turbo => ModelSpec {
                variant: *self,
                filename: "ggml-large-v3-turbo.bin",
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
                size_bytes: 1_620_000_000,
                min_ram_gb: 8,
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
    pub size_bytes: u64,
    pub min_ram_gb: u32,
    pub quality: u8,
    pub supports_multilingual: bool,
}

/// Relative path within `$HOME` where a given variant is stored.
pub fn relative_path_for(variant: WhisperModelVariant) -> String {
    format!(".oscar/models/{}", variant.spec().filename)
}
