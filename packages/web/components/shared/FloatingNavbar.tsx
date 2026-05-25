"use client";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { OrgSwitcher } from "@/components/org/OrgSwitcher";
import { V2Wordmark } from "@/components/v2/V2Primitives";

export function FloatingNavbar() {
  const pathname = usePathname();
  const isAuthPage = pathname === ROUTES.AUTH || pathname === ROUTES.DOWNLOAD;

  return (
    <nav className="fixed top-0 z-50 w-full transition-opacity duration-500 opacity-100">
      <div
        className="px-6 md:px-14 py-5 flex items-center justify-between w-full"
        style={{ background: "#f7f4ee", borderBottom: "1px solid #e5e0d6" }}
      >
        <V2Wordmark href={ROUTES.HOME} />
        {!isAuthPage && (
          <div className="flex items-center gap-3">
            <OrgSwitcher />
          </div>
        )}
      </div>
    </nav>
  );
}
