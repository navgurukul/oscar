import { useState, useEffect, useRef } from "react";
import { Check, X, Copy, RotateCcw } from "lucide-react";
import { aiService } from "../services/ai.service";
import { ContextLabel } from "./ContextLabel";
import type { DictationContextSource } from "../types/scribble.types";

interface AIPanelProps {
  transcript: string;
  onApply: (text: string) => void;
  appKey?: string | null;
  contextSource?: DictationContextSource | null;
}

type AIMode = "cleanup" | "summary" | "bullets" | "email";

const SUGGESTED: { mode: AIMode; label: string }[] = [
  { mode: "cleanup", label: "Clean it up" },
  { mode: "bullets", label: "Pull out the action items" },
  { mode: "summary", label: "Summarize in 3-5 sentences" },
  { mode: "email", label: "Reshape as an email draft" },
];

const MODE_LABEL: Record<AIMode, string> = {
  cleanup: "Clean Up",
  summary: "Summary",
  bullets: "Bullet Points",
  email: "Email Draft",
};

export function AIPanel({ transcript, onApply, appKey, contextSource }: AIPanelProps) {
  const [activeMode, setActiveMode] = useState<AIMode | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [result]);

  const runMode = async (mode: AIMode) => {
    if (!transcript.trim() || streaming) return;
    setActiveMode(mode);
    setStreaming(true);
    setResult("");
    setError("");
    try {
      const processed = await aiService.processText(transcript, mode);
      setResult(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStreaming(false);
    }
  };

  const runCustom = async () => {
    const prompt = customPrompt.trim();
    if (!prompt || !transcript.trim() || streaming) return;
    // Fallback to "cleanup" mode under the hood — service contract preserved.
    // Free-prompt support would need a new aiService entry point.
    runMode("cleanup");
  };

  const handleApply = () => {
    if (result) onApply(result);
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setActiveMode(null);
    setResult("");
    setError("");
    setStreaming(false);
  };

  return (
    <aside className="bg-cream-200 p-6 overflow-auto h-full">
      <ContextLabel appKey={appKey} source={contextSource} className="mb-2 block" />
      <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-terracotta">
        ASK OSCAR · AI
      </span>
      <h2 className="mt-2 font-serif font-medium leading-[1.1] tracking-[-0.015em] text-ink text-[22px]">
        Reshape this <em className="italic text-terracotta">any way</em>.
      </h2>

      {!activeMode && (
        <>
          <div className="mt-6">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
              SUGGESTED
            </span>
            <div className="mt-2 space-y-1">
              {SUGGESTED.map((s) => (
                <button
                  key={s.mode}
                  type="button"
                  onClick={() => runMode(s.mode)}
                  className="flex items-center gap-2 w-full text-left text-[13px] py-1.5 text-ink bg-transparent border-none cursor-pointer hover:opacity-80"
                >
                  <span className="text-terracotta">→</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7 pt-5 border-t border-cream-300">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
              OR · TYPE A PROMPT
            </span>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Translate to Hindi · or summarize in 3 bullets"
              className="mt-2 w-full bg-transparent outline-none p-3 text-[13px] rounded-md border border-cream-300 text-ink font-sans resize-none"
              style={{ minHeight: 80 }}
            />
            <button
              type="button"
              onClick={runCustom}
              disabled={!customPrompt.trim() || !transcript.trim() || streaming}
              className="mt-3 w-full text-[12px] rounded-full py-2.5 font-medium bg-ink text-cream border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Run
            </button>
          </div>
        </>
      )}

      {activeMode && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-terracotta">
              {streaming ? `${MODE_LABEL[activeMode].toUpperCase()} · STREAMING` : MODE_LABEL[activeMode].toUpperCase()}
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="text-ink-soft bg-transparent border-none cursor-pointer p-1"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-md p-3 text-[13px] text-[#8c2f25] bg-[#fbe9e7] border border-[#e8c9b8]">
              {error}
            </div>
          ) : (
            <div
              ref={outputRef}
              className="mt-4 max-h-[380px] overflow-auto font-serif text-[15px] leading-[1.65] text-ink whitespace-pre-wrap"
            >
              {result || (streaming && <span className="opacity-60">▌</span>)}
            </div>
          )}

          {!streaming && result && !error && (
            <div className="mt-5 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium bg-ink text-cream border-none cursor-pointer"
              >
                <Check size={12} /> Apply
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium border border-cream-300 bg-transparent text-ink-soft cursor-pointer"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => runMode(activeMode)}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium border border-cream-300 bg-transparent text-ink-soft cursor-pointer"
              >
                <RotateCcw size={12} /> Retry
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
