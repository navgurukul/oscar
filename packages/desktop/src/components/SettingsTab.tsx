import { useState, useEffect } from "react";
import {
  CreditCard,
  BookOpen,
  User,
  Shield,
  LogOut,
  AlertTriangle,
  Download,
  FileText,
  Trash2,
  ExternalLink,
  Mail,
  Lock,
  Settings2,
  Search,
  LayoutTemplate,
  Plus,
  Pencil,
  X,
  Check,
} from "lucide-react";
import type { MeetingTemplateData } from "./MeetingsTab";
import { BillingSection } from "./BillingSection";
import { VocabularySection } from "./VocabularySection";
import { getInitials } from "../lib/utils";

type SettingsTabType =
  | "billing"
  | "vocabulary"
  | "general"
  | "meetingTemplates"
  | "account"
  | "privacy";

// All languages Whisper small supports, with flag + native name
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

interface MicDevice {
  deviceId: string;
  label: string;
}

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
  meetingTemplates: MeetingTemplateData[];
  onSaveTemplate: (tpl: MeetingTemplateData) => void;
  onDeleteTemplate: (id: string) => void;
  initialSection?: SettingsTabType;
  systemAudioSupported?: boolean;
  systemAudioEnabled?: boolean;
  onSystemAudioToggle?: (enabled: boolean) => void;
}

const NAV_ITEMS: {
  id: SettingsTabType;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "billing", label: "Plans & Billing", icon: CreditCard },
  { id: "vocabulary", label: "Vocabulary", icon: BookOpen },
  { id: "general", label: "General", icon: Settings2 },
  { id: "meetingTemplates", label: "Meeting Templates", icon: LayoutTemplate },
  { id: "account", label: "Account", icon: User },
  { id: "privacy", label: "Data & Privacy", icon: Shield },
];

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
  meetingTemplates,
  onSaveTemplate,
  onDeleteTemplate,
  initialSection,
  systemAudioSupported = false,
  systemAudioEnabled = true,
  onSystemAudioToggle,
}: SettingsTabProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabType>(initialSection || "billing");
  const [clearConfirm, setClearConfirm] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const [micDevices, setMicDevices] = useState<MicDevice[]>([]);
  // Template editing
  const [editingTpl, setEditingTpl] = useState<MeetingTemplateData | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplPrompt, setTplPrompt] = useState("");

  const autoDetect = transcriptionLanguage === "auto";

  // Sync initialSection when it changes externally
  useEffect(() => { if (initialSection) setActiveTab(initialSection); }, [initialSection]);

  // Enumerate mic devices when General tab is opened
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

  return (
    <div className="st-layout">
      {/* ── Left navigation sidebar ── */}
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
              {label}
            </button>
          ))}
        </nav>
        <div className="st-sidebar-spacer" />
      </aside>

      {/* ── Right content panel ── */}
      <div className="st-panel" key={activeTab}>
        {/* ── Plans & Billing ── */}
        {activeTab === "billing" &&
          (userId && userEmail ? (
            <BillingSection userId={userId} userEmail={userEmail} />
          ) : (
            <div className="st-content">
              <h2 className="st-content-title">Plans & Billing</h2>
              <div className="st-empty-state">
                <CreditCard size={32} />
                <p>Sign in to manage your subscription.</p>
              </div>
            </div>
          ))}

        {/* ── Vocabulary ── */}
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

        {/* ── General ── */}
        {activeTab === "general" && (
          <div className="st-content">
            <h2 className="st-content-title">General</h2>

            {/* ── Microphone ── */}
            <div className="st-card">
              <div className="st-card-hd">
                <span className="st-ico-pill">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </span>
                <div>
                  <h3 className="st-card-title">Microphone</h3>
                  <p className="st-card-desc">
                    Choose which microphone OSCAR uses for recording
                  </p>
                </div>
              </div>
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

            {/* ── Language ── */}
            <div className="st-card gen-lang-card-wrap">
              {/* Header row with auto-detect toggle */}
              <div className="gen-lang-hd">
                <div>
                  <h3 className="st-card-title">Transcription Language</h3>
                  <p className="st-card-desc">
                    Select your language or let OSCAR detect it automatically
                  </p>
                </div>
                <label className="gen-toggle-label">
                  <span className="gen-toggle-text">Auto-detect</span>
                  <div
                    className={`gen-toggle${autoDetect ? " on" : ""}`}
                    onClick={() => onLanguageChange(autoDetect ? "en" : "auto")}
                    role="switch"
                    aria-checked={autoDetect}
                  >
                    <div className="gen-toggle-thumb" />
                  </div>
                </label>
              </div>

              {/* Search box — only when manual mode */}
              <div className={`gen-lang-body${autoDetect ? " dimmed" : ""}`}>
                <div className="gen-search-wrap">
                  <Search size={14} className="gen-search-icon" />
                  <input
                    type="text"
                    className="gen-search"
                    placeholder="Search languages…"
                    value={langSearch}
                    onChange={(e) => setLangSearch(e.target.value)}
                    disabled={autoDetect}
                  />
                </div>

                {/* Language grid */}
                <div className="gen-lang-grid">
                  {filteredLangs.map((lang) => {
                    const isSelected =
                      transcriptionLanguage === lang.code && !autoDetect;
                    return (
                      <button
                        key={lang.code}
                        className={`gen-lang-tile${isSelected ? " selected" : ""}${autoDetect ? " disabled" : ""}`}
                        onClick={() => {
                          if (!autoDetect) onLanguageChange(lang.code);
                        }}
                        disabled={autoDetect}
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
              </div>

              {autoDetect && (
                <p className="st-card-hint" style={{ marginTop: 8 }}>
                  OSCAR will detect the language from your first few seconds of
                  speech.
                </p>
              )}
            </div>

            {/* ── System Audio (Meetings) ── */}
            {systemAudioSupported && (
              <div className="st-card">
                <div className="st-card-hd">
                  <span className="st-ico-pill">
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="st-card-title">System Audio Capture</h3>
                    <p className="st-card-desc">
                      Capture other participants' audio during meetings
                    </p>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        color: "#334155",
                        fontSize: "0.875rem",
                      }}
                    >
                      Record system audio in meetings
                    </div>
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        color: "#94a3b8",
                        marginTop: 2,
                      }}
                    >
                      Captures audio from Zoom, Teams, and other apps so
                      everyone's voice is transcribed. Requires Screen Recording
                      permission.
                    </div>
                  </div>
                  <label className="gen-toggle-label" style={{ marginBottom: 0 }}>
                    <div
                      className={`gen-toggle${systemAudioEnabled ? " on" : ""}`}
                      onClick={() => onSystemAudioToggle?.(!systemAudioEnabled)}
                      role="switch"
                      aria-checked={systemAudioEnabled}
                    >
                      <div className="gen-toggle-thumb" />
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* ── AI Enhancement ── */}
            <div className="st-card">
              <div className="st-card-hd">
                <span className="st-ico-pill">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </span>
                <div>
                  <h3 className="st-card-title">AI Enhancement</h3>
                  <p className="st-card-desc">
                    Improve transcriptions with DeepSeek AI
                  </p>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      color: "#334155",
                      fontSize: "0.875rem",
                    }}
                  >
                    Improve transcripts with AI
                  </div>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      color: "#94a3b8",
                      marginTop: 2,
                    }}
                  >
                    Automatically clean up grammar, filler words, and
                    punctuation using DeepSeek AI.
                  </div>
                </div>
                <label className="gen-toggle-label" style={{ marginBottom: 0 }}>
                  <div
                    className={`gen-toggle${aiImprovementEnabled ? " on" : ""}`}
                    onClick={() => onAiImprovementChange(!aiImprovementEnabled)}
                    role="switch"
                    aria-checked={aiImprovementEnabled}
                  >
                    <div className="gen-toggle-thumb" />
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── Meeting Templates ── */}
        {activeTab === "meetingTemplates" && (
          <div className="st-content">
            <h2 className="st-content-title">Meeting Templates</h2>
            <p className="st-desc">
              Templates control how Oscar structures your meeting notes.
              Edit built-in templates or create your own.
            </p>

            {/* Template list */}
            <div className="st-tpl-list">
              {meetingTemplates.map((tpl) => (
                <div key={tpl.id} className={`st-tpl-card${editingTpl?.id === tpl.id ? " editing" : ""}`}>
                  {editingTpl?.id === tpl.id ? (
                    <div className="st-tpl-edit-form">
                      <input
                        className="st-tpl-input"
                        placeholder="Template name"
                        value={tplName}
                        onChange={(e) => setTplName(e.target.value)}
                      />
                      <input
                        className="st-tpl-input"
                        placeholder="Short description"
                        value={tplDesc}
                        onChange={(e) => setTplDesc(e.target.value)}
                      />
                      <textarea
                        className="st-tpl-textarea"
                        placeholder="Custom instructions for the AI (e.g. &quot;Organize notes by speaker, include timestamps&quot;)"
                        value={tplPrompt}
                        onChange={(e) => setTplPrompt(e.target.value)}
                        rows={3}
                      />
                      <div className="st-tpl-edit-actions">
                        <button
                          className="st-tpl-save-btn"
                          disabled={!tplName.trim()}
                          onClick={() => {
                            onSaveTemplate({
                              ...editingTpl,
                              name: tplName.trim(),
                              desc: tplDesc.trim(),
                              prompt: tplPrompt.trim(),
                            });
                            setEditingTpl(null);
                          }}
                        >
                          <Check size={13} /> Save
                        </button>
                        <button className="st-tpl-cancel-btn" onClick={() => setEditingTpl(null)}>
                          <X size={13} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="st-tpl-display">
                      <div className="st-tpl-info">
                        <div className="st-tpl-name">
                          {tpl.name}
                          {tpl.builtin && <span className="st-tpl-builtin-badge">built-in</span>}
                        </div>
                        <div className="st-tpl-desc">{tpl.desc}</div>
                        {tpl.prompt && <div className="st-tpl-prompt-preview">{tpl.prompt}</div>}
                      </div>
                      <div className="st-tpl-actions">
                        <button
                          className="st-tpl-action-btn"
                          title="Edit"
                          onClick={() => {
                            setEditingTpl(tpl);
                            setTplName(tpl.name);
                            setTplDesc(tpl.desc);
                            setTplPrompt(tpl.prompt);
                          }}
                        >
                          <Pencil size={13} />
                        </button>
                        {!tpl.builtin && (
                          <button
                            className="st-tpl-action-btn st-tpl-delete-btn"
                            title="Delete"
                            onClick={() => onDeleteTemplate(tpl.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add new template */}
            <button
              className="st-tpl-add-btn"
              onClick={() => {
                const newTpl: MeetingTemplateData = {
                  id: `custom_${Date.now()}`,
                  name: "",
                  desc: "",
                  prompt: "",
                  builtin: false,
                };
                setEditingTpl(newTpl);
                setTplName("");
                setTplDesc("");
                setTplPrompt("");
              }}
            >
              <Plus size={14} />
              Add Template
            </button>
          </div>
        )}

        {/* ── Account ── */}
        {activeTab === "account" && (
          <div className="st-content">
            <h2 className="st-content-title">Account</h2>

            <div className="st-card">
              <div className="st-card-hd">
                <span className="st-ico-pill">
                  <User size={15} />
                </span>
                <div>
                  <h3 className="st-card-title">Profile</h3>
                  <p className="st-card-desc">Your account details</p>
                </div>
              </div>
              <div className="st-profile-row">
                <div className="st-avatar">{getInitials(userEmail)}</div>
                <div className="st-profile-info">
                  <span className="st-profile-email">
                    <Mail size={13} />
                    {userEmail || "No email address"}
                  </span>
                  <span className="st-profile-note">
                    <Lock size={11} />
                    Signed in with Google
                  </span>
                </div>
              </div>
            </div>

            <div className="st-card">
              <div className="st-card-hd">
                <span className="st-ico-pill st-ico-pill--neutral">
                  <LogOut size={15} />
                </span>
                <div>
                  <h3 className="st-card-title">Sign Out</h3>
                  <p className="st-card-desc">
                    Sign out of your account on this device
                  </p>
                </div>
              </div>
              <button className="st-btn-muted" onClick={onSignOut}>
                <LogOut size={14} />
                Sign out
              </button>
            </div>

            <div className="st-card st-card-danger">
              <div className="st-card-hd">
                <span className="st-ico-pill st-ico-pill--danger">
                  <AlertTriangle size={15} />
                </span>
                <div>
                  <h3 className="st-card-title st-title-danger">
                    Delete Account
                  </h3>
                  <p className="st-card-desc">
                    Permanently delete your account and all associated data
                  </p>
                </div>
              </div>
              <button
                className="st-btn-danger-ghost"
                onClick={() => window.open(`${WEB_APP_URL}/settings`, "_blank")}
              >
                <AlertTriangle size={14} />
                Delete Account
              </button>
            </div>
          </div>
        )}

        {/* ── Data & Privacy ── */}
        {activeTab === "privacy" && (
          <div className="st-content">
            <h2 className="st-content-title">Data & Privacy</h2>

            <div className="st-card">
              <div className="st-card-hd">
                <span className="st-ico-pill">
                  <Download size={15} />
                </span>
                <div>
                  <h3 className="st-card-title">Export Your Data</h3>
                  <p className="st-card-desc">
                    Download a copy of your notes, vocabulary, and account
                    information
                  </p>
                </div>
              </div>
              <button
                className="st-btn-primary"
                onClick={() => window.open(`${WEB_APP_URL}/settings`, "_blank")}
              >
                <Download size={14} />
                Request Data Export
              </button>
            </div>

            <div className="st-card">
              <div className="st-card-hd">
                <span className="st-ico-pill st-ico-pill--neutral">
                  <FileText size={15} />
                </span>
                <div>
                  <h3 className="st-card-title">Legal & Compliance</h3>
                  <p className="st-card-desc">Review our terms and policies</p>
                </div>
              </div>
              <div className="st-legal-list">
                {[
                  { label: "Privacy Policy", href: `${WEB_APP_URL}/privacy` },
                  { label: "Terms of Service", href: `${WEB_APP_URL}/terms` },
                  {
                    label: "Refund Policy",
                    href: `${WEB_APP_URL}/refund-policy`,
                  },
                ].map(({ label, href }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="st-legal-link"
                  >
                    {label}
                    <ExternalLink size={12} />
                  </a>
                ))}
              </div>
            </div>

            <div className="st-card st-card-danger">
              <div className="st-card-hd">
                <span className="st-ico-pill st-ico-pill--danger">
                  <Trash2 size={15} />
                </span>
                <div>
                  <h3 className="st-card-title st-title-danger">
                    Clear All Data
                  </h3>
                  <p className="st-card-desc">
                    Delete all local data, downloaded models, and sign out.
                    You'll need to set up OSCAR again.
                  </p>
                </div>
              </div>
              {clearConfirm ? (
                <div className="st-confirm-row">
                  <span className="st-confirm-msg">
                    This will delete all data, sign you out, and reset the app.
                    This cannot be undone.
                  </span>
                  <div className="st-confirm-btns">
                    <button
                      className="st-btn-ghost"
                      onClick={() => setClearConfirm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="st-btn-danger"
                      onClick={() => {
                        setClearConfirm(false);
                        onClearData();
                      }}
                    >
                      Yes, reset everything
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="st-btn-danger-ghost"
                  onClick={() => setClearConfirm(true)}
                >
                  <Trash2 size={14} />
                  Clear All Local Data
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
