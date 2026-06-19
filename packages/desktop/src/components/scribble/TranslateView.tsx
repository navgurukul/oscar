import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { aiService } from "../../services/ai.service";
import type { DBScribble } from "../../types/scribble.types";
import { Caps, cleanBody } from "./_shared";

// Translate screen (design screen 09): source vs translated columns with a
// FROM→TO language pill. Calls the web translate route (Bearer), which keeps
// vocabulary/glossary terms in their original form via its tuned prompt.

type Target = "en" | "hi";
const LABEL: Record<Target, string> = { en: "English", hi: "हिन्दी · Hindi" };

export function TranslateView({
  scribble,
  onBack,
}: {
  scribble: DBScribble;
  onBack: () => void;
}) {
  const source = cleanBody(scribble);
  const [target, setTarget] = useState<Target>("hi");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (lang: Target) => {
    setTarget(lang);
    if (!source.trim() || busy) return;
    setBusy(true);
    setError("");
    setResult("");
    try {
      setResult(await aiService.translateScribble(source, lang));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const LangBtn = ({ lang }: { lang: Target }) => (
    <button
      type="button"
      onClick={() => void run(lang)}
      disabled={busy}
      className={`rounded-full px-3 py-1 text-[12px] border cursor-pointer transition-colors disabled:cursor-wait ${
        target === lang
          ? "border-terracotta text-terracotta font-medium"
          : "border-cream-300 text-ink-soft hover:text-ink"
      }`}
    >
      {LABEL[lang]}
    </button>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-cream">
      <div className="flex items-center gap-3 px-8 py-3 border-b border-cream-300 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 bg-transparent border-none cursor-pointer"
        >
          <Caps className="flex items-center gap-1.5">
            <ArrowLeft size={11} /> SCRIBBLE · TRANSLATE
          </Caps>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-10 py-8">
        <div className="mx-auto" style={{ maxWidth: 980 }}>
          <h1
            className="font-serif font-medium text-ink"
            style={{ fontSize: 30, lineHeight: 1, letterSpacing: "-0.02em" }}
          >
            Your words, in <em className="italic text-terracotta">another tongue</em>.
          </h1>

          <div className="mt-4 inline-flex items-center gap-2.5 rounded-full px-3 py-1.5 bg-cream-200 border border-cream-300">
            <Caps>TRANSLATE TO</Caps>
            <LangBtn lang="hi" />
            <LangBtn lang="en" />
          </div>

          <div
            className="mt-7 grid gap-9"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
          >
            <div className="min-w-0">
              <Caps>ORIGINAL</Caps>
              <div
                className="mt-3 font-serif text-ink whitespace-pre-wrap"
                style={{ fontSize: 16.5, lineHeight: 1.6 }}
              >
                {source}
              </div>
            </div>
            <div className="min-w-0">
              <Caps tone="terra">{LABEL[target].toUpperCase()}</Caps>
              {error ? (
                <div className="mt-3 rounded-md p-3 text-[13px] text-[#8c2f25] bg-[#fbe9e7] border border-[#e8c9b8]">
                  {error}
                </div>
              ) : (
                <div
                  className="mt-3 font-serif text-ink whitespace-pre-wrap"
                  style={{ fontSize: 16.5, lineHeight: 1.7 }}
                >
                  {result ||
                    (busy ? (
                      <span className="inline-flex items-center gap-2 text-terracotta">
                        <Loader2 size={15} className="animate-spin" /> Translating…
                      </span>
                    ) : (
                      <span className="text-ink-faint">
                        Choose a language to translate.
                      </span>
                    ))}
                </div>
              )}
              {result && !busy && !error && (
                <div className="mt-6 pt-4 border-t border-cream-300">
                  <Caps>GLOSSARY PRESERVED</Caps>
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
                    Oscar keeps your product names and vocabulary in their original
                    form &mdash; it treats them as proper nouns.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
