import React, { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Crown,
  Sparkles,
  Cloud,
  Check,
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
  Home,
  Mic,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { getInitials } from "../lib/utils";

const WEB_APP_URL =
  import.meta.env.VITE_WEB_APP_URL ?? "https://oscar.samyarth.org";
const PRICING_URL = `${WEB_APP_URL}/pricing`;

type TabType = "home" | "meetings" | "scribble" | "vocabulary" | "billing" | "settings";

interface UpdaterState {
  checking: boolean;
  updateAvailable: boolean;
  downloading: boolean;
  downloadProgress: number;
  readyToInstall: boolean;
  error: string | null;
  updateInfo: { version: string; currentVersion: string; date?: string; body?: string } | null;
}

interface FolderSummary {
  name: string;
  count: number;
}

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  userEmail: string;
  userName?: string;
  isProUser?: boolean;
  onUpgradeClick?: () => void;
  appVersion: string | null;
  updaterState?: UpdaterState;
  onCheckForUpdates?: () => void;
  onDownloadUpdate?: () => void;
  onInstallUpdate?: () => void;
  folders?: FolderSummary[];
}

function CapsLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
      {children}
    </span>
  );
}

function NavRow({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full text-left bg-transparent border-none cursor-pointer py-1.5 px-0.5 transition-colors duration-150 ${
        isActive ? "text-ink font-medium" : "text-ink-soft hover:text-ink"
      } text-[13px]`}
    >
      <span
        className={`inline-block h-[5px] w-[5px] rounded-full ${
          isActive ? "bg-terracotta" : "bg-transparent"
        }`}
      />
      <span>{label}</span>
    </button>
  );
}

export function Navigation({
  activeTab,
  onTabChange,
  userEmail,
  userName,
  isProUser = false,
  onUpgradeClick,
  appVersion,
  updaterState,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  folders = [],
}: NavigationProps) {
  const workspaceItems: { id: TabType; label: string; Icon: LucideIcon }[] = [
    { id: "home", label: "Today", Icon: Home },
    { id: "scribble", label: "Scribbles", Icon: Mic },
    { id: "meetings", label: "Minutes", Icon: FileText },
    { id: "settings", label: "Settings", Icon: Settings },
  ];

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      openUrl(PRICING_URL).catch((error) => {
        console.error("Failed to open pricing:", error);
        onTabChange("settings");
      });
    }
  };

  const displayName = userName?.trim() || userEmail?.split("@")[0] || "Signed in";
  const visibleFolders = folders.slice(0, 6);

  // Below the 1080px breakpoint, collapse the 240px sidebar to a 64px icon rail
  // (the design's V2DeskRail) so the content panes keep their width down to the
  // enforced 960px window floor. Full sidebar returns at wider widths.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const update = () => setCompact(window.innerWidth < 1080);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (compact) {
    return (
      <nav className="w-16 bg-cream flex flex-col items-center flex-shrink-0 border-r border-cream-300 pt-5 pb-3.5">
        <div
          data-tauri-drag-region
          className="cursor-default"
          onMouseDown={(e) => {
            if (e.button === 0) getCurrentWindow().startDragging();
          }}
        >
          <img
            src="/oscar-light-logo.svg"
            alt="Oscar"
            width="22"
            height="22"
            className="object-contain pointer-events-none"
          />
        </div>
        <div className="mt-5 flex flex-col items-center gap-1">
          {workspaceItems.map(({ id, label, Icon }) => {
            const on = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                title={label}
                className="flex flex-col items-center gap-1 bg-transparent border-none cursor-pointer py-1"
                style={{ width: 56 }}
              >
                <span
                  className={`inline-flex items-center justify-center rounded-[10px] transition-colors ${
                    on ? "bg-ink text-cream" : "text-ink-soft hover:text-ink"
                  }`}
                  style={{ height: 34, width: 38 }}
                >
                  <Icon size={17} strokeWidth={1.7} />
                </span>
                <span
                  className={`font-mono text-[8.5px] tracking-[0.04em] uppercase ${
                    on ? "text-ink font-semibold" : "text-ink-faint"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        <div
          className="mt-auto"
          title={`${displayName} · ${isProUser ? "Pro" : "Free"}`}
        >
          <div className="h-[30px] w-[30px] rounded-full bg-terracotta text-cream font-serif text-[12px] font-medium uppercase flex items-center justify-center">
            {getInitials(userEmail)}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="w-60 bg-cream flex flex-col flex-shrink-0 border-r border-cream-300">
      {/* Brand — V2Wordmark. Draggable on macOS. */}
      <div
        data-tauri-drag-region
        className="pt-5 pb-7 px-6 flex items-center gap-2.5 cursor-default"
        onMouseDown={(e) => {
          if (e.button === 0) getCurrentWindow().startDragging();
        }}
      >
        <img
          src="/oscar-light-logo.svg"
          alt="Oscar Logo"
          width="22"
          height="22"
          className="object-contain"
        />
        <span className="font-serif text-[22px] font-medium tracking-[0] text-ink">
          Oscar
        </span>
      </div>

      <div className="px-6 flex-1 flex flex-col gap-7 overflow-y-auto">
        <div>
          <CapsLabel>MENU</CapsLabel>
          <div className="mt-3 space-y-0.5">
            {workspaceItems.map((item) => (
              <NavRow
                key={item.id}
                label={item.label}
                isActive={activeTab === item.id}
                onClick={() => onTabChange(item.id)}
              />
            ))}
          </div>
        </div>

        {visibleFolders.length > 0 && (
          <div className="pt-5 border-t border-cream-300">
            <CapsLabel>FOLDERS</CapsLabel>
            <div className="mt-3 space-y-2">
              {visibleFolders.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center justify-between"
                >
                  <span className="text-[12px] text-ink-soft truncate pr-2">{f.name}</span>
                  <span className="font-mono text-[11px] text-ink-faint">{f.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-6 pt-4 pb-5 border-t border-cream-300 space-y-4">
        {/* Account block — V2DeskSidebar style: caps tier, avatar + name */}
        <div>
          <CapsLabel>{isProUser ? "OSCAR · PRO" : "OSCAR · FREE"}</CapsLabel>
          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-terracotta text-cream font-serif text-[11px] font-medium uppercase flex items-center justify-center shrink-0">
              {getInitials(userEmail)}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-[13px] text-ink truncate leading-tight"
                title={displayName}
              >
                {displayName}
              </div>
              {userEmail && userEmail !== displayName && (
                <div
                  className="text-[11px] text-ink-faint truncate leading-tight"
                  title={userEmail}
                >
                  {userEmail}
                </div>
              )}
            </div>
          </div>
        </div>

        {!isProUser && (
          <button
            onClick={handleUpgrade}
            className="w-full text-left rounded-xl bg-ink text-cream p-4 cursor-pointer border-none transition-transform duration-150 hover:-translate-y-px"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles size={13} className="text-terracotta" />
              <CapsLabel>OSCAR · PRO</CapsLabel>
            </div>
            <p className="font-serif text-[15px] leading-snug text-cream mb-2.5">
              Unlimited recordings, Scribbles, and priority AI.
            </p>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-terracotta">
              <Crown size={12} />
              View Pro plans →
            </span>
          </button>
        )}

        {appVersion && (
          <VersionIndicator
            version={appVersion}
            updaterState={updaterState}
            onCheckForUpdates={onCheckForUpdates}
            onDownloadUpdate={onDownloadUpdate}
            onInstallUpdate={onInstallUpdate}
          />
        )}
      </div>
    </nav>
  );
}

function VersionIndicator({
  version,
  updaterState,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
}: {
  version: string;
  updaterState?: UpdaterState;
  onCheckForUpdates?: () => void;
  onDownloadUpdate?: () => void;
  onInstallUpdate?: () => void;
}) {
  const getStatusIcon = () => {
    if (!updaterState) return <Cloud size={11} className="text-ink-faint" />;
    if (updaterState.checking) return <Loader2 size={11} className="text-ink-faint animate-spin" />;
    if (updaterState.readyToInstall) return <Download size={11} className="text-terracotta" />;
    if (updaterState.downloading) return <Loader2 size={11} className="text-terracotta animate-spin" />;
    if (updaterState.updateAvailable) return <RefreshCw size={11} className="text-terracotta" />;
    if (updaterState.error) return <AlertCircle size={11} className="text-[#8c2f25]" />;
    return <Check size={11} className="text-ink-faint" />;
  };

  const getStatusText = () => {
    if (!updaterState) return "Check for updates";
    if (updaterState.checking) return "Checking…";
    if (updaterState.readyToInstall) return "Restart to install";
    if (updaterState.downloading) return `Downloading ${updaterState.downloadProgress}%`;
    if (updaterState.updateAvailable && updaterState.updateInfo) return `v${updaterState.updateInfo.version} available`;
    if (updaterState.error) return "Check failed";
    return "Up to date";
  };

  const handleClick = () => {
    if (!updaterState) {
      onCheckForUpdates?.();
      return;
    }
    if (updaterState.readyToInstall) {
      onInstallUpdate?.();
      return;
    }
    if (updaterState.updateAvailable && !updaterState.downloading) {
      onDownloadUpdate?.();
      return;
    }
    if (!updaterState.checking && !updaterState.downloading) {
      onCheckForUpdates?.();
    }
  };

  const isClickable = !updaterState?.checking && !updaterState?.downloading;
  const highlighted = updaterState?.updateAvailable || updaterState?.readyToInstall;

  return (
    <button
      onClick={handleClick}
      disabled={!isClickable}
      className={`w-full flex items-center gap-2 py-1.5 px-0 bg-transparent border-none transition-opacity ${
        isClickable ? "cursor-pointer hover:opacity-80" : "cursor-default"
      }`}
    >
      {getStatusIcon()}
      <span className="font-mono text-[10px] tracking-[0.06em] text-ink-faint">v{version}</span>
      <span className="text-ink-faint">·</span>
      <span
        className={`font-mono text-[10px] tracking-[0.04em] ${
          highlighted ? "text-terracotta" : "text-ink-faint"
        }`}
      >
        {getStatusText()}
      </span>
    </button>
  );
}
