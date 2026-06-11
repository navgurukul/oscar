import { invoke } from "@tauri-apps/api/core";

// ── Type mirrors of Rust enums (kebab-case to match #[serde] rename) ─────────

export type WhisperModelVariant =
  | "tiny"
  | "base"
  | "small"
  | "medium"
  | "large-v3-turbo"
  | "large-v3-turbo-q5_0"
  // Oriserve Hindi2Hinglish fine-tunes — romanized Latin output, selected only
  // for the "hi-en" transcription language (see hardware.rs::recommend_for_language).
  | "hindi2hinglish-apex"
  | "hindi2hinglish-prime";

export type WhisperRole = "dictation" | "minutes";

export type ModelPreset = "auto" | "fast" | "balanced" | "best";

export type GpuBackend = "none" | "metal" | "cuda" | "vulkan";

export interface ModelSpec {
  variant: WhisperModelVariant;
  filename: string;
  url: string;
  sha256: string;
  sizeBytes: number;
  minRamGb: number;
  quality: number;
  supportsMultilingual: boolean;
}

export interface HardwareProfile {
  platform: string;
  ramGb: number;
  cpuCores: number;
  cpuBrand: string;
  gpuBackend: GpuBackend;
}

export interface ModelRecommendation {
  spec: ModelSpec;
  preset: ModelPreset;
  reason: string;
}

// ── Static fallback registry (mirrors models.rs) ─────────────────────────────
//
// Used for size estimates / labels before the backend has been polled. The
// authoritative copy lives in Rust — frontend never sets URL/filename, only
// reads them via `listWhisperModels()` or the recommendation command.

export const FALLBACK_MODELS: Record<WhisperModelVariant, ModelSpec> = {
  tiny: {
    variant: "tiny",
    filename: "ggml-tiny.bin",
    url: "https://djpsaiqyvjjg7.cloudfront.net/ggml-tiny.bin",
    sha256: "be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21",
    sizeBytes: 77_700_000,
    minRamGb: 2,
    quality: 1,
    supportsMultilingual: true,
  },
  base: {
    variant: "base",
    filename: "ggml-base.bin",
    url: "https://djpsaiqyvjjg7.cloudfront.net/ggml-base.bin",
    sha256: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe",
    sizeBytes: 147_900_000,
    minRamGb: 2,
    quality: 2,
    supportsMultilingual: true,
  },
  small: {
    variant: "small",
    filename: "ggml-small.bin",
    url: "https://djpsaiqyvjjg7.cloudfront.net/ggml-small.bin",
    sha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
    sizeBytes: 487_600_000,
    minRamGb: 4,
    quality: 3,
    supportsMultilingual: true,
  },
  medium: {
    variant: "medium",
    filename: "ggml-medium.bin",
    url: "https://djpsaiqyvjjg7.cloudfront.net/ggml-medium.bin",
    sha256: "6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208",
    sizeBytes: 1_530_000_000,
    minRamGb: 6,
    quality: 4,
    supportsMultilingual: true,
  },
  "large-v3-turbo-q5_0": {
    variant: "large-v3-turbo-q5_0",
    filename: "ggml-large-v3-turbo-q5_0.bin",
    url: "https://djpsaiqyvjjg7.cloudfront.net/ggml-large-v3-turbo-q5_0.bin",
    sha256: "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2",
    sizeBytes: 574_000_000,
    minRamGb: 4,
    quality: 5,
    supportsMultilingual: true,
  },
  "large-v3-turbo": {
    variant: "large-v3-turbo",
    filename: "ggml-large-v3-turbo.bin",
    url: "https://djpsaiqyvjjg7.cloudfront.net/ggml-large-v3-turbo.bin",
    sha256: "07617879c4a257c3e119b7cc5f8ab95146811f9e59933abefebbd1f4da6b8037",
    sizeBytes: 1_620_000_000,
    minRamGb: 8,
    quality: 6,
    supportsMultilingual: true,
  },
  // Oriserve Hindi2Hinglish q5_0 fine-tunes. Values mirror models.rs exactly.
  "hindi2hinglish-apex": {
    variant: "hindi2hinglish-apex",
    filename: "ggml-hindi2hinglish-apex-q5_0.bin",
    url: "https://djpsaiqyvjjg7.cloudfront.net/ggml-hindi2hinglish-apex-q5_0.bin",
    sha256: "9d877151b15cec1feb9110cfbc0a3162cf377bcc0ab1935174226f461cf60f13",
    sizeBytes: 574_041_195,
    minRamGb: 4,
    quality: 5,
    supportsMultilingual: true,
  },
  "hindi2hinglish-prime": {
    variant: "hindi2hinglish-prime",
    filename: "ggml-hindi2hinglish-prime-q5_0.bin",
    url: "https://djpsaiqyvjjg7.cloudfront.net/ggml-hindi2hinglish-prime-q5_0.bin",
    sha256: "ccd4e5e48de189f9be887007f96744cb51a3ee086d97ab8787b132f94055fda3",
    sizeBytes: 1_081_140_203,
    minRamGb: 6,
    quality: 6,
    supportsMultilingual: true,
  },
};

export function relativeModelPath(variant: WhisperModelVariant): string {
  return `.oscar/models/${FALLBACK_MODELS[variant].filename}`;
}

export function variantFromFilename(
  filename: string,
): WhisperModelVariant | null {
  const entry = (Object.values(FALLBACK_MODELS) as ModelSpec[]).find(
    (m) => m.filename === filename,
  );
  return entry ? entry.variant : null;
}

export function formatModelSize(bytes: number): string {
  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  }
  return `${Math.round(bytes / 1_000_000)} MB`;
}

export function modelDisplayName(variant: WhisperModelVariant): string {
  switch (variant) {
    case "tiny":
      return "Tiny";
    case "base":
      return "Base";
    case "small":
      return "Small";
    case "medium":
      return "Medium";
    case "large-v3-turbo-q5_0":
      return "Turbo";
    case "large-v3-turbo":
      return "Turbo HD";
    case "hindi2hinglish-apex":
      return "Hinglish Fast";
    case "hindi2hinglish-prime":
      return "Hinglish HD";
  }
}

// ── Backend command wrappers ─────────────────────────────────────────────────

export async function detectHardware(): Promise<HardwareProfile> {
  return invoke<HardwareProfile>("detect_hardware");
}

export async function recommendWhisperModel(
  role: WhisperRole,
  preset: ModelPreset,
  // Transcription language code (e.g. "hi-en"). Routes Hinglish to the
  // Oriserve models; omitted/other languages use the hardware-only ladder.
  language?: string,
): Promise<ModelRecommendation> {
  return invoke<ModelRecommendation>("recommend_whisper_model", {
    role,
    preset,
    language: language ?? null,
  });
}

export async function listWhisperModels(): Promise<ModelSpec[]> {
  return invoke<ModelSpec[]>("list_whisper_models");
}
