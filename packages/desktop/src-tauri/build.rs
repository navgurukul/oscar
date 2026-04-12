fn main() {
    // Re-run this script when GPU SDK env vars change so feature recommendations stay current.
    println!("cargo:rerun-if-env-changed=CUDA_PATH");
    println!("cargo:rerun-if-env-changed=VULKAN_SDK");

    // Warn Windows users who have CUDA installed but aren't building with --features cuda.
    #[cfg(target_os = "windows")]
    if std::env::var("CUDA_PATH").is_ok() && !cfg!(feature = "cuda") {
        println!("cargo:warning=CUDA_PATH is set but the `cuda` feature is not enabled.");
        println!("cargo:warning=Rebuild with `--features cuda` for GPU-accelerated transcription.");
    }

    // Warn Linux users who have Vulkan SDK installed but aren't building with --features vulkan.
    #[cfg(target_os = "linux")]
    if std::env::var("VULKAN_SDK").is_ok() && !cfg!(feature = "vulkan") {
        println!("cargo:warning=VULKAN_SDK is set but the `vulkan` feature is not enabled.");
        println!("cargo:warning=Rebuild with `--features vulkan` for GPU-accelerated transcription.");
    }

    #[cfg(target_os = "macos")]
    {
        link_clang_runtime();
        compile_swift_system_audio();
        println!("cargo:rustc-link-framework=Metal");
        println!("cargo:rustc-link-framework=Foundation");
        println!("cargo:rustc-link-framework=CoreGraphics");
    }

    tauri_build::build()
}

/// Compile the Swift SystemAudioCapture helper into a static library and link it.
///
/// The Swift code uses ScreenCaptureKit (macOS 13.0+) to capture system audio
/// and exposes a C-compatible API via `@_cdecl`.
#[cfg(target_os = "macos")]
fn compile_swift_system_audio() {
    let out_dir = std::env::var("OUT_DIR").unwrap();
    let obj_path = format!("{}/SystemAudioCapture.o", out_dir);
    let lib_path = format!("{}/libSystemAudioCapture.a", out_dir);
    let module_cache_path = format!("{}/swift-module-cache", out_dir);
    let _ = std::fs::create_dir_all(&module_cache_path);

    // Detect target architecture from Cargo's TARGET env var
    let target = std::env::var("TARGET").unwrap_or_else(|_| "aarch64-apple-darwin".to_string());
    let arch = if target.contains("x86_64") {
        "x86_64"
    } else {
        "arm64"
    };
    let swift_target = format!("{}-apple-macosx12.0", arch);

    let mut swift_args = vec![
        "swift/SystemAudioCapture.swift".to_string(),
        "-emit-object".to_string(),
        "-parse-as-library".to_string(),
        "-whole-module-optimization".to_string(),
        "-module-name".to_string(),
        "SystemAudioCapture".to_string(),
        "-module-cache-path".to_string(),
        module_cache_path.clone(),
        "-target".to_string(),
        swift_target.clone(),
        "-o".to_string(),
        obj_path.clone(),
    ];

    if let Ok(output) = std::process::Command::new("xcrun")
        .args(["--show-sdk-path"])
        .output()
    {
        let sdk = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !sdk.is_empty() {
            swift_args.push("-sdk".to_string());
            swift_args.push(sdk);
        }
    }

    // Compile Swift → object file
    let status = std::process::Command::new("swiftc")
        .args(&swift_args)
        .status()
        .expect("Failed to run swiftc — is Xcode installed?");

    assert!(status.success(), "Swift compilation failed");

    // Create static library from the object file
    let status = std::process::Command::new("ar")
        .args(["rcs", &lib_path, &obj_path])
        .status()
        .expect("Failed to run ar");

    assert!(status.success(), "Failed to create static library");

    // Link the static library
    println!("cargo:rustc-link-search=native={}", out_dir);
    println!("cargo:rustc-link-lib=static=SystemAudioCapture");

    // Link ScreenCaptureKit weakly so the app still launches on macOS < 12.3
    // (the Swift code uses @available guards and returns "not supported" at runtime)
    println!("cargo:rustc-link-arg=-Wl,-weak_framework,ScreenCaptureKit");
    println!("cargo:rustc-link-framework=CoreMedia");

    // Link the Swift standard library (shipped with macOS since 10.14.4)
    println!("cargo:rustc-link-search=native=/usr/lib/swift");
    println!("cargo:rustc-link-lib=dylib=swiftCore");
    println!("cargo:rustc-link-lib=dylib=swiftFoundation");
    println!("cargo:rustc-link-lib=dylib=swiftDispatch");
    println!("cargo:rustc-link-lib=dylib=swiftObjectiveC");
    println!("cargo:rustc-link-lib=dylib=swiftCoreFoundation");

    // Also search the SDK's Swift lib directory (needed during development)
    if let Ok(output) = std::process::Command::new("xcrun")
        .args(["--show-sdk-path"])
        .output()
    {
        let sdk = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !sdk.is_empty() {
            println!("cargo:rustc-link-search=native={}/usr/lib/swift", sdk);
        }
    }

    // Also add the Xcode toolchain's lib/swift/macosx directory
    if let Ok(output) = std::process::Command::new("xcrun")
        .args(["--toolchain", "default", "--find", "swiftc"])
        .output()
    {
        let swiftc_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if let Some(toolchain_dir) = std::path::Path::new(&swiftc_path)
            .parent() // bin/
            .and_then(|p| p.parent())
        // toolchain/
        {
            let swift_lib = toolchain_dir.join("lib/swift/macosx");
            if swift_lib.exists() {
                println!("cargo:rustc-link-search=native={}", swift_lib.display());
            }
        }
    }

    println!("cargo:rerun-if-changed=swift/SystemAudioCapture.swift");
}

/// Link the clang compiler-rt builtins library.
///
/// whisper.cpp's Metal backend uses `@available()` checks which the compiler
/// lowers to calls to `___isPlatformVersionAtLeast`. That symbol lives in
/// `libclang_rt.osx.a` (the clang compiler-rt builtins library). Rust links
/// with `-nodefaultlibs`, so the compiler runtime is not included automatically
/// and the symbol would be undefined at link time. We locate and link it here.
#[cfg(target_os = "macos")]
fn link_clang_runtime() {
    // Try clang --print-runtime-dir first (available in clang 13+).
    if let Ok(output) = std::process::Command::new("clang")
        .arg("--print-runtime-dir")
        .output()
    {
        let dir = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !dir.is_empty() && std::path::Path::new(&dir).exists() {
            println!("cargo:rustc-link-search=native={}", dir);
            println!("cargo:rustc-link-lib=static=clang_rt.osx");
            return;
        }
    }

    // Fallback: ask clang for the exact file path.
    if let Ok(output) = std::process::Command::new("clang")
        .args(["--print-file-name", "libclang_rt.osx.a"])
        .output()
    {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let path = std::path::Path::new(&path);
        if let Some(dir) = path.parent() {
            if dir.exists() {
                println!("cargo:rustc-link-search=native={}", dir.display());
                println!("cargo:rustc-link-lib=static=clang_rt.osx");
                return;
            }
        }
    }

    println!("cargo:warning=Could not find clang runtime library (libclang_rt.osx.a). Metal linking may fail.");
}
