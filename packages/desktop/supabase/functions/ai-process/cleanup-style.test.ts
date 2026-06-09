// Pure-function tests for cleanup style selection. Run with:
//   deno test packages/desktop/supabase/functions/ai-process/cleanup-style.test.ts
//
// These guard the wiring that "makes prompt engineering work": prompt-engineer
// must be a system-prompt swap, tone presets must append a user-prompt line,
// and faithful must change nothing.
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1";
import {
  getStreamLanguageInstruction,
  getStreamStyleInstruction,
  isPromptEngineerStyle,
  STREAM_LANGUAGE_INSTRUCTIONS,
  STREAM_STYLE_INSTRUCTIONS,
} from "./cleanup-style.ts";

Deno.test("prompt-engineer is detected as a system-prompt swap", () => {
  assertEquals(isPromptEngineerStyle("prompt-engineer"), true);
  assertEquals(isPromptEngineerStyle("polished"), false);
  assertEquals(isPromptEngineerStyle("faithful"), false);
  assertEquals(isPromptEngineerStyle(undefined), false);
});

Deno.test("tone presets append a user-prompt instruction line", () => {
  assertEquals(
    getStreamStyleInstruction("polished"),
    STREAM_STYLE_INSTRUCTIONS.polished,
  );
  assertEquals(
    getStreamStyleInstruction("concise"),
    STREAM_STYLE_INSTRUCTIONS.concise,
  );
});

Deno.test("faithful / prompt-engineer / unknown add no tone line", () => {
  // faithful is the baseline (no change); prompt-engineer swaps the system
  // prompt elsewhere; unknown values degrade gracefully.
  assertEquals(getStreamStyleInstruction("faithful"), undefined);
  assertEquals(getStreamStyleInstruction("prompt-engineer"), undefined);
  assertEquals(getStreamStyleInstruction(undefined), undefined);
  assertEquals(getStreamStyleInstruction("bogus"), undefined);
});

Deno.test("script-sensitive languages get explicit, distinct directives", () => {
  // hi-en must stay Roman; hi must stay Devanagari. Conflating them is the
  // exact bug this guards: the default (hi-en) must never push Devanagari.
  assertEquals(getStreamLanguageInstruction("hi-en"), STREAM_LANGUAGE_INSTRUCTIONS["hi-en"]);
  assertEquals(getStreamLanguageInstruction("hi"), STREAM_LANGUAGE_INSTRUCTIONS.hi);
  assertStringIncludes(getStreamLanguageInstruction("hi-en")!, "Roman");
  assertStringIncludes(getStreamLanguageInstruction("hi-en")!, "do NOT convert");
  assertStringIncludes(getStreamLanguageInstruction("hi")!, "Devanagari");
});

Deno.test("language code is normalised (case / whitespace)", () => {
  assertEquals(getStreamLanguageInstruction("  HI-EN "), STREAM_LANGUAGE_INSTRUCTIONS["hi-en"]);
  assertEquals(getStreamLanguageInstruction("EN"), STREAM_LANGUAGE_INSTRUCTIONS.en);
});

Deno.test("generic supported languages get a keep-in-<Language> line", () => {
  const es = getStreamLanguageInstruction("es");
  assertStringIncludes(es!, "Spanish");
  assertStringIncludes(es!, "Do not translate");
  assertStringIncludes(getStreamLanguageInstruction("ja")!, "Japanese");
});

Deno.test("auto / empty / unknown add no language line", () => {
  // These fall back to the system prompt's "preserve the original language".
  assertEquals(getStreamLanguageInstruction("auto"), undefined);
  assertEquals(getStreamLanguageInstruction(""), undefined);
  assertEquals(getStreamLanguageInstruction("   "), undefined);
  assertEquals(getStreamLanguageInstruction(undefined), undefined);
  assertEquals(getStreamLanguageInstruction(null), undefined);
  assertEquals(getStreamLanguageInstruction("zz"), undefined);
});
