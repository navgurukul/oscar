//! ct2rs smoke test — Stage 2 KILL SWITCH for Faster-Whisper feasibility spike.
//!
//! Goal: prove that `ct2rs` (Rust binding for CTranslate2 / Faster-Whisper)
//! builds + links cleanly on a real MSVC Windows CI runner. We do NOT care
//! about transcription quality or speed at this stage — only that the C++
//! CTranslate2 library compiles, links, and the Whisper API surface is
//! exposed to Rust.
//!
//! If this binary builds in CI → green light to invest in Stage 3 (model
//! conversion + WER comparison). If it fails → Faster-Whisper is dead for
//! Windows and we pivot to whisper.cpp + Silero VAD.

use ct2rs::{Config, Whisper, WhisperOptions};
use std::env;
use std::process::ExitCode;

fn main() -> ExitCode {
    println!("== ct2rs smoke test ==");
    println!("Build + link verification for Stage 2 kill-switch.\n");

    // Step 1: Confirm the Whisper type is exposed at the binding layer.
    // If we got here at all, the crate linked and the Rust ABI is intact.
    println!("[1/3] ct2rs::Whisper type linked OK");
    println!("      ({})", std::any::type_name::<Whisper>());

    // Step 2: Confirm config + options builders are constructible.
    // These touch the FFI boundary indirectly, so a missing symbol surfaces here.
    let _config = Config::default();
    let _opts = WhisperOptions::default();
    println!("[2/3] Config + WhisperOptions constructed OK");

    // Step 3: Optional model load. Only attempted if a path is passed on the
    // command line; the CI smoke test runs without args (we only have build
    // + link to verify until Stage 3 produces a converted model). Locally
    // you can pass a CT2-format model folder to sanity-check inference too.
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        println!("[3/3] Skipping load test (no model path argument)");
        println!("\n✅ Smoke test PASSED — ct2rs builds + links on this target.");
        return ExitCode::SUCCESS;
    }

    let model_path = &args[1];
    println!("[3/3] Attempting Whisper::new on: {}", model_path);
    match Whisper::new(model_path, Config::default()) {
        Ok(whisper) => {
            println!("      ✓ Model loaded.");
            println!("      sampling_rate    = {} Hz", whisper.sampling_rate());
            println!("      is_multilingual  = {}", whisper.is_multilingual());
            println!("      num_languages    = {}", whisper.num_languages());
            println!("\n✅ Smoke test PASSED — model loaded and FFI works.");
            ExitCode::SUCCESS
        }
        Err(e) => {
            // Build/link still passed by definition (we got this far). A model-
            // load error here is informational only — Stage 3 will deal with
            // model format issues.
            println!("      ✗ Model load failed: {}", e);
            println!("\n⚠️  Build + link OK, but model load failed (expected without a converted CT2 model).");
            ExitCode::SUCCESS
        }
    }
}
