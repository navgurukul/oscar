import type { DictationContextSnapshot, DictationRoutingResult } from "../types/note.types";
import type {
  HotkeyContextEventPayload,
  MicrophonePermissionState,
} from "./app-types";

export function isMacOS() {
  return navigator.platform.toLowerCase().includes("mac");
}

export function getDesktopPlatform(): string {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("mac")) return "macos";
  if (platform.includes("win")) return "windows";
  if (platform.includes("linux")) return "linux";
  return "unknown";
}

export function buildDictationContextSnapshot(
  payload?: HotkeyContextEventPayload | null,
): DictationContextSnapshot | null {
  if (!payload) return null;

  const appName = payload.appName?.trim() || "";
  if (!appName) return null;

  return {
    platform: payload.platform?.trim() || getDesktopPlatform(),
    appName,
    appId: payload.appId?.trim() || null,
    processName: payload.processName?.trim() || null,
    windowTitle: payload.windowTitle?.trim() || null,
    siteHost: payload.siteHost?.trim() || null,
    siteTitle: payload.siteTitle?.trim() || null,
    capturedAt: new Date().toISOString(),
  };
}

export function buildDictationMetadata(routing?: DictationRoutingResult | null) {
  if (!routing) return {};

  return {
    dictation_category: routing.category,
    dictation_variant: routing.category,
    dictation_app_key: routing.appKey,
    dictation_context_source: routing.source,
    dictation_prompt_version: routing.promptVersion,
  };
}

export async function getMicrophonePermissionState(): Promise<MicrophonePermissionState> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return "unknown";
  }

  try {
    const result = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return result.state;
  } catch {
    return "unknown";
  }
}
