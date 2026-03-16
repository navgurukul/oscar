import { useState, useRef, useEffect } from "react";
import { LogOut, Settings, ChevronDown } from "lucide-react";

interface HeaderProps {
  userEmail?: string;
  onSignOut?: () => void;
  onSettingsClick?: () => void;
}

export function Header({ userEmail, onSignOut, onSettingsClick }: HeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get user initials for avatar
  const getInitials = (email?: string) => {
    if (!email) return "?";
    const name = email.split("@")[0];
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="app-header">
      <div className="app-header-left">
        {/* Left side can be used for breadcrumbs or page title if needed */}
      </div>

      <div className="app-header-right" ref={dropdownRef}>
        <button
          className="profile-trigger"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          aria-haspopup="true"
          aria-expanded={isDropdownOpen}
        >
          <div className="profile-avatar">
            <span>{getInitials(userEmail)}</span>
          </div>
          <ChevronDown size={14} className={`chevron ${isDropdownOpen ? "open" : ""}`} />
        </button>

        {isDropdownOpen && (
          <div className="profile-dropdown">
            <div className="dropdown-header">
              <div className="profile-avatar large">
                <span>{getInitials(userEmail)}</span>
              </div>
              <div className="dropdown-user-info">
                <span className="dropdown-email">{userEmail || "User"}</span>
              </div>
            </div>
            <div className="dropdown-divider" />
            <div className="dropdown-menu">
              <button
                className="dropdown-item"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onSettingsClick?.();
                }}
              >
                <Settings size={16} />
                <span>Settings</span>
              </button>
              <button
                className="dropdown-item destructive"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onSignOut?.();
                }}
              >
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
