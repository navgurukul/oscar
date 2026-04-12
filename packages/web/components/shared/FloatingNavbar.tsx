"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ROUTES, UI_STRINGS } from "@/lib/constants";
import { useAuth } from "@/lib/contexts/AuthContext";

const NAV_LINKS = [
  { href: ROUTES.NOTES,    label: "Scribbles" },
  { href: ROUTES.MEETINGS, label: "Meetings"  },
  { href: ROUTES.SETTINGS, label: "Settings"  },
] as const;

export function FloatingNavbar() {
  const pathname = usePathname();
  const { session } = useAuth();

  const isAuthPage =
    pathname === ROUTES.AUTH ||
    pathname === ROUTES.PRICING ||
    pathname === ROUTES.DOWNLOAD;

  const isAuthenticated = !!session;

  return (
    <nav className="fixed top-0 z-50 w-full transition-opacity duration-500 opacity-100">
      <div className="pt-8 pl-8 pr-8 pb-4 flex items-center justify-between w-full">
        {/* Logo */}
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
          <span
            className={`text-lg font-semibold tracking-tight leading-none truncate ${
              isAuthPage ? "text-gray-900" : "text-white"
            }`}
          >
            {UI_STRINGS.APP_NAME}
          </span>
        </Link>

        {/* Authenticated nav links */}
        {isAuthenticated && !isAuthPage && (
          <div className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    active
                      ? "bg-cyan-500/15 text-cyan-400"
                      : "text-gray-400 hover:text-white hover:bg-white/8"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
