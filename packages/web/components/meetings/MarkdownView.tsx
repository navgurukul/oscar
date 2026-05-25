"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { v2 } from "@/components/v2/V2Primitives";

interface MarkdownViewProps {
  children: string;
  className?: string;
}

function stripCitationTokens(markdown: string): string {
  return markdown
    .replace(/\s*\[\[seg:[A-Za-z0-9._:-]+\]\]/g, "")
    .replace(/[ \t]+\n/g, "\n");
}

export function MarkdownView({ children, className }: MarkdownViewProps) {
  return (
    <div
      className={className ?? "prose prose-sm max-w-none leading-relaxed"}
      style={{ color: v2.ink }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: v2.accent }}
            >
              {children}
            </a>
          ),
        }}
      >
        {stripCitationTokens(children)}
      </ReactMarkdown>
    </div>
  );
}
