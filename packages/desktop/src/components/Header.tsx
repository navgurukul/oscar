import { getCurrentWindow } from "@tauri-apps/api/window";

interface HeaderProps {
  title?: string;
  // Retained for back-compat with callers; not rendered (account lives in
  // the sidebar per V2WinChrome design).
  userEmail?: string;
  onSignOut?: () => void;
  onSettingsClick?: () => void;
}

/**
 * V2WinChrome — thin top bar with traffic-light spacer + centered caps title.
 * The OS draws the actual macOS controls in the 68px reserved area; on
 * Windows/Linux the spacer is harmless dead space. Avatar + account actions
 * live in the sidebar.
 */
export function Header({ title = "OSCAR" }: HeaderProps) {
  const handleDragRegionMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, [role='button']")) return;
    getCurrentWindow().startDragging();
  };

  return (
    <header
      data-tauri-drag-region
      className="relative flex items-center px-4 h-10 bg-cream-200 border-b border-cream-300 cursor-default flex-shrink-0"
      onMouseDown={handleDragRegionMouseDown}
    >
      {/* macOS leaves space for traffic-light controls on the left; reserve it. */}
      <div className="w-[68px] shrink-0" />

      {/* Centered caps title. */}
      <div className="flex-1 flex justify-center pointer-events-none">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
          {title}
        </span>
      </div>

      {/* Symmetric right spacer keeps the title visually centered. */}
      <div className="w-[68px] shrink-0" />
    </header>
  );
}
