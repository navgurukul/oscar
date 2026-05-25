"use client";

import React from "react";
import { PROCESSING_STEPS } from "@/lib/constants";
import { v2, v2Serif } from "@/components/v2/V2Primitives";

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
    <main
      className="flex flex-col items-center px-4 pt-8 min-h-dvh"
      style={{ background: v2.cream, color: v2.ink }}
    >
      <div className="w-full max-w-xl flex flex-col items-center gap-6 sm:gap-8 mt-16">
        <div className="text-center space-y-2">
          <h1
            style={{
              fontFamily: v2Serif,
              fontSize: 36,
              fontWeight: 500,
              letterSpacing: "-0.02em",
            }}
          >
            Processing your{" "}
            <em style={{ fontStyle: "italic", color: v2.accent }}>speech</em>
          </h1>
        </div>
        <div
          className="w-full max-w-[500px] min-h-[min(70vw,400px)] rounded-3xl p-6 sm:p-8 md:p-12 relative overflow-hidden flex flex-col justify-between"
          style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
        >
          <div className="h-8 relative z-10" />

          <div className="relative z-10 space-y-8">
            <div className="text-center">
              <h2
                className="transition-all duration-300"
                style={{
                  fontFamily: v2Serif,
                  fontSize: 22,
                  fontWeight: 500,
                  color: v2.ink,
                }}
              >
                {PROCESSING_STEPS[currentStep]?.title}
              </h2>
            </div>

            <div>
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ background: v2.rule }}
              >
                <div
                  className="h-full transition-all duration-300 ease-out"
                  style={{
                    width: `${Math.min(progress, 100)}%`,
                    background: v2.accent,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-center min-h-[56px]">
            <div className="flex justify-center gap-1.5">
              {PROCESSING_STEPS.map((_, i) => (
                <div
                  key={i}
                  className="transition-all duration-300 rounded-full w-6 h-1"
                  style={{
                    background: i <= currentStep ? v2.accent : v2.rule,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
