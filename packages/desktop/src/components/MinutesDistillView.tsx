import { useMemo } from "react";
import { MarkdownNotesView, stripEvidenceComments } from "./MarkdownNotesView";

type Section = "decisions" | "actions" | "followups" | "other";

export interface ActionItem {
  owner: string | null;
  task: string;
}

export interface ParsedMinutes {
  decisions: string[];
  actions: ActionItem[];
  followups: string[];
  hasStructure: boolean;
}

const SECTION_PATTERNS: Record<Exclude<Section, "other">, RegExp> = {
  decisions: /^(decisions?|key\s+decisions?|outcomes?)\b/i,
  actions: /^(action\s*items?|actions?|to[\s-]*dos?|next\s+actions?|owners?(\s+and\s+tasks)?)\b/i,
  followups: /^(follow[\s-]*ups?|next\s+steps?|open\s+(items?|questions?)|parking\s+lot)\b/i,
};

function detectSection(heading: string): Section {
  const cleaned = heading.replace(/[·:\-—]+.*$/, "").trim();
  for (const [name, pattern] of Object.entries(SECTION_PATTERNS) as [
    Exclude<Section, "other">,
    RegExp,
  ][]) {
    if (pattern.test(cleaned)) return name;
  }
  return "other";
}

function parseActionItem(raw: string): ActionItem {
  const trimmed = raw.trim();
  // Patterns: "**Mira**: task" or "**Mira** — task" or "Mira: task" or "Mira — task" or "task (Mira)"
  const bold = trimmed.match(/^\*\*([^*]+)\*\*\s*[:\-—–]\s*(.+)$/);
  if (bold) return { owner: bold[1].trim(), task: bold[2].trim() };
  const plain = trimmed.match(/^([A-Z][\w .'-]{0,30})\s*[:\-—–]\s+(.+)$/);
  if (plain) return { owner: plain[1].trim(), task: plain[2].trim() };
  const parens = trimmed.match(/^(.+?)\s*\(([^()]{1,40})\)\s*$/);
  if (parens) return { owner: parens[2].trim(), task: parens[1].trim() };
  return { owner: null, task: trimmed };
}

export function parseMinutes(markdown: string): ParsedMinutes {
  const decisions: string[] = [];
  const actions: ActionItem[] = [];
  const followups: string[] = [];
  let current: Section = "other";
  let hits = 0;

  const lines = stripEvidenceComments(markdown).split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, "");
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      const next = detectSection(heading[1]);
      current = next;
      if (next !== "other") hits++;
      continue;
    }
    if (current === "other") continue;
    // Bullet or numbered list item.
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (!bullet) continue;
    const item = bullet[1]
      .replace(/^\s*\[[ xX]\]\s*/, "") // strip task checkbox
      .trim();
    if (!item) continue;
    if (current === "decisions") decisions.push(item);
    else if (current === "actions") actions.push(parseActionItem(item));
    else if (current === "followups") followups.push(item);
  }

  // We need at least two of the three buckets populated to call this
  // "structured" — a single recognised heading isn't enough to swap layouts.
  const populated = [decisions.length, actions.length, followups.length].filter(
    (n) => n > 0,
  ).length;
  return {
    decisions,
    actions,
    followups,
    hasStructure: hits >= 2 && populated >= 2,
  };
}

function initialOf(name: string): string {
  const cleaned = name.replace(/[^\w]/g, "");
  return cleaned ? cleaned[0].toUpperCase() : "·";
}

function Caps({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`font-mono text-[10px] tracking-[0.18em] uppercase ${
        accent ? "text-terracotta" : "text-ink-faint"
      }`}
    >
      {children}
    </span>
  );
}

interface MinutesDistillViewProps {
  markdown: string;
  className?: string;
}

export function MinutesDistillView({ markdown, className }: MinutesDistillViewProps) {
  const parsed = useMemo(() => parseMinutes(markdown), [markdown]);

  if (!parsed.hasStructure) {
    return <MarkdownNotesView markdown={markdown} className={className} />;
  }

  return (
    <div className={`grid grid-cols-12 gap-8 ${className ?? ""}`}>
      {parsed.decisions.length > 0 && (
        <section className="col-span-12 min-[1040px]:col-span-4 pr-2">
          <Caps accent>{`DECISIONS · ${parsed.decisions.length}`}</Caps>
          <ol className="mt-4 space-y-4">
            {parsed.decisions.map((d, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-mono text-[11px] text-terracotta shrink-0 mt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-serif text-[15px] leading-[1.45] text-ink">
                  {d}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {parsed.actions.length > 0 && (
        <section className="col-span-12 min-[1040px]:col-span-5 min-[1040px]:border-l min-[1040px]:border-cream-300 min-[1040px]:pl-7">
          <Caps>{`ACTIONS · ${parsed.actions.length}`}</Caps>
          <ul className="mt-4 space-y-3">
            {parsed.actions.map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-3 pb-3 border-b border-cream-300 last:border-b-0"
              >
                <span className="inline-flex items-center justify-center h-[22px] w-[22px] rounded-full bg-terracotta-100 text-ink font-serif text-[11px] font-medium leading-none mt-0.5 shrink-0">
                  {a.owner ? initialOf(a.owner) : "·"}
                </span>
                <div className="min-w-0">
                  {a.owner && (
                    <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-ink-faint">
                      {a.owner}
                    </div>
                  )}
                  <div className="text-[13px] leading-[1.4] text-ink mt-0.5">
                    {a.task}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {parsed.followups.length > 0 && (
        <aside className="col-span-12 min-[1040px]:col-span-3 min-[1040px]:border-l min-[1040px]:border-cream-300 min-[1040px]:pl-7">
          <Caps>FOLLOW-UPS</Caps>
          <ul className="mt-4 space-y-3 text-[12px] leading-relaxed text-ink-soft list-none">
            {parsed.followups.map((f, i) => (
              <li key={i}>· {f}</li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
