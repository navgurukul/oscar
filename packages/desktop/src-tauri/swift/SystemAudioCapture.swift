// SystemAudioCapture.swift
// Captures system audio (other participants' voices) using macOS ScreenCaptureKit.
// Exposes a C API via @_cdecl so Rust can call these functions directly.
//
// Requires macOS 13.0+ for audio-specific SCStreamConfiguration properties
// (channelCount, sampleRate, excludesCurrentProcessAudio).
// Requires Screen Recording permission (Privacy & Security > Screen & System Audio Recording).

import Foundation
import CoreMedia

#if canImport(ScreenCaptureKit)
import ScreenCaptureKit
#endif

// ── Global State ────────────────────────────────────────────────────────────

private var audioSamples: [Float] = []
private let audioLock = NSLock()
private var isCurrentlyCapturing = false

#if canImport(ScreenCaptureKit)

@available(macOS 13.0, *)
private var activeStream: SCStream?

@available(macOS 13.0, *)
private var streamOutput: AudioStreamOutput?

// ── SCStreamOutput Delegate ─────────────────────────────────────────────────

@available(macOS 13.0, *)
class AudioStreamOutput: NSObject, SCStreamOutput {
    func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of type: SCStreamOutputType
    ) {
        guard type == .audio else { return }

        // Extract raw audio bytes from the CMSampleBuffer
        guard let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else { return }

        var totalLength = 0
        var dataPointer: UnsafeMutablePointer<Int8>?
        let status = CMBlockBufferGetDataPointer(
            blockBuffer,
            atOffset: 0,
            lengthAtOffsetOut: nil,
            totalLengthOut: &totalLength,
            dataPointerOut: &dataPointer
        )
        guard status == noErr, let data = dataPointer, totalLength > 0 else { return }

        // Determine channel count from the audio format description
        var channelCount = 1
        if let formatDesc = CMSampleBufferGetFormatDescription(sampleBuffer),
           let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(formatDesc)
        {
            channelCount = Int(asbd.pointee.mChannelsPerFrame)
        }

        // ScreenCaptureKit delivers audio as Float32 PCM
        let floatCount = totalLength / MemoryLayout<Float>.size
        guard floatCount > 0 else { return }
        let floatPtr = UnsafeRawPointer(data).bindMemory(to: Float.self, capacity: floatCount)

        audioLock.lock()
        if channelCount > 1 {
            // Mix down to mono by averaging channels
            let frameCount = floatCount / channelCount
            for frame in 0..<frameCount {
                var sum: Float = 0
                for ch in 0..<channelCount {
                    sum += floatPtr[frame * channelCount + ch]
                }
                audioSamples.append(sum / Float(channelCount))
            }
        } else {
            let buffer = UnsafeBufferPointer(start: floatPtr, count: floatCount)
            audioSamples.append(contentsOf: buffer)
        }
        audioLock.unlock()
    }
}

#endif

// ── C API (called from Rust via FFI) ────────────────────────────────────────

/// Returns true if system audio capture is supported on this macOS version.
@_cdecl("sck_is_supported")
public func sckIsSupported() -> Bool {
    if #available(macOS 13.0, *) {
        return true
    }
    return false
}

/// Returns true if system audio capture is currently active.
@_cdecl("sck_is_capturing")
public func sckIsCapturing() -> Bool {
    return isCurrentlyCapturing
}

/// Start capturing system audio.
/// Returns: 0 = success, 1 = already capturing, 2 = not supported,
///          3 = no display / permission denied, 4 = capture start failed
@_cdecl("sck_start_capture")
public func sckStartCapture() -> Int32 {
    guard !isCurrentlyCapturing else { return 1 }

    #if canImport(ScreenCaptureKit)
    if #available(macOS 13.0, *) {
        let semaphore = DispatchSemaphore(value: 0)
        var resultCode: Int32 = 4

        SCShareableContent.getExcludingDesktopWindows(
            true,
            onScreenWindowsOnly: false
        ) { content, error in
            guard let content = content, error == nil else {
                resultCode = 3
                semaphore.signal()
                return
            }

            guard let display = content.displays.first else {
                resultCode = 3
                semaphore.signal()
                return
            }

            // Configure for audio-only capture at 16 kHz mono
            let config = SCStreamConfiguration()
            config.capturesAudio = true
            config.excludesCurrentProcessAudio = true
            config.channelCount = 1
            config.sampleRate = 16000
            // Minimise video overhead — we only care about audio
            config.width = 2
            config.height = 2
            config.minimumFrameInterval = CMTime(value: 1, timescale: 1) // 1 fps

            let filter = SCContentFilter(
                display: display,
                excludingApplications: [],
                exceptingWindows: []
            )
            let newStream = SCStream(
                filter: filter,
                configuration: config,
                delegate: nil
            )

            let handler = AudioStreamOutput()

            do {
                try newStream.addStreamOutput(
                    handler,
                    type: .audio,
                    sampleHandlerQueue: DispatchQueue(
                        label: "com.oscar.systemaudio",
                        qos: .userInteractive
                    )
                )
            } catch {
                resultCode = 4
                semaphore.signal()
                return
            }

            newStream.startCapture { captureError in
                if captureError == nil {
                    activeStream = newStream
                    streamOutput = handler
                    audioLock.lock()
                    audioSamples.removeAll(keepingCapacity: true)
                    audioLock.unlock()
                    isCurrentlyCapturing = true
                    resultCode = 0
                } else {
                    resultCode = 4
                }
                semaphore.signal()
            }
        }

        let waitResult = semaphore.wait(timeout: .now() + 15)
        if waitResult == .timedOut {
            return 4
        }
        return resultCode
    }
    #endif

    return 2
}

/// Stop the active system audio capture.
@_cdecl("sck_stop_capture")
public func sckStopCapture() {
    guard isCurrentlyCapturing else { return }

    #if canImport(ScreenCaptureKit)
    if #available(macOS 13.0, *) {
        let semaphore = DispatchSemaphore(value: 0)
        activeStream?.stopCapture { _ in
            semaphore.signal()
        }
        _ = semaphore.wait(timeout: .now() + 5)
        activeStream = nil
        streamOutput = nil
    }
    #endif

    isCurrentlyCapturing = false
}

/// Retrieve all captured audio samples and clear the internal buffer.
/// Caller must free the returned pointer with `sck_free_audio_data`.
@_cdecl("sck_get_audio_data")
public func sckGetAudioData(_ outCount: UnsafeMutablePointer<Int32>) -> UnsafeMutablePointer<Float>? {
    audioLock.lock()
    let count = audioSamples.count
    guard count > 0 else {
        audioLock.unlock()
        outCount.pointee = 0
        return nil
    }

    let ptr = UnsafeMutablePointer<Float>.allocate(capacity: count)
    audioSamples.withUnsafeBufferPointer { buffer in
        ptr.initialize(from: buffer.baseAddress!, count: count)
    }
    audioSamples.removeAll(keepingCapacity: true)
    audioLock.unlock()

    outCount.pointee = Int32(count)
    return ptr
}

/// Free a buffer previously returned by `sck_get_audio_data`.
@_cdecl("sck_free_audio_data")
public func sckFreeAudioData(_ ptr: UnsafeMutablePointer<Float>?, _ count: Int32) {
    guard let ptr = ptr, count > 0 else { return }
    ptr.deinitialize(count: Int(count))
    ptr.deallocate()
}
