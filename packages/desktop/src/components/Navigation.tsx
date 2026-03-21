import React from "react";
import { Home, Settings, Crown, Sparkles, FileText, Cloud, Check, Download, RefreshCw, Loader2, AlertCircle } from "lucide-react";

type TabType = "home" | "notes" | "vocabulary" | "billing" | "settings";

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

export function Navigation({ 
  activeTab, 
  onTabChange, 
  isProUser = false,
  onUpgradeClick,
  appVersion,
  updaterState,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate
}: NavigationProps) {
  const navItems: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: "home", label: "Home", icon: Home },
    { id: "notes", label: "Notes", icon: FileText },
  ];

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      // Default behavior: navigate to settings tab (billing is inside settings)
      onTabChange("settings");
    }
  };

  return (
    <nav className="w-60 bg-white flex flex-col flex-shrink-0">
      {/* Brand section - fixed at top, draggable for macOS */}
      <div className="pb-4 px-5 flex items-center gap-2.5 [-webkit-app-region:drag]">
        <img src="/OSCAR_LIGHT_LOGO.png" alt="OSCAR" width={36} height={36} className="[-webkit-app-region:no-drag]" />
        <span className="text-base font-semibold text-slate-800 [-webkit-app-region:no-drag]">OSCAR</span>
      </div>

      <div className="flex-1 py-2 px-3 flex flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`flex items-center gap-3 py-3 px-4 rounded-[10px] border-none bg-transparent text-slate-500 text-[0.9375rem] font-medium cursor-pointer transition-all duration-200 relative hover:bg-slate-50 hover:text-slate-700 ${isActive ? "bg-sky-50 text-cyan-600" : ""}`}
              onClick={() => onTabChange(item.id)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-100">
        {/* Upgrade to Pro Card - only shown for free users */}
        {!isProUser && (
          <div className="bg-gradient-to-br from-cyan-600 to-cyan-500 rounded-xl p-4 mb-4 text-white">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center text-white">
                <Sparkles size={16} />
              </div>
              <span className="text-[0.9375rem] font-semibold text-white">OSCAR Pro</span>
            </div>
            <p className="text-[0.8125rem] text-white/85 leading-relaxed mb-3">
              Upgrade to Pro for unlimited recordings, vocabulary entries, and priority AI processing.
            </p>
            <button 
              className="flex items-center justify-center gap-1.5 w-full py-2.5 px-3.5 bg-white border-none rounded-lg text-cyan-600 text-sm font-semibold cursor-pointer transition-all duration-200 hover:bg-white/95 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(6,182,212,0.3)]"
              onClick={handleUpgrade}
            >
              <Crown size={14} />
              Upgrade to Pro
            </button>
          </div>
        )}

        <button 
          className={`flex items-center gap-3 py-3 px-4 rounded-[10px] border-none bg-transparent text-slate-500 text-[0.9375rem] font-medium cursor-pointer transition-all duration-200 relative hover:bg-slate-50 hover:text-slate-700 ${activeTab === "settings" ? "bg-sky-50 text-cyan-600" : ""}`}
          onClick={() => onTabChange("settings")}
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>

        {/* Version indicator */}
        {appVersion && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <VersionIndicator
              version={appVersion}
              updaterState={updaterState}
              onCheckForUpdates={onCheckForUpdates}
              onDownloadUpdate={onDownloadUpdate}
              onInstallUpdate={onInstallUpdate}
            />
          </div>
        )}
      </div>
    </nav>
  );
}

// Version indicator component
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
    if (!updaterState) {
      return <Cloud size={12} className="text-slate-400" />;
    }
    if (updaterState.checking) {
      return <Loader2 size={12} className="text-slate-400 animate-spin" />;
    }
    if (updaterState.readyToInstall) {
      return <Download size={12} className="text-emerald-500" />;
    }
    if (updaterState.downloading) {
      return <Loader2 size={12} className="text-cyan-500 animate-spin" />;
    }
    if (updaterState.updateAvailable) {
      return <RefreshCw size={12} className="text-cyan-500" />;
    }
    if (updaterState.error) {
      return <AlertCircle size={12} className="text-amber-500" />;
    }
    return <Check size={12} className="text-emerald-500" />;
  };

  const getStatusText = () => {
    if (!updaterState) {
      return "Check for updates";
    }
    if (updaterState.checking) {
      return "Checking...";
    }
    if (updaterState.readyToInstall) {
      return "Click to restart";
    }
    if (updaterState.downloading) {
      return `Downloading ${updaterState.downloadProgress}%`;
    }
    if (updaterState.updateAvailable && updaterState.updateInfo) {
      return `v${updaterState.updateInfo.version} available`;
    }
    if (updaterState.error) {
      return "Check failed";
    }
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

  return (
    <button
      onClick={handleClick}
      disabled={!isClickable}
      className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg border-none bg-transparent text-xs transition-all duration-200 ${
        isClickable
          ? "cursor-pointer hover:bg-slate-50"
          : "cursor-default"
      }`}
    >
      {getStatusIcon()}
      <span className="text-slate-500">v{version}</span>
      <span className="text-slate-400">·</span>
      <span className={`${
        updaterState?.updateAvailable || updaterState?.readyToInstall
          ? "text-cyan-600 font-medium"
          : "text-slate-400"
      }`}>
        {getStatusText()}
      </span>
    </button>
  );
}
