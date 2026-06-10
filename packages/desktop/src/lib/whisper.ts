import type { WhisperModelRole } from "./app-types";

const HINGLISH_HINT =
  "acha, theek hai, haan, nahi, kya, kaise, kab, kyun, lekin, aur, " +
  "matlab, samajh, baat, kaam, kal, aaj, abhi, sab, log, dekho, " +
  "bolo, suno, chalo, pehle, baad mein, zaroor, bilkul, thoda, bahut";

export function buildInitialPrompt(
  transcriptionLanguage: string,
  dictWords: string[],
) {
  const parts: string[] = [];
  if (transcriptionLanguage === "hi-en") {
    parts.push(HINGLISH_HINT);
  }
  if (dictWords.length > 0) {
    parts.push(dictWords.join(", "));
  }
  return parts.length > 0 ? parts.join(", ") : undefined;
}

export function getWhisperLanguage(
  transcriptionLanguage: string,
  _role: WhisperModelRole,
) {
  if (transcriptionLanguage === "auto") return undefined;
  if (transcriptionLanguage === "hi-en") {
    // Hinglish is Hindi-dominant code-switching. Forcing "en" makes Whisper
    // mangle the Hindi portions into nonsense English ("C salary big pigs"
    // out of actual Hindi speech); "hi" decodes the Hindi acoustically and
    // still transcribes the embedded English words. Script normalisation
    // (Devanagari → readable Hinglish) happens downstream in the Minutes
    // enhance step, so the user-facing notes stay readable.
    return "hi";
  }
  return transcriptionLanguage;
}
