"use client";

import React from "react";
import { v2 } from "@/components/v2/V2Primitives";

interface RecordingTimerProps {
  seconds: number;
}

export function RecordingTimer({ seconds }: RecordingTimerProps) {
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="text-center">
      <div
        className="text-2xl font-mono tracking-wider"
        style={{ color: v2.accent, fontWeight: 600 }}
      >
        {formatTime(seconds)}
      </div>
    </div>
  );
}
