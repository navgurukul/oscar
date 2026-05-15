import { invoke } from "@tauri-apps/api/core";

// ── Type mirrors of Rust enums (kebab-case to match #[serde] rename) ─────────

export type WhisperModelVariant =
  | "tiny"
  | "base"
  | "small"
  | "medium"
  | "large-v3-turbo"
  | "large-v3-turbo-q5_0";

export type WhisperRole = "dictation" | "minutes";

export type ModelPreset = "auto" | "fast" | "balanced" | "best";

export type GpuBackend = "none" | "metal" | "cuda" | "vulkan";

export interface ModelSpec {
  variant: WhisperModelVariant;
  filename: string;
  url: string;
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
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
    sizeBytes: 77_700_000,
    minRamGb: 2,
    quality: 1,
    supportsMultilingual: true,
  },
  base: {
    variant: "base",
    filename: "ggml-base.bin",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
    sizeBytes: 147_900_000,
    minRamGb: 2,
    quality: 2,
    supportsMultilingual: true,
  },
  small: {
    variant: "small",
    filename: "ggml-small.bin",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
    sizeBytes: 487_600_000,
    minRamGb: 4,
    quality: 3,
    supportsMultilingual: true,
  },
  medium: {
    variant: "medium",
    filename: "ggml-medium.bin",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
    sizeBytes: 1_530_000_000,
    minRamGb: 6,
    quality: 4,
    supportsMultilingual: true,
  },
  "large-v3-turbo-q5_0": {
    variant: "large-v3-turbo-q5_0",
    filename: "ggml-large-v3-turbo-q5_0.bin",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin",
    sizeBytes: 574_000_000,
    minRamGb: 4,
    quality: 5,
    supportsMultilingual: true,
  },
  "large-v3-turbo": {
    variant: "large-v3-turbo",
    filename: "ggml-large-v3-turbo.bin",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
    sizeBytes: 1_620_000_000,
    minRamGb: 8,
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
  }
}

// ── Backend command wrappers ─────────────────────────────────────────────────

export async function detectHardware(): Promise<HardwareProfile> {
  return invoke<HardwareProfile>("detect_hardware");
}

export async function recommendWhisperModel(
  role: WhisperRole,
  preset: ModelPreset,
): Promise<ModelRecommendation> {
  return invoke<ModelRecommendation>("recommend_whisper_model", {
    role,
    preset,
  });
}

export async function listWhisperModels(): Promise<ModelSpec[]> {
  return invoke<ModelSpec[]>("list_whisper_models");
}
