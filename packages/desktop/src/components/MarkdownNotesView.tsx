import type { ReactNode } from "react";


export function renderInlineMarkdown(text: string): ReactNode {
  if (!text.includes("**")) return text;
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    return bold ? (
      <strong key={index} className="font-semibold text-ink">
        {bold[1]}
      </strong>
    ) : (
      part
    );
  });
}

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
                className="mt-[5px] h-3.5 w-3.5 shrink-0 accent-terracotta"
                aria-label={item.task === "done" ? "Done" : "To do"}
              />
            )}
            <span>{renderInlineMarkdown(item.text)}</span>
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
        <h2
          key={`h2-${blocks.length}`}
          className="font-serif font-medium tracking-[-0.015em] text-ink leading-[1.15] pt-4"
          style={{ fontSize: 24 }}
        >
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
          className="pt-3 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint"
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
      <p
        key={`p-${blocks.length}`}
        className="font-serif leading-[1.65] text-ink"
        style={{ fontSize: 16, letterSpacing: "-0.005em" }}
      >
        {renderInlineMarkdown(line)}
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
