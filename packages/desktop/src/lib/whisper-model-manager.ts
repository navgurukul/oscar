import { invoke } from "@tauri-apps/api/core";
import { homeDir } from "@tauri-apps/api/path";

import {
  FALLBACK_MODELS,
  type ModelSpec,
  recommendWhisperModel,
  variantFromFilename,
  type ModelPreset,
  type ModelRecommendation,
  type WhisperModelVariant,
  type WhisperRole,
} from "./whisper-models";

// Legacy filenames that we should clean up when they're no longer the active
// model — older builds shipped these by default.
const LEGACY_FILENAMES = ["ggml-base.bin"];

export interface InstalledModel {
  variant: WhisperModelVariant;
  path: string;
  spec: ModelSpec;
}

interface ModelFileValidation {
  valid: boolean;
  reason?: string | null;
  sizeBytes: number;
  expectedSizeBytes?: number | null;
}

export async function absolutePathFor(
  variant: WhisperModelVariant,
): Promise<string> {
  return invoke<string>("get_model_path", {
    filename: FALLBACK_MODELS[variant].filename,
  });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return await invoke<boolean>("check_file_exists", { path });
  } catch {
    return false;
  }
}

async function isUsableModelFile(path: string): Promise<boolean> {
  try {
    const validation = await invoke<ModelFileValidation>(
      "validate_whisper_model_file",
      { path },
    );
    return validation.valid;
  } catch {
    return false;
  }
}

/// List the variants currently installed in `$HOME/.oscar/models`.
export async function listInstalledModels(): Promise<InstalledModel[]> {
  const installed: InstalledModel[] = [];
  for (const spec of Object.values(FALLBACK_MODELS)) {
    const path = await absolutePathFor(spec.variant);
    if (await isUsableModelFile(path)) {
      installed.push({ variant: spec.variant, path, spec });
    }
  }
  return installed;
}

/// Resolve the on-disk path for a specific variant. Returns `null` if not
/// installed. Also probes common legacy locations so users who installed via
/// previous Oscar builds don't need to re-download.
export async function resolveInstalledPath(
  variant: WhisperModelVariant,
): Promise<string | null> {
  const primary = await absolutePathFor(variant);
  if (await isUsableModelFile(primary)) return primary;

  const home = await homeDir();
  const filename = FALLBACK_MODELS[variant].filename;
  const candidates = [
    `${home}/.whisper/${filename}`,
    `./models/${filename}`,
    `/usr/local/share/whisper/${filename}`,
  ];
  for (const candidate of candidates) {
    if (await isUsableModelFile(candidate)) return candidate;
  }
  return null;
}

/// Pick the best already-installed variant for a role. Used as a graceful
/// fallback when the preferred variant isn't on disk yet.
export async function pickInstalledFallback(
  role: WhisperRole,
): Promise<InstalledModel | null> {
  const installed = await listInstalledModels();
  if (installed.length === 0) return null;
  installed.sort((a, b) => {
    if (role === "dictation") {
      // Dictation prefers latency: lower quality (= smaller) first.
      return a.spec.quality - b.spec.quality;
    }
    // Minutes prefers accuracy: higher quality first.
    return b.spec.quality - a.spec.quality;
  });
  return installed[0];
}

export interface ResolvedModel {
  variant: WhisperModelVariant;
  path: string;
  spec: ModelSpec;
  recommendation: ModelRecommendation;
  fallbackUsed: boolean;
}

/// Resolve which model to load for a given role, factoring in user preset,
/// hardware recommendation, and what's already on disk.
///
/// Returns `path = null` when nothing is installed yet and a download is
/// required. Callers should kick off `downloadModel(recommendation.spec)`
/// in that case.
export async function resolveModelForRole(
  role: WhisperRole,
  preset: ModelPreset,
): Promise<
  | { recommendation: ModelRecommendation; resolved: ResolvedModel | null }
> {
  const recommendation = await recommendWhisperModel(role, preset);
  const preferredPath = await resolveInstalledPath(
    recommendation.spec.variant,
  );

  if (preferredPath) {
    return {
      recommendation,
      resolved: {
        variant: recommendation.spec.variant,
        path: preferredPath,
        spec: recommendation.spec,
        recommendation,
        fallbackUsed: false,
      },
    };
  }

  const fallback = await pickInstalledFallback(role);
  if (fallback) {
    return {
      recommendation,
      resolved: {
        variant: fallback.variant,
        path: fallback.path,
        spec: fallback.spec,
        recommendation,
        fallbackUsed: true,
      },
    };
  }

  return { recommendation, resolved: null };
}

export async function downloadModel(
  spec: ModelSpec,
  sha256?: string,
): Promise<string> {
  const path = await absolutePathFor(spec.variant);
  await invoke("download_whisper_model", {
    url: spec.url,
    path,
    sha256: sha256 ?? null,
  });
  return path;
}

export async function ensureLoaded(
  role: WhisperRole,
  path: string,
): Promise<void> {
  await invoke("ensure_whisper_model_loaded", { role, path });
}

export async function deleteInstalledModel(
  variant: WhisperModelVariant,
): Promise<void> {
  const path = await absolutePathFor(variant);
  if (await fileExists(path)) {
    await invoke("delete_file", { path });
  }
}

/// Best-effort cleanup of model files that are no longer the active choice
/// for any role. Never throws — disk reclamation is opportunistic.
export async function cleanupLegacyModels(
  keepVariants: WhisperModelVariant[],
): Promise<void> {
  const keepSet = new Set(keepVariants);

  for (const filename of LEGACY_FILENAMES) {
    const variant = variantFromFilename(filename);
    if (variant && keepSet.has(variant)) continue;
    const path = await invoke<string>("get_model_path", { filename });
    if (await fileExists(path)) {
      try {
        await invoke("delete_file", { path });
      } catch {
        /* ignore */
      }
    }
  }
}
