import { useState, useEffect, useMemo } from "react";
import {
  BookOpen,
  Search,
  Loader2,
  ExternalLink,
  LogOut,
  Trash2,
  Lock,
  Mail,
  FolderOpen,
  Plus,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { BillingSection } from "./BillingSection";
import { VocabularySection } from "./VocabularySection";
import { VibeCodingPicker } from "./VibeCodingPicker";
import { getInitials } from "../lib/utils";
import { isContextAwarePlatform } from "../lib/dictation-context";
import {
  formatModelSize,
  type ModelPreset,
} from "../lib/whisper-models";
import type { RoleModelState, WhisperModelRole } from "../lib/app-types";
import {
  CLEANUP_STYLE_OPTIONS,
  type CleanupStyle,
} from "../lib/cleanup-style";
import { scribblesService } from "../services/scribbles.service";
import type { DBScribble } from "../types/scribble.types";

/* ── Types ── */

/** Accepts legacy tab names from callers */
type SettingsSection =
  | "billing"
  | "vocabulary"
  | "general"
  | "account"
  | "folders"
  | "privacy";

/** Internal active tab — matches V2DesktopSettings six-tab IA. */
type ActiveTab =
  | "general"
  | "account"
  | "vocabulary"
  | "folders"
  | "billing"
  | "privacy";

function resolveTab(section?: SettingsSection): ActiveTab {
  if (section === "billing") return "billing";
  if (section === "privacy") return "privacy";
  if (section === "account") return "account";
  if (section === "vocabulary") return "vocabulary";
  if (section === "folders") return "folders";
  return "general";
}

/* ── Languages ── */

const LANGUAGES = [
  { code: "hi-en", flag: "🇮🇳", name: "Hinglish", native: "Hindi + English" },
  { code: "en", flag: "🇺🇸", name: "English", native: "English" },
  { code: "hi", flag: "🇮🇳", name: "Hindi", native: "हिन्दी" },
  { code: "es", flag: "🇪🇸", name: "Spanish", native: "Español" },
  { code: "fr", flag: "🇫🇷", name: "French", native: "Français" },
  { code: "de", flag: "🇩🇪", name: "German", native: "Deutsch" },
  { code: "zh", flag: "🇨🇳", name: "Chinese", native: "中文" },
  { code: "ja", flag: "🇯🇵", name: "Japanese", native: "日本語" },
  { code: "ar", flag: "🇸🇦", name: "Arabic", native: "العربية" },
  { code: "pt", flag: "🇧🇷", name: "Portuguese", native: "Português" },
  { code: "ru", flag: "🇷🇺", name: "Russian", native: "Русский" },
  { code: "ko", flag: "🇰🇷", name: "Korean", native: "한국어" },
  { code: "it", flag: "🇮🇹", name: "Italian", native: "Italiano" },
  { code: "nl", flag: "🇳🇱", name: "Dutch", native: "Nederlands" },
  { code: "pl", flag: "🇵🇱", name: "Polish", native: "Polski" },
  { code: "tr", flag: "🇹🇷", name: "Turkish", native: "Türkçe" },
  { code: "vi", flag: "🇻🇳", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "id", flag: "🇮🇩", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "uk", flag: "🇺🇦", name: "Ukrainian", native: "Українська" },
  { code: "sv", flag: "🇸🇪", name: "Swedish", native: "Svenska" },
  { code: "cs", flag: "🇨🇿", name: "Czech", native: "Čeština" },
  { code: "el", flag: "🇬🇷", name: "Greek", native: "Ελληνικά" },
  { code: "fi", flag: "🇫🇮", name: "Finnish", native: "Suomi" },
  { code: "ro", flag: "🇷🇴", name: "Romanian", native: "Română" },
  { code: "hu", flag: "🇭🇺", name: "Hungarian", native: "Magyar" },
  { code: "he", flag: "🇮🇱", name: "Hebrew", native: "עברית" },
  { code: "ur", flag: "🇵🇰", name: "Urdu", native: "اردو" },
  { code: "bn", flag: "🇧🇩", name: "Bengali", native: "বাংলা" },
  { code: "ta", flag: "🇮🇳", name: "Tamil", native: "தமிழ்" },
  { code: "te", flag: "🇮🇳", name: "Telugu", native: "తెలుగు" },
  { code: "ms", flag: "🇲🇾", name: "Malay", native: "Bahasa Melayu" },
  { code: "th", flag: "🇹🇭", name: "Thai", native: "ภาษาไทย" },
  { code: "da", flag: "🇩🇰", name: "Danish", native: "Dansk" },
];

const WEB_APP_URL =
  import.meta.env.VITE_WEB_APP_URL ?? "https://oscar.samyarth.org";

/* ── Helpers ── */

interface MicDevice {
  deviceId: string;
  label: string;
}

/** Editorial hairline row — col-span-4 label+desc · col-span-8 control/value.
 *  Matches V2DesktopSettings:741 row geometry. */
function SettingRow({
  label,
  description,
  children,
  align = "baseline",
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  align?: "baseline" | "center";
}) {
  return (
    <div
      className={`grid grid-cols-12 gap-5 py-4 border-b border-cream-300 ${
        align === "center" ? "items-center" : "items-baseline"
      }`}
    >
      <div className="col-span-4 min-w-0">
        <div className="text-[14px] font-medium text-ink leading-tight">{label}</div>
        {description && (
          <div className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">
            {description}
          </div>
        )}
      </div>
      <div className="col-span-8 min-w-0">{children}</div>
    </div>
  );
}

/** Mono value — terracotta when "on/active", ink-faint when "off/neutral". */
function MonoValue({
  value,
  on,
}: {
  value: string;
  on?: boolean;
}) {
  return (
    <span
      className={`font-mono text-[12px] tracking-[0.04em] ${
        on === false ? "text-ink-faint" : "text-terracotta"
      }`}
    >
      {value}
    </span>
  );
}

/** 3/9 caps section — V2WebSettings:376 pattern (col-span-3 caps · col-span-9 body). */
export function SettingsSection({
  caps,
  capsAccent = false,
  children,
  topBorder = true,
}: {
  caps: string;
  capsAccent?: boolean;
  children: React.ReactNode;
  topBorder?: boolean;
}) {
  return (
    <section
      className={`mt-12 grid grid-cols-12 gap-10 ${
        topBorder ? "border-t border-cream-300 pt-8" : ""
      }`}
    >
      <div className="col-span-3">
        <span
          className={`font-mono text-[10px] tracking-[0.18em] uppercase ${
            capsAccent ? "text-terracotta" : "text-ink-faint"
          }`}
        >
          {caps}
        </span>
      </div>
      <div className="col-span-9 min-w-0">{children}</div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`gen-toggle${checked ? " on" : ""}${disabled ? " disabled" : ""}`}
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
    >
      <span className="gen-toggle-thumb" />
    </button>
  );
}

function openExternalPage(url: string) {
  void openUrl(url).catch((error) => {
    console.error("Failed to open external link:", error);
  });
}

/* ── Nav ── */

const NAV_ITEMS: {
  id: ActiveTab;
  label: string;
  sub: string;
}[] = [
  { id: "general", label: "General", sub: "Behavior" },
  { id: "account", label: "Account", sub: "You" },
  { id: "vocabulary", label: "Vocabulary", sub: "Words Oscar knows" },
  { id: "folders", label: "Folders", sub: "Group what you said" },
  { id: "billing", label: "Plans & billing", sub: "Subscription" },
  { id: "privacy", label: "Data & privacy", sub: "Export · delete" },
];

/* ── Props ── */

interface SettingsTabProps {
  transcriptionLanguage: string;
  selectedMicId: string;
  onLanguageChange: (lang: string) => void;
  cleanupStyle: CleanupStyle;
  onCleanupStyleChange: (style: CleanupStyle) => void;
  onMicChange: (deviceId: string) => void;
  onClearData: () => void;
  userEmail?: string;
  userId?: string;
  onSignOut: () => void;
  aiImprovementEnabled: boolean;
  onAiImprovementChange: (enabled: boolean) => void;
  contextAwareDictationEnabled: boolean;
  onContextAwareDictationChange: (enabled: boolean) => void;
  contextAwarePlatform: string;
  initialSection?: SettingsSection;
  systemAudioSupported?: boolean;
  systemAudioEnabled?: boolean;
  onSystemAudioToggle?: (enabled: boolean) => void;
  dictationModel: RoleModelState;
  meetingModel: RoleModelState;
  onModelPresetChange: (role: WhisperModelRole, preset: ModelPreset) => void;
}

/* ── Component ── */

export function SettingsTab({
  transcriptionLanguage,
  selectedMicId,
  onLanguageChange,
  cleanupStyle,
  onCleanupStyleChange,
  onMicChange,
  onClearData,
  userEmail,
  userId,
  onSignOut,
  aiImprovementEnabled,
  onAiImprovementChange,
  contextAwareDictationEnabled,
  onContextAwareDictationChange,
  contextAwarePlatform,
  initialSection,
  systemAudioSupported = false,
  systemAudioEnabled = true,
  onSystemAudioToggle,
  dictationModel,
  meetingModel,
  onModelPresetChange,
}: SettingsTabProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    resolveTab(initialSection),
  );
  const [clearConfirm, setClearConfirm] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const [micDevices, setMicDevices] = useState<MicDevice[]>([]);

  const autoDetect = transcriptionLanguage === "auto";

  useEffect(() => {
    if (initialSection) setActiveTab(resolveTab(initialSection));
  }, [initialSection]);

  // Enumerate mic devices when General tab opens
  useEffect(() => {
    if (activeTab !== "general") return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const mics = devices
          .filter((d) => d.kind === "audioinput")
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${i + 1}`,
          }));
        setMicDevices(mics);
      })
      .catch(() => {});
  }, [activeTab]);

  const filteredLangs = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.native.toLowerCase().includes(langSearch.toLowerCase()),
  );

  const contextAwareSupported = isContextAwarePlatform(contextAwarePlatform);
  const contextAwareDisabled = !aiImprovementEnabled || !contextAwareSupported;
  const contextAwareDescription = !contextAwareSupported
    ? "Available on macOS and Windows"
    : aiImprovementEnabled
      ? "Adapt cleanup style to active app"
      : "Requires AI Cleanup";

  const renderModelStatus = (model: RoleModelState) => {
    if (model.downloadState === "downloading") {
      return (
        <div className="st-row-status st-row-status--downloading">
          <Loader2 size={12} className="animate-spin" />
          Downloading {Math.round(model.progress)}%
        </div>
      );
    }

    if (model.downloadState === "checking") {
      return (
        <div className="st-row-status st-row-status--downloading">
          <Loader2 size={12} className="animate-spin" />
          Preparing
        </div>
      );
    }

    if (model.activeVariant) {
      return (
        <div className="st-row-status st-row-status--installed">
          Ready
        </div>
      );
    }

    if (model.recommendation) {
      return (
        <div className="st-row-status">
          Will download · {formatModelSize(model.recommendation.spec.sizeBytes)}
        </div>
      );
    }

    return null;
  };

  const renderModelRow = (
    label: string,
    description: string,
    model: RoleModelState,
  ) => {
    return (
      <div className="st-row">
        <div className="st-row-text">
          <div className="st-row-label">{label}</div>
          <div className="st-row-desc">{description}</div>
          {renderModelStatus(model)}
          {model.error && <div className="st-row-error">{model.error}</div>}
        </div>
        <div className="st-row-action">
          <select
            className="st-select"
            value={model.preset}
            onChange={(e) =>
              onModelPresetChange(model.role, e.target.value as ModelPreset)
            }
            aria-label={label}
            disabled={model.downloadState === "downloading"}
          >
            <option value="auto">Auto (recommended)</option>
            <option value="fast">Fast</option>
            <option value="balanced">Balanced</option>
            <option value="best">Best quality</option>
          </select>
        </div>
      </div>
    );
  };

  return (
    <div className="st-layout">
      {/* ── Sidebar / Tab bar (V2WebSettings: serif label + caps-mono sub) ── */}
      <aside className="st-sidebar">
        <p className="st-sidebar-label">Settings</p>
        <nav className="st-nav">
          {NAV_ITEMS.map(({ id, label, sub }) => (
            <button
              key={id}
              className={`st-nav-btn${activeTab === id ? " active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="st-nav-label">{label}</span>
                <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-faint">
                  {sub}
                </span>
              </span>
            </button>
          ))}
        </nav>
        <div className="st-sidebar-spacer" />
      </aside>

      {/* ── Content ── */}
      <div className="st-panel" key={activeTab}>
        {/* ════════════ General ════════════ */}
        {activeTab === "general" && (
          <div className="st-content">
            <span className="st-content-eyebrow">SETTINGS · GENERAL</span>
            <h2 className="st-content-title">
              How Oscar <em>behaves</em>.
            </h2>

            {/* Hairline rows — V2DesktopSettings:741 pattern */}
            <div className="mt-2">
              <SettingRow
                label="Global hotkey"
                description="Hold to listen. Tap to start recording."
              >
                <MonoValue value="CTRL + SPACE" />
              </SettingRow>

              <SettingRow
                label="Auto-cleanup"
                description="Remove filler words. Fix punctuation. Format for the active app."
                align="center"
              >
                <div className="flex items-center gap-4">
                  <MonoValue
                    value={aiImprovementEnabled ? "ON" : "OFF"}
                    on={aiImprovementEnabled}
                  />
                  <Toggle
                    checked={aiImprovementEnabled}
                    onChange={() => onAiImprovementChange(!aiImprovementEnabled)}
                    label="Auto-cleanup"
                  />
                </div>
              </SettingRow>

              <SettingRow
                label="Context-aware dictation"
                description={contextAwareDescription}
                align="center"
              >
                <div className="flex items-center gap-4">
                  <MonoValue
                    value={
                      contextAwareSupported && contextAwareDictationEnabled && aiImprovementEnabled
                        ? "ON · CONTEXT-V1"
                        : !contextAwareSupported
                          ? "UNAVAILABLE"
                          : "OFF"
                    }
                    on={
                      contextAwareSupported &&
                      contextAwareDictationEnabled &&
                      aiImprovementEnabled
                    }
                  />
                  <Toggle
                    checked={
                      contextAwareDictationEnabled &&
                      aiImprovementEnabled &&
                      contextAwareSupported
                    }
                    onChange={() =>
                      onContextAwareDictationChange(!contextAwareDictationEnabled)
                    }
                    label="Context-aware dictation"
                    disabled={contextAwareDisabled}
                  />
                </div>
              </SettingRow>

              <SettingRow
                label="Microphone"
                description="The input device Oscar listens through."
                align="center"
              >
                <select
                  className="st-select"
                  value={selectedMicId}
                  onChange={(e) => onMicChange(e.target.value)}
                  aria-label="Microphone"
                >
                  <option value="">System Default</option>
                  {micDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </SettingRow>

              {systemAudioSupported && (
                <SettingRow
                  label="System audio"
                  description="Capture meeting participants on top of your mic."
                  align="center"
                >
                  <div className="flex items-center gap-4">
                    <MonoValue
                      value={systemAudioEnabled ? "ON" : "OFF"}
                      on={systemAudioEnabled}
                    />
                    <Toggle
                      checked={systemAudioEnabled}
                      onChange={() => onSystemAudioToggle?.(!systemAudioEnabled)}
                      label="System audio"
                    />
                  </div>
                </SettingRow>
              )}

              <SettingRow
                label="Language"
                description={
                  autoDetect
                    ? "Auto-detecting from the first seconds of speech."
                    : `Currently: ${
                        LANGUAGES.find((l) => l.code === transcriptionLanguage)?.name ??
                        transcriptionLanguage
                      }`
                }
                align="center"
              >
                <div className="flex items-center gap-4">
                  <MonoValue
                    value={autoDetect ? "AUTO" : transcriptionLanguage.toUpperCase()}
                  />
                  <Toggle
                    checked={autoDetect}
                    onChange={() => onLanguageChange(autoDetect ? "en" : "auto")}
                    label="Auto-detect"
                  />
                </div>
              </SettingRow>
            </div>

            {/* Language picker — opens inline when auto-detect off */}
            {!autoDetect && (
              <SettingsSection caps="LANGUAGE LIST">
                <div className="gen-search-wrap">
                  <Search size={14} className="gen-search-icon" />
                  <input
                    type="text"
                    className="gen-search"
                    placeholder="Search languages…"
                    value={langSearch}
                    onChange={(e) => setLangSearch(e.target.value)}
                  />
                </div>
                <div className="gen-lang-grid mt-3">
                  {filteredLangs.map((lang) => {
                    const isSelected = transcriptionLanguage === lang.code;
                    return (
                      <button
                        key={lang.code}
                        className={`gen-lang-tile${isSelected ? " selected" : ""}`}
                        onClick={() => onLanguageChange(lang.code)}
                      >
                        <span className="gen-lang-flag">{lang.flag}</span>
                        <span className="gen-lang-name">{lang.name}</span>
                        <span className="gen-lang-native">{lang.native}</span>
                      </button>
                    );
                  })}
                  {filteredLangs.length === 0 && (
                    <p className="gen-lang-empty">
                      No languages match "{langSearch}"
                    </p>
                  )}
                </div>
              </SettingsSection>
            )}

            {/* Voice models — 3/9 caps section */}
            <SettingsSection caps="VOICE MODELS">
              {renderModelRow(
                "Dictation",
                "For Scribbles, Stream, and Ctrl+Space.",
                dictationModel,
              )}
              <div className="st-divider" />
              {renderModelRow(
                "Meetings",
                "For Minutes and long meeting transcription.",
                meetingModel,
              )}
            </SettingsSection>

            {/* Cleanup style — persisted tone for AI-cleaned dictation. The
                Prompt Engineer rewrite mode is intentionally NOT here; it's an
                ephemeral, per-session toggle that lives on the recording pill. */}
            <SettingsSection caps="CLEANUP STYLE">
              <div className="st-row">
                <div className="st-row-text">
                  <div className="st-row-label">Dictation cleanup</div>
                  <div className="st-row-desc">
                    {CLEANUP_STYLE_OPTIONS.find((o) => o.value === cleanupStyle)
                      ?.hint ?? ""}
                  </div>
                </div>
                <div className="st-row-action">
                  <select
                    className="st-select"
                    value={cleanupStyle}
                    onChange={(e) =>
                      onCleanupStyleChange(e.target.value as CleanupStyle)
                    }
                    aria-label="Dictation cleanup style"
                  >
                    {CLEANUP_STYLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection caps="EXPERIMENTAL">
              <VibeCodingPicker />
            </SettingsSection>
          </div>
        )}

        {/* ════════════ Vocabulary ════════════ */}
        {activeTab === "vocabulary" &&
          (userId ? (
            <VocabularySection userId={userId} />
          ) : (
            <div className="st-content">
              <span className="st-content-eyebrow">SETTINGS · VOCABULARY</span>
              <h2 className="st-content-title">
                Words Oscar should <em>know</em>.
              </h2>
              <div className="st-empty-state">
                <BookOpen size={32} />
                <p>Sign in to manage your vocabulary.</p>
              </div>
            </div>
          ))}

        {/* ════════════ Plans & Billing ════════════ */}
        {activeTab === "billing" && (
          <div className="st-content">
            <span className="st-content-eyebrow">SETTINGS · PLANS & BILLING</span>
            <h2 className="st-content-title">
              Your <em>plan</em>, your terms.
            </h2>
            {userId && userEmail ? (
              <BillingSection userId={userId} />
            ) : (
              <div className="st-card st-card--grouped">
                <p className="st-row-desc" style={{ padding: "4px 0" }}>
                  Sign in to view your plan and usage.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ════════════ Account ════════════ */}
        {activeTab === "account" && (
          <div className="st-content">
            <span className="st-content-eyebrow">SETTINGS · ACCOUNT</span>
            <h2 className="st-content-title">
              You, on <em>Oscar</em>.
            </h2>
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ink-soft">
              Your identity, voice profile, and how Oscar shows up when it
              pastes for you.
            </p>

            {/* IDENTITY — V2WebSettings:376 */}
            <SettingsSection caps="IDENTITY">
              <SettingRow label="Display name" align="center">
                <span className="text-[14px] text-ink">
                  {userEmail?.split("@")[0] || "—"}
                </span>
              </SettingRow>
              <SettingRow label="Email" align="center">
                <span className="inline-flex items-center gap-2 text-[14px] text-ink">
                  <Mail size={12} className="text-ink-faint" />
                  {userEmail || "Not signed in"}
                </span>
              </SettingRow>
              <SettingRow label="Signed in with" align="center">
                <span className="inline-flex items-center gap-2 text-[14px] text-ink">
                  <Lock size={12} className="text-ink-faint" />
                  Google
                </span>
              </SettingRow>
              <SettingRow label="Language" align="center">
                <MonoValue
                  value={
                    autoDetect
                      ? "AUTO"
                      : (
                          LANGUAGES.find((l) => l.code === transcriptionLanguage)?.name ??
                          transcriptionLanguage
                        ).toUpperCase()
                  }
                />
              </SettingRow>
            </SettingsSection>

            {/* VOICE PROFILE — V2WebSettings:386 */}
            <SettingsSection caps="VOICE PROFILE">
              <SettingRow label="Auto-cleanup" align="center">
                <MonoValue
                  value={
                    aiImprovementEnabled
                      ? "ON · GEMINI REMOVES FILLER"
                      : "OFF"
                  }
                  on={aiImprovementEnabled}
                />
              </SettingRow>
              <SettingRow label="Context-aware dictation" align="center">
                <MonoValue
                  value={
                    contextAwareSupported &&
                    contextAwareDictationEnabled &&
                    aiImprovementEnabled
                      ? "ON · ADAPTS PER ACTIVE APP"
                      : !contextAwareSupported
                        ? "UNAVAILABLE"
                        : "OFF"
                  }
                  on={
                    contextAwareSupported &&
                    contextAwareDictationEnabled &&
                    aiImprovementEnabled
                  }
                />
              </SettingRow>
              <SettingRow label="Voice profile" align="center">
                <MonoValue value="DEFAULT" on={false} />
              </SettingRow>
            </SettingsSection>

            {/* SESSIONS — V2WebSettings:396 */}
            <SettingsSection caps="SESSIONS">
              <div className="flex items-center justify-between py-4 border-b border-cream-300">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-terracotta text-cream font-serif text-[13px] font-medium flex items-center justify-center shrink-0">
                    {getInitials(userEmail)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] text-ink truncate">
                      This device · OSCAR desktop
                    </div>
                    <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-ink-faint">
                      {userEmail || "Local session"}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[11px] tracking-[0.14em] text-terracotta">
                  HERE
                </span>
              </div>
              <button
                onClick={onSignOut}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-transparent px-4 py-2 text-[12px] text-ink-soft cursor-pointer hover:text-ink transition-colors"
              >
                <LogOut size={12} />
                Sign out on this device
              </button>
            </SettingsSection>
          </div>
        )}

        {/* ════════════ Folders ════════════ */}
        {activeTab === "folders" && (
          <FoldersPanel userId={userId} />
        )}

        {/* ════════════ Data & privacy ════════════ */}
        {activeTab === "privacy" && (
          <div className="st-content">
            <span className="st-content-eyebrow">SETTINGS · DATA &amp; PRIVACY</span>
            <h2 className="st-content-title">
              What we <em>do</em> with your voice.
            </h2>
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ink-soft">
              Oscar transcribes locally on this device when it can. Audio never
              leaves your machine unless you opt in. Transcripts sync if you're
              signed in.
            </p>

            {/* WHAT'S STORED — V2WebSettingsPrivacy:458 */}
            <SettingsSection caps="WHAT'S STORED">
              <SettingRow
                label="Audio recordings"
                description="Audio is discarded after transcription. Local-only by design."
                align="center"
              >
                <MonoValue value="OFF · DISCARDED" on={false} />
              </SettingRow>
              <SettingRow
                label="Transcripts"
                description="Cleaned text is stored so your library is searchable."
                align="center"
              >
                <MonoValue value="ON · REQUIRED" />
              </SettingRow>
              <SettingRow
                label="Telemetry"
                description="Anonymous crash reports only. No content ever leaves."
                align="center"
              >
                <MonoValue value="OFF" on={false} />
              </SettingRow>
            </SettingsSection>

            {/* YOUR DATA — V2WebSettingsPrivacy:467 */}
            <SettingsSection caps="YOUR DATA">
              <div className="space-y-3">
                <div className="rounded-lg p-5 flex items-start justify-between gap-6 bg-cream-200 border border-cream-300">
                  <div className="min-w-0">
                    <div className="font-serif text-[20px] font-medium text-ink leading-tight">
                      Export everything
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                      Download a ZIP of every Scribble, every Minutes, every
                      vocabulary entry. Markdown + JSON.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openExternalPage(`${WEB_APP_URL}/settings`)}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-ink text-cream px-4 py-2 text-[12px] font-medium border-none cursor-pointer transition-opacity hover:opacity-90"
                  >
                    <ExternalLink size={11} />
                    Start export
                  </button>
                </div>
                <div className="rounded-lg p-5 flex items-start justify-between gap-6 border border-[#d6b3a8]">
                  <div className="min-w-0">
                    <div className="font-serif text-[20px] font-medium text-[#8c2f25] leading-tight">
                      Clear local data
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                      Reset this device — remove downloaded models, cached
                      data, and sign out. Does not delete server data.
                    </p>
                  </div>
                  {clearConfirm ? (
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setClearConfirm(false);
                          onClearData();
                        }}
                        className="rounded-full px-4 py-2 text-[12px] text-cream bg-[#8c2f25] border-none cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setClearConfirm(false)}
                        className="rounded-full px-4 py-2 text-[12px] text-ink-soft border border-cream-300 bg-transparent cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setClearConfirm(true)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] text-[#8c2f25] border border-[#d6b3a8] bg-transparent cursor-pointer"
                    >
                      <Trash2 size={11} />
                      Clear
                    </button>
                  )}
                </div>
                <div className="rounded-lg p-5 flex items-start justify-between gap-6 border border-[#d6b3a8]">
                  <div className="min-w-0">
                    <div className="font-serif text-[20px] font-medium text-[#8c2f25] leading-tight">
                      Delete account
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                      Permanently delete every Scribble, every Minutes, your
                      subscription. Cannot be undone.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openExternalPage(`${WEB_APP_URL}/settings`)}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] text-[#8c2f25] border border-[#d6b3a8] bg-transparent cursor-pointer"
                  >
                    Delete account
                  </button>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection caps="LEGAL">
              <div className="space-y-1">
                {[
                  { label: "Privacy Policy", href: `${WEB_APP_URL}/privacy` },
                  { label: "Terms of Service", href: `${WEB_APP_URL}/terms` },
                  { label: "Refund Policy", href: `${WEB_APP_URL}/refund-policy` },
                ].map(({ label, href }) => (
                  <button
                    key={href}
                    type="button"
                    onClick={() => openExternalPage(href)}
                    className="flex items-center justify-between w-full py-3 border-b border-cream-300 bg-transparent border-l-0 border-r-0 border-t-0 cursor-pointer text-left hover:bg-cream-100/40 transition-colors"
                  >
                    <span className="text-[14px] text-ink">{label}</span>
                    <ExternalLink size={12} className="text-ink-faint" />
                  </button>
                ))}
              </div>
            </SettingsSection>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Folders panel ── */

interface FolderSummary {
  name: string;
  count: number;
  latestTitle: string | null;
  latestCreatedAt: string | null;
}

function FoldersPanel({ userId }: { userId?: string }) {
  const [scribbles, setScribbles] = useState<DBScribble[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      const { data } = await scribblesService.getScribbles();
      if (cancelled) return;
      setScribbles(data ?? []);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const folders: FolderSummary[] = useMemo(() => {
    const byFolder = new Map<string, FolderSummary>();
    for (const s of scribbles) {
      const key = s.folder?.trim();
      if (!key) continue;
      const created = s.created_at;
      const existing = byFolder.get(key);
      if (!existing) {
        byFolder.set(key, {
          name: key,
          count: 1,
          latestTitle: s.title || s.original_formatted_text.slice(0, 80),
          latestCreatedAt: created,
        });
      } else {
        existing.count += 1;
        if (
          !existing.latestCreatedAt ||
          (created && created > existing.latestCreatedAt)
        ) {
          existing.latestTitle = s.title || s.original_formatted_text.slice(0, 80);
          existing.latestCreatedAt = created;
        }
      }
    }
    return [...byFolder.values()].sort((a, b) => b.count - a.count);
  }, [scribbles]);

  const totalFiled = folders.reduce((acc, f) => acc + f.count, 0);

  return (
    <div className="st-content">
      <span className="st-content-eyebrow">SETTINGS · FOLDERS</span>
      <h2 className="st-content-title">
        How you <em>group</em> things.
      </h2>
      <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ink-soft">
        Oscar routes Scribbles to folders automatically based on what you
        said. They show up in your sidebar so you can jump straight in.
      </p>

      <SettingsSection caps={`YOUR FOLDERS · ${folders.length} · ${totalFiled} SCRIBBLES FILED`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-ink-faint">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : folders.length === 0 ? (
          <div className="rounded-lg p-8 text-center bg-cream-200 border border-cream-300">
            <FolderOpen className="mx-auto mb-3 text-ink-faint" size={28} />
            <p className="font-serif text-[18px] text-ink leading-snug">
              No folders yet.
            </p>
            <p className="mt-1.5 text-[13px] text-ink-soft">
              Folders form when you tag Scribbles. Try a few captures and they
              will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5">
            {folders.map((f) => (
              <div
                key={f.name}
                className="rounded-lg p-6 bg-cream-200 border border-cream-300"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-serif font-medium text-ink leading-tight" style={{ fontSize: 26, letterSpacing: "-0.015em" }}>
                    {f.name}
                  </h3>
                  <span className="font-mono text-[13px] text-terracotta">
                    {f.count}
                  </span>
                </div>
                {f.latestTitle && (
                  <div className="mt-5 text-[12px] leading-relaxed text-ink-soft">
                    <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
                      LATEST
                    </span>
                    <p className="mt-1.5 text-[13px] text-ink line-clamp-2">
                      {f.latestTitle}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-6 inline-flex items-center gap-2 text-[12px] text-ink-soft">
          <Plus size={12} className="text-ink-faint" />
          New folders form when Oscar groups a Scribble. No manual create yet.
        </p>
      </SettingsSection>
    </div>
  );
}
