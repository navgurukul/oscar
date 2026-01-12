"use client";

import { motion } from "motion/react";
import { HomeRecordingButton } from "@/components/recording/HomeRecordingButton";
import { LampContainer } from "@/components/ui/lamp";
import { LayoutTextFlip } from "@/components/ui/layout-text-flip";
import { NoiseBackground } from "@/components/ui/noise-background";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

export default function Home() {
  return (
    <main className="h-screen bg-black flex flex-col overflow-hidden">
      {/* AI-Powered Badge at Top */}
      <div className="w-full flex justify-center px-6 py-3">
        <NoiseBackground
          containerClassName="w-fit"
          gradientColors={[
            "rgb(20, 184, 166)",
            "rgb(13, 148, 136)",
            "rgb(5, 122, 115)",
          ]}
          speed={0.08}
          noiseIntensity={0.15}
        >
          <Badge variant="outline" className="inline-flex items-center gap-2 px-5 py-2 text-xs md:text-sm text-teal-500 bg-black font-bold border-teal-700/30">
            <Zap className="w-3 h-3 md:w-4 md:h-4 text-teal-400" />
            <span>AI-Powered Voice Notes</span>
          </Badge>
        </NoiseBackground>
      </div>

      {/* Lamp Effect Header */}
      <LampContainer className="h-[35vh] flex-shrink-0">
        <div></div>
      </LampContainer>

      <div className="flex justify-center mb-8">
        <div className="scale-125 md:scale-150">
          <HomeRecordingButton />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-start px-6 py-4 overflow-y-auto">
        <div className="max-w-6xl w-full flex flex-col items-center text-center">
          {/* Heading with Text Flip Effect */}
          <motion.div
            initial={{ opacity: 0.5, y: 100 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.3,
              duration: 0.8,
              ease: "easeInOut",
            }}
            className="mb-4"
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
          </motion.div>
        </div>
      </div>
    </main>
  );
}
