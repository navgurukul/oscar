"use client";

import Link from "next/link";
import { Mic } from "lucide-react";
import { ROUTES, UI_STRINGS } from "@/lib/constants";

export function FloatingNavbar() {
  return (
    <nav className="fixed m-6 rounded-xl top-0 left-0 right-0 z-50">
      <div className="px-6 py-3 flex items-center justify-between">
        <Link
          href={ROUTES.HOME}
          className="flex items-center gap-3 font-bold text-white text-xl hover:opacity-80 transition-opacity group"
        >
          <Mic className="text-cyan-400 transition-all duration-300" />
          <span className="text-white transition-all duration-300">
            {UI_STRINGS.APP_NAME}
          </span>
        </Link>

        <div className="flex items-center gap-4"></div>
      </div>
    </nav>
  );
}
