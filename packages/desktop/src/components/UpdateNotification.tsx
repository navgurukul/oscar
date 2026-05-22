import { X } from "lucide-react";

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
  onShowNotes?: () => void;
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
  onShowNotes,
}: UpdateNotificationProps) {
  if (!updateAvailable && !error) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[1000] w-[300px] max-w-[calc(100vw-24px)] rounded-xl border border-cream-300 bg-cream-50 p-3.5 shadow-[0_16px_40px_rgba(26,24,22,0.18)]">
      <div className="mb-2 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
        UPDATE
      </div>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {error ? (
            <p className="text-[0.8125rem] text-slate-500">Update check failed</p>
          ) : readyToInstall ? (
            <>
              <p className="text-[0.8125rem] font-medium text-slate-800">Ready to install</p>
              <p className="text-[0.75rem] text-slate-400 mt-0.5">
                v{updateInfo?.version} — restart to apply
              </p>
            </>
          ) : downloading ? (
            <>
              <p className="text-[0.8125rem] font-medium text-slate-800">Downloading update</p>
              <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-terracotta-500 transition-[width] duration-300 ease-out"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="text-[0.75rem] text-slate-400 mt-1.5">{downloadProgress}%</p>
            </>
          ) : (
            <>
              <p className="text-[0.8125rem] font-medium text-slate-800">
                v{updateInfo?.version} available
              </p>
              <p className="text-[0.75rem] text-slate-400 mt-0.5">
                Current: v{updateInfo?.currentVersion}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {!downloading && !error && onShowNotes && (
            <button
              onClick={onShowNotes}
              type="button"
              className="text-[0.75rem] font-medium text-ink-soft hover:text-ink transition-colors bg-transparent border-none cursor-pointer"
            >
              Notes
            </button>
          )}
          {!downloading && !error && (
            <button
              onClick={readyToInstall ? onInstall : onDownload}
              type="button"
              className="text-[0.75rem] font-semibold text-terracotta hover:opacity-80 transition-opacity bg-transparent border-none cursor-pointer"
            >
              {readyToInstall ? "Restart" : "Update"}
            </button>
          )}
          <button
            onClick={onDismiss}
            type="button"
            aria-label="Dismiss"
            className="flex items-center justify-center h-6 w-6 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
