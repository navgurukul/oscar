"use client";
import Link from "next/link";
import { Mic } from "lucide-react";
import { ROUTES, UI_STRINGS } from "@/lib/constants";

export function FloatingNavbar() {
  return (
    <nav className="fixed  top-0 z-50 w-full ">
      <div className="pt-8 pl-8 pb-4 flex items-center justify-between w-full ">
        <Link
          href={ROUTES.HOME}
          className="flex items-center gap-2 sm:gap-3 font-bold text-white text-base sm:text-lg hover:opacity-80 transition-opacity group min-w-0"
        >
          <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 transition-all duration-300 flex-shrink-0" />
          <span className="text-white transition-all duration-300 leading-none truncate">
            {UI_STRINGS.APP_NAME}
          </span>
        </Link>
        <div className="flex items-center gap-4" />
      </div>
    </nav>
  );
}
