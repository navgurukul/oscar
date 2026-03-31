"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ROUTES, UI_STRINGS } from "@/lib/constants";

export function FloatingNavbar() {
  const pathname = usePathname();
  
  const isAuthPage = pathname === ROUTES.AUTH || pathname === ROUTES.PRICING || pathname === ROUTES.DOWNLOAD;

  return (
    <nav className="fixed top-0 z-50 w-full transition-opacity duration-500 opacity-100">
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
      </div>
    </nav>
  );
}
