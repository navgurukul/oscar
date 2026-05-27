use std::io::Write;
use tauri::Manager;

#[tauri::command]
pub fn check_file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<String, String> {
    if std::path::Path::new(&path).exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))?;
        Ok(format!("Deleted {}", path))
    } else {
        Ok(format!("File not found: {}", path))
    }
}

/// Returns the full path to a model file inside `~/.oscar/models/`, creating
/// the directory if it doesn't exist. Path is resolved via Tauri's home_dir
/// so it uses the correct OS separator on Windows, macOS, and Linux.
#[tauri::command]
pub fn get_model_path(filename: String, app: tauri::AppHandle) -> Result<String, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|e| format!("Failed to resolve home directory: {}", e))?;
    let models_dir = home.join(".oscar").join("models");
    std::fs::create_dir_all(&models_dir)
        .map_err(|e| format!("Failed to create models directory: {}", e))?;
    Ok(models_dir.join(&filename).to_string_lossy().to_string())
}

/// Append a single JSON line to `<app_data_dir>/perf.jsonl`. The caller is
/// expected to pass a pre-serialised JSON object as `json_line` — we treat the
/// payload as opaque and only enforce the newline boundary so the file stays a
/// valid JSONL stream even under interleaved writes.
///
/// Fire-and-forget from JS: failures bubble back as `Err(String)` but the
/// dictation flow ignores them, so an unwritable disk never breaks paste.
#[tauri::command]
pub fn append_perf_log(json_line: String, app: tauri::AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir unavailable: {}", e))?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    let path = dir.join("perf.jsonl");

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Failed to open perf.jsonl: {}", e))?;

    // Trim any trailing newline the caller added so the on-disk shape is
    // exactly `<json>\n` per record, regardless of how JS framed the payload.
    let trimmed = json_line.trim_end_matches('\n');
    file.write_all(trimmed.as_bytes())
        .map_err(|e| format!("Failed to write perf.jsonl: {}", e))?;
    file.write_all(b"\n")
        .map_err(|e| format!("Failed to write perf.jsonl: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}
