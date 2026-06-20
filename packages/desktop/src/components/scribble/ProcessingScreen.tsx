import { Loader2 } from "lucide-react";
import { Caps } from "./_shared";

// Full-screen "distilling" surface (design screen 03), shown while Oscar cleans
// the just-recorded transcript. Props mirror the global recording status.
export function ProcessingScreen({ statusMessage }: { statusMessage?: string | null }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-cream text-center px-12">
      <Caps tone="terra">DISTILLING</Caps>
      <h1
        className="mt-4 font-serif font-medium text-ink"
        style={{ fontSize: 46, lineHeight: 1, letterSpacing: "-0.03em", maxWidth: 540 }}
      >
        Finding the <em className="italic text-terracotta">spine</em> of what you said.
      </h1>
      <div className="mt-10 inline-flex items-center gap-2.5 text-terracotta">
        <Loader2 size={18} className="animate-spin" />
        <span className="font-mono text-[12px] tracking-[0.08em]">
          {statusMessage || "Oscar is cleaning up your Scribble…"}
        </span>
      </div>
    </div>
  );
}
