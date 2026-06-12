import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import type { MinutesTranscriptionStatus } from "../components/MeetingsTab";
import type { MeetingTranscriptSegment } from "../types/meeting.types";
import type {
  MeetingSegmentJob,
  Transcription,
  WhisperModelRole,
  WhisperModelVariant,
} from "../lib/app-types";
import {
  MEETING_MIN_SEGMENT_DURATION_MS,
  MEETING_MIN_SPEECH_MS,
  MEETING_SEGMENT_DURATION_MS,
  MEETING_SILENCE_ROTATE_AFTER_MS,
  MEETING_VAD_PEAK_THRESHOLD,
  MEETING_VAD_RMS_THRESHOLD,
  MEETING_VAD_SAMPLE_RATE,
} from "../lib/desktop-constants";
import {
  appendTranscriptSegment,
  buildTranscriptFromStructuredSegments,
  getTranscriptTailWords,
  mergeMeetingTranscriptSegments,
  toAbsoluteMeetingTranscriptSegments,
  toFallbackMeetingTranscriptSegment,
} from "../lib/transcript-utils";
import { buildInitialPrompt, getWhisperLanguage } from "../lib/whisper";

type AudioContextConstructor = new (
  contextOptions?: AudioContextOptions,
) => AudioContext;

interface UseMinutesRecorderOptions {
  canStartRecordingRef: MutableRefObject<() => boolean>;
  ensureWhisperModelLoadedRef: MutableRefObject<
    (role: WhisperModelRole) => Promise<unknown>
  >;
  warmVoiceEngineRef: MutableRefObject<() => Promise<void>>;
  getAudioConstraintsRef: MutableRefObject<
    () => MediaTrackConstraints | boolean
  >;
  warmStreamRef: MutableRefObject<MediaStream | null>;
  dictWordsRef: MutableRefObject<string[]>;
  transcriptionLanguageRef: MutableRefObject<string>;
  systemAudioEnabled: boolean;
  systemAudioSupported: boolean;
}

export function useMinutesRecorder({
  canStartRecordingRef,
  ensureWhisperModelLoadedRef,
  warmVoiceEngineRef,
  getAudioConstraintsRef,
  warmStreamRef,
  dictWordsRef,
  transcriptionLanguageRef,
  systemAudioEnabled,
  systemAudioSupported,
}: UseMinutesRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  // True while startRecording() is mid-flight: model download/load, voice-engine
  // warm, and system-audio capture start can take many seconds before
  // `isRecording` flips. The Minutes UI reads this to show a "Preparing…"
  // button instead of an unresponsive "Start recording" that silently swallows
  // re-clicks (the startingRef guard below).
  const [isPreparing, setIsPreparing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [transcriptSegments, setTranscriptSegments] = useState<
    MeetingTranscriptSegment[]
  >([]);
  const [startedAt, setStartedAt] = useState("");
  const [transcriptionStatus, setTranscriptionStatus] =
    useState<MinutesTranscriptionStatus>("idle");
  const [segmentQueue, setSegmentQueue] = useState(0);
  const [segmentsCompleted, setSegmentsCompleted] = useState(0);
  const [segmentsTotal, setSegmentsTotal] = useState(0);
  // Indices of segments whose transcription threw. segmentsCompleted advances
  // for these too (the worker counts them in `finally`), so without this the
  // progress bar reads "done" while the audio silently vanished. The result
  // phase reads this to warn the user the notes may have gaps.
  const [failedSegments, setFailedSegments] = useState<number[]>([]);
  const [systemAudioWarning, setSystemAudioWarning] = useState("");
  // Mic-only mute. True = the local microphone is silenced; system-audio
  // capture of the other participants keeps running. See setMicMuted below.
  const [isMuted, setIsMuted] = useState(false);
  // Reactive mirror of sessionUsesSystemAudioRef: true while this session is
  // actually capturing the other participants (system audio). Lets the UI tell
  // "muted, others still recorded" apart from a mic-only meeting where muting
  // captures nothing.
  const [isCapturingSystemAudio, setIsCapturingSystemAudio] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isRecordingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segmentStopRef =
    useRef<((mode?: "rotate" | "final") => void) | null>(null);
  const sessionIdRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const startingRef = useRef(false);
  const nextSegmentIndexRef = useRef(0);
  const segmentQueueRef = useRef<MeetingSegmentJob[]>([]);
  const segmentWorkerRunningRef = useRef(false);
  const transcriptRef = useRef("");
  const transcriptSegmentsRef = useRef<MeetingTranscriptSegment[]>([]);
  // Variant loaded for this meeting (captured at startRecording). Every segment
  // transcribe declares it so a wrong-model load is a typed error, not a silent
  // wrong-model transcript (invariant I2).
  const loadedVariantRef = useRef<WhisperModelVariant | null>(null);
  // True for the WHOLE pipeline lifetime — not just while `isRecording`, which
  // stopRecording flips false immediately while segments are still draining.
  // Other surfaces (hotkey/scribble start, clear-data) read this to block until
  // the meeting fully finalizes (invariant I3; matrix rows 4, 8).
  const isPipelineBusyRef = useRef<() => boolean>(() => false);
  const startedAtRef = useRef("");
  const sessionUsesSystemAudioRef = useRef(false);
  const systemAudioActiveRef = useRef(false);
  const isMutedRef = useRef(false);

  const vadAudioContextRef = useRef<AudioContext | null>(null);
  const vadSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const vadProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const vadGainRef = useRef<GainNode | null>(null);
  const segmentStartedAtMsRef = useRef(0);
  const segmentSpeechMsRef = useRef(0);
  const segmentTrailingSilenceMsRef = useRef(0);
  const segmentLastVadAtRef = useRef(0);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // ─── Mic mute ────────────────────────────────────────────────────────────
  // Mutes ONLY the local microphone track. System-audio capture (the other
  // participants, handled in Rust) is never touched, and the shared warm
  // stream is never stopped: `track.enabled = false` delivers digital silence
  // to both the segment MediaRecorder and the VAD monitor, so muted mic audio
  // is dropped as silence rather than transcribed or hallucinated. Using
  // `track.stop()` here would kill the device and leak a dead track into the
  // dictation flow, which reuses the same warm stream.
  //
  // Note: while muted the VAD monitor reads those zero samples, so the
  // speech-boundary rotation never triggers; segments fall back to the
  // time-based segmentTimer (MEETING_SEGMENT_DURATION_MS), which is the
  // intended, fully-functional fallback.
  const applyMicEnabled = useCallback(
    (enabled: boolean) => {
      const stream = warmStreamRef.current;
      if (!stream) return;
      for (const track of stream.getAudioTracks()) {
        track.enabled = enabled;
      }
    },
    [warmStreamRef],
  );

  const setMicMuted = useCallback(
    (muted: boolean) => {
      applyMicEnabled(!muted);
      isMutedRef.current = muted;
      setIsMuted(muted);
    },
    [applyMicEnabled],
  );

  const toggleMute = useCallback(() => {
    setMicMuted(!isMutedRef.current);
  }, [setMicMuted]);

  // Keep the sessionUsesSystemAudio ref and its reactive mirror in lockstep so
  // the UI can truthfully report whether the other participants are still being
  // captured while the mic is muted.
  const setSessionUsesSystemAudio = useCallback((value: boolean) => {
    sessionUsesSystemAudioRef.current = value;
    setIsCapturingSystemAudio(value);
  }, []);

  const stopVadMonitor = useCallback(() => {
    vadProcessorRef.current?.disconnect();
    vadSourceRef.current?.disconnect();
    vadGainRef.current?.disconnect();
    const audioContext = vadAudioContextRef.current;
    vadProcessorRef.current = null;
    vadSourceRef.current = null;
    vadGainRef.current = null;
    vadAudioContextRef.current = null;
    segmentSpeechMsRef.current = 0;
    segmentTrailingSilenceMsRef.current = 0;
    segmentLastVadAtRef.current = 0;

    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch((err) => {
        console.warn("[meeting-vad] failed to close audio context:", err);
      });
    }
  }, []);

  const resetSegmentVadState = (startedAtMs: number) => {
    segmentStartedAtMsRef.current = startedAtMs;
    segmentSpeechMsRef.current = 0;
    segmentTrailingSilenceMsRef.current = 0;
    segmentLastVadAtRef.current = performance.now();
  };

  const maybeRotateForSpeechBoundary = useCallback(() => {
    const stopSegment = segmentStopRef.current;
    if (!stopSegment || stopRequestedRef.current) return;

    const segmentAgeMs = Date.now() - segmentStartedAtMsRef.current;
    if (segmentAgeMs < MEETING_MIN_SEGMENT_DURATION_MS) return;
    if (segmentSpeechMsRef.current < MEETING_MIN_SPEECH_MS) return;
    if (
      segmentTrailingSilenceMsRef.current < MEETING_SILENCE_ROTATE_AFTER_MS
    ) {
      return;
    }

    stopSegment("rotate");
  }, []);

  const startVadMonitor = useCallback(
    (stream: MediaStream) => {
      stopVadMonitor();

      try {
        const AudioContextCtor =
          window.AudioContext ??
          (window as Window & { webkitAudioContext?: AudioContextConstructor })
            .webkitAudioContext;

        if (!AudioContextCtor) return;

        const audioContext = new AudioContextCtor({
          sampleRate: MEETING_VAD_SAMPLE_RATE,
        });
        if (audioContext.state === "suspended") {
          void audioContext.resume().catch((err) => {
            console.warn("[meeting-vad] failed to resume audio context:", err);
          });
        }
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(2048, 1, 1);
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        segmentLastVadAtRef.current = performance.now();

        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0);
          if (input.length === 0) return;

          let sumSq = 0;
          let peak = 0;
          for (let i = 0; i < input.length; i += 1) {
            const sample = input[i];
            sumSq += sample * sample;
            const abs = sample < 0 ? -sample : sample;
            if (abs > peak) peak = abs;
          }

          const rms = Math.sqrt(sumSq / input.length);
          const now = performance.now();
          const elapsedMs = Math.max(0, now - segmentLastVadAtRef.current);
          segmentLastVadAtRef.current = now;

          if (
            rms >= MEETING_VAD_RMS_THRESHOLD ||
            peak >= MEETING_VAD_PEAK_THRESHOLD
          ) {
            segmentSpeechMsRef.current += elapsedMs;
            segmentTrailingSilenceMsRef.current = 0;
          } else {
            segmentTrailingSilenceMsRef.current += elapsedMs;
          }

          maybeRotateForSpeechBoundary();
        };

        source.connect(processor);
        processor.connect(gain);
        gain.connect(audioContext.destination);

        vadAudioContextRef.current = audioContext;
        vadSourceRef.current = source;
        vadProcessorRef.current = processor;
        vadGainRef.current = gain;
      } catch (err) {
        console.warn("[meeting-vad] failed to start monitor:", err);
        stopVadMonitor();
      }
    },
    [maybeRotateForSpeechBoundary, stopVadMonitor],
  );

  const resetPipelineState = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
    stopVadMonitor();
    segmentQueueRef.current = [];
    segmentWorkerRunningRef.current = false;
    transcriptRef.current = "";
    transcriptSegmentsRef.current = [];
    startedAtRef.current = "";
    nextSegmentIndexRef.current = 0;
    stopRequestedRef.current = false;
    segmentStopRef.current = null;
    setSessionUsesSystemAudio(false);
    systemAudioActiveRef.current = false;
    mediaRecorderRef.current = null;
    // Reset mute state up front so the invariant ("a fresh session starts
    // capturing") holds even on the early-return error paths below, where the
    // setMicMuted(false) in startRecording would otherwise be skipped.
    isMutedRef.current = false;
    setIsMuted(false);
    setTranscript("");
    setTranscriptSegments([]);
    setStartedAt("");
    setRecordingTime(0);
    setSegmentQueue(0);
    setSegmentsCompleted(0);
    setSegmentsTotal(0);
    setFailedSegments([]);
    setTranscriptionStatus("idle");
  }, [stopVadMonitor, setSessionUsesSystemAudio]);

  const maybeCompleteFinalization = () => {
    if (!stopRequestedRef.current) return;
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      return;
    }
    if (segmentQueueRef.current.length > 0) return;
    if (segmentWorkerRunningRef.current) return;

    systemAudioActiveRef.current = false;
    setSegmentQueue(0);
    setTranscriptionStatus("notes");
  };

  const processSegmentQueue = async () => {
    if (segmentWorkerRunningRef.current) return;
    segmentWorkerRunningRef.current = true;

    while (segmentQueueRef.current.length > 0) {
      const job = segmentQueueRef.current.shift();
      if (!job) break;

      setSegmentQueue(segmentQueueRef.current.length);
      if (!stopRequestedRef.current) {
        setTranscriptionStatus("transcribing");
      }

      try {
        const expectedVariant = loadedVariantRef.current;
        if (!expectedVariant) {
          throw new Error("Speech model not loaded for meeting segment");
        }
        const bytes = Array.from(new Uint8Array(await job.blob.arrayBuffer()));
        const result = await invoke<Transcription>(
          "transcribe_meeting_segment_bytes",
          {
            bytes,
            ext: job.ext,
            useSystemAudio: job.useSystemAudio,
            initialPrompt: buildInitialPrompt(
              transcriptionLanguageRef.current,
              dictWordsRef.current,
            ),
            language: getWhisperLanguage(
              transcriptionLanguageRef.current,
              "minutes",
            ),
            sessionId: job.sessionId,
            segmentIndex: job.segmentIndex,
            previousTailText: getTranscriptTailWords(transcriptRef.current, 30),
            expectedVariant,
          },
        );

        if (result.segments && result.segments.length > 0) {
          const absoluteSegments = toAbsoluteMeetingTranscriptSegments(
            job,
            result.segments,
          );
          const mergedSegments = mergeMeetingTranscriptSegments(
            transcriptSegmentsRef.current,
            absoluteSegments,
          );
          transcriptSegmentsRef.current = mergedSegments;
          setTranscriptSegments(mergedSegments);

          const nextTranscript =
            buildTranscriptFromStructuredSegments(mergedSegments);
          transcriptRef.current = nextTranscript;
          setTranscript(nextTranscript);
        } else if (result.text) {
          const fallbackSegment = toFallbackMeetingTranscriptSegment(
            job,
            result.text,
          );

          if (fallbackSegment) {
            const mergedSegments = mergeMeetingTranscriptSegments(
              transcriptSegmentsRef.current,
              [fallbackSegment],
            );
            transcriptSegmentsRef.current = mergedSegments;
            setTranscriptSegments(mergedSegments);

            const nextTranscript =
              buildTranscriptFromStructuredSegments(mergedSegments);
            transcriptRef.current = nextTranscript;
            setTranscript(nextTranscript);
          } else {
            const nextTranscript = appendTranscriptSegment(
              transcriptRef.current,
              result.text,
            );
            transcriptRef.current = nextTranscript;
            setTranscript(nextTranscript);
          }
        }
      } catch (err) {
        console.error("[meeting] segment transcription failed:", err);
        setFailedSegments((prev) =>
          prev.includes(job.segmentIndex)
            ? prev
            : [...prev, job.segmentIndex],
        );
      } finally {
        setSegmentsCompleted((prev) => prev + 1);
      }
    }

    segmentWorkerRunningRef.current = false;

    if (stopRequestedRef.current) {
      maybeCompleteFinalization();
      return;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      setTranscriptionStatus("recording");
    } else {
      setTranscriptionStatus("idle");
    }
  };

  const queueSegment = (job: MeetingSegmentJob) => {
    segmentQueueRef.current.push(job);
    setSegmentQueue(segmentQueueRef.current.length);
    setSegmentsTotal((prev) => prev + 1);
    if (!stopRequestedRef.current) {
      setTranscriptionStatus("transcribing");
    }
    void processSegmentQueue();
  };

  const startSegmentRecorder = (sessionId: number) => {
    const stream = warmStreamRef.current;
    if (!stream) return;

    const useWebm = MediaRecorder.isTypeSupported("audio/webm");
    const mimeType = useWebm ? "audio/webm" : "audio/mp4";
    const ext = useWebm ? "webm" : "mp4";
    const segmentIndex = nextSegmentIndexRef.current;
    const segmentUsesSystemAudio = sessionUsesSystemAudioRef.current;
    nextSegmentIndexRef.current += 1;
    const segmentStartedAtMs = Date.now();
    resetSegmentVadState(segmentStartedAtMs);

    if (segmentIndex === 0) {
      const nextStartedAt = new Date(segmentStartedAtMs).toISOString();
      startedAtRef.current = nextStartedAt;
      setStartedAt(nextStartedAt);
    }

    const chunks: Blob[] = [];
    let stopMode: "rotate" | "final" | null = null;
    let rotationPromise: Promise<void> = Promise.resolve();
    let segmentEndedAtMs = segmentStartedAtMs;
    let segmentSpeechMs = 0;
    let segmentHasDetectedSpeech = false;

    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mediaRecorder;
    segmentStopRef.current = (mode = "final") => {
      if (mediaRecorder.state !== "recording") return;
      if (segmentTimerRef.current) {
        clearTimeout(segmentTimerRef.current);
        segmentTimerRef.current = null;
      }

      stopMode = mode;
      segmentEndedAtMs = Date.now();
      segmentSpeechMs = Math.round(segmentSpeechMsRef.current);
      segmentHasDetectedSpeech = segmentSpeechMs >= MEETING_MIN_SPEECH_MS;
      rotationPromise = segmentUsesSystemAudio
        ? invoke("rotate_meeting_system_audio_segment", {
            sessionId,
            segmentIndex,
            restartCapture: mode === "rotate",
          })
            .then(() => undefined)
            .catch((err) => {
              console.warn(
                "[meeting] system audio segment rotation failed:",
                err,
              );
              setSessionUsesSystemAudio(false);
              systemAudioActiveRef.current = false;
              void invoke("stop_system_audio_capture", { sessionId }).catch(
                () => {},
              );
            })
        : Promise.resolve();

      mediaRecorder.stop();
    };

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      window.setTimeout(async () => {
        await rotationPromise;

        const shouldContinue =
          stopMode === "rotate" &&
          !stopRequestedRef.current &&
          sessionIdRef.current === sessionId;

        if (shouldContinue) {
          startSegmentRecorder(sessionId);
        }

        if (mediaRecorderRef.current === mediaRecorder) {
          mediaRecorderRef.current = null;
        }
        if (segmentStopRef.current && stopMode === "final") {
          segmentStopRef.current = null;
        }

        const audioBlob = new Blob(chunks, { type: mimeType });
        const shouldQueue =
          audioBlob.size >= 500 &&
          (segmentUsesSystemAudio || segmentHasDetectedSpeech);

        if (shouldQueue) {
          queueSegment({
            blob: audioBlob,
            ext,
            sessionId,
            segmentIndex,
            useSystemAudio: segmentUsesSystemAudio,
            startedAtMs: segmentStartedAtMs,
            endedAtMs: Math.max(segmentEndedAtMs, segmentStartedAtMs + 1),
            speechMs: segmentSpeechMs,
            hasDetectedSpeech: segmentHasDetectedSpeech,
          });
        } else if (audioBlob.size >= 500) {
          console.info("[meeting-vad] skipped silent mic segment", {
            segmentIndex,
            speechMs: segmentSpeechMs,
          });
        }

        maybeCompleteFinalization();
      }, 0);
    };

    mediaRecorder.start();
    setTranscriptionStatus("recording");
    segmentTimerRef.current = setTimeout(() => {
      if (sessionIdRef.current !== sessionId || stopRequestedRef.current) {
        return;
      }
      segmentStopRef.current?.("rotate");
    }, MEETING_SEGMENT_DURATION_MS);
  };

  const startRecording = async () => {
    // Re-entrancy guard: the system-audio start below can take a few seconds,
    // during which `isRecording` is still false and the Start button stays
    // clickable. Without this guard a second click (or re-invoke) races a
    // second capture start against the first — the loser returns "already
    // active" (code 1), falls back to mic-only, and the meeting loses every
    // remote participant (the "only one speaker" symptom).
    if (startingRef.current || isRecordingRef.current) return;
    if (!canStartRecordingRef.current()) return;
    startingRef.current = true;
    setIsPreparing(true);

    try {
      setSystemAudioWarning("");
      resetPipelineState();

      try {
        const ensured = (await ensureWhisperModelLoadedRef.current(
          "minutes",
        )) as { variant?: WhisperModelVariant | null } | null | undefined;
        loadedVariantRef.current = ensured?.variant ?? null;
        await warmVoiceEngineRef.current();
      } catch (err) {
        console.error(
          "[meeting-record] failed to prepare Whisper model:",
          err,
        );
        return;
      }

      let stream: MediaStream;
      if (
        warmStreamRef.current &&
        warmStreamRef.current
          .getAudioTracks()
          .some((t) => t.readyState === "live")
      ) {
        stream = warmStreamRef.current;
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: getAudioConstraintsRef.current(),
          });
          warmStreamRef.current = stream;
        } catch (err) {
          console.error("[meeting-record] getUserMedia failed:", err);
          return;
        }
      }

      // Fresh session always starts capturing. Clear any mic-mute left over
      // from a prior meeting or dictation: `track.enabled = false` persists on
      // the shared warm stream and survives the readyState==="live" reuse
      // check above, which would otherwise start this meeting mic-dead (no
      // "You" speaker ever surfaces).
      setMicMuted(false);

      sessionIdRef.current += 1;
      const sessionId = sessionIdRef.current;
      stopRequestedRef.current = false;
      transcriptRef.current = "";
      await invoke("clear_meeting_segment_buffers").catch((err) => {
        console.warn(
          "[meeting-record] failed to clear segment buffers:",
          err,
        );
      });

      if (systemAudioEnabled && systemAudioSupported) {
        try {
          // start_system_audio_capture takes ownership of the shared backend
          // for this session: it first stops any stale capture left by an
          // abandoned prior session (component unmount, hot-reload, or a
          // rotation error that never stopped), records this session id as the
          // active owner, then starts. Threading sessionId means a late
          // rotate/stop from the previous meeting no longer kills this capture.
          await invoke("start_system_audio_capture", { sessionId });
          systemAudioActiveRef.current = true;
          setSessionUsesSystemAudio(true);
          setSystemAudioWarning("");
          console.log("[meeting-record] System audio capture started");
        } catch (err) {
          console.warn(
            "[meeting-record] System audio capture failed, mic only:",
            err,
          );
          systemAudioActiveRef.current = false;
          setSessionUsesSystemAudio(false);
          const reason = String(err).replace(/^Error:\s*/i, "");
          setSystemAudioWarning(
            `${reason} Meeting recording will continue with your microphone only.`,
          );
        }
      } else {
        systemAudioActiveRef.current = false;
        setSessionUsesSystemAudio(false);
        if (systemAudioEnabled && !systemAudioSupported) {
          // Capture is on in settings but this device/build can't capture
          // system audio. Surface a brief notice so the user knows remote
          // participants won't be recorded, rather than silently dropping to
          // mic-only. (A user who turned the setting off gets no notice.)
          setSystemAudioWarning(
            "System audio capture isn't supported on this device, so remote participants won't be recorded. Meeting recording will continue with your microphone only.",
          );
        } else {
          setSystemAudioWarning("");
        }
      }

      startVadMonitor(stream);
      isRecordingRef.current = true;
      setIsRecording(true);
      setRecordingTime(0);
      setTranscript("");
      setTranscriptionStatus("recording");
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      startSegmentRecorder(sessionId);
    } finally {
      startingRef.current = false;
      setIsPreparing(false);
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    // Restore the mic track so a muted meeting never leaves the shared warm
    // stream disabled for the next dictation/meeting session.
    setMicMuted(false);
    stopRequestedRef.current = true;
    setTranscriptionStatus("finalizing");

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }

    if (segmentStopRef.current) {
      segmentStopRef.current("final");
      stopVadMonitor();
      return;
    }

    stopVadMonitor();
    if (systemAudioActiveRef.current) {
      void invoke("stop_system_audio_capture", {
        sessionId: sessionIdRef.current,
      }).catch((err) => {
        console.warn("[meeting] failed to stop system audio capture:", err);
      });
      systemAudioActiveRef.current = false;
    }
    maybeCompleteFinalization();
  };

  const clearTranscript = () => {
    // Bump the session id so any in-flight stale segment worker or rotation
    // from the prior meeting is discarded — the segment recorder loop checks
    // sessionIdRef before continuing, and queued jobs carry their own session —
    // then wipe the Rust-side per-segment system-audio buffers so the next
    // meeting starts from a clean slate (no stale PCM at a colliding index).
    sessionIdRef.current += 1;
    void invoke("clear_meeting_segment_buffers").catch(() => {});
    transcriptRef.current = "";
    transcriptSegmentsRef.current = [];
    startedAtRef.current = "";
    setTranscript("");
    setTranscriptSegments([]);
    setStartedAt("");
    // Reset the elapsed timer too — otherwise a fresh meeting setup ("New
    // meeting" / Back / start-from-event) keeps showing the *previous*
    // meeting's recording time in the record pill until the next start, since
    // recordingTime only otherwise zeroes inside startRecording().
    setRecordingTime(0);
    setSegmentQueue(0);
    setSegmentsCompleted(0);
    setSegmentsTotal(0);
    setFailedSegments([]);
    setTranscriptionStatus("idle");
    // A fresh meeting setup ("New meeting" / Back / start-from-event) starts
    // unmuted; clear any stale mute so the next record pill doesn't show MUTED.
    setMicMuted(false);
  };

  const clearSystemAudioWarning = () => {
    setSystemAudioWarning("");
  };

  useEffect(() => {
    return () => {
      stopVadMonitor();
      if (timerRef.current) clearInterval(timerRef.current);
      if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current);
      stopRequestedRef.current = true;
      const activeRecorder = mediaRecorderRef.current;
      if (activeRecorder && activeRecorder.state === "recording") {
        try {
          activeRecorder.stop();
        } catch (err) {
          console.warn("[meeting-record] mediaRecorder.stop on unmount:", err);
        }
      }
      if (systemAudioActiveRef.current) {
        systemAudioActiveRef.current = false;
        void invoke("stop_system_audio_capture", {
          sessionId: sessionIdRef.current,
        }).catch((err) => {
          console.warn(
            "[meeting-record] stop_system_audio_capture on unmount:",
            err,
          );
        });
      }
      // Re-enable the mic track on unmount so a mid-mute teardown doesn't leave
      // the shared warm stream muted for the dictation flow.
      const warmStream = warmStreamRef.current;
      if (warmStream) {
        for (const track of warmStream.getAudioTracks()) {
          track.enabled = true;
        }
      }
    };
  }, [stopVadMonitor, warmStreamRef]);

  // Re-assigned every render so the closure reads live refs. Busy = recording,
  // OR segments still queued/being-worked, OR a stop was requested and the
  // finalize tail hasn't completed.
  isPipelineBusyRef.current = () =>
    isRecordingRef.current ||
    segmentQueueRef.current.length > 0 ||
    segmentWorkerRunningRef.current ||
    stopRequestedRef.current;

  return {
    isRecording,
    isRecordingRef,
    isPipelineBusyRef,
    isPreparing,
    isMuted,
    toggleMute,
    isCapturingSystemAudio,
    recordingTime,
    transcript,
    transcriptSegments,
    startedAt,
    transcriptionStatus,
    segmentQueue,
    segmentsCompleted,
    segmentsTotal,
    failedSegments,
    systemAudioWarning,
    clearSystemAudioWarning,
    startRecording,
    stopRecording,
    clearTranscript,
  };
}
