import { useMemo } from "react";
import type { LocalTranscript } from "../types/scribble.types";

interface HomeTabProps {
  userName: string;
  userId: string;
  totalScribbles?: number;
  localTranscripts: LocalTranscript[];
  onDeleteTranscript: (id: string) => void;
  onClearAllTranscripts: () => void;
}

function Caps({
  children,
  className = "",
  tone = "faint",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "faint" | "ink" | "terra";
}) {
  const toneClass =
    tone === "terra"
      ? "text-terracotta"
      : tone === "ink"
        ? "text-ink"
        : "text-ink-faint";
  return (
    <span
      className={`font-mono text-[10px] tracking-[0.18em] uppercase ${toneClass} ${className}`}
    >
      {children}
    </span>
  );
}

function formatHeroDate(d: Date) {
  const day = d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  const month = d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
  const date = d.getDate();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} · ${month} ${date} · ${time}`;
}

function formatEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function sourceLabel(t: LocalTranscript): string {
  if (t.dictation_app_key) return t.dictation_app_key.replace(/[-_]/g, " ").toUpperCase();
  return "DICTATED";
}

function isFresh(iso: string): boolean {
  const created = new Date(iso).getTime();
  return Date.now() - created < 60_000;
}

function HomeTab({
  userName,
  totalScribbles,
  localTranscripts,
  onDeleteTranscript,
  onClearAllTranscripts,
}: HomeTabProps) {
  const firstName = userName?.split(" ")[0] || "";
  const today = new Date();
  const heroLabel = formatHeroDate(today);

  // Aggregate stats from local transcripts
  const stats = useMemo(() => {
    const captures = localTranscripts.length;
    const sources = new Set<string>();
    let words = 0;
    for (const t of localTranscripts) {
      if (t.dictation_app_key) sources.add(t.dictation_app_key);
      words += (t.text || "").split(/\s+/).filter(Boolean).length;
    }
    return { captures, sourceCount: sources.size, words };
  }, [localTranscripts]);

  const hasCaptures = localTranscripts.length > 0;

  return (
    <div className="relative flex flex-1 flex-col overflow-y-auto bg-cream">
      <div className="mx-auto w-full max-w-[820px] px-10 pt-14 pb-24">
        {/* Editorial hero — time-spine listening surface */}
        <div className="pb-9">
          <Caps>{heroLabel}</Caps>
          <h1
            className="mt-2.5 font-serif font-medium leading-[0.98] tracking-[-0.025em] text-ink"
            style={{ fontSize: 56 }}
          >
            {firstName ? (
              <>
                Today,{" "}
                <em className="italic text-terracotta">{firstName}</em>
                <br />listened.
              </>
            ) : (
              <>
                Today, you{" "}
                <em className="italic text-terracotta">listened</em>.
              </>
            )}
          </h1>

          <p className="mt-5 max-w-md text-[14px] leading-relaxed text-ink-soft">
            {hasCaptures ? (
              <>
                {stats.captures} {stats.captures === 1 ? "capture" : "captures"}
                {stats.sourceCount > 0 ? (
                  <>
                    {" · "}
                    {stats.sourceCount} {stats.sourceCount === 1 ? "app" : "apps"}
                  </>
                ) : null}
                {stats.words > 0 ? (
                  <>
                    {" · "}
                    {stats.words.toLocaleString()} words dictated
                  </>
                ) : null}
                {typeof totalScribbles === "number" ? (
                  <>
                    {" · "}
                    {totalScribbles} in library
                  </>
                ) : null}
              </>
            ) : (
              <>Hold Ctrl+Space anywhere on screen. Oscar listens, cleans, and pastes back where you were.</>
            )}
          </p>

          <div className="mt-7 flex items-center gap-4">
            <div className="inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 bg-ink text-cream">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-terracotta" />
              <span className="font-mono text-[11px] tracking-[0.06em] text-cream-200">
                CTRL+SPACE
              </span>
              <span className="text-[13px]">to listen</span>
            </div>
            <span className="text-[13px] text-ink-soft">· into any app</span>
          </div>
        </div>

        {/* Spine */}
        <div className="pt-10 border-t border-cream-300">
          <div className="flex items-baseline justify-between mb-8">
            <Caps>THE DAY, IN ORDER</Caps>
            {hasCaptures && (
              <button
                type="button"
                onClick={onClearAllTranscripts}
                className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint hover:text-ink-soft bg-transparent border-none cursor-pointer transition-colors"
              >
                CLEAR ALL
              </button>
            )}
          </div>

          {!hasCaptures ? (
            <div className="py-16 text-center">
              <p className="font-serif text-[20px] text-ink-soft leading-snug">
                Nothing yet today.
              </p>
              <p className="mt-2 text-[13px] text-ink-faint">
                Your captures will show up here, in time order.
              </p>
            </div>
          ) : (
            <div className="space-y-9">
              {localTranscripts.map((t) => {
                const time = formatEventTime(t.createdAt);
                const source = sourceLabel(t);
                const live = isFresh(t.createdAt);
                return (
                  <article key={t.id} className="grid grid-cols-12 gap-6 group">
                    <div className="col-span-3 pt-1">
                      <span className="font-mono text-[13px] text-ink tracking-[0.02em]">
                        {time}
                      </span>
                      <div className="mt-1">
                        <span
                          className={`font-mono text-[10px] tracking-[0.16em] uppercase ${
                            live ? "text-terracotta" : "text-ink-faint"
                          }`}
                        >
                          {source}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-9">
                      <p
                        className="font-serif text-ink leading-[1.4]"
                        style={{ fontSize: 19, letterSpacing: "-0.005em" }}
                      >
                        {t.text}
                      </p>
                      <div className="mt-4 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onDeleteTranscript(t.id)}
                          className="font-mono text-[10px] tracking-[0.16em] uppercase text-ink-faint hover:text-terracotta bg-transparent border-none cursor-pointer transition-colors"
                        >
                          DISMISS
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HomeTab;
