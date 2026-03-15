import { Mic, Square, Copy, Trash2, Loader2, Sparkles, BookOpen } from "lucide-react";

type TonePreset = "none" | "professional" | "casual" | "friendly";

interface RecordTabProps {
  isRecording: boolean;
  isProcessing: boolean;
  whisperLoaded: boolean;
  transcript: string;
  aiEditing: boolean;
  tonePreset: TonePreset;
  dictWords: string[];
  status: string;
  hotkeyWarning: string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCopyTranscript: () => void;
  onClearTranscript: () => void;
  onToggleAiEditing: () => void;
  onToneChange: (tone: TonePreset) => void;
}

export function RecordTab({
  isRecording,
  isProcessing,
  whisperLoaded,
  transcript,
  aiEditing,
  tonePreset,
  dictWords,
  status,
  hotkeyWarning,
  onStartRecording,
  onStopRecording,
  onCopyTranscript,
  onClearTranscript,
  onToggleAiEditing,
  onToneChange,
}: RecordTabProps) {
  const toneOptions: { value: TonePreset; label: string }[] = [
    { value: "none", label: "None" },
    { value: "professional", label: "Professional" },
    { value: "casual", label: "Casual" },
    { value: "friendly", label: "Friendly" },
  ];

  return (
    <div className="record-tab">
      {/* Status Bar */}
      <div className="status-bar-modern">
        <div className={`status-dot ${isRecording ? "recording" : isProcessing ? "processing" : whisperLoaded ? "ready" : "error"}`} />
        <span className="status-text">{status}</span>
      </div>

      {hotkeyWarning && (
        <div className="permission-warning-modern">
          <span>Hotkey unavailable:</span> {hotkeyWarning}
          <button className="dismiss-btn" onClick={() => {}}>✕</button>
        </div>
      )}

      {/* Main Content */}
      <div className="record-content">
        {/* Mic Section */}
        <div className="mic-section-modern">
          <div className="mic-ring-outer">
            <div className={`mic-ring-inner ${isRecording ? "recording" : ""}`}>
              <button
                className={`mic-button-modern ${isRecording ? "recording" : ""} ${!whisperLoaded ? "disabled" : ""}`}
                onClick={isRecording ? onStopRecording : onStartRecording}
                disabled={!whisperLoaded || isProcessing}
                title={isRecording ? "Stop recording" : "Start recording"}
              >
                {isProcessing ? (
                  <Loader2 size={28} className="spin" />
                ) : isRecording ? (
                  <Square size={24} fill="currentColor" />
                ) : (
                  <Mic size={28} />
                )}
              </button>
            </div>
          </div>

          <p className="mic-hint-modern">
            {isRecording
              ? "Recording — tap to stop"
              : isProcessing
              ? "Processing..."
              : "Hold Ctrl+Space anywhere · or tap to record"}
          </p>

          {/* Feature Badges */}
          <div className="feature-badges-modern">
            <div className={`whisper-badge-modern ${whisperLoaded ? "loaded" : "missing"}`}>
              <span className="whisper-dot" />
              Whisper {whisperLoaded ? "ready" : "not loaded"}
            </div>
            {aiEditing && (
              <div className="feature-badge-modern ai">
                <Sparkles size={12} />
                AI{tonePreset !== "none" ? ` · ${tonePreset}` : ""}
              </div>
            )}
            {dictWords.length > 0 && (
              <div className="feature-badge-modern dict">
                <BookOpen size={12} />
                {dictWords.length} word{dictWords.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* AI Editing Toggle */}
          <div className="ai-editing-section">
            <label className="ai-toggle-label">
              <input
                type="checkbox"
                checked={aiEditing}
                onChange={onToggleAiEditing}
              />
              <Sparkles size={14} />
              <span>AI Auto-Editing</span>
            </label>
            
            {aiEditing && (
              <div className="tone-selector">
                <span>Tone:</span>
                <div className="tone-buttons">
                  {toneOptions.map((option) => (
                    <button
                      key={option.value}
                      className={`tone-btn ${tonePreset === option.value ? "active" : ""}`}
                      onClick={() => onToneChange(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Output Section */}
        <div className="output-section-modern">
          <div className="output-header-modern">
            <span>Transcript</span>
            {transcript && (
              <div className="output-actions">
                <button className="action-btn" onClick={onCopyTranscript}>
                  <Copy size={14} />
                  Copy
                </button>
                <button className="action-btn destructive" onClick={onClearTranscript}>
                  <Trash2 size={14} />
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="output-content">
            {transcript ? (
              <p className="transcript-text">{transcript}</p>
            ) : (
              <div className="transcript-placeholder">
                <Mic size={32} className="placeholder-icon" />
                <span>Your transcription will appear here...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
