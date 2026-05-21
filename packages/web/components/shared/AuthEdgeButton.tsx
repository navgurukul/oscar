"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LogIn, FileText, Settings, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ROUTES } from "@/lib/constants";
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const pillStyle = {
  background: "#efeae0",
  border: "1px solid #d8d2c4",
  color: "#1a1816",
} as const;

const iconColor = "#b8623d";

export function AuthEdgeButton() {
  const { user, signOut, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);

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
      {/* Mobile */}
      <div className="fixed bottom-6 right-4 z-50 flex flex-col items-center gap-2 md:hidden">
        <AnimatePresence mode="popLayout">
          {user && (
            <motion.div
              key="scribbles-link-mobile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <Link href={ROUTES.SCRIBBLE}>
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center justify-center w-10 h-10 rounded-xl shadow-lg"
                  style={pillStyle}
                >
                  <FileText className="w-4 h-4" style={{ color: iconColor }} />
                </motion.div>
              </Link>
            </motion.div>
          )}

          {user && (
            <motion.div
              key="meetings-link-mobile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <Link href={ROUTES.MEETINGS}>
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center justify-center w-10 h-10 rounded-xl shadow-lg"
                  style={pillStyle}
                >
                  <Users className="w-4 h-4" style={{ color: iconColor }} />
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
                  className="flex items-center justify-center w-10 h-10 rounded-xl shadow-lg"
                  style={pillStyle}
                >
                  <Settings className="w-4 h-4" style={{ color: iconColor }} />
                </motion.div>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={handleAction}
          whileTap={{ scale: 0.95 }}
          className="flex items-center justify-center w-10 h-10 rounded-xl shadow-lg overflow-hidden"
          style={pillStyle}
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
              <div
                className="w-full h-full flex items-center justify-center font-bold text-sm"
                style={{ background: "rgba(184,98,61,0.18)", color: iconColor }}
              >
                {user.email?.[0].toUpperCase() || "U"}
              </div>
            )
          ) : (
            <LogIn className="w-4 h-4" style={{ color: iconColor }} />
          )}
        </motion.button>
      </div>

      {/* Desktop */}
      <TooltipProvider delayDuration={300}>
        <div className="fixed top-6 right-0 z-50 pointer-events-none items-center gap-3 pr-0 hidden md:flex">
          <AnimatePresence mode="popLayout">
            {user && (
              <motion.div
                key="scribbles-link"
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="pointer-events-auto"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href={ROUTES.SCRIBBLE}>
                      <motion.div
                        whileHover={{ y: -3, scale: 1.04 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="flex items-center justify-center w-12 h-12 rounded-xl shadow-lg transition-colors"
                        style={pillStyle}
                      >
                        <FileText className="w-5 h-5" style={{ color: iconColor }} />
                      </motion.div>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Scribbles</p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            )}

            {user && (
              <motion.div
                key="meetings-link"
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="pointer-events-auto"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href={ROUTES.MEETINGS}>
                      <motion.div
                        whileHover={{ y: -3, scale: 1.04 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="flex items-center justify-center w-12 h-12 rounded-xl shadow-lg transition-colors"
                        style={pillStyle}
                      >
                        <Users className="w-5 h-5" style={{ color: iconColor }} />
                      </motion.div>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Meetings</p>
                  </TooltipContent>
                </Tooltip>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href={ROUTES.SETTINGS}>
                      <motion.div
                        whileHover={{ y: -3, scale: 1.04 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="flex items-center justify-center w-12 h-12 rounded-xl shadow-lg transition-colors"
                        style={pillStyle}
                      >
                        <Settings className="w-5 h-5" style={{ color: iconColor }} />
                      </motion.div>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Settings</p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleAction}
            layout
            className="pointer-events-auto flex items-center rounded-l-xl h-12 shadow-lg group overflow-hidden"
            style={pillStyle}
          >
            <div className="flex items-center px-3 min-w-[56px] justify-center">
              <AnimatePresence initial={false}>
                {isHovered && (
                  <motion.div
                    key="text"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="overflow-hidden"
                  >
                    <span
                      className="text-sm font-bold tracking-wide uppercase whitespace-nowrap mr-2 block"
                      style={{ color: "#1a1816" }}
                    >
                      {user ? "Sign Out" : "Sign In"}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-center shrink-0 relative z-10">
                {user ? (
                  user.user_metadata?.avatar_url ? (
                    <div
                      className="w-8 h-8 rounded-full overflow-hidden transition-transform duration-300 group-hover:scale-110"
                      style={{ border: "2px solid #b8623d" }}
                    >
                      <Image
                        src={user.user_metadata.avatar_url}
                        alt="Profile"
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-transform duration-300 group-hover:scale-110"
                      style={{
                        background: "rgba(184,98,61,0.18)",
                        color: "#b8623d",
                        border: "2px solid #b8623d",
                      }}
                    >
                      {user.email?.[0].toUpperCase() || "U"}
                    </div>
                  )
                ) : (
                  <LogIn className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" style={{ color: iconColor }} />
                )}
              </div>
            </div>
          </motion.button>
        </div>
      </TooltipProvider>
    </>
  );
}
