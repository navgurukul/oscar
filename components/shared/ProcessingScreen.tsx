"use client";

import React from "react";
import { DottedGlowBackground } from "../ui/dotted-glow-background";
import { PROCESSING_STEPS } from "@/lib/constants";

interface ProcessingScreenProps {
  isProcessing: boolean;
  progress: number;
  currentStep: number;
}

export function ProcessingScreen({
  isProcessing,
  progress,
  currentStep,
}: ProcessingScreenProps) {
  if (!isProcessing) return null;

  return (
    <main className="flex flex-col items-center px-4 pt-8">
      <div className="w-full max-w-xl flex flex-col items-center gap-8 mt-16">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">
            Processing Your <span className="text-cyan-500">Speech</span>
          </h1>
        </div>
        <div className="bg-slate-900 w-full max-w-[500px] aspect-square rounded-3xl shadow-xl border border-cyan-700/30 p-6 sm:p-8 md:p-12 space-y-8 sm:space-y-12 relative overflow-hidden">
          <DottedGlowBackground
            gap={20}
            radius={1.3}
            color="rgba(6, 182, 212, 0.4)"
            glowColor="rgba(6, 182, 212, 0.7)"
            opacity={0.6}
            speedMin={0.6}
            speedMax={1.4}
            speedScale={1.2}
          />

          {/* Top section placeholder to match Timer height */}
          <div className="h-8" />

          <div className="relative z-10 space-y-8 pt-4">
            {/* Step Title - Clean and Prominent */}
            <div className="text-center">
              <h2 className="text-2xl font-medium text-white transition-all duration-300">
                {PROCESSING_STEPS[currentStep]?.title}
              </h2>
            </div>

            {/* Minimalist Progress Bar */}
            <div className="space-y-3">
              <div className="h-1 bg-gray-800/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Simplified Step Dots - Bottom section matching instruction text area */}
          <div className="text-center pt-4 h-16 flex items-center justify-center">
            <div className="flex justify-center gap-1.5">
              {PROCESSING_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`transition-all duration-300 rounded-full ${
                    i <= currentStep
                      ? "w-6 h-1 bg-cyan-500"
                      : "w-6 h-1 bg-gray-700"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
