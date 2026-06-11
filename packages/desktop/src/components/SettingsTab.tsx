import { useState, useEffect, useMemo } from "react";
import {
  BookOpen,
  Search,
  Loader2,
  ExternalLink,
  LogOut,
  Trash2,
  Mail,
  FolderOpen,
  ChevronRight,
  AlertTriangle,
  Check,
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
type SettingsSectionId =
  | "billing"
  | "vocabulary"
  | "general"
  | "account"
  | "folders"
  | "privacy";

/** Internal active tab — matches V2DeskSettingsShell six-tab IA. */
type ActiveTab =
  | "general"
  | "account"
  | "vocabulary"
  | "folders"
  | "billing"
  | "privacy";

function resolveTab(section?: SettingsSectionId): ActiveTab {
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

function openExternalPage(url: string) {
  void openUrl(url).catch((error) => {
    console.error("Failed to open external link:", error);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Design-system primitives — port of oscar-v2-desk-settings.jsx (DS*).
   Cream/ink/terracotta Tailwind tokens map 1:1 onto the mock's v2 palette:
   cream-200 = #efeae0 (cream2), cream-300 = #e5e0d6 (rule),
   cream-400 = #d8d2c4 (ruleHard), terracotta = #b8623d (accent).
   ═══════════════════════════════════════════════════════════════════════════ */

const RULE = "#e5e0d6"; // cream-300

/** Mono micro-caps label. */
function Caps({
  children,
  accent = false,
  className = "",
}: {
  children: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-[10px] tracking-[0.18em] uppercase ${
        accent ? "text-terracotta" : "text-ink-faint"
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** Caps section header with a hard rule, then full-width rows below.
 *  Replaces the old 3/9 grid `SettingsSection`. Exported for BillingSection. */
export function Group({
  title,
  accent = false,
  first = false,
  children,
}: {
  title: string;
  accent?: boolean;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: first ? 0 : 30 }}>
      <div className="pb-2 border-b border-cream-400">
        <Caps accent={accent}>{title}</Caps>
      </div>
      <div className="mt-1">{children}</div>
    </section>
  );
}

/** Label + description on the left, a control on the right, hairline divider. */
function Row({
  label,
  desc,
  children,
  last = false,
}: {
  label?: React.ReactNode;
  desc?: React.ReactNode;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-start justify-between gap-6 py-4"
      style={{ borderBottom: last ? "none" : `1px solid ${RULE}` }}
    >
      {(label || desc) && (
        <div className="min-w-0" style={{ maxWidth: 340 }}>
          {label && (
            <div className="text-[14px] font-medium text-ink leading-tight">
              {label}
            </div>
          )}
          {desc && (
            <div className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">
              {desc}
            </div>
          )}
        </div>
      )}
      <div className="shrink-0 flex items-center" style={{ minHeight: 24 }}>
        {children}
      </div>
    </div>
  );
}

/** 40×22 pill toggle. */
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

/** Pill segmented control — selected option fills ink. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center rounded-full p-0.5 bg-cream-200 border border-cream-300"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3 py-1 text-[12px] border-none cursor-pointer transition-colors ${
              on
                ? "bg-ink text-cream font-medium"
                : "bg-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Keyboard chips, e.g. ⌘ + Space. */
function Kbd({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded border border-cream-400 bg-cream px-[7px] py-0.5"
        >
          <span className="font-mono text-[11px] tracking-[0.04em] text-ink">
            {k}
          </span>
        </span>
      ))}
    </span>
  );
}

/** Mono value — terracotta when "on/active", ink-faint when "off/neutral". */
function MonoValue({ value, on }: { value: string; on?: boolean }) {
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

/** Dashed empty panel — icon disc, serif line, body, optional CTA. */
export function EmptyPanel({
  icon,
  title,
  body,
  cta,
  onCta,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta?: string;
  onCta?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg px-7 py-10 text-center border border-dashed border-cream-400 bg-cream-200">
      <div
        className="mx-auto inline-flex items-center justify-center rounded-full border border-cream-400 bg-cream text-ink-faint"
        style={{ height: 40, width: 40 }}
      >
        {icon}
      </div>
      <h3
        className="mt-4 font-serif font-medium text-ink"
        style={{ fontSize: 21, letterSpacing: "-0.01em" }}
      >
        {title}
      </h3>
      <p
        className="mt-2 mx-auto text-[13px] leading-relaxed text-ink-soft"
        style={{ maxWidth: 360 }}
      >
        {body}
      </p>
      {cta && (
        <button
          type="button"
          onClick={onCta}
          className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-medium bg-ink text-cream border-none cursor-pointer transition-opacity hover:opacity-90"
        >
          {cta}
        </button>
      )}
      {children}
    </div>
  );
}

/** Terracotta attention banner — used for the mic-permission prompt. */
function Banner({
  title,
  body,
  cta,
  onCta,
}: {
  title: string;
  body: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <div className="rounded-lg px-5 py-4 flex items-start gap-4 bg-terracotta-100 border border-terracotta">
      <AlertTriangle
        size={18}
        className="text-terracotta shrink-0 mt-px"
        strokeWidth={1.8}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-ink">{title}</div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed" style={{ color: "#6b3a2a" }}>
          {body}
        </p>
      </div>
      {cta && (
        <button
          type="button"
          onClick={onCta}
          className="shrink-0 inline-flex items-center rounded-full px-4 py-2 text-[12px] font-medium bg-ink text-cream border-none cursor-pointer transition-opacity hover:opacity-90"
        >
          {cta}
        </button>
      )}
    </div>
  );
}

/* ── Nav ── */

const NAV_ITEMS: {
  id: ActiveTab;
  label: string;
  sub: string;
}[] = [
  { id: "general", label: "General", sub: "Hotkey · dictation · models" },
  { id: "account", label: "Account", sub: "You · sessions" },
  { id: "vocabulary", label: "Vocabulary", sub: "Words Oscar knows" },
  { id: "folders", label: "Folders", sub: "How you group things" },
  { id: "billing", label: "Plans & billing", sub: "Plan · usage" },
  { id: "privacy", label: "Data & privacy", sub: "Export · delete" },
];

/* ── Props ── */

interface SettingsTabProps {
  transcriptionLanguage: string;
  selectedMicId: string;
  onLanguageChange: (lang: string) => void;
  cleanupStyle: CleanupStyle;
  onCleanupStyleChange: (style: CleanupStyle) => void;
  promptMode: boolean;
  onPromptModeChange: (on: boolean) => void;
  onMicChange: (deviceId: string) => void;
  onClearData: () => void;
  perfLogTranscripts: boolean;
  onPerfLogTranscriptsChange: (enabled: boolean) => void;
  onClearDiagnostics: () => void;
  userEmail?: string;
  userId?: string;
  onSignOut: () => void;
  aiImprovementEnabled: boolean;
  onAiImprovementChange: (enabled: boolean) => void;
  contextAwareDictationEnabled: boolean;
  onContextAwareDictationChange: (enabled: boolean) => void;
  contextAwarePlatform: string;
  initialSection?: SettingsSectionId;
  systemAudioSupported?: boolean;
  systemAudioEnabled?: boolean;
  onSystemAudioToggle?: (enabled: boolean) => void;
  dictationModel: RoleModelState;
  meetingModel: RoleModelState;
  onModelPresetChange: (role: WhisperModelRole, preset: ModelPreset) => void;
  appVersion?: string | null;
}

/* ── Component ── */

export function SettingsTab({
  transcriptionLanguage,
  selectedMicId,
  onLanguageChange,
  cleanupStyle,
  onCleanupStyleChange,
  promptMode,
  onPromptModeChange,
  onMicChange,
  onClearData,
  perfLogTranscripts,
  onPerfLogTranscriptsChange,
  onClearDiagnostics,
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
  appVersion,
}: SettingsTabProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    resolveTab(initialSection),
  );
  const [clearConfirm, setClearConfirm] = useState(false);
  const [diagnosticsCleared, setDiagnosticsCleared] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const [micDevices, setMicDevices] = useState<MicDevice[]>([]);
  const [micPermission, setMicPermission] = useState<
    "granted" | "denied" | "unknown"
  >("unknown");

  const autoDetect = transcriptionLanguage === "auto";

  useEffect(() => {
    if (initialSection) setActiveTab(resolveTab(initialSection));
  }, [initialSection]);

  // Enumerate mic devices when General tab opens. A device that reports an
  // empty label means the page has no mic permission yet — surface the banner.
  useEffect(() => {
    if (activeTab !== "general") return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const inputs = devices.filter((d) => d.kind === "audioinput");
        const mics = inputs.map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${i + 1}`,
        }));
        setMicDevices(mics);
        setMicPermission(
          inputs.length > 0 && inputs.some((d) => d.label)
            ? "granted"
            : "denied",
        );
      })
      .catch(() => setMicPermission("denied"));
  }, [activeTab]);

  const filteredLangs = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.native.toLowerCase().includes(langSearch.toLowerCase()),
  );

  const currentMicLabel =
    micDevices.find((d) => d.deviceId === selectedMicId)?.label ??
    "System default";
  const currentLangName =
    LANGUAGES.find((l) => l.code === transcriptionLanguage)?.name ??
    transcriptionLanguage;

  const contextAwareSupported = isContextAwarePlatform(contextAwarePlatform);
  const contextAwareDisabled = !aiImprovementEnabled || !contextAwareSupported;
  const contextAwareOn =
    contextAwareSupported && contextAwareDictationEnabled && aiImprovementEnabled;
  const contextAwareDescription = !contextAwareSupported
    ? "Available on macOS and Windows."
    : aiImprovementEnabled
      ? "Adapt the output to Slack, Notion, Cursor, Gmail."
      : "Requires Auto-cleanup.";

  const requestMicAccess = () => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        setMicPermission("granted");
        return navigator.mediaDevices.enumerateDevices();
      })
      .then((devices) => {
        if (!devices) return;
        const mics = devices
          .filter((d) => d.kind === "audioinput")
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${i + 1}`,
          }));
        setMicDevices(mics);
      })
      .catch(() => setMicPermission("denied"));
  };

  const modelStatus = (model: RoleModelState): React.ReactNode => {
    if (model.downloadState === "downloading") {
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-terracotta">
          <Loader2 size={11} className="animate-spin" />
          Downloading {Math.round(model.progress)}%
        </span>
      );
    }
    if (model.downloadState === "checking") {
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-terracotta">
          <Loader2 size={11} className="animate-spin" />
          Preparing
        </span>
      );
    }
    if (model.activeVariant) return null;
    if (model.recommendation) {
      return (
        <span className="font-mono text-[11px] text-ink-faint">
          Will download · {formatModelSize(model.recommendation.spec.sizeBytes)}
        </span>
      );
    }
    return null;
  };

  const renderModelRow = (
    label: string,
    description: string,
    model: RoleModelState,
    last = false,
  ) => {
    const status = modelStatus(model);
    return (
      <Row
        label={label}
        desc={
          <>
            {description}
            {status && <span className="block mt-1">{status}</span>}
            {model.error && (
              <span className="block mt-1 text-[11px] text-[#dc2626]">
                {model.error}
              </span>
            )}
          </>
        }
        last={last}
      >
        <select
          className="ds-select"
          value={model.preset}
          onChange={(e) =>
            onModelPresetChange(model.role, e.target.value as ModelPreset)
          }
          aria-label={label}
          disabled={model.downloadState === "downloading"}
        >
          <option value="auto">Auto</option>
          <option value="fast">Fast</option>
          <option value="balanced">Balanced</option>
          <option value="best">Best quality</option>
        </select>
      </Row>
    );
  };

  return (
    <div className="st-layout">
      {/* ── Settings sub-nav: serif label + caps-mono sub + accent rail ── */}
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
                <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-ink-faint">
                  {sub}
                </span>
              </span>
            </button>
          ))}
        </nav>
        <div className="st-sidebar-spacer" />
        {appVersion && (
          <div className="flex items-center gap-2 px-2.5 pt-4">
            <Check size={11} className="text-ink-faint shrink-0" strokeWidth={1.8} />
            <span className="font-mono text-[10px] tracking-[0.06em] text-ink-faint">
              v{appVersion} · UP TO DATE
            </span>
          </div>
        )}
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

            {micPermission === "denied" && (
              <div className="mt-2">
                <Banner
                  title="Microphone access needed"
                  body="Oscar can’t hear you yet. Grant access to start dictating and recording."
                  cta="Grant access"
                  onCta={requestMicAccess}
                />
              </div>
            )}

            {/* INPUT */}
            <Group title="INPUT" first={micPermission !== "denied"}>
              <Row
                label="Microphone"
                desc="The device Oscar listens through."
              >
                <label className="ds-picker">
                  <span className="ds-picker-value">{currentMicLabel}</span>
                  <ChevronRight size={12} className="text-ink-faint" />
                  <select
                    value={selectedMicId}
                    onChange={(e) => onMicChange(e.target.value)}
                    aria-label="Microphone"
                  >
                    <option value="">System default</option>
                    {micDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
              </Row>
              {systemAudioSupported && (
                <Row
                  label="System audio"
                  desc="Capture meeting participants on top of your mic."
                  last
                >
                  <Toggle
                    checked={systemAudioEnabled}
                    onChange={() => onSystemAudioToggle?.(!systemAudioEnabled)}
                    label="System audio"
                  />
                </Row>
              )}
            </Group>

            {/* DICTATION */}
            <Group title="DICTATION">
              <Row
                label="Dictation hotkey"
                desc="Hold to stream cleaned text into the app you’re in."
              >
                <Kbd keys={["Ctrl", "Space"]} />
              </Row>
              <Row
                label="Auto-cleanup"
                desc="Remove filler words, fix punctuation, format for the active app."
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
              </Row>
              <Row
                label="Context-aware dictation"
                desc={contextAwareDescription}
              >
                <div className="flex items-center gap-3">
                  {contextAwareOn && (
                    <span className="font-mono text-[10.5px] tracking-[0.08em] text-terracotta">
                      CONTEXT-V1
                    </span>
                  )}
                  <Toggle
                    checked={contextAwareOn}
                    onChange={() =>
                      onContextAwareDictationChange(!contextAwareDictationEnabled)
                    }
                    label="Context-aware dictation"
                    disabled={contextAwareDisabled}
                  />
                </div>
              </Row>
              <Row
                label="Dictation cleanup"
                desc={
                  CLEANUP_STYLE_OPTIONS.find((o) => o.value === cleanupStyle)
                    ?.hint ?? "How Oscar polishes dictated text."
                }
              >
                <Segmented
                  ariaLabel="Dictation cleanup style"
                  value={cleanupStyle}
                  onChange={(v) => onCleanupStyleChange(v)}
                  options={CLEANUP_STYLE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                />
              </Row>
              <Row
                label="Prompt mode"
                desc="Rewrites your speech into a clean, ready-to-paste prompt instead of just tidying it."
                last
              >
                <div className="flex items-center gap-4">
                  <MonoValue value={promptMode ? "ON" : "OFF"} on={promptMode} />
                  <Toggle
                    checked={promptMode}
                    onChange={() => onPromptModeChange(!promptMode)}
                    label="Prompt mode"
                  />
                </div>
              </Row>
            </Group>

            {/* LANGUAGE */}
            <Group title="LANGUAGE">
              <Row
                label="Auto-detect language"
                desc={
                  autoDetect
                    ? "Detecting from the first seconds of speech."
                    : `Fixed to ${currentLangName}.`
                }
                last={autoDetect}
              >
                <div className="flex items-center gap-4">
                  <MonoValue
                    value={
                      autoDetect ? "AUTO" : transcriptionLanguage.toUpperCase()
                    }
                    on={autoDetect}
                  />
                  <Toggle
                    checked={autoDetect}
                    onChange={() => onLanguageChange(autoDetect ? "en" : "auto")}
                    label="Auto-detect language"
                  />
                </div>
              </Row>
              {!autoDetect && (
                <div className="pt-4">
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
                        No languages match “{langSearch}”
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Group>

            {/* VOICE MODELS */}
            <Group title="VOICE MODELS">
              {renderModelRow(
                "Dictation",
                "For Scribbles and Stream.",
                dictationModel,
              )}
              {renderModelRow(
                "Meetings",
                "For Minutes and long meeting transcription.",
                meetingModel,
                true,
              )}
            </Group>

            {/* EXPERIMENTAL */}
            <Group title="EXPERIMENTAL">
              <div className="pt-2">
                <VibeCodingPicker />
              </div>
            </Group>
          </div>
        )}

        {/* ════════════ Account ════════════ */}
        {activeTab === "account" && (
          <div className="st-content">
            <span className="st-content-eyebrow">SETTINGS · ACCOUNT</span>
            <h2 className="st-content-title">
              You, on <em>Oscar</em>.
            </h2>
            <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-ink-soft">
              Your identity, voice profile, and the devices signed into this
              account.
            </p>

            {/* Profile header */}
            <div className="flex items-center gap-4 pb-6 mt-7 border-b border-cream-300">
              <div className="h-[52px] w-[52px] rounded-full bg-terracotta text-cream font-serif text-[20px] font-medium flex items-center justify-center shrink-0">
                {getInitials(userEmail)}
              </div>
              <div className="min-w-0">
                <div className="font-serif text-[22px] font-medium text-ink leading-tight">
                  {userEmail?.split("@")[0] || "Signed in"}
                </div>
                <div className="mt-0.5 text-[13px] text-ink-soft truncate">
                  {userEmail || "Local session"}
                </div>
              </div>
            </div>

            {/* IDENTITY — caps label stacked above value, action on the right */}
            <Group title="IDENTITY">
              <div
                className="flex items-center justify-between gap-4 py-3.5"
                style={{ borderBottom: `1px solid ${RULE}` }}
              >
                <div className="min-w-0">
                  <Caps>DISPLAY NAME</Caps>
                  <div className="mt-1 text-[14px] text-ink truncate">
                    {userEmail?.split("@")[0] || "—"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openExternalPage(`${WEB_APP_URL}/settings`)}
                  className="shrink-0 text-[12px] text-terracotta bg-transparent border-none cursor-pointer"
                >
                  Edit →
                </button>
              </div>
              <div
                className="flex items-center justify-between gap-4 py-3.5"
                style={{ borderBottom: `1px solid ${RULE}` }}
              >
                <div className="min-w-0">
                  <Caps>EMAIL</Caps>
                  <div className="mt-1 inline-flex items-center gap-2 text-[14px] text-ink truncate">
                    <Mail size={12} className="text-ink-faint shrink-0" />
                    {userEmail || "Not signed in"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openExternalPage(`${WEB_APP_URL}/settings`)}
                  className="shrink-0 text-[12px] text-terracotta bg-transparent border-none cursor-pointer"
                >
                  Change →
                </button>
              </div>
              <div className="py-3.5">
                <Caps>LANGUAGE</Caps>
                <div className="mt-1 text-[14px] text-ink">
                  {autoDetect ? "Auto-detect" : currentLangName}
                </div>
              </div>
            </Group>

            {/* VOICE PROFILE — read-only mirror of the General toggles */}
            <Group title="VOICE PROFILE">
              <Row
                label="Auto-cleanup"
                desc="Gemini removes filler and fixes formatting."
              >
                <MonoValue
                  value={aiImprovementEnabled ? "ON" : "OFF"}
                  on={aiImprovementEnabled}
                />
              </Row>
              <Row
                label="Context-aware dictation"
                desc="Adapts per active app."
              >
                <MonoValue
                  value={
                    contextAwareOn
                      ? "ON"
                      : !contextAwareSupported
                        ? "UNAVAILABLE"
                        : "OFF"
                  }
                  on={contextAwareOn}
                />
              </Row>
              <Row label="Voice profile" desc="Personalised tuning to your cadence." last>
                <MonoValue value="DEFAULT" on={false} />
              </Row>
            </Group>

            {/* SESSIONS */}
            <Group title="SESSIONS">
              <Row
                label="MacBook · current"
                desc={userEmail || "Local session"}
                last
              >
                <span className="font-mono text-[11px] tracking-[0.14em] text-terracotta">
                  HERE
                </span>
              </Row>
              <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
                This is the only device signed in here. Sign in on the web or
                your phone to see them listed.
              </p>
              <button
                onClick={onSignOut}
                className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-transparent px-4 py-2 text-[12px] text-ink-soft cursor-pointer hover:text-ink transition-colors"
              >
                <LogOut size={12} />
                Sign out of this device
              </button>
            </Group>
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
              <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-ink-soft">
                Names, jargon, file paths — the words Whisper would otherwise
                miss. Oscar treats this as the canonical spelling.
              </p>
              <div className="mt-7">
                <EmptyPanel
                  icon={<BookOpen size={17} strokeWidth={1.6} />}
                  title="Sign in to build your vocabulary."
                  body="Your custom words sync with your account, so they’re the same on every device. Sign in to add and manage them here."
                />
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
              <div className="mt-7">
                <BillingSection userId={userId} />
              </div>
            ) : (
              <div className="mt-7">
                <EmptyPanel
                  icon={<BookOpen size={17} strokeWidth={1.6} />}
                  title="Sign in to view your plan."
                  body="Your subscription, usage, and invoices live with your account. Sign in to see them here."
                />
              </div>
            )}
          </div>
        )}

        {/* ════════════ Folders ════════════ */}
        {activeTab === "folders" && <FoldersPanel userId={userId} />}

        {/* ════════════ Data & privacy ════════════ */}
        {activeTab === "privacy" && (
          <div className="st-content">
            <span className="st-content-eyebrow">SETTINGS · DATA &amp; PRIVACY</span>
            <h2 className="st-content-title">
              What we <em>do</em> with your voice.
            </h2>
            <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-ink-soft">
              Oscar transcribes locally on this device when it can. Audio never
              leaves your machine unless you opt in. Transcripts sync if you’re
              signed in.
            </p>

            {/* ON THIS MAC */}
            <Group title="ON THIS DEVICE">
              <Row
                label="On-device transcription"
                desc="Uses the local Whisper model. Audio stays on your machine."
              >
                <MonoValue value="ON" />
              </Row>
              <Row
                label="Cloud fallback"
                desc="Audio is never uploaded — Oscar always transcribes locally."
                last
              >
                <MonoValue value="OFF" on={false} />
              </Row>
            </Group>

            {/* WHAT'S STORED */}
            <Group title="WHAT’S STORED">
              <Row
                label="Audio recordings"
                desc="Audio is discarded after transcription. Local-only by design."
              >
                <MonoValue value="DISCARDED" on={false} />
              </Row>
              <Row
                label="Transcripts"
                desc="Cleaned text is stored so your library is searchable."
              >
                <MonoValue value="REQUIRED" />
              </Row>
              <Row
                label="Telemetry"
                desc="Anonymous crash reports only. No content ever leaves."
                last
              >
                <MonoValue value="OFF" on={false} />
              </Row>
            </Group>

            {/* DIAGNOSTICS */}
            <Group title="DIAGNOSTICS">
              <Row
                label="Log transcripts to diagnostics file"
                desc="Saves the raw and AI-cleaned text of each dictation to a local perf.jsonl file for quality debugging. Off by default — timing and length stats are recorded either way."
              >
                <Toggle
                  checked={perfLogTranscripts}
                  onChange={() =>
                    onPerfLogTranscriptsChange(!perfLogTranscripts)
                  }
                  label="Log transcripts to diagnostics file"
                />
              </Row>
              <Row
                label="Clear diagnostics log"
                desc="Delete the local perf.jsonl diagnostics file (and its backup) from this device."
                last
              >
                <button
                  type="button"
                  onClick={() => {
                    onClearDiagnostics();
                    setDiagnosticsCleared(true);
                  }}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] text-ink-soft border border-cream-300 bg-transparent cursor-pointer"
                >
                  <Trash2 size={11} />
                  {diagnosticsCleared ? "Cleared" : "Clear log"}
                </button>
              </Row>
            </Group>

            {/* YOUR DATA */}
            <Group title="YOUR DATA">
              <div className="space-y-3 pt-1">
                <div className="rounded-lg p-5 flex items-start justify-between gap-6 bg-cream-200 border border-cream-300">
                  <div className="min-w-0">
                    <div className="font-serif text-[18px] font-medium text-ink leading-tight">
                      Export everything
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
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
                    <div className="font-serif text-[18px] font-medium text-[#8c2f25] leading-tight">
                      Clear local data
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                      Reset this device — remove downloaded models, cached data,
                      and sign out. Does not delete server data.
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
                    <div className="font-serif text-[18px] font-medium text-[#8c2f25] leading-tight">
                      Delete account
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
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
            </Group>

            {/* LEGAL */}
            <Group title="LEGAL">
              <div>
                {[
                  { label: "Privacy Policy", href: `${WEB_APP_URL}/privacy` },
                  { label: "Terms of Service", href: `${WEB_APP_URL}/terms` },
                  { label: "Refund Policy", href: `${WEB_APP_URL}/refund-policy` },
                ].map(({ label, href }, i, arr) => (
                  <button
                    key={href}
                    type="button"
                    onClick={() => openExternalPage(href)}
                    className="flex items-center justify-between w-full py-3 bg-transparent border-0 cursor-pointer text-left group"
                    style={{
                      borderBottom:
                        i === arr.length - 1 ? "none" : `1px solid ${RULE}`,
                    }}
                  >
                    <span className="text-[14px] text-ink group-hover:text-terracotta transition-colors">
                      {label}
                    </span>
                    <ExternalLink size={12} className="text-ink-faint" />
                  </button>
                ))}
              </div>
            </Group>
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
      <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-ink-soft">
        Oscar routes Scribbles to folders automatically based on what you said.
        They show up in your sidebar so you can jump straight in.
      </p>

      <Group
        title={`YOUR FOLDERS · ${folders.length} · ${totalFiled} SCRIBBLES FILED`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-ink-faint">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : folders.length === 0 ? (
          <div className="pt-2">
            <EmptyPanel
              icon={<FolderOpen size={17} strokeWidth={1.6} />}
              title="No folders yet."
              body="Folders form when Oscar groups a Scribble by topic. Capture a few and they’ll appear here — then jump in from the sidebar."
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 pt-3">
            {folders.map((f) => (
              <div
                key={f.name}
                className="rounded-lg p-5 bg-cream-200 border border-cream-300"
              >
                <div className="flex items-baseline justify-between">
                  <h3
                    className="font-serif font-medium text-ink leading-tight"
                    style={{ fontSize: 22, letterSpacing: "-0.015em" }}
                  >
                    {f.name}
                  </h3>
                  <span className="font-mono text-[13px] text-terracotta">
                    {f.count}
                  </span>
                </div>
                {f.latestTitle && (
                  <div className="mt-4">
                    <Caps>LATEST</Caps>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft line-clamp-2">
                      {f.latestTitle}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {folders.length > 0 && (
          <p className="mt-6 text-[12px] leading-relaxed text-ink-faint">
            New folders form when Oscar groups a Scribble. No manual create yet.
          </p>
        )}
      </Group>
    </div>
  );
}
