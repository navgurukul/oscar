"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ROUTES } from "@/lib/constants";

/**
 * AuthEdgeButton - A fixed-position authentication button attached to the right edge.
 * It slides out on hover to reveal sign-in/sign-out text.
 */
export function AuthEdgeButton() {
  const { user, signOut, isLoading } = useAuth();
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  // Don't show anything while auth is loading
  if (isLoading) return null;

  const handleAction = async () => {
    if (user) {
      await signOut();
      router.push(ROUTES.HOME);
      router.refresh();
    } else {
      router.push(ROUTES.AUTH);
    }
  };

  return (
    <div className="fixed bottom-12 right-0 z-50 pointer-events-none">
      <motion.button
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleAction}
        layout
        className="pointer-events-auto flex items-center text-white rounded-l-xl h-12 shadow-2xl backdrop-blur-md border border-cyan-500/30 border-r-0 group overflow-hidden bg-cyan-500/10 hover:bg-cyan-600"
      >
        <div className="flex items-center px-3 min-w-[56px] justify-center">
          <AnimatePresence initial={false}>
            {isHovered && (
              <motion.div
                key="text"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
                className="overflow-hidden"
              >
                <span className="text-sm font-bold tracking-wide uppercase whitespace-nowrap mr-3 block">
                  {user ? "Sign Out" : "Sign In"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-center shrink-0 relative z-10">
            {user ? (
              <LogOut className="w-5 h-5 transition-transform duration-300 group-hover:scale-110 text-gray-400 group-hover:text-white" />
            ) : (
              <LogIn className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
            )}
          </div>
        </div>
      </motion.button>
    </div>
  );
}
