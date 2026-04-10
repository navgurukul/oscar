import { useState, useEffect, useRef } from "react";
import { Sparkles, FileText, List, Mail, Check, X, Copy, RotateCcw } from "lucide-react";
import { aiService } from "../services/ai.service";

interface AIPanelProps {
  transcript: string;
  onApply: (text: string) => void;
}

type AIMode = "cleanup" | "summary" | "bullets" | "email";

const AI_ACTIONS: { mode: AIMode; icon: typeof Sparkles; label: string; desc: string }[] = [
  { mode: "cleanup",  icon: Sparkles,  label: "Clean Up",      desc: "Fix grammar & remove fillers" },
  { mode: "summary",  icon: FileText,  label: "Summary",       desc: "3-5 sentence overview" },
  { mode: "bullets",  icon: List,      label: "Bullet Points", desc: "Key points as bullets" },
  { mode: "email",    icon: Mail,      label: "Email Draft",   desc: "Ready-to-send professional email" },
];

export function AIPanel({ transcript, onApply }: AIPanelProps) {
  const [activeMode, setActiveMode] = useState<AIMode | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll streaming output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
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
    <div className="ai-panel">
      {/* Action buttons row */}
      {!activeMode && (
        <div className="ai-panel-actions">
          <span className="ai-panel-label">
            <Sparkles size={12} />
            AI Actions
          </span>
          <div className="ai-panel-btns">
            {AI_ACTIONS.map(({ mode, icon: Icon, label, desc }) => (
              <button
                key={mode}
                className="ai-action-btn"
                title={desc}
                onClick={() => runMode(mode)}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active mode: streaming output */}
      {activeMode && (
        <div className="ai-output-wrap">
          <div className="ai-output-header">
            <div className="ai-output-title">
              {(() => {
                const action = AI_ACTIONS.find(a => a.mode === activeMode);
                if (!action) return null;
                const Icon = action.icon;
                return (
                  <>
                    <Icon size={14} />
                    <span>{action.label}</span>
                    {streaming && <span className="ai-thinking-dot" />}
                  </>
                );
              })()}
            </div>
            <button className="ai-output-close" onClick={handleReset} title="Dismiss">
              <X size={14} />
            </button>
          </div>

          {error ? (
            <div className="ai-output-error">{error}</div>
          ) : (
            <div className="ai-output-text" ref={outputRef}>
              {result || (streaming && <span className="ai-cursor-blink">&#9613;</span>)}
            </div>
          )}

          {!streaming && result && !error && (
            <div className="ai-output-footer">
              <button className="ai-footer-btn ai-footer-apply" onClick={handleApply}>
                <Check size={13} />
                Apply to transcript
              </button>
              <button className="ai-footer-btn ai-footer-copy" onClick={handleCopy}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button className="ai-footer-btn ai-footer-retry" onClick={() => runMode(activeMode)}>
                <RotateCcw size={13} />
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
