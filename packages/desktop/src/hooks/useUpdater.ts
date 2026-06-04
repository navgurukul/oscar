import { useState, useCallback, useRef } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";

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

  // The pending Update is created by check() and reused by download() and
  // install() — the downloaded bytes live on this object, so the same instance
  // must survive between the "Update" and "Restart" clicks.
  const updateRef = useRef<Update | null>(null);

  const checkForUpdates = useCallback(async () => {
    setState((prev) => ({ ...prev, checking: true, error: null }));

    try {
      const update = await check();
      updateRef.current = update;

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

  // Download only. The install is deferred to installAndRelaunch so we can tear
  // down auxiliary windows first (see below). On Windows, downloadAndInstall()
  // used to call std::process::exit(0) mid-flow before we could clean up, which
  // left the NSIS /UPDATE installer unable to replace the locked oscar.exe.
  const downloadAndInstall = useCallback(async () => {
    setState((prev) => ({ ...prev, downloading: true, downloadProgress: 0 }));

    try {
      let update = updateRef.current;
      if (!update) {
        update = await check();
        updateRef.current = update;
      }

      if (!update) {
        throw new Error("No update available");
      }

      let downloaded = 0;
      let contentLength = 0;

      await update.download((event) => {
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
      // Stop the pill's cursor-hover poller before installing. The poller
      // touches the always-on recording-pill window every ~45ms; if it's still
      // running when the NSIS /UPDATE installer (and the plugin's
      // cleanup_before_exit) tears the window down, the destroy deadlocks and
      // the whole update hangs — the "Restart" button appears to do nothing.
      // Stop it, wait one poll cycle so the thread exits, then install.
      // (A previous attempt destroyed the window from here directly and hit the
      // same deadlock; stopping the poller first is the actual fix.)
      try {
        await invoke("stop_pill_hover");
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch {
        // Best-effort — proceed with the install regardless.
      }

      const update = updateRef.current;
      if (update) {
        // Windows: extracts + runs the NSIS /UPDATE installer, then exits this
        // process so the installer can replace files and relaunch the new build.
        // macOS/Linux: swaps the bundle in place and returns here.
        await update.install();
      }

      // macOS/Linux need an explicit relaunch into the new version. On Windows
      // this is unreachable — install() already exited the process.
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
