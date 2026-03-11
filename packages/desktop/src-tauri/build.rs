fn main() {
    // Set macOS deployment target to avoid deprecated std::filesystem issues
    println!("cargo:rustc-env=MACOSX_DEPLOYMENT_TARGET=13.0");
    tauri_build::build()
}
