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
    <main className="flex flex-col items-center px-4 pt-8 min-h-dvh">
      <div className="w-full max-w-xl flex flex-col items-center gap-6 sm:gap-8 mt-16">
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold">
            Processing Your <span className="text-cyan-500">Speech</span>
          </h1>
        </div>
        <div className="bg-slate-900 w-full max-w-[500px] min-h-[min(70vw,400px)] rounded-3xl shadow-xl border border-cyan-700/30 p-6 sm:p-8 md:p-12 relative overflow-hidden flex flex-col justify-between">
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

          {/* Top spacer — mirrors RecordingTimer reserved height */}
          <div className="h-8 relative z-10" />

          <div className="relative z-10 space-y-8">
            {/* Step Title */}
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-medium text-white transition-all duration-300">
                {PROCESSING_STEPS[currentStep]?.title}
              </h2>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="h-1 bg-gray-800/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Step Dots — bottom area mirrors swipe-hint row */}
          <div className="relative z-10 flex items-center justify-center min-h-[56px]">
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
