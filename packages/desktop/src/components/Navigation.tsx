import React from "react";
import { Mic, BookOpen, CreditCard, Settings, LogOut } from "lucide-react";

type TabType = "record" | "vocabulary" | "billing" | "settings";

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onSignOut: () => void;
  userEmail: string;
}

export function Navigation({ activeTab, onTabChange, onSignOut, userEmail }: NavigationProps) {
  const navItems: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: "record", label: "Record", icon: Mic },
    { id: "vocabulary", label: "Vocabulary", icon: BookOpen },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "settings", label: "Settings", icon: Settings },
  ];

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
