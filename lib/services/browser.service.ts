// Browser detection service

export const browserService = {
  /**
   * Check if speech recognition is supported in the current browser
   */
  isSpeechRecognitionSupported(): boolean {
    if (typeof window === "undefined") return false;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    return !!SpeechRecognition;
  },

  /**
   * Detect if running on iOS Safari
   * iOS Safari has specific limitations that require restart strategy
   */
  isIOSSafari(): boolean {
    if (typeof navigator === "undefined") return false;

    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS/i.test(ua);

    return isIOS && isSafari;
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
    } catch (error: any) {
      let errorMsg = "Microphone access denied";

      if (error.name === "NotAllowedError") {
        errorMsg =
          "Microphone permission required. Enable it from browser settings and reload";
      } else if (error.name === "NotFoundError") {
        errorMsg = "No microphone found. Check your device and try again";
      } else if (error.name === "NotReadableError") {
        errorMsg = "Microphone in use. Close other apps and try again";
      }

      return { granted: false, error: errorMsg };
    }
  },
};
