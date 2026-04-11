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

  return (
    <div className="fixed bottom-5 right-5 z-[1000] w-[300px] max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_10px_40px_rgba(0,0,0,0.10)]">
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
                  className="h-full rounded-full bg-cyan-500 transition-[width] duration-300 ease-out"
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
          {!downloading && !error && (
            <button
              onClick={readyToInstall ? onInstall : onDownload}
              type="button"
              className="text-[0.75rem] font-semibold text-cyan-600 hover:text-cyan-700 transition-colors"
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
