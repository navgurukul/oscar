import type { ReactNode } from "react";

export function stripEvidenceComments(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s*\[\[seg:[A-Za-z0-9._:-]+\]\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function markdownPreview(markdown: string, maxLength = 120): string {
  const flattened = stripEvidenceComments(markdown)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (flattened.length <= maxLength) {
    return flattened;
  }

  return `${flattened.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

interface MarkdownNotesViewProps {
  markdown: string;
  className?: string;
}

export function MarkdownNotesView({
  markdown,
  className,
}: MarkdownNotesViewProps) {
  type ListItem = { text: string; task: "none" | "open" | "done" };
  const blocks: ReactNode[] = [];
  const lines = stripEvidenceComments(markdown).split(/\r?\n/);
  let listItems: ListItem[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    const key = `list-${blocks.length}`;
    const allTasks = listItems.every((item) => item.task !== "none");
    blocks.push(
      <ul
        key={key}
        className={
          allTasks ? "ml-1 space-y-2" : "ml-5 list-disc space-y-2"
        }
      >
        {listItems.map((item, index) => (
          <li
            key={`${key}-${index}`}
            className={item.task !== "none" ? "flex items-start gap-2 list-none" : undefined}
          >
            {item.task !== "none" && (
              <input
                type="checkbox"
                checked={item.task === "done"}
                readOnly
                className="mt-[5px] h-3.5 w-3.5 shrink-0 accent-cyan-500"
                aria-label={item.task === "done" ? "Done" : "To do"}
              />
            )}
            <span>{item.text}</span>
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      flushList();
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="text-xl font-semibold text-slate-900">
          {h2Match[1].trim()}
        </h2>,
      );
      continue;
    }

    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      flushList();
      blocks.push(
        <h3
          key={`h3-${blocks.length}`}
          className="pt-2 text-sm font-semibold uppercase tracking-[0.04em] text-slate-500"
        >
          {h3Match[1].trim()}
        </h3>,
      );
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (bulletMatch) {
      const body = bulletMatch[1].trim();
      const taskMatch = body.match(/^\[([ xX])\]\s+(.+)$/);
      if (taskMatch) {
        listItems.push({
          text: taskMatch[2].trim(),
          task: taskMatch[1].toLowerCase() === "x" ? "done" : "open",
        });
      } else {
        listItems.push({ text: body, task: "none" });
      }
      continue;
    }

    flushList();
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-sm leading-[1.7] text-slate-600">
        {line}
      </p>,
    );
  }

  flushList();

  return (
    <div className={className ? `space-y-3 ${className}` : "space-y-3"}>
      {blocks}
    </div>
  );
}
