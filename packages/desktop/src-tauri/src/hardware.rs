//! Hardware detection and model-tier recommendation.
//!
//! Detection is best-effort, cross-platform via `sysinfo`. GPU presence is
//! determined at compile-time from the feature flags whisper-rs was built
//! with (macOS = Metal, optional Windows = CUDA, optional Linux = Vulkan).
//! Recommendation is a pure function — easy to unit-test, easy to override.

use serde::{Deserialize, Serialize};
use sysinfo::System;

use crate::models::{ModelSpec, WhisperModelVariant};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum GpuBackend {
    None,
    Metal,
    Cuda,
    Vulkan,
}

impl GpuBackend {
    pub fn detect() -> Self {
        // Backend is baked in at build time. We pick the strongest enabled
        // backend for the current platform.
        #[cfg(all(target_os = "macos"))]
        {
            return GpuBackend::Metal;
        }
        #[cfg(all(target_os = "windows", feature = "cuda"))]
        {
            return GpuBackend::Cuda;
        }
        #[cfg(all(target_os = "linux", feature = "vulkan"))]
        {
            return GpuBackend::Vulkan;
        }
        #[allow(unreachable_code)]
        GpuBackend::None
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareProfile {
    pub platform: String,
    pub ram_gb: u32,
    pub cpu_cores: u32,
    pub cpu_brand: String,
    pub gpu_backend: GpuBackend,
}

impl HardwareProfile {
    pub fn detect() -> Self {
        let mut sys = System::new();
        sys.refresh_memory();
        sys.refresh_cpu_all();

        // sysinfo reports bytes; convert + round down to whole GB. Round down
        // so we never over-promise model fit on a borderline machine.
        let ram_gb = ((sys.total_memory() as f64) / 1024.0 / 1024.0 / 1024.0).floor() as u32;
        // Logical cores match what whisper-rs's CPU backend can actually use.
        let cpu_cores = num_cpus::get() as u32;
        let cpu_brand = sys
            .cpus()
            .first()
            .map(|c| c.brand().to_string())
            .unwrap_or_default();
        let platform = std::env::consts::OS.to_string();

        HardwareProfile {
            platform,
            ram_gb,
            cpu_cores,
            cpu_brand,
            gpu_backend: GpuBackend::detect(),
        }
    }

    pub fn has_gpu(&self) -> bool {
        self.gpu_backend != GpuBackend::None
    }

    /// CPU threads to hand to whisper-rs. Leave at least one core for the OS
    /// + UI thread so the app stays responsive during long inferences.
    pub fn whisper_thread_count(&self) -> i32 {
        let reserved = if self.cpu_cores >= 8 { 2 } else { 1 };
        ((self.cpu_cores as i32) - reserved).max(1)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WhisperRole {
    Dictation,
    Minutes,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ModelPreset {
    /// Hardware-derived recommendation.
    Auto,
    /// Smallest viable model — minimise download size and CPU load.
    Fast,
    /// Best accuracy that comfortably fits the hardware.
    Balanced,
    /// Highest-quality model the hardware can plausibly run.
    Best,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRecommendation {
    pub spec: ModelSpec,
    pub preset: ModelPreset,
    pub reason: String,
}

/// Pick a model variant for the given role + preset + hardware.
///
/// Rules — keep these readable; correctness over cleverness:
/// - Dictation values latency > accuracy. Cap at quantised turbo even on
///   beefy machines.
/// - Minutes values accuracy > latency. Push toward full turbo when RAM
///   and GPU allow.
/// - `min_ram_gb` is enforced strictly — never recommend a model that won't
///   fit, regardless of preset.
pub fn recommend(
    role: WhisperRole,
    preset: ModelPreset,
    profile: &HardwareProfile,
) -> ModelRecommendation {
    use WhisperModelVariant::*;

    let ram = profile.ram_gb;
    let cores = profile.cpu_cores;
    let gpu = profile.has_gpu();

    let candidates: &[WhisperModelVariant] = match (role, preset) {
        (_, ModelPreset::Fast) => &[Base, Tiny],
        (WhisperRole::Dictation, ModelPreset::Balanced) => &[Small, Base],
        (WhisperRole::Dictation, ModelPreset::Best) => &[LargeV3TurboQ5, Small, Base],
        (WhisperRole::Dictation, ModelPreset::Auto) => {
            if gpu && ram >= 8 {
                &[LargeV3TurboQ5, Small, Base]
            } else if ram >= 16 && cores >= 8 {
                &[Small, Base]
            } else if ram >= 8 && cores >= 4 {
                &[Small, Base]
            } else {
                &[Base, Tiny]
            }
        }
        (WhisperRole::Minutes, ModelPreset::Balanced) => &[LargeV3TurboQ5, Small],
        (WhisperRole::Minutes, ModelPreset::Best) => {
            if gpu && ram >= 8 {
                &[LargeV3Turbo, LargeV3TurboQ5, Small]
            } else {
                &[LargeV3TurboQ5, Small]
            }
        }
        (WhisperRole::Minutes, ModelPreset::Auto) => {
            if gpu && ram >= 16 {
                &[LargeV3Turbo, LargeV3TurboQ5, Small]
            } else if gpu && ram >= 8 {
                &[LargeV3TurboQ5, Small]
            } else if ram >= 16 && cores >= 8 {
                &[LargeV3TurboQ5, Small]
            } else if ram >= 8 && cores >= 4 {
                &[Small, Base]
            } else {
                &[Base, Tiny]
            }
        }
    };

    let chosen = candidates
        .iter()
        .find(|v| ram >= v.spec().min_ram_gb)
        .copied()
        .unwrap_or(Tiny);

    let spec = chosen.spec();
    let reason = build_reason(role, preset, profile, &spec);

    ModelRecommendation {
        spec,
        preset,
        reason,
    }
}

fn build_reason(
    role: WhisperRole,
    preset: ModelPreset,
    profile: &HardwareProfile,
    spec: &ModelSpec,
) -> String {
    let role_label = match role {
        WhisperRole::Dictation => "dictation",
        WhisperRole::Minutes => "meeting transcription",
    };
    let preset_label = match preset {
        ModelPreset::Auto => "auto",
        ModelPreset::Fast => "fast",
        ModelPreset::Balanced => "balanced",
        ModelPreset::Best => "best quality",
    };
    let gpu_label = match profile.gpu_backend {
        GpuBackend::None => "no GPU acceleration",
        GpuBackend::Metal => "Metal GPU",
        GpuBackend::Cuda => "CUDA GPU",
        GpuBackend::Vulkan => "Vulkan GPU",
    };

    format!(
        "{} on {} ({} GB RAM, {} cores, {}) → {} ({} MB)",
        preset_label,
        role_label,
        profile.ram_gb,
        profile.cpu_cores,
        gpu_label,
        spec.filename,
        spec.size_bytes / 1_000_000,
    )
}

// ── Tauri commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn detect_hardware() -> HardwareProfile {
    HardwareProfile::detect()
}

#[tauri::command]
pub fn recommend_whisper_model(
    role: WhisperRole,
    preset: ModelPreset,
) -> ModelRecommendation {
    let profile = HardwareProfile::detect();
    recommend(role, preset, &profile)
}

#[tauri::command]
pub fn list_whisper_models() -> Vec<ModelSpec> {
    WhisperModelVariant::all()
        .iter()
        .map(|v| v.spec())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn profile(ram: u32, cores: u32, gpu: GpuBackend) -> HardwareProfile {
        HardwareProfile {
            platform: "test".into(),
            ram_gb: ram,
            cpu_cores: cores,
            cpu_brand: "test".into(),
            gpu_backend: gpu,
        }
    }

    #[test]
    fn auto_dictation_low_end() {
        let p = profile(4, 2, GpuBackend::None);
        let r = recommend(WhisperRole::Dictation, ModelPreset::Auto, &p);
        assert_eq!(r.spec.variant, WhisperModelVariant::Base);
    }

    #[test]
    fn auto_dictation_mid() {
        let p = profile(8, 4, GpuBackend::None);
        let r = recommend(WhisperRole::Dictation, ModelPreset::Auto, &p);
        assert_eq!(r.spec.variant, WhisperModelVariant::Small);
    }

    #[test]
    fn auto_minutes_gpu_high_ram() {
        let p = profile(16, 8, GpuBackend::Metal);
        let r = recommend(WhisperRole::Minutes, ModelPreset::Auto, &p);
        assert_eq!(r.spec.variant, WhisperModelVariant::LargeV3Turbo);
    }

    #[test]
    fn fast_always_returns_small_model() {
        let p = profile(64, 16, GpuBackend::Metal);
        let r = recommend(WhisperRole::Minutes, ModelPreset::Fast, &p);
        assert_eq!(r.spec.variant, WhisperModelVariant::Base);
    }

    #[test]
    fn never_recommends_under_ram_floor() {
        let p = profile(2, 2, GpuBackend::None);
        let r = recommend(WhisperRole::Minutes, ModelPreset::Best, &p);
        assert!(p.ram_gb >= r.spec.min_ram_gb);
    }
}
