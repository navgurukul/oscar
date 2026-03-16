import { useState } from "react";
import { FolderOpen, Keyboard, Sparkles, Trash2, CreditCard, BookOpen, User, Shield, Download, FileText, AlertTriangle, LogOut } from "lucide-react";

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
  onSignOut: () => void;
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
  userEmail,
  onSignOut,
}: SettingsTabProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabType>("billing");
  const toneOptions: { value: TonePreset; label: string }[] = [
    { value: "none", label: "None" },
    { value: "professional", label: "Professional" },
    { value: "casual", label: "Casual" },
    { value: "friendly", label: "Friendly" },
  ];

  const tabs: { id: SettingsTabType; label: string; icon: React.ElementType }[] = [
    { id: "billing", label: "Plans & Billing", icon: CreditCard },
    { id: "vocabulary", label: "Vocabulary", icon: BookOpen },
    { id: "account", label: "Account", icon: User },
    { id: "privacy", label: "Data & Privacy", icon: Shield },
  ];

  return (
    <div className="settings-tab">
      <h2 className="settings-tab-title">Settings</h2>

      {/* Sub-tabs */}
      <div className="settings-subtabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`subtab-btn ${isActive ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="settings-content">
        {/* Plans & Billing Tab */}
        {activeTab === "billing" && (
          <div className="settings-section">
            <div className="settings-card">
              <div className="settings-card-header">
                <CreditCard size={20} />
                <h3>Subscription</h3>
              </div>
              <p className="settings-card-description">
                Manage your subscription and billing information.
              </p>
              <div className="billing-info">
                <p className="billing-note">
                  Visit the web app to manage your subscription, view billing history, and update payment methods.
                </p>
                <button 
                  className="billing-cta-btn"
                  onClick={() => window.open("https://oscarai.app/settings", "_blank")}
                >
                  Open Billing Portal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vocabulary Tab */}
        {activeTab === "vocabulary" && (
          <div className="settings-section">
            <div className="settings-card">
              <div className="settings-card-header">
                <BookOpen size={20} />
                <h3>Personal Dictionary</h3>
              </div>
              <p className="settings-card-description">
                Manage words and phrases to improve transcription accuracy.
              </p>
              <div className="vocabulary-info">
                <p className="vocabulary-note">
                  Your vocabulary helps OSCAR recognize custom words, names, and industry-specific terms.
                </p>
                <button 
                  className="vocabulary-cta-btn"
                  onClick={() => window.open("https://oscarai.app/settings", "_blank")}
                >
                  Manage Vocabulary
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account Tab */}
        {activeTab === "account" && (
          <div className="settings-section">
            <div className="settings-card">
              <div className="settings-card-header">
                <User size={20} />
                <h3>Profile Information</h3>
              </div>
              <p className="settings-card-description">
                View your account details
              </p>
              <div className="account-info">
                <div className="account-field">
                  <label>Email Address</label>
                  <span className="account-value">{userEmail || "Not available"}</span>
                </div>
                <p className="account-note">
                  You signed in with Google. To change your email or password, update your Google account settings.
                </p>
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-card-header">
                <LogOut size={20} />
                <h3>Sign Out</h3>
              </div>
              <p className="settings-card-description">
                Sign out of your account on this device
              </p>
              <button className="sign-out-settings-btn" onClick={onSignOut}>
                <LogOut size={16} />
                Sign out
              </button>
            </div>

            <div className="settings-card danger">
              <div className="settings-card-header">
                <AlertTriangle size={20} />
                <h3>Delete Account</h3>
              </div>
              <p className="settings-card-description">
                Permanently delete your account and all associated data
              </p>
              <button 
                className="delete-account-btn"
                onClick={() => window.open("https://oscarai.app/settings", "_blank")}
              >
                Delete Account
              </button>
            </div>
          </div>
        )}

        {/* Data & Privacy Tab */}
        {activeTab === "privacy" && (
          <div className="settings-section">
            <div className="settings-card">
              <div className="settings-card-header">
                <Download size={20} />
                <h3>Export Your Data</h3>
              </div>
              <p className="settings-card-description">
                Download a copy of all your personal data
              </p>
              <div className="export-info">
                <p className="export-note">
                  Request an export of your notes, vocabulary, and account information.
                </p>
                <button 
                  className="export-cta-btn"
                  onClick={() => window.open("https://oscarai.app/settings", "_blank")}
                >
                  Request Data Export
                </button>
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-card-header">
                <FileText size={20} />
                <h3>Legal & Compliance</h3>
              </div>
              <p className="settings-card-description">
                Review our terms and policies
              </p>
              <div className="legal-links">
                <a href="https://oscarai.app/privacy" target="_blank" rel="noopener noreferrer" className="legal-link">
                  Privacy Policy
                </a>
                <a href="https://oscarai.app/terms" target="_blank" rel="noopener noreferrer" className="legal-link">
                  Terms of Service
                </a>
                <a href="https://oscarai.app/refund-policy" target="_blank" rel="noopener noreferrer" className="legal-link">
                  Refund Policy
                </a>
              </div>
            </div>

            <div className="settings-card danger">
              <div className="settings-card-header">
                <Trash2 size={20} />
                <h3>Clear All Data</h3>
              </div>
              <p className="settings-card-description">
                Delete all local data while keeping your account
              </p>
              <button className="clear-data-btn" onClick={onClearData}>
                Clear All Local Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
