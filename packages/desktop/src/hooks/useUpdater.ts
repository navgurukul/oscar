import { useState, useCallback } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

interface UpdateInfo {
  version: string;
  currentVersion: string;
  date?: string;
  body?: string;
}

interface UpdaterState {
  checking: boolean;
  updateAvailable: boolean;
  downloading: boolean;
  downloadProgress: number;
  readyToInstall: boolean;
  error: string | null;
  updateInfo: UpdateInfo | null;
}

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({
    checking: false,
    updateAvailable: false,
    downloading: false,
    downloadProgress: 0,
    readyToInstall: false,
    error: null,
    updateInfo: null,
  });

  const checkForUpdates = useCallback(async () => {
    setState((prev) => ({ ...prev, checking: true, error: null }));

    try {
      const update = await check();

      if (update) {
        setState((prev) => ({
          ...prev,
          checking: false,
          updateAvailable: true,
          updateInfo: {
            version: update.version,
            currentVersion: update.currentVersion,
            date: update.date,
            body: update.body,
          },
        }));
        return update;
      } else {
        setState((prev) => ({
          ...prev,
          checking: false,
          updateAvailable: false,
        }));
        return null;
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        checking: false,
        error: (error as Error).message,
      }));
      return null;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    setState((prev) => ({ ...prev, downloading: true, downloadProgress: 0 }));

    try {
      const update = await check();

      if (!update) {
        throw new Error("No update available");
      }

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            const progress = contentLength > 0 ? (downloaded / contentLength) * 100 : 0;
            setState((prev) => ({ ...prev, downloadProgress: Math.round(progress) }));
            break;
          case "Finished":
            setState((prev) => ({
              ...prev,
              downloading: false,
              downloadProgress: 100,
              readyToInstall: true,
            }));
            break;
        }
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        downloading: false,
        error: (error as Error).message,
      }));
    }
  }, []);

  const installAndRelaunch = useCallback(async () => {
    try {
      await relaunch();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: (error as Error).message,
      }));
    }
  }, []);

  return {
    ...state,
    checkForUpdates,
    downloadAndInstall,
    installAndRelaunch,
  };
}
