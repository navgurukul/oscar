import type { LocalTranscript } from "../types/scribble.types";

interface TranscriptsSectionProps {
  transcripts: LocalTranscript[];
  onDeleteTranscript: (id: string) => void;
  onClearAll: () => void;
}

function sourceLabel(t: LocalTranscript): string {
  if (t.dictation_app_key) {
    return t.dictation_app_key.replace(/[-_]/g, " ").toUpperCase();
  }
  return "DICTATED";
}

function isFresh(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 60_000;
}

export function TranscriptsSection({
  transcripts,
  onDeleteTranscript,
  onClearAll,
}: TranscriptsSectionProps) {
  if (!transcripts || transcripts.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="font-serif text-[18px] text-ink-soft leading-snug">
          Nothing pending.
        </p>
        <p className="mt-1.5 text-[12px] text-ink-faint">
          Hold Ctrl+Space to capture a Scribble.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
          PENDING · {transcripts.length}
        </span>
        <button
          type="button"
          onClick={onClearAll}
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint hover:text-ink-soft bg-transparent border-none cursor-pointer transition-colors"
        >
          CLEAR ALL
        </button>
      </div>

      <div>
        {transcripts.map((t) => {
          const time = new Date(t.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          const source = sourceLabel(t);
          const live = isFresh(t.createdAt);
          return (
            <article
              key={t.id}
              className="group grid grid-cols-12 gap-5 py-5 border-b border-cream-300 last:border-b-0"
            >
              <div className="col-span-3 pt-0.5">
                <span className="font-mono text-[12px] text-ink tracking-[0.02em]">
                  {time}
                </span>
                <div
                  className={`mt-1 font-mono text-[10px] tracking-[0.16em] uppercase ${
                    live ? "text-terracotta" : "text-ink-faint"
                  }`}
                >
                  {source}
                </div>
              </div>
              <div className="col-span-9">
                <p
                  className="font-serif text-ink leading-[1.45] whitespace-pre-wrap"
                  style={{ fontSize: 16, letterSpacing: "-0.005em" }}
                >
                  {t.text}
                </p>
                <button
                  type="button"
                  onClick={() => onDeleteTranscript(t.id)}
                  className="mt-3 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-faint hover:text-terracotta bg-transparent border-none cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                  title="Dismiss"
                >
                  DISMISS
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
