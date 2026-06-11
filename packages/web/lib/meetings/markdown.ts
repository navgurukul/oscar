/**
 * Strip Oscar's enhance-pipeline artifacts from meeting-note markdown:
 *  - citation tokens like `[[seg:abc-123]]` and shortened `[[12-0]]` refs
 *  - evidence / citation HTML comments like
 *    `<!-- ev:start=12.3 src=microphone -->`
 *
 * Used both when rendering notes ([id] detail page) and when matching the
 * Minutes search query (list page). Sharing the one regex keeps the two in
 * lockstep, so the comment metadata can neither leak into the rendered UI nor
 * produce phantom search hits on tokens like "ev", "src", "microphone", or a
 * timestamp fragment.
 */
export function stripCitations(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s*\[\[[^\]\n]+\]\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
