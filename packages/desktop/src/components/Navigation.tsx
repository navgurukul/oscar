import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Crown, Sparkles, Cloud, Check, Download, RefreshCw, Loader2, AlertCircle } from "lucide-react";
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

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  userEmail: string;
  isProUser?: boolean;
  onUpgradeClick?: () => void;
  appVersion: string | null;
  updaterState?: UpdaterState;
  onCheckForUpdates?: () => void;
  onDownloadUpdate?: () => void;
  onInstallUpdate?: () => void;
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
  isProUser = false,
  onUpgradeClick,
  appVersion,
  updaterState,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
}: NavigationProps) {
  const workspaceItems: { id: TabType; label: string }[] = [
    { id: "home", label: "Today" },
    { id: "scribble", label: "Scribbles" },
    { id: "meetings", label: "Minutes" },
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
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10.5" stroke="#1a1816" strokeWidth="1.2" />
          <path
            d="M7.5 12c0-1.6.8-2.5 1.8-2.5M9.3 14.5c-1 0-1.8-1-1.8-2.4M12 8.5v7M14.8 10v4M17.5 11.2v1.8"
            stroke="#1a1816"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        <span className="font-serif text-[22px] font-medium tracking-[-0.005em] text-ink">
          Oscar
        </span>
      </div>

      <div className="px-6 flex-1 flex flex-col gap-7 overflow-y-auto">
        <div>
          <CapsLabel>WORKSPACE</CapsLabel>
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

        <div className="pt-5 border-t border-cream-300">
          <CapsLabel>ACCOUNT</CapsLabel>
          <div className="mt-3 space-y-0.5">
            <NavRow
              label="Settings"
              isActive={activeTab === "settings"}
              onClick={() => onTabChange("settings")}
            />
          </div>
        </div>
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
              <div className="text-[13px] text-ink truncate" title={userEmail}>
                {userEmail || "Signed in"}
              </div>
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
