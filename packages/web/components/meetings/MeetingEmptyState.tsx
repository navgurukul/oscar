"use client";

import Link from "next/link";
import { Users, Download } from "lucide-react";

export function MeetingEmptyState() {
  return (
    <div className="flex flex-col items-center gap-5 py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
        <Users size={28} className="text-cyan-400" />
      </div>
      <div className="space-y-2">
        <p className="text-white font-semibold text-lg">No meetings yet</p>
        <p className="text-slate-400 text-sm max-w-[300px] leading-relaxed">
          Record meetings on the OSCAR desktop app. They&apos;ll sync here
          automatically.
        </p>
      </div>
      <Link
        href="/download"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 transition-colors duration-150"
      >
        <Download size={15} />
        Get the Desktop App
      </Link>
    </div>
  );
}
