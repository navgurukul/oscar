import { invoke } from "@tauri-apps/api/core";

import {
  FALLBACK_MODELS,
  type ModelSpec,
  recommendWhisperModel,
  type ModelPreset,
  type ModelRecommendation,
  type WhisperModelVariant,
  type WhisperRole,
} from "./whisper-models";

// Minimum model quality (ordinal from models.rs: tiny=1 … large-v3-turbo=6)
// that we accept as a substitute for a role's recommendation without kicking
// off an upgrade download. `small` (3) is the floor: any installed model at or
// above it is "good enough" so Minutes reuses the per-device shared model
// instead of pulling a second, larger one. The actual threshold is
// min(recommendedQuality, FLOOR) so a weak box (recommended base/tiny) still
// reuses what it has rather than chasing an unrunnable upgrade.
// (The Hinglish models share the ordinal scale — Apex=5, Prime=6 — but are
// partitioned off by isHinglishVariant, so they only ever substitute for each
// other, never across the general/Hinglish boundary.)
const REUSE_QUALITY_FLOOR = 3; // "small"

/// The Oriserve Hindi2Hinglish models emit romanized Hinglish and must only
/// ever serve the "hi-en" language. This guard is used on both sides of model
/// resolution: a general transcription must never substitute a Hinglish model,
/// and a Hinglish request must never substitute a general (Devanagari) model.
export function isHinglishVariant(variant: WhisperModelVariant): boolean {
  return (
    variant === "hindi2hinglish-apex" || variant === "hindi2hinglish-prime"
  );
}

/// Mirror of Rust `ModelStatus` (whisper.rs). `path` is for display/debug only
/// and is never passed back across IPC — Rust owns the registry (invariant I1).
export interface ModelStatus {
  variant: WhisperModelVariant;
  installed: boolean;
  valid: boolean;
  sizeBytes: number;
  expectedBytes: number;
  path: string;
}

export interface InstalledModel {
  variant: WhisperModelVariant;
  path: string;
  spec: ModelSpec;
}

/// Status of every registry variant in a single IPC round-trip (replaces the
/// frontend's old per-variant `get_model_path` + `validate` loop).
export async function listModelStatuses(): Promise<ModelStatus[]> {
  return invoke<ModelStatus[]>("list_model_statuses");
}

export async function getModelStatus(
  variant: WhisperModelVariant,
): Promise<ModelStatus> {
  return invoke<ModelStatus>("model_status", { variant });
}

/// List the variants currently installed AND valid in `$HOME/.oscar/models`.
export async function listInstalledModels(): Promise<InstalledModel[]> {
  const statuses = await listModelStatuses();
  return statuses
    .filter((s) => s.valid)
    .map((s) => ({
      variant: s.variant,
      path: s.path,
      spec: FALLBACK_MODELS[s.variant],
    }));
}

/// Resolve the on-disk path for a specific variant. Returns `null` when it is
/// not installed (or the file failed validation). Rust resolves the canonical
/// `~/.oscar/models` location — the legacy external-path probing is gone now
/// that Rust owns the bytes (invariant I4).
export async function resolveInstalledPath(
  variant: WhisperModelVariant,
): Promise<string | null> {
  const status = await getModelStatus(variant);
  return status.valid ? status.path : null;
}

/// Pick the best already-installed variant for a role. Used as a graceful
/// fallback when the preferred variant isn't on disk yet.
export async function pickInstalledFallback(
  role: WhisperRole,
  recommendedVariant: WhisperModelVariant,
): Promise<InstalledModel | null> {
  // Only substitute within the same family as the recommendation: a Hinglish
  // request falls back among installed Hinglish models, a general request among
  // installed general models. Never cross the boundary (see isHinglishVariant).
  const wantHinglish = isHinglishVariant(recommendedVariant);
  const installed = (await listInstalledModels()).filter(
    (m) => isHinglishVariant(m.variant) === wantHinglish,
  );
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
  /**
   * True when this resolved model is an acceptable substitute for the role's
   * recommendation — either it IS the recommendation, or (Auto only) it's an
   * installed model whose quality meets the reuse floor. Explicit presets
   * (Fast/Balanced/Best) are NEVER sufficient on a non-target install, so they
   * always converge to their exact recommended variant (I7). Callers use this
   * to decide whether a `fallbackUsed` model still warrants a download.
   */
  sufficient: boolean;
  /**
   * True when this is a stop-gap model serving NOW while the target variant
   * downloads in the background (then swaps at idle — WS-C rule 1/3).
   */
  interim: boolean;
  /**
   * True when a hi-en (Hinglish) request is being served by a general,
   * non-Hinglish model as an offline degrade. The UI shows the reduced-accuracy
   * notice; the proper model auto-upgrades once downloaded (I10).
   */
  crossFamilyInterim: boolean;
}

/// Resolve which model to load for a given role, factoring in user preset,
/// hardware recommendation, and what's already on disk.
///
/// Returns `resolved = null` when nothing is installed yet and a download is
/// required. Callers should kick off `downloadModel(recommendation.spec)`
/// in that case.
export async function resolveModelForRole(
  role: WhisperRole,
  preset: ModelPreset,
  // Transcription language — routes "hi-en" to the Oriserve Hinglish models.
  language?: string,
): Promise<{ recommendation: ModelRecommendation; resolved: ResolvedModel | null }> {
  const recommendation = await recommendWhisperModel(role, preset, language);
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
        sufficient: true,
        interim: false,
        crossFamilyInterim: false,
      },
    };
  }

  const fallback = await pickInstalledFallback(
    role,
    recommendation.spec.variant,
  );
  if (fallback) {
    // Auto: an installed same-family model is a sufficient substitute when its
    // quality clears min(recommendedQuality, floor) — this lets Minutes reuse
    // the shared dictation model instead of pulling a second, larger one.
    // Explicit presets (Fast/Balanced/Best) must CONVERGE to their exact
    // recommended variant, so a non-target install is never sufficient — it
    // serves only as an interim while the target downloads, then swaps at idle
    // (I7; fixes "Fast/Balanced are no-ops when a bigger model is installed").
    const isExplicit = preset !== "auto";
    const reuseThreshold = Math.min(
      recommendation.spec.quality,
      REUSE_QUALITY_FLOOR,
    );
    const sufficient = isExplicit
      ? false
      : fallback.spec.quality >= reuseThreshold;
    return {
      recommendation,
      resolved: {
        variant: fallback.variant,
        path: fallback.path,
        spec: fallback.spec,
        recommendation,
        fallbackUsed: true,
        sufficient,
        // A not-sufficient fallback is being served while the target downloads.
        interim: !sufficient,
        crossFamilyInterim: false,
      },
    };
  }

  return { recommendation, resolved: null };
}

/// Download a model variant. URL / filename / sha256 are resolved by Rust from
/// the registry (invariant I1) and the checksum is always verified there, so
/// the optional `_sha256` arg is accepted for call-site compatibility but
/// ignored. Resolves with the on-disk path.
export async function downloadModel(
  spec: ModelSpec,
  _sha256?: string,
): Promise<string> {
  return invoke<string>("download_model", { variant: spec.variant });
}

/// Download a model addressed directly by variant (no spec needed).
export async function downloadModelByVariant(
  variant: WhisperModelVariant,
): Promise<string> {
  return invoke<string>("download_model", { variant });
}

export interface LoadedModelInfo {
  variant: WhisperModelVariant;
  path: string;
}

/// Make `variant` the single resident model for a role. Rust resolves the path
/// and returns the now-loaded `{variant, path}`.
export async function ensureLoaded(
  role: WhisperRole,
  variant: WhisperModelVariant,
): Promise<LoadedModelInfo> {
  return invoke<LoadedModelInfo>("ensure_model_loaded", { role, variant });
}

/// Drop the resident context (frees RAM). Used by clear-data and delete-model.
export async function unloadModel(): Promise<void> {
  await invoke("unload_whisper_model");
}

/// Cancel every in-flight download (each deletes its own `.partial`).
export async function cancelModelDownloads(): Promise<void> {
  await invoke("cancel_model_downloads");
}

/// Wipe all model bytes under `~/.oscar/models` (final files, partials, legacy
/// phi files). Returns the number of bytes reclaimed.
export async function clearLocalModels(): Promise<{ bytesFreed: number }> {
  return invoke<{ bytesFreed: number }>("clear_local_models");
}

/// Delete one variant's files (unloads first if it is the resident model).
export async function deleteInstalledModel(
  variant: WhisperModelVariant,
): Promise<void> {
  await invoke("delete_model", { variant });
}

/// For a Hinglish target that failed to download (offline), pick the best
/// installed GENERAL model to serve as a cross-family interim. The Hinglish
/// one-way valve (I10): only hi-en may degrade to a general model, never the
/// reverse, and only as an offline stop-gap that auto-upgrades once the proper
/// model downloads. Returns null for a general target (no cross-family) or when
/// no general model is installed.
export async function pickCrossFamilyInterim(
  role: WhisperRole,
  targetVariant: WhisperModelVariant,
): Promise<InstalledModel | null> {
  if (!isHinglishVariant(targetVariant)) return null;
  const general = (await listInstalledModels()).filter(
    (m) => !isHinglishVariant(m.variant),
  );
  if (general.length === 0) return null;
  general.sort((a, b) =>
    role === "dictation"
      ? a.spec.quality - b.spec.quality
      : b.spec.quality - a.spec.quality,
  );
  return general[0];
}
