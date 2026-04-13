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
  role: WhisperModelRole,
) {
  if (transcriptionLanguage === "auto") return undefined;
  if (transcriptionLanguage === "hi-en") {
    return role === "minutes" ? undefined : "en";
  }
  return transcriptionLanguage;
}
