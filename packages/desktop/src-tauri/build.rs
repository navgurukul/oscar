fn main() {
    // Metal framework requires explicit linking for ggml-metal (used by whisper-rs)
    // ___isPlatformVersionAtLeast symbol comes from libclang_rt via Metal framework
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rustc-env=MACOSX_DEPLOYMENT_TARGET=13.0");
        println!("cargo:rustc-link-framework=Metal");
        println!("cargo:rustc-link-framework=Foundation");
        println!("cargo:rustc-link-framework=CoreGraphics");
    }

    tauri_build::build()
}
