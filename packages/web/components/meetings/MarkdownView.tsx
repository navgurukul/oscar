"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewProps {
  children: string;
  className?: string;
}

export function MarkdownView({ children, className }: MarkdownViewProps) {
  return (
    <div
      className={
        className ??
        "prose prose-sm prose-invert max-w-none text-slate-300 leading-relaxed"
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 underline"
            >
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
