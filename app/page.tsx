"use client";

import { motion } from "motion/react";
import { HomeRecordingButton } from "@/components/recording/HomeRecordingButton";
import { LampContainer } from "@/components/ui/lamp";
import { LayoutTextFlip } from "@/components/ui/layout-text-flip";
import { useEffect, useRef } from "react";

export default function Home() {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    // Motion handles the animation, no manual strokeDashoffset needed
  }, []);

  return (
    <main className="h-screen flex flex-col overflow-hidden">
      {/* AI-Powered Badge at Top */}

      {/* Lamp Effect Header */}
      <LampContainer>
        <motion.h1
          initial={{ opacity: 0.5, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.3,
            duration: 0.8,
            ease: "easeInOut",
          }}
          className="mt-8 bg-gradient-to-br from-slate-300 to-slate-500 py-4 bg-clip-text text-center text-4xl font-medium tracking-tight text-transparent md:text-7xl"
        >
          <LayoutTextFlip
            text="Speak your thoughts."
            words={[
              "Let AI write.",
              "Let AI refine.",
              "Let AI transform.",
              "Create effortlessly.",
            ]}
            duration={3000}
          />
        </motion.h1>
      </LampContainer>

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 ">
        <HomeRecordingButton />
      </div>
    </main>
  );
}
