import { Download, RefreshCw, X, CheckCircle } from "lucide-react";

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
    <div className="update-notification">
      <button className="update-dismiss" onClick={onDismiss} aria-label="Dismiss">
        <X size={14} />
      </button>

      {error && (
        <div className="update-error">
          <span>Update check failed: {error}</span>
        </div>
      )}

      {readyToInstall ? (
        <div className="update-ready">
          <CheckCircle size={16} className="update-icon success" />
          <div className="update-content">
            <span className="update-title">Update Ready</span>
            <span className="update-message">Version {updateInfo?.version} is ready to install</span>
          </div>
          <button className="update-btn install" onClick={onInstall}>
            <RefreshCw size={14} />
            Restart & Install
          </button>
        </div>
      ) : downloading ? (
        <div className="update-downloading">
          <Download size={16} className="update-icon downloading" />
          <div className="update-content">
            <span className="update-title">Downloading...</span>
            <div className="update-progress-bar">
              <div 
                className="update-progress-fill" 
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <span className="update-progress-text">{downloadProgress}%</span>
          </div>
        </div>
      ) : updateAvailable && updateInfo ? (
        <div className="update-available">
          <Download size={16} className="update-icon" />
          <div className="update-content">
            <span className="update-title">Update Available</span>
            <span className="update-message">
              Version {updateInfo.version} (current: {updateInfo.currentVersion})
            </span>
            {updateInfo.body && (
              <p className="update-notes">{updateInfo.body}</p>
            )}
          </div>
          <button className="update-btn download" onClick={onDownload}>
            <Download size={14} />
            Download
          </button>
        </div>
      ) : null}
    </div>
  );
}
