"use client";

import React, { useEffect, useRef } from "react";
import { v2 } from "@/components/v2/V2Primitives";

interface RecordingWaveformProps {
  /** True while actively recording — bars react to the live mic. */
  active: boolean;
  /** Number of bars. The v2 design (`V2WebRecording`) uses 32. */
  bars?: number;
  /** Container height in px. The design field is 140. */
  height?: number;
}

/**
 * Audio-reactive recording indicator.
 *
 * Matches the v2 design system (`V2WebRecording` / `ScrWave`): a centered field
 * of terracotta rounded bars — never a circle. While recording, bar heights are
 * driven by live mic frequency data from an AnalyserNode and written straight to
 * the DOM via refs on a requestAnimationFrame loop, so it stays smooth without
 * per-frame React renders. At rest (and under prefers-reduced-motion) it shows
 * the design's quiet static silhouette.
 *
 * This replaces the old `RecordingControls` cyan `meet-ripple` ring, which was
 * off-palette (`rgba(8,145,178)` — CLAUDE.md forbids reintroducing cyan) and
 * read as a "circle" instead of the editorial waveform the design calls for.
 */
function RecordingWaveformBase({ active, bars = 32, height = 140 }: RecordingWaveformProps) {
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // The design caps live bars around 0.78 of the field height.
  const maxBar = height * 0.78;

  useEffect(() => {
    if (!active) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return; // keep the static silhouette, no mic/rAF

    let mounted = true;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") void ctx.resume();

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128; // 64 bins — plenty for ~32 bars
        analyser.smoothingTimeConstant = 0.72;
        analyserRef.current = analyser;
        ctx.createMediaStreamSource(stream).connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        // Speech energy lives in the lower bins — map bars across the lower ~70%.
        const usableBins = Math.max(1, Math.floor(analyser.frequencyBinCount * 0.7));

        const render = () => {
          const an = analyserRef.current;
          if (!mounted || !an) return;
          an.getByteFrequencyData(data);
          const n = barRefs.current.length;
          for (let i = 0; i < n; i++) {
            const el = barRefs.current[i];
            if (!el) continue;
            const bin = Math.floor((i / n) * usableBins);
            const v = data[bin] / 255; // 0..1
            const floor = 6 + Math.abs(Math.sin(i * 0.5 + 1)) * 8; // quiet shimmer
            const h = Math.max(floor, 8 + v * (maxBar - 8));
            el.style.height = `${h}px`;
            el.style.opacity = String(0.45 + v * 0.5);
          }
          rafRef.current = requestAnimationFrame(render);
        };
        render();
      } catch (e) {
        // Mic unavailable for the meter (in use, denied, etc.). The static
        // silhouette stays; recording/transcription itself is unaffected.
        console.error("Waveform mic init failed:", e);
      }
    };

    void init();

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current) void audioCtxRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      rafRef.current = null;
      audioCtxRef.current = null;
      analyserRef.current = null;
      streamRef.current = null;
    };
  }, [active, maxBar]);

  return (
    <div className="flex items-center justify-center gap-1.5" style={{ height }} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => {
        // Resting silhouette: while recording it mirrors the design mock's shape
        // (the rAF loop then drives it live); idle is a quieter, shorter field.
        const seed = Math.abs(Math.sin(i * 0.42 + 1.4));
        const restH = active ? 14 + seed * (maxBar - 14) : 6 + Math.abs(Math.sin(i * 0.4)) * 14;
        return (
          <span
            key={i}
            ref={(el) => {
              barRefs.current[i] = el;
            }}
            className="rounded-full"
            style={{
              width: 4,
              height: restH,
              background: active ? v2.accent : v2.ruleHard,
              opacity: active ? 0.5 + Math.abs(Math.sin(i * 0.3)) * 0.4 : 0.35,
              transition: active
                ? "none"
                : "height 0.3s ease, opacity 0.3s ease, background 0.4s ease",
            }}
          />
        );
      })}
    </div>
  );
}

export const RecordingWaveform = React.memo(RecordingWaveformBase);
