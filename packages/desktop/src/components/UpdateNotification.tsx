import { Download, RefreshCw, X, CheckCircle } from "lucide-react";
import { cn } from "../lib/utils";

interface UpdateNotificationProps {
  updateAvailable: boolean;
  downloading: boolean;
  downloadProgress: number;
  readyToInstall: boolean;
  error: string | null;
  updateInfo: {
    version: string;
    currentVersion: string;
    body?: string;
  } | null;
  onDownload: () => void;
  onInstall: () => void;
  onDismiss: () => void;
}

export function UpdateNotification({
  updateAvailable,
  downloading,
  downloadProgress,
  readyToInstall,
  error,
  updateInfo,
  onDownload,
  onInstall,
  onDismiss,
}: UpdateNotificationProps) {
  if (!updateAvailable && !error) return null;

  const status = readyToInstall
    ? {
        label: "Ready to install",
        title: "Restart to finish updating",
        message: updateInfo?.version
          ? `Version ${updateInfo.version} has been downloaded and is ready.`
          : "The latest version has been downloaded and is ready.",
        icon: CheckCircle,
        iconClassName: "text-emerald-600",
        badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
        actionLabel: "Restart and install",
        actionIcon: RefreshCw,
        action: onInstall,
      }
    : downloading
      ? {
          label: "Downloading",
          title: "Installing the update in the background",
          message: `${downloadProgress}% complete`,
          icon: Download,
          iconClassName: "text-cyan-600",
          badgeClassName: "border-cyan-200 bg-cyan-50 text-cyan-700",
          actionLabel: null,
          actionIcon: null,
          action: null,
        }
      : updateAvailable && updateInfo
        ? {
            label: "Update available",
            title: `Version ${updateInfo.version} is ready`,
            message: `Current version: ${updateInfo.currentVersion}`,
            icon: Download,
            iconClassName: "text-cyan-600",
            badgeClassName: "border-cyan-200 bg-cyan-50 text-cyan-700",
            actionLabel: "Download update",
            actionIcon: Download,
            action: onDownload,
          }
        : null;

  if (!status && !error) return null;

  const StatusIcon = status?.icon;
  const ActionIcon = status?.actionIcon;

  return (
    <div className="fixed bottom-6 right-6 z-[1000] w-[380px] max-w-[calc(100vw-32px)] rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.14)] backdrop-blur-md">
      <button
        className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        onClick={onDismiss}
        aria-label="Dismiss"
        type="button"
      >
        <X size={16} />
      </button>

      {error && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[0.8125rem] leading-5 text-red-700">
          Update check failed: {error}
        </div>
      )}

      {status && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", status.badgeClassName)}>
              {StatusIcon && (
                <StatusIcon
                  size={18}
                  className={cn(status.iconClassName, downloading && "animate-pulse")}
                />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1 pr-8">
              <span
                className={cn(
                  "inline-flex rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]",
                  status.badgeClassName,
                )}
              >
                {status.label}
              </span>
              <div className="text-[0.95rem] font-semibold tracking-[-0.01em] text-slate-900">
                {status.title}
              </div>
              <div className="text-[0.8125rem] leading-5 text-slate-500">
                {status.message}
              </div>
            </div>
          </div>

          {downloading && (
            <div className="space-y-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-cyan-500 transition-[width] duration-300 ease-out"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-cyan-700">
                {downloadProgress}% complete
              </div>
            </div>
          )}

          {updateAvailable && updateInfo?.body && !downloading && (
            <p className="max-h-28 overflow-y-auto rounded-xl bg-slate-50 px-3 py-2.5 text-[0.78rem] leading-5 text-slate-600">
              {updateInfo.body}
            </p>
          )}

          {status.action && status.actionLabel && ActionIcon && (
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3.5 py-3 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-slate-800"
              onClick={status.action}
              type="button"
            >
              <ActionIcon size={16} className={readyToInstall ? "animate-none" : ""} />
              {status.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
