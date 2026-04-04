fn main() {
    // Metal framework requires explicit linking for ggml-metal (used by whisper-rs).
    // MACOSX_DEPLOYMENT_TARGET must be ≥12.0 because the Metal backend uses
    // ___isPlatformVersionAtLeast which is only available from macOS 12 onwards.
    // The env var is set by CI; the linker flag here ensures local dev builds also
    // link at the correct version.
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rustc-link-arg=-mmacosx-version-min=12.0");
        println!("cargo:rustc-link-framework=Metal");
        println!("cargo:rustc-link-framework=Foundation");
        println!("cargo:rustc-link-framework=CoreGraphics");
    }

    tauri_build::build()
}
