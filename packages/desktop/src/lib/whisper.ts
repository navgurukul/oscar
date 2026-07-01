import type { WhisperModelRole } from "./app-types";

const HINGLISH_HINT =
  "Yeh ek casual Hinglish baatcheet hai jisme Hindi aur English dono mix hote " +
  "hain. English ke words, technical terms aur company ke naam English mein hi " +
  "rehte hain, jaise: value provide karti hai, wheelbase aur boot space, " +
  "company ke against compare karna, basis par, 4.6 meters.";

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
  // Pass "hi-en" through to the backend UNMAPPED. Whisper has no "hi-en" token,
  // so the right ISO token depends on which model is actually resident — and
  // only the Rust side knows that:
  //   • Oriserve Hindi2Hinglish fine-tune → decoded with "en" (the token its
  //     model card specifies for romanized Hinglish output). Forcing "hi" here
  //     drove it off-spec and produced garbled, looping transcripts.
  //   • general-model fallback (box too small for Oriserve) → decoded with "hi"
  //     (Devanagari, which downstream Mercury/Gemini cleanup romanizes).
  // `transcribe_audio_inner` performs this variant-aware mapping from the
  // declared `expected_variant`, so the FE must not pre-collapse the code.
  return transcriptionLanguage;
}
