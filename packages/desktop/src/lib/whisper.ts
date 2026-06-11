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
    // still transcribes the embedded English words. This holds for both the
    // general model and the Oriserve Hindi2Hinglish model that the backend now
    // routes "hi-en" to (it is fine-tuned from large-v3, so the "hi" language
    // token still primes Hindi acoustics).
    //
    // Output script: the Oriserve model emits romanized Latin Hinglish directly.
    // On hardware too small for it, the general-model fallback emits Devanagari,
    // which the downstream Mercury/Gemini cleanup romanizes via the language
    // hint — so user-facing notes stay readable on every tier.
    return "hi";
  }
  return transcriptionLanguage;
}
