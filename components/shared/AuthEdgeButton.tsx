"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LogIn, LogOut, FileText, Settings } from "lucide-react";
import Link from "next/link";
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
    <div className="fixed bottom-10 right-0 z-50 pointer-events-none flex items-center gap-3 pr-0">
      <AnimatePresence mode="popLayout">
        {user && (
          <motion.div
            key="notes-link"
            layout
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="pointer-events-auto"
          >
            <Link href={ROUTES.NOTES}>
              <motion.div
                whileHover={{ y: -5, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 backdrop-blur-md shadow-2xl group transition-colors"
              >
                <FileText className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
              </motion.div>
            </Link>
          </motion.div>
        )}
        {user && (
          <motion.div
            key="settings-link"
            layout
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="pointer-events-auto"
          >
            <Link href={ROUTES.SETTINGS}>
              <motion.div
                whileHover={{ y: -5, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 backdrop-blur-md shadow-2xl group transition-colors"
              >
                <Settings className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
              </motion.div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

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
