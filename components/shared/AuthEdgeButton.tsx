"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LogIn, FileText, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ROUTES } from "@/lib/constants";
import Image from "next/image";

/**
 * AuthEdgeButton - A fixed-position authentication button attached to the right edge.
 * Desktop: Horizontal layout with sliding text animation on hover (top-right corner)
 * Mobile: Vertical stack with simple icon-only buttons (top-right corner)
 */
export function AuthEdgeButton() {
  const { user, signOut, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);

  // Don't show anything while auth is loading or on auth page
  if (isLoading || pathname === ROUTES.AUTH) return null;

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
    <>
      {/* Mobile Layout - Vertical stack with simple icon buttons */}
      {/* Order: Notes (top) -> Settings -> Auth (bottom, aligned with Mic button at bottom-6) */}
      <div className="fixed bottom-6 right-4 z-50 flex flex-col items-center gap-2 md:hidden">
        <AnimatePresence mode="popLayout">
          {user && (
            <motion.div
              key="notes-link-mobile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <Link href={ROUTES.NOTES}>
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 active:bg-cyan-500/20 border border-cyan-500/30 backdrop-blur-md shadow-2xl"
                >
                  <FileText className="w-4 h-4 text-cyan-400" />
                </motion.div>
              </Link>
            </motion.div>
          )}
          {user && (
            <motion.div
              key="settings-link-mobile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <Link href={ROUTES.SETTINGS}>
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 active:bg-cyan-500/20 border border-cyan-500/30 backdrop-blur-md shadow-2xl"
                >
                  <Settings className="w-4 h-4 text-cyan-400" />
                </motion.div>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auth button - displays avatar when logged in, at bottom */}
        <motion.button
          onClick={handleAction}
          whileTap={{ scale: 0.95 }}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 active:bg-cyan-500/20 border border-cyan-500/30 backdrop-blur-md shadow-2xl overflow-hidden"
        >
          {user ? (
            user.user_metadata?.avatar_url ? (
              <Image
                src={user.user_metadata.avatar_url}
                alt="Profile"
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-sm">
                {user.email?.[0].toUpperCase() || "U"}
              </div>
            )
          ) : (
            <LogIn className="w-4 h-4 text-cyan-400" />
          )}
        </motion.button>
      </div>

      {/* Desktop Layout - Horizontal with sliding animation */}
      <div className="fixed top-8 right-0 z-50 pointer-events-none items-center gap-3 pr-0 hidden md:flex">
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

        {/* Auth button with sliding animation on desktop */}
        <motion.button
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleAction}
          layout
          className="pointer-events-auto flex items-center rounded-l-xl h-12 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 backdrop-blur-md shadow-2xl group transition-colors overflow-hidden"
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
                  <span className="text-sm font-bold tracking-wide uppercase whitespace-nowrap mr-2 block text-gray-300">
                    {user ? "Sign Out" : "Sign In"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-center shrink-0 relative z-10">
              {user ? (
                user.user_metadata?.avatar_url ? (
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-cyan-400/50 transition-transform duration-300 group-hover:scale-110">
                    <Image
                      src={user.user_metadata.avatar_url}
                      alt="Profile"
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-sm border-2 border-cyan-400/50 transition-transform duration-300 group-hover:scale-110">
                    {user.email?.[0].toUpperCase() || "U"}
                  </div>
                )
              ) : (
                <LogIn className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
              )}
            </div>
          </div>
        </motion.button>
      </div>
    </>
  );
}
