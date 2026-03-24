// Extend standard browser types with non-standard APIs

interface NavigatorUAData {
  platform: string;
  mobile: boolean;
  brands: Array<{ brand: string; version: string }>;
  getHighEntropyValues(hints: string[]): Promise<{ architecture?: string; platform?: string }>;
}

interface Navigator {
  userAgentData?: NavigatorUAData;
}

// Extend Window with vendor-specific speech recognition APIs
interface Window {
  SpeechRecognition?: typeof SpeechRecognition;
  webkitSpeechRecognition?: typeof SpeechRecognition;
}
