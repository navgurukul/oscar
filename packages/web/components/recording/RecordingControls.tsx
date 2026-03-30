"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface RecordingControlsProps {
  isRecording: boolean;
  isProcessing: boolean;
  isInitializing: boolean;
  isRequestingPermission?: boolean;
  onStart: () => void;
  onStop: () => void;
}

function useMicAudioLevel(isRecording: boolean) {
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRecording) {
      setAudioLevel(0);
      return;
    }

    let mounted = true;

    const initAudio = async () => {
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
        const audioContext = new AudioCtx();
        audioContextRef.current = audioContext;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const measure = () => {
          if (!analyserRef.current || !mounted) return;
          analyserRef.current.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const level = Math.min(1, avg / 60);
          setAudioLevel(level);

          rafRef.current = requestAnimationFrame(measure);
        };

        measure();
      } catch (e) {
        console.error("Audio init failed:", e);
      }
    };

    initAudio();

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [isRecording]);

  return audioLevel;
}

// Inject keyframes once into the document
const KEYFRAMES_ID = "meet-ripple-keyframes";
function injectKeyframes() {
  if (typeof document === "undefined" || document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes meet-ripple {
      0%   { transform: translate(-50%, -50%) scale(1);   opacity: var(--ring-opacity); }
      100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

export function RecordingControls({
  isRecording,
  isProcessing,
  isInitializing,
  isRequestingPermission = false,
  onStart,
  onStop,
}: RecordingControlsProps) {
  useEffect(() => { injectKeyframes(); }, []);

  const disabled = isProcessing || isInitializing || isRequestingPermission;
  const audioLevel = useMicAudioLevel(isRecording);

  // --- Google Meet ring behaviour ---
  // Silence dead-zone: no rings below threshold.
  // Above it, remap smoothly to [0 → 1].
  const THRESHOLD = 0.08;
  const normalised = audioLevel < THRESHOLD
    ? 0
    : (audioLevel - THRESHOLD) / (1 - THRESHOLD);

  // Meet uses 2–3 concentric halos that pulse outward.
  // The halos are filled (rgba background), not just borders.
  const BUTTON_SIZE = 120;          // px — base avatar size
  const CONTAINER_SIZE = BUTTON_SIZE * 3; // room for rings to expand

  // Ring colour: green when idle/recording, red tint when stopping
  const ringColor = "8, 145, 178"; // RGB

  // Rings: 3 layers with staggered delays, exactly like Meet
  const rings = [
    { delay: 0,    opacityMult: 1.00 },
    { delay: 0.35, opacityMult: 0.70 },
    { delay: 0.70, opacityMult: 0.45 },
  ];

  // Pulse speed: faster when louder (1.6 s silence → 0.9 s loud)
  const duration = Math.max(0.9, 1.6 - normalised * 0.7);

  // Base opacity of innermost ring (0 when silent, up to ~0.55 when loud)
  const baseOpacity = normalised * 0.85;

  return (
    <div className="flex justify-center">
      <div
        className="relative"
        style={{ width: CONTAINER_SIZE, height: CONTAINER_SIZE }}
      >
        {/* Ripple rings — only rendered while recording */}
        {isRecording &&
          rings.map(({ delay, opacityMult }, i) => {
            const ringOpacity = baseOpacity * opacityMult;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: BUTTON_SIZE,
                  height: BUTTON_SIZE,
                  borderRadius: "50%",
                  // Filled halo (Meet style) — no border, just a translucent disc
                  background: `rgba(${ringColor}, ${ringOpacity})`,
                  // CSS custom property lets the keyframe read the current opacity
                  "--ring-opacity": ringOpacity,
                  transform: "translate(-50%, -50%)",
                  animationName: "meet-ripple",
                  animationDuration: `${duration}s`,
                  animationTimingFunction: "ease-out",
                  animationIterationCount: "infinite",
                  animationDelay: `${delay * (duration / 1.6)}s`,
                  // Smooth opacity transitions between audio frames
                  transition: "background 0.08s ease",
                  pointerEvents: "none",
                  willChange: "transform, opacity",
                } as React.CSSProperties}
              />
            );
          })}

        {/* Avatar / action button */}
        <Button
          onClick={isRecording ? onStop : onStart}
          disabled={disabled}
          className="focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
            minWidth: BUTTON_SIZE,
            minHeight: BUTTON_SIZE,
            borderRadius: "50%",
            backgroundColor: isRecording
              ? "#dc2626"
              : disabled
              ? "#4b5563"
              : "#0891b2",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            zIndex: 1,
          }}
        >
          {disabled ? (
            <Spinner style={{ width: "2.5rem", height: "2.5rem", color: "white" }} />
          ) : isRecording ? (
            <Square style={{ width: "2.5rem", height: "2.5rem", color: "white", fill: "currentColor" }} />
          ) : (
            <Mic style={{ width: "3rem", height: "3rem", color: "white" }} />
          )}
        </Button>
      </div>
    </div>
  );
}