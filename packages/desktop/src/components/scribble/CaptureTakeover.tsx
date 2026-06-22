import { Square } from "lucide-react";
import { Caps } from "./_shared";

// Full-screen capture surface (design screen 02). No sidebar — listening is the
// only job. The waveform is a CSS animation, not real mic data: the recorder
// runs in Rust and the frontend only sees isRecording + elapsed seconds, so the
// bars are decorative motion (matching the design, which is also CSS-animated).

const BAR_COUNT = 28;

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function CaptureTakeover({
  recordingTime,
  caption = "Recording on this Mac · click to stop",
  onStop,
}: {
  recordingTime: number;
  caption?: string;
  onStop: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-cream overflow-hidden text-center px-12">
      <style>{`@keyframes scrBar{0%,100%{transform:scaleY(.28)}50%{transform:scaleY(1)}}`}</style>
      <Caps tone="terra">● RECORDING</Caps>
      <h1
        className="mt-4 font-serif font-medium text-ink"
        style={{ fontSize: 46, lineHeight: 1, letterSpacing: "-0.03em", maxWidth: 560 }}
      >
        <em className="italic text-terracotta">Listening</em>. Say it once.
      </h1>

      <div className="mt-12 flex items-end gap-1.5" style={{ height: 120 }} aria-hidden>
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <span
            key={i}
            className="rounded-full bg-terracotta"
            style={{
              width: 4,
              height: 18 + Math.abs(Math.sin(i * 0.5)) * 78,
              transformOrigin: "center bottom",
              animation: `scrBar ${0.7 + (i % 5) * 0.12}s ease-in-out ${(i % 7) * 0.06}s infinite`,
              opacity: 0.5 + Math.abs(Math.sin(i * 0.3)) * 0.4,
            }}
          />
        ))}
      </div>

      <div className="mt-10 font-mono text-[14px] text-terracotta tabular-nums">
        {formatTime(recordingTime)}
      </div>
      <p className="mt-1.5">
        <Caps>{caption}</Caps>
      </p>

      <button
        type="button"
        onClick={onStop}
        className="mt-9 inline-flex items-center gap-2.5 rounded-full pl-3 pr-6 py-2.5 bg-ink text-cream border-none cursor-pointer shadow-lg transition-opacity hover:opacity-90"
      >
        <span
          className="inline-flex items-center justify-center rounded-full bg-terracotta shrink-0"
          style={{ height: 34, width: 34 }}
        >
          <Square size={13} fill="currentColor" />
        </span>
        <span className="text-[15px] font-medium">Stop recording</span>
      </button>
      <p className="mt-4 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-faint">
        Your voice stays on this Mac
      </p>
    </div>
  );
}
