'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import RecordingButton from '@/components/RecordingButton'
import { LampContainer } from '@/components/ui/lamp'
import { LayoutTextFlip } from '@/components/ui/layout-text-flip'
import { NoiseBackground } from '@/components/ui/noise-background'
import { Typewriter } from '@/components/ui/typewriter'

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
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs md:text-sm text-teal-500 bg-black font-bold">
            <svg className="w-3 h-3 md:w-4 md:h-4 text-teal-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            <span>AI-Powered Voice Notes</span>
          </div>
        </NoiseBackground>
      </div>

      {/* Lamp Effect Header */}
      <LampContainer className="h-[35vh] flex-shrink-0">
        <div></div>
      </LampContainer>

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
              words={["Let AI write.", "Let AI refine.", "Let AI transform.", "Create effortlessly."]}
              duration={3000}
            />
          </motion.div>

          {/* Description with Typewriter Effect */}
          <Typewriter
            text="Turn your voice into clear, formatted text using AI. Just talk, and OSCAR handles the rest."
            speed={30}
            delay={500}
            className="text-teal-500 text-sm md:text-lg text-center mb-8 md:mb-12 max-w-2xl"
            cursorClassName="bg-teal-400"
          />

          {/* Start Recording Button */}
          <div className="mt-4 md:mt-8">
            <div className="scale-125 md:scale-150">
              <RecordingButton />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

