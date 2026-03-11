"use client";
import Link from "next/link";
import Image from "next/image";
import { ROUTES, UI_STRINGS } from "@/lib/constants";

export function FloatingNavbar() {
  return (
    <nav className="fixed top-0 z-50 w-full ">
      <div className="pt-8 pl-8 pb-4 flex items-center justify-between w-full ">
        <Link
          href={ROUTES.HOME}
          className="flex items-center gap-2 font-bold text-white text-base sm:text-lg hover:opacity-80 transition-opacity group min-w-0"
        >
          <div className="relative w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0">
            <Image
              src="/OSCARLOGO.png"
              alt="OSCAR Logo"
              fill
              className="object-contain"
            />
          </div>
          <span className="text-white transition-all duration-300 leading-none truncate">
            {UI_STRINGS.APP_NAME}
          </span>
        </Link>
        <div className="flex items-center gap-4" />
      </div>
    </nav>
  );
}
