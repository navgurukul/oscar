import { useState } from "react";
import {
  CreditCard, BookOpen, User, Shield, LogOut, AlertTriangle,
  Download, FileText, Trash2, ExternalLink, Mail, Lock,
} from "lucide-react";
import { BillingSection } from "./BillingSection";
import { VocabularySection } from "./VocabularySection";

type TonePreset = "none" | "professional" | "casual" | "friendly";
type SettingsTabType = "billing" | "vocabulary" | "account" | "privacy";

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
  userEmail?: string;
  userId?: string;
  onSignOut: () => void;
}

const NAV_ITEMS: {
  id: SettingsTabType;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "billing",    label: "Plans & Billing", icon: CreditCard },
  { id: "vocabulary", label: "Vocabulary",       icon: BookOpen   },
  { id: "account",    label: "Account",          icon: User       },
  { id: "privacy",    label: "Data & Privacy",   icon: Shield     },
];

function getInitials(email?: string): string {
  if (!email) return "?";
  const local = email.split("@")[0];
  const parts = local.split(/[._\-+]/);
  return parts
    .slice(0, 2)
    .map((p) => (p[0] ?? "").toUpperCase())
    .join("") || (email[0]?.toUpperCase() ?? "?");
}

export function SettingsTab({
  whisperModelPath: _whisperModelPath,
  autoPaste: _autoPaste,
  aiEditing: _aiEditing,
  tonePreset: _tonePreset,
  userApiKey: _userApiKey,
  whisperLoaded: _whisperLoaded,
  onModelPathChange: _onModelPathChange,
  onLoadModel: _onLoadModel,
  onAutoPasteChange: _onAutoPasteChange,
  onAiEditingChange: _onAiEditingChange,
  onTonePresetChange: _onTonePresetChange,
  onApiKeyChange: _onApiKeyChange,
  onSaveApiKey: _onSaveApiKey,
  onClearData,
  userEmail,
  userId,
  onSignOut,
}: SettingsTabProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabType>("billing");
  const [clearConfirm, setClearConfirm] = useState(false);

  void _tonePreset;

  return (
    <div className="st-layout">
      {/* ── Left navigation sidebar ── */}
      <aside className="st-sidebar">
        <p className="st-sidebar-label">Settings</p>

        <nav className="st-nav">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                className={`st-nav-btn${isActive ? " active" : ""}`}
                onClick={() => setActiveTab(id)}
              >
                <span className="st-nav-ico">
                  <Icon size={15} />
                </span>
                {label}
              </button>
            );
          })}
        </nav>

        <div className="st-sidebar-spacer" />

        {/* Version / app info */}
        <p className="st-sidebar-footer">OSCAR AI</p>
      </aside>

      {/* ── Right content panel ── */}
      <div className="st-panel" key={activeTab}>

        {/* ── Plans & Billing ── */}
        {activeTab === "billing" && (
          userId && userEmail ? (
            <BillingSection userId={userId} userEmail={userEmail} />
          ) : (
            <div className="st-content">
              <h2 className="st-content-title">Plans & Billing</h2>
              <div className="st-empty-state">
                <CreditCard size={32} />
                <p>Sign in to manage your subscription.</p>
              </div>
            </div>
          )
        )}

        {/* ── Vocabulary ── */}
        {activeTab === "vocabulary" && (
          userId ? (
            <VocabularySection userId={userId} />
          ) : (
            <div className="st-content">
              <h2 className="st-content-title">Vocabulary</h2>
              <div className="st-empty-state">
                <BookOpen size={32} />
                <p>Sign in to manage your vocabulary.</p>
              </div>
            </div>
          )
        )}

        {/* ── Account ── */}
        {activeTab === "account" && (
          <div className="st-content">
            <h2 className="st-content-title">Account</h2>

            {/* Profile card */}
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
                <div className="st-avatar">
                  {getInitials(userEmail)}
                </div>
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

            {/* Sign out card */}
            <div className="st-card">
              <div className="st-card-hd">
                <span className="st-ico-pill st-ico-pill--neutral">
                  <LogOut size={15} />
                </span>
                <div>
                  <h3 className="st-card-title">Sign Out</h3>
                  <p className="st-card-desc">Sign out of your account on this device</p>
                </div>
              </div>
              <button className="st-btn-muted" onClick={onSignOut}>
                <LogOut size={14} />
                Sign out
              </button>
            </div>

            {/* Delete account card */}
            <div className="st-card st-card-danger">
              <div className="st-card-hd">
                <span className="st-ico-pill st-ico-pill--danger">
                  <AlertTriangle size={15} />
                </span>
                <div>
                  <h3 className="st-card-title st-title-danger">Delete Account</h3>
                  <p className="st-card-desc">Permanently delete your account and all associated data</p>
                </div>
              </div>
              <button
                className="st-btn-danger-ghost"
                onClick={() => window.open("https://oscarai.app/settings", "_blank")}
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

            {/* Export card */}
            <div className="st-card">
              <div className="st-card-hd">
                <span className="st-ico-pill">
                  <Download size={15} />
                </span>
                <div>
                  <h3 className="st-card-title">Export Your Data</h3>
                  <p className="st-card-desc">
                    Download a copy of your notes, vocabulary, and account information
                  </p>
                </div>
              </div>
              <button
                className="st-btn-primary"
                onClick={() => window.open("https://oscarai.app/settings", "_blank")}
              >
                <Download size={14} />
                Request Data Export
              </button>
            </div>

            {/* Legal links card */}
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
                  { label: "Privacy Policy",   href: "https://oscarai.app/privacy" },
                  { label: "Terms of Service", href: "https://oscarai.app/terms" },
                  { label: "Refund Policy",    href: "https://oscarai.app/refund-policy" },
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

            {/* Clear data card */}
            <div className="st-card st-card-danger">
              <div className="st-card-hd">
                <span className="st-ico-pill st-ico-pill--danger">
                  <Trash2 size={15} />
                </span>
                <div>
                  <h3 className="st-card-title st-title-danger">Clear All Data</h3>
                  <p className="st-card-desc">
                    Delete all local data while keeping your account active
                  </p>
                </div>
              </div>

              {clearConfirm ? (
                <div className="st-confirm-row">
                  <span className="st-confirm-msg">This cannot be undone. Are you sure?</span>
                  <div className="st-confirm-btns">
                    <button className="st-btn-ghost" onClick={() => setClearConfirm(false)}>
                      Cancel
                    </button>
                    <button
                      className="st-btn-danger"
                      onClick={() => { setClearConfirm(false); onClearData(); }}
                    >
                      Yes, clear data
                    </button>
                  </div>
                </div>
              ) : (
                <button className="st-btn-danger-ghost" onClick={() => setClearConfirm(true)}>
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
