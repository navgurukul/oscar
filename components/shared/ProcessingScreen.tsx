"use client";

import React from "react";
import { DottedGlowBackground } from "../ui/dotted-glow-background";

interface ProcessingScreenProps {
  isProcessing: boolean;
  progress: number;
  currentStep: number;
}

const processingSteps = [
  {
    title: "Analyzing Audio",
    description: "Processing sound waves...",
    icon: "🎙️",
  },
  {
    title: "AI Recognition",
    description: "Understanding speech patterns...",
    icon: "🧠",
  },
  { title: "Formatting", description: "Structuring your text...", icon: "📝" },
];

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
        <div className="bg-slate-900 size-[500px] rounded-3xl shadow-xl border border-cyan-700/30 p-8 md:p-12  space-y-12 relative overflow-hidden">
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
          <div className="relative z-10">
            <p className="text-gray-300 text-lg mb-12">
              Oscar's AI is working its magic...
            </p>

            {/* Current Step Info */}
            <div className="mb-8 min-h-20">
              <h2 className="text-2xl font-bold mb-2 text-white transition-all duration-300">
                {processingSteps[currentStep]?.title}
              </h2>
              <p className="text-gray-400 text-base">
                {processingSteps[currentStep]?.description}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-lg mx-auto mb-8">
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-cyan-600 transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="text-sm text-gray-400 mt-3 font-medium">
                {Math.min(Math.round(progress), 100)}% Complete
              </p>
            </div>

            {/* Steps Indicator */}
            <div className="flex justify-center gap-2 mb-8">
              {processingSteps.map((_, i) => (
                <div
                  key={i}
                  className={`transition-all duration-300 ${
                    i <= currentStep
                      ? "w-4 h-4 bg-cyan-600 rounded-full scale-100"
                      : "w-3 h-3 bg-gray-600 rounded-full scale-75"
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
