import { useState, useEffect } from "react";
import {
  Settings2,
  BookOpen,
  User,
  Search,
  Loader2,
  Download,
  ExternalLink,
  LogOut,
  Trash2,
  Lock,
  Mail,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { BillingSection } from "./BillingSection";
import { VocabularySection } from "./VocabularySection";
import { getInitials } from "../lib/utils";
import { isContextAwarePlatform } from "../lib/dictation-context";

/* ── Types ── */

/** Accepts legacy tab names from callers */
type SettingsSection =
  | "billing"
  | "vocabulary"
  | "general"
  | "account"
  | "privacy";

/** Internal active tab */
type ActiveTab = "general" | "vocabulary" | "account";

function resolveTab(section?: SettingsSection): ActiveTab {
  if (section === "billing" || section === "privacy" || section === "account")
    return "account";
  if (section === "vocabulary") return "vocabulary";
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
  icon: React.ElementType;
}[] = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "vocabulary", label: "Vocabulary", icon: BookOpen },
  { id: "account", label: "Account", icon: User },
];

/* ── Props ── */

interface SettingsTabProps {
  transcriptionLanguage: string;
  selectedMicId: string;
  onLanguageChange: (lang: string) => void;
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
  minutesModelEnabled?: boolean;
  minutesModelDownloadState?: "idle" | "downloading" | "installed";
  minutesModelDownloadProgress?: number;
  minutesModelVariant?: string;
  onDownloadMinutesModel?: () => void;
  onRemoveMinutesModel?: () => void;
}

/* ── Component ── */

export function SettingsTab({
  transcriptionLanguage,
  selectedMicId,
  onLanguageChange,
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
  minutesModelEnabled = false,
  minutesModelDownloadState = "idle",
  minutesModelDownloadProgress = 0,
  onDownloadMinutesModel,
  onRemoveMinutesModel,
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

  const minutesPackInstalled =
    minutesModelDownloadState === "installed" || minutesModelEnabled;
  const contextAwareSupported = isContextAwarePlatform(contextAwarePlatform);

  return (
    <div className="st-layout">
      {/* ── Sidebar / Tab bar ── */}
      <aside className="st-sidebar">
        <p className="st-sidebar-label">Settings</p>
        <nav className="st-nav">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`st-nav-btn${activeTab === id ? " active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <span className="st-nav-ico">
                <Icon size={15} />
              </span>
              <span className="st-nav-label">{label}</span>
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
            <h2 className="st-content-title">General</h2>

            {/* — Recording — */}
            <div className="st-section-label">Recording</div>
            <div className="st-card st-card--grouped">
              <div className="st-row">
                <div className="st-row-text">
                  <div className="st-row-label">Context-Aware Dictation</div>
                  <div className="st-row-desc">
                    Auto-adapts formatting to active app
                  </div>
                </div>
                <Toggle
                  checked={contextAwareDictationEnabled}
                  onChange={() =>
                    onContextAwareDictationChange(!contextAwareDictationEnabled)
                  }
                  label="Context-Aware Dictation"
                  disabled={!contextAwareSupported}
                />
              </div>

              <div className="st-divider" />

              <div className="st-row st-row--col">
                <div className="st-row-label">Microphone</div>
                <select
                  className="st-select"
                  value={selectedMicId}
                  onChange={(e) => onMicChange(e.target.value)}
                >
                  <option value="">System Default</option>
                  {micDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {systemAudioSupported && (
                <>
                  <div className="st-divider" />
                  <div className="st-row">
                    <div className="st-row-text">
                      <div className="st-row-label">System Audio</div>
                      <div className="st-row-desc">
                        Capture meeting participants' audio
                      </div>
                    </div>
                    <Toggle
                      checked={systemAudioEnabled}
                      onChange={() =>
                        onSystemAudioToggle?.(!systemAudioEnabled)
                      }
                      label="System Audio"
                    />
                  </div>
                </>
              )}
            </div>

            {/* — Language — */}
            <div className="st-section-label">Language</div>
            <div className="st-card st-card--grouped">
              <div className="st-row">
                <div className="st-row-label">Auto-detect language</div>
                <Toggle
                  checked={autoDetect}
                  onChange={() => onLanguageChange(autoDetect ? "en" : "auto")}
                  label="Auto-detect language"
                />
              </div>

              {autoDetect && (
                <p className="st-row-hint">
                  Detects language from your first few seconds of speech.
                </p>
              )}

              {!autoDetect && (
                <>
                  <div className="st-divider" />
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
                  <div className="gen-lang-grid">
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
                </>
              )}
            </div>

            {/* — Enhancement — */}
            <div className="st-section-label">Enhancement</div>
            <div className="st-card st-card--grouped">
              <div className="st-row">
                <div className="st-row-text">
                  <div className="st-row-label">AI Cleanup</div>
                  <div className="st-row-desc">
                    Fix grammar, filler words, and punctuation
                  </div>
                </div>
                <Toggle
                  checked={aiImprovementEnabled}
                  onChange={() =>
                    onAiImprovementChange(!aiImprovementEnabled)
                  }
                  label="AI Cleanup"
                />
              </div>

              <div className="st-divider" />

              <div className="st-row">
                <div className="st-row-text">
                  <div className="st-row-label">Accuracy Pack</div>
                  <div className="st-row-desc">
                    Better Hindi, Hinglish, and long-meeting transcription
                  </div>
                  {minutesModelDownloadState === "downloading" && (
                    <div className="st-row-status st-row-status--downloading">
                      Downloading…{" "}
                      {Math.max(
                        0,
                        Math.min(
                          100,
                          Math.round(minutesModelDownloadProgress),
                        ),
                      )}
                      %
                    </div>
                  )}
                  {minutesPackInstalled &&
                    minutesModelDownloadState !== "downloading" && (
                      <div className="st-row-status st-row-status--installed">
                        Installed
                      </div>
                    )}
                </div>
                <div className="st-row-action">
                  {minutesPackInstalled ? (
                    <button
                      className="st-btn-ghost-sm"
                      onClick={() => onRemoveMinutesModel?.()}
                      disabled={minutesModelDownloadState === "downloading"}
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      className="st-btn-primary-sm"
                      onClick={() => onDownloadMinutesModel?.()}
                      disabled={minutesModelDownloadState === "downloading"}
                    >
                      {minutesModelDownloadState === "downloading" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Download size={14} />
                      )}
                      {minutesModelDownloadState === "downloading"
                        ? "Downloading…"
                        : "Download"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════ Vocabulary ════════════ */}
        {activeTab === "vocabulary" &&
          (userId ? (
            <VocabularySection userId={userId} />
          ) : (
            <div className="st-content">
              <h2 className="st-content-title">Vocabulary</h2>
              <div className="st-empty-state">
                <BookOpen size={32} />
                <p>Sign in to manage your vocabulary.</p>
              </div>
            </div>
          ))}

        {/* ════════════ Account ════════════ */}
        {activeTab === "account" && (
          <div className="st-content">
            <h2 className="st-content-title">Account</h2>

            {/* Profile */}
            <div className="st-card st-card--grouped">
              <div className="st-profile-row">
                <div className="st-avatar">{getInitials(userEmail)}</div>
                <div className="st-profile-info">
                  <span className="st-profile-email">
                    <Mail size={13} />
                    {userEmail || "Not signed in"}
                  </span>
                  {userEmail && (
                    <span className="st-profile-note">
                      <Lock size={11} />
                      Signed in with Google
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Plan & Usage */}
            {userId && userEmail ? (
              <BillingSection userId={userId} />
            ) : (
              <div className="st-card st-card--grouped">
                <p className="st-row-desc" style={{ padding: "4px 0" }}>
                  Sign in to view your plan and usage.
                </p>
              </div>
            )}

            {/* Resources */}
            <div className="st-section-label">Resources</div>
            <div className="st-card st-card--links">
              {[
                {
                  label: "Export Your Data",
                  href: `${WEB_APP_URL}/settings`,
                },
                {
                  label: "Privacy Policy",
                  href: `${WEB_APP_URL}/privacy`,
                },
                {
                  label: "Terms of Service",
                  href: `${WEB_APP_URL}/terms`,
                },
                {
                  label: "Refund Policy",
                  href: `${WEB_APP_URL}/refund-policy`,
                },
              ].map(({ label, href }) => (
                <button
                  key={href}
                  type="button"
                  className="st-link-row"
                  onClick={() => openExternalPage(href)}
                >
                  <span>{label}</span>
                  <ExternalLink size={13} />
                </button>
              ))}
            </div>

            {/* Danger Zone */}
            <div className="st-section-label st-section-label--danger">
              Danger Zone
            </div>
            <div className="st-card st-card-danger st-card--grouped">
              <div className="st-row">
                <div className="st-row-text">
                  <div className="st-row-label">Sign Out</div>
                  <div className="st-row-desc">
                    Sign out on this device
                  </div>
                </div>
                <button className="st-btn-muted-sm" onClick={onSignOut}>
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>

              <div className="st-divider" />

              <div className="st-row">
                <div className="st-row-text">
                  <div className="st-row-label">Delete Account</div>
                  <div className="st-row-desc">
                    Permanently remove your account and data
                  </div>
                </div>
                <button
                  className="st-btn-danger-ghost-sm"
                  onClick={() => openExternalPage(`${WEB_APP_URL}/settings`)}
                >
                  Delete
                </button>
              </div>

              <div className="st-divider" />

              <div className="st-row">
                <div className="st-row-text">
                  <div className="st-row-label">Clear Local Data</div>
                  <div className="st-row-desc">
                    Reset app, remove downloads, sign out
                  </div>
                </div>
                {clearConfirm ? (
                  <div className="st-confirm-inline">
                    <button
                      className="st-btn-danger-sm"
                      onClick={() => {
                        setClearConfirm(false);
                        onClearData();
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      className="st-btn-ghost-sm"
                      onClick={() => setClearConfirm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="st-btn-danger-ghost-sm"
                    onClick={() => setClearConfirm(true)}
                  >
                    <Trash2 size={13} />
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
