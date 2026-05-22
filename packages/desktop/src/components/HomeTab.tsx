import { TranscriptsSection } from "./TranscriptsSection";
import type { LocalTranscript } from "../types/scribble.types";

interface HomeTabProps {
  userName: string;
  userId: string;
  totalScribbles?: number;
  localTranscripts: LocalTranscript[];
  onDeleteTranscript: (id: string) => void;
  onClearAllTranscripts: () => void;
}

function CapsMono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint ${className}`}
    >
      {children}
    </span>
  );
}

function formatHeroDate(d: Date) {
  const day = d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  const month = d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
  const date = d.getDate();
  return `${day} · ${month} ${date}`;
}

function HomeTab({
  userName,
  totalScribbles,
  localTranscripts,
  onDeleteTranscript,
  onClearAllTranscripts,
}: HomeTabProps) {
  const firstName = userName?.split(" ")[0] || "";
  const hasStats = typeof totalScribbles === "number";
  const today = new Date();
  const heroLabel = formatHeroDate(today);

  return (
    <div className="relative flex flex-1 flex-col overflow-y-auto bg-cream">
      <div className="mx-auto w-full max-w-[760px] px-9 pt-12 pb-24">
        {/* Editorial hero */}
        <div className="pb-7 border-b border-cream-300">
          <CapsMono>{heroLabel}</CapsMono>
          <h1
            className="mt-2 font-serif font-medium leading-[1.02] tracking-[-0.022em] text-ink"
            style={{ fontSize: 44 }}
          >
            {firstName ? (
              <>
                Welcome back,{" "}
                <em className="italic text-terracotta">{firstName}</em>.
              </>
            ) : (
              <>
                Today, you{" "}
                <em className="italic text-terracotta">listen</em>.
              </>
            )}
          </h1>
          {hasStats && (
            <p className="mt-3 text-[14px] text-ink-soft">
              {totalScribbles} {totalScribbles === 1 ? "Scribble" : "Scribbles"} captured · {localTranscripts.length} pending
            </p>
          )}

          <div className="mt-6 flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 rounded-full px-4 py-2 bg-ink text-cream">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-terracotta" />
              <span className="font-mono text-[11px] tracking-[0.06em] text-cream-200">
                CTRL+SPACE
              </span>
              <span className="text-[12px]">to dictate</span>
            </div>
            <span className="text-[12px] text-ink-soft">into any app</span>
          </div>
        </div>

        {/* Transcripts spine */}
        <div className="pt-8">
          <CapsMono>RECENT CAPTURES</CapsMono>
          <div className="mt-4">
            <TranscriptsSection
              transcripts={localTranscripts}
              onDeleteTranscript={onDeleteTranscript}
              onClearAll={onClearAllTranscripts}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomeTab;
