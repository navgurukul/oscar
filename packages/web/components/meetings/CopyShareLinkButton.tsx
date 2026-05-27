"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

interface Props {
  url: string;
  textStyle?: React.CSSProperties;
  outerStyle?: React.CSSProperties;
}

export function CopyShareLinkButton({ url, textStyle, outerStyle }: Props) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // No-op — clipboard blocked.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px]"
      style={outerStyle}
    >
      {copied ? <Check size={12} /> : <Link2 size={12} />}
      <span style={textStyle}>{copied ? "Copied" : "Copy link"}</span>
    </button>
  );
}
