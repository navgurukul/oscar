import { useState, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogOut, Settings } from "lucide-react";
import { getInitials } from "../lib/utils";

interface HeaderProps {
  title?: string;
  userEmail?: string;
  onSignOut?: () => void;
  onSettingsClick?: () => void;
}

export function Header({ title = "OSCAR", userEmail, onSignOut, onSettingsClick }: HeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDragRegionMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, [role='button']")) return;
    getCurrentWindow().startDragging();
  };

  return (
    <header
      data-tauri-drag-region
      className="relative flex items-center justify-between px-4 h-10 bg-cream-200 border-b border-cream-300 cursor-default flex-shrink-0"
      onMouseDown={handleDragRegionMouseDown}
    >
      {/* macOS leaves space for traffic-light controls on the left; reserve it. */}
      <div className="w-[68px] shrink-0" />

      {/* Centered caps title. */}
      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-3 relative" ref={dropdownRef}>
        <button
          className="flex items-center gap-2 py-0.5 px-0.5 bg-transparent border-none rounded-full cursor-pointer transition-colors duration-150 hover:bg-cream-300"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          aria-haspopup="true"
          aria-expanded={isDropdownOpen}
        >
          <div className="w-7 h-7 rounded-full bg-terracotta text-cream flex items-center justify-center text-[11px] font-medium uppercase shrink-0 font-serif">
            <span>{getInitials(userEmail)}</span>
          </div>
        </button>

        {isDropdownOpen && (
          <div className="absolute top-[calc(100%+8px)] right-0 min-w-[220px] bg-cream-50 border border-cream-300 rounded-xl shadow-[0_16px_40px_rgba(26,24,22,0.18)] z-[100]">
            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-full bg-terracotta text-cream flex items-center justify-center text-sm font-medium uppercase shrink-0 font-serif">
                <span>{getInitials(userEmail)}</span>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
                  SIGNED IN
                </span>
                <span className="text-sm text-ink overflow-hidden text-ellipsis whitespace-nowrap">
                  {userEmail || "User"}
                </span>
              </div>
            </div>
            <div className="h-px bg-cream-300 mx-2" />
            <div className="p-2">
              <button
                className="flex items-center gap-2.5 w-full py-2 px-3 bg-transparent border-none rounded-lg text-sm text-ink cursor-pointer transition-colors duration-150 text-left hover:bg-cream-200"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onSettingsClick?.();
                }}
              >
                <Settings size={14} className="shrink-0 text-ink-soft" />
                <span>Settings</span>
              </button>
              <button
                className="flex items-center gap-2.5 w-full py-2 px-3 bg-transparent border-none rounded-lg text-sm text-ink cursor-pointer transition-colors duration-150 text-left hover:bg-cream-200"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onSignOut?.();
                }}
              >
                <LogOut size={14} className="shrink-0 text-ink-soft" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
