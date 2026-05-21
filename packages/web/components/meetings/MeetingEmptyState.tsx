"use client";

import Link from "next/link";
import { Users, Download } from "lucide-react";
import { v2, v2Serif } from "@/components/v2/V2Primitives";

export function MeetingEmptyState() {
  return (
    <div className="flex flex-col items-center gap-5 py-24 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: v2.accentSoft }}
      >
        <Users size={28} style={{ color: v2.accent }} />
      </div>
      <div className="space-y-2">
        <p
          style={{
            fontFamily: v2Serif,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "-0.015em",
            color: v2.ink,
          }}
        >
          No meetings yet
        </p>
        <p
          className="text-sm max-w-[300px] leading-relaxed"
          style={{ color: v2.inkSoft }}
        >
          Record meetings on the OSCAR desktop app. They&apos;ll sync here
          automatically.
        </p>
      </div>
      <Link
        href="/download"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-colors duration-150"
        style={{ background: v2.ink, color: v2.cream }}
      >
        <Download size={15} />
        Get the desktop app
      </Link>
    </div>
  );
}
