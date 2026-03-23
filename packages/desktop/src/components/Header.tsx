import { useState, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogOut, Settings } from "lucide-react";

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

  const handleDragRegionMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, [role='button']")) return;
    getCurrentWindow().startDragging();
  };

  return (
    <header
      data-tauri-drag-region
      className="flex items-center justify-end py-3 px-6 bg-white h-14 flex-shrink-0 cursor-default"
      onMouseDown={handleDragRegionMouseDown}
    >
      <div className="flex items-center gap-3 relative" ref={dropdownRef}>
        <button
          className="flex items-center gap-2 py-1 px-2 pl-1 bg-transparent border-none rounded-3xl cursor-pointer transition-colors duration-200 hover:bg-slate-50"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          aria-haspopup="true"
          aria-expanded={isDropdownOpen}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-600 to-cyan-500 text-white flex items-center justify-center text-xs font-semibold uppercase shrink-0">
            <span>{getInitials(userEmail)}</span>
          </div>
        </button>

        {isDropdownOpen && (
          <div className="absolute top-[calc(100%+8px)] right-0 min-w-[220px] bg-white border border-slate-200 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] z-[100] animate-[dropdown-fade-in_0.15s_ease]">
            <div className="flex items-center gap-3 p-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-600 to-cyan-500 text-white flex items-center justify-center text-base font-semibold uppercase shrink-0">
                <span>{getInitials(userEmail)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap">{userEmail || "User"}</span>
              </div>
            </div>
            <div className="h-px bg-slate-200 mx-2" />
            <div className="p-2">
              <button
                className="flex items-center gap-2.5 w-full py-2.5 px-3 bg-transparent border-none rounded-lg text-sm font-medium text-slate-700 cursor-pointer transition-colors duration-150 text-left hover:bg-slate-50"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onSettingsClick?.();
                }}
              >
                <Settings size={16} className="shrink-0 text-slate-500" />
                <span>Settings</span>
              </button>
              <button
                className="flex items-center gap-2.5 w-full py-2.5 px-3 bg-transparent border-none rounded-lg text-sm font-medium text-slate-700 cursor-pointer transition-colors duration-150 text-left hover:bg-slate-50"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onSignOut?.();
                }}
              >
                <LogOut size={16} className="shrink-0 text-slate-500" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
