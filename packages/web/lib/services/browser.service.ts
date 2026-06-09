// Browser detection service

export const browserService = {
  /**
   * Check if speech recognition is supported in the current browser
   */
  isSpeechRecognitionSupported(): boolean {
    if (typeof window === "undefined") return false;

    // Chrome and other third-party browsers on iOS do NOT support the SpeechRecognition API,
    // as Apple restricts this to Safari only.
    if (this.isIOS() && !this.isSafari()) return false;

    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  /**
   * Helper to detect iOS devices
   */
  isIOS(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  },

  /**
   * Helper to detect Safari browser
   */
  isSafari(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    return /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(ua);
  },

  /**
   * Detect if running on iOS Safari
   * iOS Safari has specific limitations that require restart strategy
   */
  isIOSSafari(): boolean {
    return this.isIOS() && this.isSafari();
  },

  /**
   * Detect whether the SpeechRecognition engine is Apple WebKit.
   *
   * The Web Speech API on every Apple-WebKit surface — iOS Safari, macOS
   * Safari, and embedded WKWebView (e.g. the Tauri desktop app on macOS) —
   * terminates the recognition session after ~30-60s. Blink (Chrome/Edge/
   * Brave) and Gecko (Firefox) do not, so they need no proactive restart.
   *
   * Chrome ships its own "AppleWebKit" token in the UA for legacy reasons, so
   * WebKit is identified as AppleWebKit *minus* any Chromium/Blink marker.
   */
  isWebKitSpeechEngine(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    const isBlink = /Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|Brave/i.test(ua);
    return /AppleWebKit/i.test(ua) && !isBlink;
  },

  /**
   * Whether the recognition engine needs the preemptive stop/start restart
   * strategy to survive a long recording. True for all Apple-WebKit engines
   * (iOS + macOS Safari, WKWebView), which silently drop the session mid-
   * recording — without proactive restarts only the opening ~minute of audio
   * is ever committed.
   */
  needsPreemptiveRestart(): boolean {
    return this.isWebKitSpeechEngine();
  },

  /**
   * Check microphone permission status
   * @returns Promise with permission granted status and optional error message
   */
  async checkMicrophonePermission(): Promise<{
    granted: boolean;
    error?: string;
  }> {
    try {
      const result = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permission granted, stop the stream immediately
      result.getTracks().forEach((track) => track.stop());
      return { granted: true };
    } catch (error: unknown) {
      const err = error as Error & { name?: string };
      let errorMsg = "Microphone access denied";

      if (err.name === "NotAllowedError") {
        errorMsg =
          "Microphone permission required. Enable it from browser settings and reload";
      } else if (err.name === "NotFoundError") {
        errorMsg = "No microphone found. Check your device and try again";
      } else if (err.name === "NotReadableError") {
        errorMsg = "Microphone in use. Close other apps and try again";
      }

      return { granted: false, error: errorMsg };
    }
  },
};
