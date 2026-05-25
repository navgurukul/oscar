import { useEffect, useState } from "react";
import { loadSetting, saveSetting } from "../lib/store";

export type VibeMode = "conv" | "code" | "mins" | "note";

const MODES: {
  id: VibeMode;
  name: string;
  tag: string;
  desc: string;
}[] = [
  {
    id: "conv",
    name: "Conversational",
    tag: "DEFAULT",
    desc: "Cleaned prose. Punctuation, capitalization, removed filler. The standard.",
  },
  {
    id: "code",
    name: "Coding",
    tag: "IDES",
    desc: "No prose cleanup. Variables, snake_case, dot.notation, file paths verbatim.",
  },
  {
    id: "mins",
    name: "Minutes",
    tag: "MEETINGS",
    desc: "Speaker turns. Decisions and actions surfaced. Filler kept for nuance.",
  },
  {
    id: "note",
    name: "Note",
    tag: "JOURNALS",
    desc: "Bullet-leaning. Stream of consciousness preserved. Light cleanup only.",
  },
];

const STORAGE_KEY = "vibeMode";

export function VibeCodingPicker() {
  const [active, setActive] = useState<VibeMode>("conv");

  useEffect(() => {
    loadSetting<VibeMode>(STORAGE_KEY, "conv")
      .then((mode) => {
        if (mode) setActive(mode);
      })
      .catch(() => {});
  }, []);

  const pick = (id: VibeMode) => {
    setActive(id);
    saveSetting(STORAGE_KEY, id).catch((err) =>
      console.warn("[VibeCodingPicker] save failed", err),
    );
  };

  return (
    <section className="mt-10">
      <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
        VIBE CODING · FORMATTING MODE
      </span>
      <h2 className="mt-2 font-serif font-medium tracking-[-0.02em] text-ink text-[24px] leading-[1.1]">
        How Oscar should <em className="italic text-terracotta">format</em>.
      </h2>
      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-soft">
        Pick a baseline. Context-aware dictation overrides this per app — VS Code uses Coding, Notion uses Note, Slack uses Conversational.
      </p>

      <div className="mt-6 space-y-2.5">
        {MODES.map((m) => {
          const isActive = m.id === active;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => pick(m.id)}
              className={`w-full text-left rounded-lg p-5 flex items-start gap-5 cursor-pointer transition-colors ${
                isActive
                  ? "bg-cream-200 border border-terracotta"
                  : "bg-transparent border border-cream-300 hover:bg-cream-50"
              }`}
            >
              <span
                className={`inline-flex h-4 w-4 shrink-0 mt-1 rounded-full items-center justify-center ${
                  isActive
                    ? "bg-terracotta border-0"
                    : "bg-transparent border-[1.5px] border-cream-400"
                }`}
              >
                {isActive && <span className="block h-1.5 w-1.5 bg-cream rounded-full" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h3 className="font-serif font-medium text-ink text-[20px] tracking-[-0.01em]">
                    {m.name}
                  </h3>
                  <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
                    {m.tag}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{m.desc}</p>
              </div>
              {isActive && (
                <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-terracotta shrink-0 mt-1.5">
                  ACTIVE
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
