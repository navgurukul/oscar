// Convert meeting-notes markdown to clipboard payloads.
//
// Goal: when user copies a Minutes summary and pastes into Slack, Notion, Gmail,
// Docs etc, they see rich formatting (headings, bullets, bold) instead of raw
// `##` / `**` / `-` characters. Apps that only read plain text get a
// symbol-stripped version, not the raw markdown.
//
// Supported syntax (matches what the Minutes pipeline emits):
//   - `# / ## / ###` headings
//   - `- ` / `* ` bullets, `1.` ordered lists
//   - `- [ ]` / `- [x]` task lists
//   - `**bold**`, `*italic*`, `_italic_`, `` `code` ``
//   - `[label](url)` links
//   - `> quote` blockquotes
//   - paragraphs split by blank lines

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPE[ch]);
}

function stripCitations(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s*\[\[[^\]\n]+\]\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function renderInlineHtml(text: string): string {
  // Pull code spans first so their content is not parsed as markdown.
  const codeSpans: string[] = [];
  let work = text.replace(/`([^`]+)`/g, (_, code) => {
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return `CODE${codeSpans.length - 1}`;
  });

  work = escapeHtml(work);

  // Bold (** or __), then italic (* or _).
  work = work.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  work = work.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  work = work.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  work = work.replace(/(^|[^_\w])_([^_\n]+)_/g, "$1<em>$2</em>");

  // Links [text](url).
  work = work.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_match, label, href) =>
      `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`,
  );

  work = work.replace(/CODE(\d+)/g, (_, idx) => codeSpans[Number(idx)] ?? "");
  return work;
}

function renderInlinePlain(text: string): string {
  let work = text;
  // Drop code-span backticks but keep content.
  work = work.replace(/`([^`]+)`/g, "$1");
  // Bold / italic markers gone, content retained.
  work = work.replace(/\*\*([^*]+)\*\*/g, "$1");
  work = work.replace(/__([^_]+)__/g, "$1");
  work = work.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2");
  work = work.replace(/(^|[^_\w])_([^_\n]+)_/g, "$1$2");
  // Links → "label (url)" so the URL is not lost.
  work = work.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)");
  return work;
}

interface ListContext {
  type: "ul" | "ol";
  items: string[];
}

export function markdownToHtml(markdown: string): string {
  const cleaned = stripCitations(markdown);
  if (!cleaned) return "";

  const lines = cleaned.split(/\r?\n/);
  const out: string[] = [];
  let list: ListContext | null = null;
  let paragraph: string[] = [];
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    out.push(`<p>${renderInlineHtml(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    out.push(`<${list.type}>${list.items.join("")}</${list.type}>`);
    list = null;
  };

  const flushQuote = () => {
    if (quote.length === 0) return;
    out.push(`<blockquote><p>${renderInlineHtml(quote.join(" "))}</p></blockquote>`);
    quote = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1].length, 6);
      out.push(`<h${level}>${renderInlineHtml(heading[2].trim())}</h${level}>`);
      continue;
    }

    const taskMatch = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (taskMatch) {
      flushParagraph();
      flushQuote();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      const checked = taskMatch[1].toLowerCase() === "x";
      const box = checked ? "☑" : "☐";
      list.items.push(
        `<li>${box} ${renderInlineHtml(taskMatch[2].trim())}</li>`,
      );
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      flushQuote();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(`<li>${renderInlineHtml(bullet[1].trim())}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      flushQuote();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(`<li>${renderInlineHtml(ordered[1].trim())}</li>`);
      continue;
    }

    const blockquote = line.match(/^>\s?(.*)$/);
    if (blockquote) {
      flushParagraph();
      flushList();
      quote.push(blockquote[1].trim());
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }

  flushAll();
  return out.join("");
}

export function markdownToPlainText(markdown: string): string {
  const cleaned = stripCitations(markdown);
  if (!cleaned) return "";

  return cleaned
    .split(/\r?\n/)
    .map((raw) => {
      const line = raw.replace(/\s+$/, "");
      if (!line.trim()) return "";

      const heading = line.match(/^#{1,6}\s+(.+)$/);
      if (heading) return renderInlinePlain(heading[1].trim());

      const task = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/);
      if (task) {
        const indent = task[1] ?? "";
        const box = task[2].toLowerCase() === "x" ? "☑" : "☐";
        return `${indent}${box} ${renderInlinePlain(task[3].trim())}`;
      }

      const bullet = line.match(/^(\s*)[-*]\s+(.+)$/);
      if (bullet) return `${bullet[1] ?? ""}• ${renderInlinePlain(bullet[2].trim())}`;

      const ordered = line.match(/^(\s*)(\d+\.)\s+(.+)$/);
      if (ordered) return `${ordered[1] ?? ""}${ordered[2]} ${renderInlinePlain(ordered[3].trim())}`;

      const quote = line.match(/^>\s?(.*)$/);
      if (quote) return renderInlinePlain(quote[1]);

      return renderInlinePlain(line);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Call-to-action appended to a copied/shared Minutes summary so a pasted
// version always carries a link back to the full, interactive minutes in Oscar
// (where chat-with-your-minutes will live). Kept here so web + desktop emit an
// identical footer.
export const MINUTES_SHARE_CTA = "Open the full minutes in Oscar";

// Append the share footer to a Minutes markdown body. `url` is the public
// /m/{token} link; when it's absent (a private meeting with no token) the body
// is returned untouched so nothing dangling is copied. Rendered as a markdown
// link so HTML-aware targets get a clickable anchor and plain-text targets get
// "Open the full minutes in Oscar (https://…)".
export function appendMinutesShareFooter(
  markdown: string,
  url: string | null | undefined,
): string {
  const body = (markdown ?? "").trimEnd();
  if (!url) return body;
  return `${body}\n\n---\n\n[${MINUTES_SHARE_CTA}](${url})`;
}

// Write rich + plain to clipboard so HTML-aware targets (Slack, Notion, Gmail,
// Docs) render formatted output while plain-text targets get a clean,
// symbol-free version. Falls back to writeText(plain) when ClipboardItem is
// unavailable (older webviews, Firefox without flag).
export async function copyMarkdownAsRichText(markdown: string): Promise<void> {
  const html = markdownToHtml(markdown);
  const plain = markdownToPlainText(markdown);

  const w = typeof window !== "undefined" ? window : undefined;
  const canRichCopy =
    !!w &&
    typeof w.ClipboardItem !== "undefined" &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.write === "function";

  if (canRichCopy) {
    try {
      const item = new w!.ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return;
    } catch {
      // Fall through to plain-text copy below.
    }
  }

  await navigator.clipboard.writeText(plain);
}
