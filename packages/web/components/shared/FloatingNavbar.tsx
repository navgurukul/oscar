"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ROUTES, UI_STRINGS } from "@/lib/constants";
import { Download } from "lucide-react";

export function FloatingNavbar() {
  const pathname = usePathname();
  const isAuthPage = pathname === ROUTES.AUTH || pathname === ROUTES.PRICING || pathname === ROUTES.DOWNLOAD;
  const isLandingPage = pathname === ROUTES.HOME;

  return (
    <nav className="fixed top-0 z-50 w-full ">
      <div className="pt-8 pl-8 pr-8 pb-4 flex items-center justify-between w-full ">
        <Link
          href={ROUTES.HOME}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity group min-w-0"
        >
          <div className="relative w-7 h-7 sm:w-9 sm:h-9 flex-shrink-0">
            <Image
              src={isAuthPage ? "/OSCAR_LIGHT_LOGO.png" : "/OSCAR_DARK_LOGO.png"}
              alt="OSCAR Logo"
              fill
              className="object-contain"
            />
          </div>
          <span className={`text-lg font-semibold tracking-tight leading-none truncate ${
            isAuthPage ? "text-gray-900" : "text-white"
          }`}>
            {UI_STRINGS.APP_NAME}
          </span>
        </Link>
        
        {/* Download link - only show on landing page */}
        {isLandingPage && (
          <Link
            href={ROUTES.DOWNLOAD}
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Download App</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
