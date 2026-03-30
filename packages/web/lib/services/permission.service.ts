// Permission service for handling microphone permission retry flow

import { browserService } from "./browser.service";
import { PERMISSION_CONFIG, ERROR_MESSAGES } from "../constants";

export interface PermissionInstructions {
  browser: string;
  steps: string[];
  settingsUrl?: string;
}

/**
 * Permission service provides utilities for handling microphone permission
 * edge cases with retry logic and browser-specific instructions.
 */
export const permissionService = {
  /**
   * Get browser-specific instructions for enabling microphone access
   */
  getPermissionInstructions(): PermissionInstructions {
    const isIOS = browserService.isIOS();
    const isSafari = browserService.isSafari();
    const isChrome = this.isChrome();
    const isFirefox = this.isFirefox();
    const isEdge = this.isEdge();

    if (isIOS && isSafari) {
      return {
        browser: "Safari (iOS)",
        steps: [
          "Open Settings app on your device",
          "Scroll down and tap Safari",
          "Tap Microphone under 'Settings for Websites'",
          "Select 'Allow' or enable for this site",
          "Return to this page and tap 'Try Again'",
        ],
      };
    }

    if (isIOS && !isSafari) {
      return {
        browser: "iOS Browser",
        steps: [
          "Speech recognition on iOS requires Safari",
          "Please open this page in Safari",
          "Then allow microphone access when prompted",
        ],
      };
    }

    if (isChrome) {
      return {
        browser: "Chrome",
        steps: [
          "Click the lock/tune icon in the address bar",
          "Find 'Microphone' in the permissions list",
          "Change it from 'Block' to 'Allow'",
          "Refresh the page or tap 'Try Again'",
        ],
        settingsUrl: "chrome://settings/content/microphone",
      };
    }

    if (isFirefox) {
      return {
        browser: "Firefox",
        steps: [
          "Click the lock icon in the address bar",
          "Click 'Connection secure' or site info",
          "Click 'More information'",
          "Go to Permissions tab",
          "Find Microphone and select 'Allow'",
        ],
      };
    }

    if (isEdge) {
      return {
        browser: "Edge",
        steps: [
          "Click the lock icon in the address bar",
          "Find 'Microphone' in permissions",
          "Change it from 'Block' to 'Allow'",
          "Refresh the page or tap 'Try Again'",
        ],
      };
    }

    if (isSafari && !isIOS) {
      return {
        browser: "Safari (macOS)",
        steps: [
          "Click Safari in the menu bar",
          "Select 'Settings for This Website...'",
          "Find Microphone and select 'Allow'",
          "Alternatively: Safari > Settings > Websites > Microphone",
        ],
      };
    }

    // Generic fallback
    return {
      browser: "Your browser",
      steps: [
        "Look for a microphone icon in the address bar",
        "Or check site permissions in browser settings",
        "Enable microphone access for this site",
        "Then refresh the page or tap 'Try Again'",
      ],
    };
  },

  /**
   * Check if the permission can potentially be retried.
   * Some browsers permanently block after user denies multiple times.
   */
  async canRetryPermission(): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.permissions) {
      // If Permissions API not supported, assume retry is possible
      return true;
    }

    try {
      const result = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      // 'prompt' means user can be asked again
      // 'denied' means permanently blocked (user must change in settings)
      // 'granted' means already allowed
      return result.state === "prompt" || result.state === "granted";
    } catch {
      // Permissions API might not support 'microphone' query in some browsers
      return true;
    }
  },

  /**
   * Get the current permission state
   */
  async getPermissionState(): Promise<
    "granted" | "denied" | "prompt" | "unknown"
  > {
    if (typeof navigator === "undefined" || !navigator.permissions) {
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
  },

  /**
   * Determine if the error indicates a permission denial vs other mic error
   */
  isPermissionDeniedError(errorMessage: string): boolean {
    const permissionDeniedPatterns = [
      ERROR_MESSAGES.MIC_PERMISSION_DENIED,
      ERROR_MESSAGES.PERMISSION_DENIED_RETRY,
      ERROR_MESSAGES.PERMISSION_BLOCKED,
      "NotAllowedError",
      "Permission denied",
      "permission required",
      "access denied",
    ];

    const lowerError = errorMessage.toLowerCase();
    return permissionDeniedPatterns.some(
      (pattern) =>
        lowerError.includes(pattern.toLowerCase()) ||
        errorMessage.includes(pattern)
    );
  },

  /**
   * Get appropriate error message based on retry count
   */
  getErrorMessage(retryCount: number): string {
    if (retryCount >= PERMISSION_CONFIG.MAX_RETRY_ATTEMPTS) {
      return ERROR_MESSAGES.PERMISSION_BLOCKED;
    }
    return ERROR_MESSAGES.PERMISSION_DENIED_RETRY;
  },

  // Browser detection helpers
  isChrome(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    return /Chrome/i.test(ua) && !/Edge|Edg|OPR/i.test(ua);
  },

  isFirefox(): boolean {
    if (typeof navigator === "undefined") return false;
    return /Firefox/i.test(navigator.userAgent);
  },

  isEdge(): boolean {
    if (typeof navigator === "undefined") return false;
    return /Edg/i.test(navigator.userAgent);
  },
};
