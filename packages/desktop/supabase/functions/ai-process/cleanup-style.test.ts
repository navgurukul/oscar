// Pure-function tests for cleanup style selection. Run with:
//   deno test packages/desktop/supabase/functions/ai-process/cleanup-style.test.ts
//
// These guard the wiring that "makes prompt engineering work": prompt-engineer
// must be a system-prompt swap, tone presets must append a user-prompt line,
// and faithful must change nothing.
import { assertEquals } from "jsr:@std/assert@^1";
import {
  getStreamStyleInstruction,
  isPromptEngineerStyle,
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
