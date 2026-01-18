"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface RecordingControlsProps {
  isRecording: boolean;
  isProcessing: boolean;
  isInitializing: boolean;
  isRequestingPermission?: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function RecordingControls({
  isRecording,
  isProcessing,
  isInitializing,
  isRequestingPermission = false,
  onStart,
  onStop,
}: RecordingControlsProps) {
  const disabled = isProcessing || isInitializing || isRequestingPermission;

  return (
    <div className="flex justify-center pt-4">
      <Button
        onClick={isRecording ? onStop : onStart}
        disabled={disabled}
        size="lg"
        className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full transition-all duration-300 shadow-2xl transform ${
          isRecording
            ? "bg-red-600 hover:bg-red-700 scale-100 ring-4 sm:ring-8 ring-red-900"
            : disabled
            ? "bg-gray-600 cursor-not-allowed scale-100"
            : "bg-cyan-600 hover:bg-cyan-700 hover:scale-110 hover:shadow-2xl active:scale-95"
        }`}
      >
        {disabled ? (
          <Spinner className="size-10 sm:size-14 text-white" />
        ) : isRecording ? (
          <Square
            className="w-10 h-10 sm:w-14 sm:h-14 text-white"
            fill="currentColor"
          />
        ) : (
          <Mic className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
        )}
      </Button>
    </div>
  );
}
