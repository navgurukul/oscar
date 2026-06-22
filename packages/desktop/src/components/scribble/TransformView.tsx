import { useState } from "react";
import { ArrowLeft, Loader2, Check, Copy } from "lucide-react";
import { aiService } from "../../services/ai.service";
import type { DBScribble } from "../../types/scribble.types";
import { Caps, cleanBody } from "./_shared";

// Transform screen (design screen 08): TONE / LENGTH / AUDIENCE controls on the
// left, ORIGINAL vs TRANSFORMED columns on the right. Calls the web transform
// route (Bearer) via aiService; tone/length/audience steer the rewrite. LENGTH
// maps to the route's structural mode (bullets vs summary).

const TONES: [string, string][] = [
  ["as_said", "As you said it"],
  ["formal", "More formal"],
  ["casual", "More casual"],
  ["teammate", "For a teammate"],
];
const LENGTHS: [string, string][] = [
  ["original", "Original"],
  ["shorter", "Shorter"],
  ["bullets", "Bullet list"],
  ["headline", "Just the headline"],
];
const AUDIENCES: [string, string][] = [
  ["team", "Inside the team"],
  ["customers", "For customers"],
  ["investors", "For investors"],
];

function Opt({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full text-left py-1.5 px-2 rounded bg-transparent border-none cursor-pointer ${
        active ? "bg-cream-200" : ""
      }`}
    >
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${
          active ? "bg-terracotta" : "border-[1.5px] border-cream-400"
        }`}
      />
      <span className={`text-[12.5px] ${active ? "text-ink font-medium" : "text-ink-soft"}`}>
        {label}
      </span>
    </button>
  );
}

export function TransformView({
  scribble,
  onBack,
  onSaveAsNew,
}: {
  scribble: DBScribble;
  onBack: () => void;
  onSaveAsNew: (title: string, body: string) => void | Promise<void>;
}) {
  const source = cleanBody(scribble);
  const [tone, setTone] = useState("formal");
  const [length, setLength] = useState("shorter");
  const [audience, setAudience] = useState("team");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const run = async () => {
    if (!source.trim() || busy) return;
    setBusy(true);
    setError("");
    setResult("");
    try {
      const mode = length === "bullets" ? "bullets" : "summary";
      const out = await aiService.transformScribble(source, {
        mode,
        tone,
        length,
        audience,
        title: scribble.title || undefined,
      });
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const saveNew = async () => {
    if (!result) return;
    await onSaveAsNew(`${scribble.title || "Scribble"} (reshaped)`, result);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-cream">
      <div className="flex items-center gap-3 px-8 py-3 border-b border-cream-300 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 bg-transparent border-none cursor-pointer"
        >
          <Caps className="flex items-center gap-1.5">
            <ArrowLeft size={11} /> SCRIBBLE · TRANSFORM
          </Caps>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-10 py-8">
        <div className="mx-auto" style={{ maxWidth: 980 }}>
          <h1
            className="font-serif font-medium text-ink"
            style={{ fontSize: 30, lineHeight: 1, letterSpacing: "-0.02em" }}
          >
            Same words, <em className="italic text-terracotta">different shape</em>.
          </h1>

          <div
            className="mt-7 grid gap-8"
            style={{ gridTemplateColumns: "minmax(180px, 220px) 1fr" }}
          >
            {/* controls */}
            <div>
              <Caps>TONE</Caps>
              <div className="mt-2">
                {TONES.map(([v, l]) => (
                  <Opt key={v} active={tone === v} label={l} onClick={() => setTone(v)} />
                ))}
              </div>
              <div className="mt-5">
                <Caps>LENGTH</Caps>
                <div className="mt-2">
                  {LENGTHS.map(([v, l]) => (
                    <Opt key={v} active={length === v} label={l} onClick={() => setLength(v)} />
                  ))}
                </div>
              </div>
              <div className="mt-5">
                <Caps>AUDIENCE</Caps>
                <div className="mt-2">
                  {AUDIENCES.map(([v, l]) => (
                    <Opt
                      key={v}
                      active={audience === v}
                      label={l}
                      onClick={() => setAudience(v)}
                    />
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void run()}
                disabled={busy || !source.trim()}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full py-2.5 text-[12px] font-medium bg-ink text-cream border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Transforming…
                  </>
                ) : (
                  "Transform"
                )}
              </button>
            </div>

            {/* original vs transformed */}
            <div
              className="grid gap-8"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
            >
              <div className="min-w-0">
                <Caps>ORIGINAL</Caps>
                <div
                  className="mt-3 font-serif text-ink-soft whitespace-pre-wrap"
                  style={{ fontSize: 15.5, lineHeight: 1.6 }}
                >
                  {source}
                </div>
              </div>
              <div className="min-w-0">
                <Caps tone="terra">TRANSFORMED</Caps>
                {error ? (
                  <div className="mt-3 rounded-md p-3 text-[13px] text-[#8c2f25] bg-[#fbe9e7] border border-[#e8c9b8]">
                    {error}
                  </div>
                ) : (
                  <div
                    className="mt-3 font-serif text-ink whitespace-pre-wrap"
                    style={{ fontSize: 16, lineHeight: 1.6 }}
                  >
                    {result ||
                      (busy ? (
                        <span className="opacity-60">▌</span>
                      ) : (
                        <span className="text-ink-faint">
                          Pick options and hit Transform.
                        </span>
                      ))}
                  </div>
                )}
                {result && !busy && !error && (
                  <div className="mt-5 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => void saveNew()}
                      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-medium bg-ink text-cream border-none cursor-pointer"
                    >
                      {saved ? <Check size={12} /> : null}
                      {saved ? "Saved" : "Save as new Scribble"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copy()}
                      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] border border-cream-300 text-ink-soft bg-transparent cursor-pointer"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
