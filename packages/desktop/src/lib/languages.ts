/**
 * Shared transcription-language list — the single source for the language
 * picker in Settings and onboarding (extracted from SettingsTab for WS-E).
 */
export interface LanguageOption {
  code: string;
  flag: string;
  name: string;
  native: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "hi-en", flag: "🇮🇳", name: "Hinglish", native: "Hindi + English" },
  { code: "en", flag: "🇺🇸", name: "English", native: "English" },
  { code: "hi", flag: "🇮🇳", name: "Hindi", native: "हिन्दी" },
  { code: "es", flag: "🇪🇸", name: "Spanish", native: "Español" },
  { code: "fr", flag: "🇫🇷", name: "French", native: "Français" },
  { code: "de", flag: "🇩🇪", name: "German", native: "Deutsch" },
  { code: "zh", flag: "🇨🇳", name: "Chinese", native: "中文" },
  { code: "ja", flag: "🇯🇵", name: "Japanese", native: "日本語" },
  { code: "ar", flag: "🇸🇦", name: "Arabic", native: "العربية" },
  { code: "pt", flag: "🇧🇷", name: "Portuguese", native: "Português" },
  { code: "ru", flag: "🇷🇺", name: "Russian", native: "Русский" },
  { code: "ko", flag: "🇰🇷", name: "Korean", native: "한국어" },
  { code: "it", flag: "🇮🇹", name: "Italian", native: "Italiano" },
  { code: "nl", flag: "🇳🇱", name: "Dutch", native: "Nederlands" },
  { code: "pl", flag: "🇵🇱", name: "Polish", native: "Polski" },
  { code: "tr", flag: "🇹🇷", name: "Turkish", native: "Türkçe" },
  { code: "vi", flag: "🇻🇳", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "id", flag: "🇮🇩", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "uk", flag: "🇺🇦", name: "Ukrainian", native: "Українська" },
  { code: "sv", flag: "🇸🇪", name: "Swedish", native: "Svenska" },
  { code: "cs", flag: "🇨🇿", name: "Czech", native: "Čeština" },
  { code: "el", flag: "🇬🇷", name: "Greek", native: "Ελληνικά" },
  { code: "fi", flag: "🇫🇮", name: "Finnish", native: "Suomi" },
  { code: "ro", flag: "🇷🇴", name: "Romanian", native: "Română" },
  { code: "hu", flag: "🇭🇺", name: "Hungarian", native: "Magyar" },
  { code: "he", flag: "🇮🇱", name: "Hebrew", native: "עברית" },
  { code: "ur", flag: "🇵🇰", name: "Urdu", native: "اردو" },
  { code: "bn", flag: "🇧🇩", name: "Bengali", native: "বাংলা" },
  { code: "ta", flag: "🇮🇳", name: "Tamil", native: "தமிழ்" },
  { code: "te", flag: "🇮🇳", name: "Telugu", native: "తెలుగు" },
  { code: "ms", flag: "🇲🇾", name: "Malay", native: "Bahasa Melayu" },
  { code: "th", flag: "🇹🇭", name: "Thai", native: "ภาษาไทย" },
  { code: "da", flag: "🇩🇰", name: "Danish", native: "Dansk" },
];
