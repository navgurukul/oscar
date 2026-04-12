// system_audio.rs — Cross-platform system audio capture.
//
// macOS:   ScreenCaptureKit via compiled Swift helper (SystemAudioCapture.swift).
// Windows: WASAPI loopback — captures whatever is playing through the default
//          audio render device (speakers / headphones).
// Linux:   PulseAudio / PipeWire-PA monitor source via `parec` subprocess.
//          Requires pulseaudio-utils (Ubuntu/Debian) or pipewire-pulse.

// ── macOS ─────────────────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
mod platform {
    // FFI bindings to the Swift SystemAudioCapture helper.
    // These functions are defined with @_cdecl in swift/SystemAudioCapture.swift
    // and compiled into a static library by build.rs.
    extern "C" {
        fn sck_is_supported() -> bool;
        fn sck_is_capturing() -> bool;
        fn sck_start_capture() -> i32;
        fn sck_stop_capture();
        fn sck_get_audio_data(out_count: *mut i32) -> *mut f32;
        fn sck_free_audio_data(ptr: *mut f32, count: i32);
    }

    pub fn is_supported() -> bool {
        unsafe { sck_is_supported() }
    }

    pub fn is_capturing() -> bool {
        unsafe { sck_is_capturing() }
    }

    pub fn start_capture() -> Result<(), String> {
        let code = unsafe { sck_start_capture() };
        match code {
            0 => {
                log::info!("[system-audio] Capture started successfully");
                Ok(())
            }
            1 => Err("System audio capture is already active".to_string()),
            2 => Err(
                "System audio capture requires macOS 13.0 or later".to_string(),
            ),
            3 => Err(
                "Screen Recording permission is required. \
                 Please grant permission in System Settings → Privacy & Security → Screen & System Audio Recording, \
                 then restart OSCAR."
                    .to_string(),
            ),
            4 => Err(
                "Failed to start system audio capture. \
                 Ensure Screen Recording permission is granted in \
                 System Settings → Privacy & Security → Screen & System Audio Recording."
                    .to_string(),
            ),
            _ => Err(format!("Unknown system audio error (code {})", code)),
        }
    }

    pub fn stop_capture() {
        unsafe { sck_stop_capture() };
        log::info!("[system-audio] Capture stopped");
    }

    pub fn get_audio_data() -> Vec<f32> {
        let mut count: i32 = 0;
        let ptr = unsafe { sck_get_audio_data(&mut count) };
        if ptr.is_null() || count <= 0 {
            return Vec::new();
        }
        let data = unsafe { std::slice::from_raw_parts(ptr, count as usize) }.to_vec();
        unsafe { sck_free_audio_data(ptr, count) };
        log::info!(
            "[system-audio] Retrieved {} samples ({:.1}s at 16 kHz)",
            data.len(),
            data.len() as f64 / 16000.0
        );
        data
    }
}

// ── Windows — WASAPI loopback ─────────────────────────────────────────────────

#[cfg(target_os = "windows")]
mod platform {
    use std::sync::{Arc, Mutex};
    use std::sync::atomic::{AtomicBool, Ordering};
    use windows::Win32::Media::Audio::{
        IAudioCaptureClient, IAudioClient, IMMDeviceEnumerator, MMDeviceEnumerator,
        AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK,
        eConsole, eRender, WAVEFORMATEX,
    };
    // Not exported by windows-rs 0.58; value from Windows SDK mmreg.h
    const WAVE_FORMAT_IEEE_FLOAT: u16 = 3;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize,
        CLSCTX_ALL, COINIT_MULTITHREADED,
    };

    struct WasapiCapture {
        stop_flag: Arc<AtomicBool>,
        buffer:    Arc<Mutex<Vec<f32>>>,
        thread:    std::thread::JoinHandle<()>,
    }

    // SAFETY: WasapiCapture is Send because:
    //   • AtomicBool is Send+Sync
    //   • Arc<Mutex<Vec<f32>>> is Send+Sync
    //   • JoinHandle<()> is Send
    unsafe impl Send for WasapiCapture {}

    static STATE: Mutex<Option<WasapiCapture>> = Mutex::new(None);

    pub fn is_supported() -> bool {
        true // WASAPI is present on Windows Vista and later
    }

    pub fn is_capturing() -> bool {
        STATE.lock().map_or(false, |s| s.is_some())
    }

    pub fn start_capture() -> Result<(), String> {
        let mut state = STATE.lock().map_err(|_| "State lock poisoned".to_string())?;
        if state.is_some() {
            return Err("System audio capture is already active".to_string());
        }

        let buffer: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
        let stop_flag = Arc::new(AtomicBool::new(false));
        let buf   = buffer.clone();
        let stop  = stop_flag.clone();

        let thread = std::thread::spawn(move || {
            if let Err(e) = unsafe { capture_loop(buf, stop) } {
                log::error!("[system-audio] WASAPI capture thread error: {e:?}");
            }
        });

        *state = Some(WasapiCapture { stop_flag, buffer, thread });
        log::info!("[system-audio] WASAPI loopback capture started");
        Ok(())
    }

    pub fn stop_capture() {
        let mut state = STATE.lock().unwrap();
        if let Some(cap) = state.take() {
            cap.stop_flag.store(true, Ordering::Relaxed);
            let _ = cap.thread.join();
        }
        log::info!("[system-audio] WASAPI capture stopped");
    }

    pub fn get_audio_data() -> Vec<f32> {
        let state = STATE.lock().unwrap();
        state.as_ref().map_or_else(Vec::new, |cap| {
            let mut buf = cap.buffer.lock().unwrap();
            let data: Vec<f32> = buf.drain(..).collect();
            log::info!(
                "[system-audio] Retrieved {} Windows samples ({:.1}s at 16 kHz)",
                data.len(),
                data.len() as f32 / 16_000.0
            );
            data
        })
    }

    /// Background thread: open WASAPI loopback, pull PCM, downsample to 16 kHz mono.
    unsafe fn capture_loop(
        buffer: Arc<Mutex<Vec<f32>>>,
        stop:   Arc<AtomicBool>,
    ) -> windows::core::Result<()> {
        // S_FALSE means "already initialised on this thread" — both are fine.
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let device  = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
        let client: IAudioClient = device.Activate(CLSCTX_ALL, None)?;

        let fmt_ptr = client.GetMixFormat()?;
        let fmt: &WAVEFORMATEX = &*fmt_ptr;

        // Copy packed-struct fields to locals before any use — WAVEFORMATEX is
        // 1-byte aligned, so taking a reference to its fields is UB (E0793).
        let native_rate   = fmt.nSamplesPerSec;
        let channels      = fmt.nChannels as usize;
        let format_tag    = fmt.wFormatTag;
        let bits_per_sample = fmt.wBitsPerSample;
        // Treat as float32 if tag is IEEE_FLOAT (3) or EXTENSIBLE with 32-bit samples.
        let is_float =
            format_tag == WAVE_FORMAT_IEEE_FLOAT
            || (format_tag == 0xFFFE && bits_per_sample == 32);

        log::info!(
            "[system-audio] WASAPI mix format: {}Hz {}ch {}bit float={}",
            native_rate, channels, bits_per_sample, is_float
        );

        // 200 ms shared-mode loopback buffer (units: 100-ns intervals).
        client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK,
            2_000_000,
            0,
            fmt_ptr,
            None,
        )?;

        let capture: IAudioCaptureClient = client.GetService()?;
        client.Start()?;

        const TARGET_RATE: u32 = 16_000;
        const SILENT_FLAG:  u32 = 0x0000_0002; // AUDCLNT_BUFFERFLAGS_SILENT

        let ratio = native_rate as f64 / TARGET_RATE as f64;
        let mut mono_buf: Vec<f32> = Vec::new();

        while !stop.load(Ordering::Relaxed) {
            if capture.GetNextPacketSize()? == 0 {
                std::thread::sleep(std::time::Duration::from_millis(10));
                continue;
            }

            let mut data_ptr: *mut u8 = std::ptr::null_mut();
            let mut frames:   u32     = 0;
            let mut flags:    u32     = 0;
            capture.GetBuffer(&mut data_ptr, &mut frames, &mut flags, None, None)?;

            if flags & SILENT_FLAG == 0 {
                let bps  = if is_float { 4usize } else { 2 }; // bytes per sample
                let bpf  = channels * bps;                     // bytes per frame
                let pcm  = std::slice::from_raw_parts(data_ptr, frames as usize * bpf);

                for f in 0..frames as usize {
                    let mut mono = 0.0f32;
                    for ch in 0..channels {
                        let o = f * bpf + ch * bps;
                        mono += if is_float {
                            f32::from_le_bytes(pcm[o..o+4].try_into().unwrap_or([0; 4]))
                        } else {
                            i16::from_le_bytes(pcm[o..o+2].try_into().unwrap_or([0; 2])) as f32
                                / 32_768.0
                        };
                    }
                    mono_buf.push(mono / channels as f32);
                }
            } else {
                // Silent packet: push zeros so timing stays aligned.
                mono_buf.extend(std::iter::repeat(0.0f32).take(frames as usize));
            }

            capture.ReleaseBuffer(frames)?;

            // Linear-interpolation downsample from native_rate → 16 kHz.
            let out_len = (mono_buf.len() as f64 / ratio) as usize;
            if out_len > 0 {
                let mut resampled = Vec::with_capacity(out_len);
                for i in 0..out_len {
                    let p   = i as f64 * ratio;
                    let idx = p as usize;
                    let t   = (p - idx as f64) as f32;
                    let a   = mono_buf.get(idx    ).copied().unwrap_or(0.0);
                    let b   = mono_buf.get(idx + 1).copied().unwrap_or(a);
                    resampled.push(a + (b - a) * t);
                }
                let consumed = ((out_len as f64 * ratio) as usize).min(mono_buf.len());
                mono_buf.drain(..consumed);
                buffer.lock().unwrap().extend(resampled);
            }
        }

        client.Stop()?;
        CoTaskMemFree(Some(fmt_ptr.cast()));
        CoUninitialize();
        Ok(())
    }
}

// ── Linux — PulseAudio / PipeWire monitor source ─────────────────────────────

#[cfg(target_os = "linux")]
mod platform {
    use std::io::Read;
    use std::process::{Child, Command, Stdio};
    use std::sync::{Arc, Mutex};
    use std::sync::atomic::{AtomicBool, Ordering};

    struct LinuxCapture {
        process:   Child,
        _reader:   std::thread::JoinHandle<()>,
        buffer:    Arc<Mutex<Vec<f32>>>,
        stop_flag: Arc<AtomicBool>,
    }

    // Child is not Send by default on all platforms; we access it only from one
    // thread (stop_capture) so the Send impl is safe.
    unsafe impl Send for LinuxCapture {}

    static STATE: Mutex<Option<LinuxCapture>> = Mutex::new(None);

    /// Ask PulseAudio/PipeWire for the default sink, return its monitor source name.
    fn default_sink_monitor() -> Option<String> {
        let out = Command::new("pactl").arg("info").output().ok()?;
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines() {
            if let Some(rest) = line.strip_prefix("Default Sink:") {
                return Some(format!("{}.monitor", rest.trim()));
            }
        }
        None
    }

    pub fn is_supported() -> bool {
        // Both parec and pactl must be present (pulseaudio-utils / pipewire-pulse)
        Command::new("parec").arg("--version").output().is_ok()
            && Command::new("pactl").arg("info").output().is_ok()
    }

    pub fn is_capturing() -> bool {
        STATE.lock().map_or(false, |s| s.is_some())
    }

    pub fn start_capture() -> Result<(), String> {
        let mut state = STATE.lock().map_err(|_| "State lock poisoned".to_string())?;
        if state.is_some() {
            return Err("System audio capture is already active".to_string());
        }

        let monitor = default_sink_monitor().ok_or_else(|| {
            "Could not find audio output monitor source. \
             Ensure PulseAudio or PipeWire (with pipewire-pulse) is running."
                .to_string()
        })?;

        let buffer:    Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
        let stop_flag: Arc<AtomicBool>      = Arc::new(AtomicBool::new(false));

        // `parec` records float32 little-endian PCM at 16 kHz mono from the
        // monitor source, so no resampling is needed on the Rust side.
        let mut child = Command::new("parec")
            .args([
                "--format=float32le",
                "--rate=16000",
                "--channels=1",
                "--latency-msec=100",
                &format!("--device={monitor}"),
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| {
                format!(
                    "Failed to spawn parec: {e}. \
                     Install pulseaudio-utils (Ubuntu/Debian) or pipewire-pulse."
                )
            })?;

        let stdout     = child.stdout.take().expect("stdout is piped");
        let buf_clone  = buffer.clone();
        let stop_clone = stop_flag.clone();

        let reader = std::thread::spawn(move || {
            let mut r     = std::io::BufReader::new(stdout);
            let mut bytes = [0u8; 4 * 512]; // 512 float32 samples per read
            while !stop_clone.load(Ordering::Relaxed) {
                match r.read(&mut bytes) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        let samples = n / 4;
                        let mut buf = buf_clone.lock().unwrap();
                        for i in 0..samples {
                            let b = [bytes[i*4], bytes[i*4+1], bytes[i*4+2], bytes[i*4+3]];
                            buf.push(f32::from_le_bytes(b));
                        }
                    }
                }
            }
        });

        log::info!("[system-audio] parec started (monitor: {monitor})");
        *state = Some(LinuxCapture { process: child, _reader: reader, buffer, stop_flag });
        Ok(())
    }

    pub fn stop_capture() {
        let mut state = STATE.lock().unwrap();
        if let Some(mut cap) = state.take() {
            cap.stop_flag.store(true, Ordering::Relaxed);
            let _ = cap.process.kill();
            log::info!("[system-audio] parec capture stopped");
        }
    }

    pub fn get_audio_data() -> Vec<f32> {
        let state = STATE.lock().unwrap();
        state.as_ref().map_or_else(Vec::new, |cap| {
            let mut buf = cap.buffer.lock().unwrap();
            let data: Vec<f32> = buf.drain(..).collect();
            log::info!(
                "[system-audio] Retrieved {} Linux samples ({:.1}s at 16 kHz)",
                data.len(),
                data.len() as f32 / 16_000.0
            );
            data
        })
    }
}

// ── Fallback stub (any other OS) ──────────────────────────────────────────────

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
mod platform {
    pub fn is_supported() -> bool { false }
    pub fn is_capturing() -> bool { false }
    pub fn start_capture() -> Result<(), String> {
        Err("System audio capture is not supported on this platform".to_string())
    }
    pub fn stop_capture() {}
    pub fn get_audio_data() -> Vec<f32> { Vec::new() }
}

pub use platform::*;
