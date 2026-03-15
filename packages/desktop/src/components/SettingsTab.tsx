import { FolderOpen, Keyboard, Sparkles, Trash2 } from "lucide-react";

type TonePreset = "none" | "professional" | "casual" | "friendly";

interface SettingsTabProps {
  whisperModelPath: string;
  autoPaste: boolean;
  aiEditing: boolean;
  tonePreset: TonePreset;
  userApiKey: string;
  whisperLoaded: boolean;
  onModelPathChange: (path: string) => void;
  onLoadModel: () => void;
  onAutoPasteChange: (value: boolean) => void;
  onAiEditingChange: (value: boolean) => void;
  onTonePresetChange: (tone: TonePreset) => void;
  onApiKeyChange: (key: string) => void;
  onSaveApiKey: () => void;
  onClearData: () => void;
}

export function SettingsTab({
  whisperModelPath,
  autoPaste,
  aiEditing,
  tonePreset,
  userApiKey,
  whisperLoaded,
  onModelPathChange,
  onLoadModel,
  onAutoPasteChange,
  onAiEditingChange,
  onTonePresetChange,
  onApiKeyChange,
  onSaveApiKey,
  onClearData,
}: SettingsTabProps) {
  const toneOptions: { value: TonePreset; label: string }[] = [
    { value: "none", label: "None" },
    { value: "professional", label: "Professional" },
    { value: "casual", label: "Casual" },
    { value: "friendly", label: "Friendly" },
  ];

  return (
    <div className="settings-tab">
      <h2 className="settings-tab-title">Settings</h2>

      <div className="settings-grid">
        {/* Model Settings */}
        <div className="settings-card">
          <div className="settings-card-header">
            <FolderOpen size={20} />
            <h3>Whisper Model</h3>
          </div>
          <p className="settings-card-description">
            Configure the speech recognition model path.
          </p>
          <div className="model-input-modern">
            <input
              type="text"
              value={whisperModelPath}
              onChange={(e) => onModelPathChange(e.target.value)}
              placeholder="/path/to/ggml-base.bin"
            />
            <button 
              onClick={onLoadModel} 
              disabled={!whisperModelPath}
              className={whisperLoaded ? "loaded" : ""}
            >
              {whisperLoaded ? "Loaded" : "Load"}
            </button>
          </div>
          <p className="settings-hint">
            Recommended: ggml-small.bin from HuggingFace
          </p>
        </div>

        {/* Hotkey Settings */}
        <div className="settings-card">
          <div className="settings-card-header">
            <Keyboard size={20} />
            <h3>Hotkey</h3>
          </div>
          <p className="settings-card-description">
            Configure global hotkey behavior.
          </p>
          <label className="toggle-setting">
            <input
              type="checkbox"
              checked={autoPaste}
              onChange={(e) => onAutoPasteChange(e.target.checked)}
            />
            <span>Auto-paste into active app after transcription</span>
          </label>
          <p className="settings-hint">
            Hold <kbd>Ctrl</kbd>+<kbd>Space</kbd> in any app to start recording.
            Requires Accessibility & Input Monitoring permissions.
          </p>
        </div>

        {/* AI Settings */}
        <div className="settings-card">
          <div className="settings-card-header">
            <Sparkles size={20} />
            <h3>AI Enhancement</h3>
          </div>
          <p className="settings-card-description">
            Configure AI editing and enhancement options.
          </p>
          
          <label className="toggle-setting">
            <input
              type="checkbox"
              checked={aiEditing}
              onChange={(e) => onAiEditingChange(e.target.checked)}
            />
            <span>Enable AI editing (removes filler words, fixes grammar)</span>
          </label>

          {aiEditing && (
            <div className="tone-setting">
              <span>Default tone preset:</span>
              <div className="tone-buttons-modern">
                {toneOptions.map((option) => (
                  <button
                    key={option.value}
                    className={tonePreset === option.value ? "active" : ""}
                    onClick={() => onTonePresetChange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="api-key-section">
            <label>DeepSeek API Key (optional)</label>
            <div className="api-key-input">
              <input
                type="password"
                value={userApiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder="sk-..."
              />
              <button onClick={onSaveApiKey}>Save</button>
            </div>
            <p className="settings-hint">
              Leave blank to use OSCAR&apos;s AI service. Your key is stored locally.
            </p>
          </div>
        </div>

        {/* Data Management */}
        <div className="settings-card danger">
          <div className="settings-card-header">
            <Trash2 size={20} />
            <h3>Data Management</h3>
          </div>
          <p className="settings-card-description">
            Clear local data and reset settings.
          </p>
          <button className="clear-data-btn" onClick={onClearData}>
            Clear All Local Data
          </button>
        </div>
      </div>
    </div>
  );
}
