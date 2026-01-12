"use client";

import Link from "next/link";
import { Mic, Settings, FileText, Home } from "lucide-react";

export function FloatingNavbar() {
  return (
    <nav className="fixed m-6 rounded-xl top-0 left-0  z-50 bg-slate-950/80 backdrop-blur-md border border-slate-950/50 ">
      <div className="px-6 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 font-bold text-white text-xl hover:opacity-80 transition-opacity group"
        >
          <Mic className="text-cyan-400  transition-all duration-300" />
          <span className="text-white transition-all duration-300">OSCAR</span>
        </Link>
      </div>
    </nav>
  );
}
