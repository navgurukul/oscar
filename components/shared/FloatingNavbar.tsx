"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, FileText, LogOut } from "lucide-react";
import { ROUTES, UI_STRINGS } from "@/lib/constants";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export function FloatingNavbar() {
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push(ROUTES.HOME);
    router.refresh();
  };

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

        <div className="flex items-center gap-4">
          {!isLoading && (
            <>
              {user ? (
                <>
                  <Link
                    href={ROUTES.NOTES}
                    className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300  transition-colors"
                  >
                    <FileText className="w-4 h-4" strokeWidth={2.5} />
                  </Link>
                  {/* <div className="flex items-center gap-2 text-gray-400">
                    <User className="w-4 h-4" />
                    <span className="text-sm truncate max-w-[150px]">
                      {user.email}
                    </span>
                  </div> */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="text-gray-400 hover:text-red-400"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Link
                  href={ROUTES.AUTH}
                  className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Sign In
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
