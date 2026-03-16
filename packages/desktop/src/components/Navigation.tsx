import React from "react";
import { Mic, BookOpen, CreditCard, Settings, LogOut, Crown, Sparkles } from "lucide-react";

type TabType = "record" | "vocabulary" | "billing" | "settings";

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onSignOut: () => void;
  userEmail: string;
  isProUser?: boolean;
  onUpgradeClick?: () => void;
}

export function Navigation({ 
  activeTab, 
  onTabChange, 
  onSignOut, 
  userEmail,
  isProUser = false,
  onUpgradeClick
}: NavigationProps) {
  const navItems: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: "record", label: "Record", icon: Mic },
    { id: "vocabulary", label: "Vocabulary", icon: BookOpen },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      // Default behavior: navigate to billing tab
      onTabChange("billing");
    }
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <img src="/OSCAR_LIGHT_LOGO.png" alt="OSCAR" width={32} height={32} />
          <span>OSCAR</span>
        </div>
      </div>

      <div className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? "active" : ""}`}
              onClick={() => onTabChange(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
              {isActive && <div className="nav-indicator" />}
            </button>
          );
        })}
      </div>

      <div className="sidebar-footer">
        {/* Upgrade to Pro Card - only shown for free users */}
        {!isProUser && (
          <div className="upgrade-card">
            <div className="upgrade-card-header">
              <div className="upgrade-card-icon">
                <Sparkles size={16} />
              </div>
              <span className="upgrade-card-title">OSCAR Pro</span>
            </div>
            <p className="upgrade-card-description">
              Upgrade to Pro for unlimited recordings, vocabulary entries, and priority AI processing.
            </p>
            <button className="upgrade-card-btn" onClick={handleUpgrade}>
              <Crown size={14} />
              Upgrade to Pro
            </button>
          </div>
        )}

        <div className="user-info">
          <span className="user-email" title={userEmail}>
            {userEmail}
          </span>
        </div>
        <button className="sign-out-btn" onClick={onSignOut}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </nav>
  );
}
