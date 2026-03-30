"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

export const LayoutTextFlip = ({
  text = "Build Amazing",
  words = ["Landing Pages", "Component Blocks", "Page Sections", "3D Shaders"],
  duration = 3000,
}: {
  text: string;
  words: string[];
  duration?: number;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % words.length);
    }, duration);

    return () => clearInterval(interval);
  }, [duration, words.length]);

  return (
    <>
      <motion.div
        layout
        className="flex items-center justify-center gap-2 flex-col"
      >
        <motion.span
          layoutId="subtext"
          className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight drop-shadow-lg text-white"
        >
          {text}
        </motion.span>

        <motion.span
          layout
          className="relative w-fit overflow-hidden rounded-md border border-cyan-600/40 bg-gradient-to-r from-cyan-400 to-cyan-500 px-3 py-1.5 sm:px-4 sm:py-2 font-sans text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-950 shadow-sm drop-shadow-lg"
        >
          <AnimatePresence mode="popLayout">
            <motion.span
              key={currentIndex}
              initial={{ y: -40, filter: "blur(10px)" }}
              animate={{
                y: 0,
                filter: "blur(0px)",
              }}
              exit={{ y: 50, filter: "blur(10px)", opacity: 0 }}
              transition={{
                duration: 0.5,
              }}
              className={cn("inline-block whitespace-nowrap")}
            >
              {words[currentIndex]}
            </motion.span>
          </AnimatePresence>
        </motion.span>
      </motion.div>
    </>
  );
};
