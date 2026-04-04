fn main() {
    #[cfg(target_os = "macos")]
    {
        link_clang_runtime();
        println!("cargo:rustc-link-framework=Metal");
        println!("cargo:rustc-link-framework=Foundation");
        println!("cargo:rustc-link-framework=CoreGraphics");
    }

    tauri_build::build()
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
