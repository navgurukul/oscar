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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRecognitionAPI =
      win.SpeechRecognition || win.webkitSpeechRecognition;
    return !!SpeechRecognitionAPI;
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
