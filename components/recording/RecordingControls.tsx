'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Mic, Square, Loader2 } from 'lucide-react'

interface RecordingControlsProps {
  isRecording: boolean
  isProcessing: boolean
  isInitializing: boolean
  onStart: () => void
  onStop: () => void
}

export function RecordingControls({
  isRecording,
  isProcessing,
  isInitializing,
  onStart,
  onStop,
}: RecordingControlsProps) {
  const disabled = isProcessing || isInitializing

  return (
    <div className="flex justify-center pt-4">
      <Button
        onClick={isRecording ? onStop : onStart}
        disabled={disabled}
        size="lg"
        className={`w-32 h-32 rounded-full transition-all duration-300 shadow-2xl transform ${
          isRecording
            ? 'bg-red-600 hover:bg-red-700 scale-100 ring-8 ring-red-900'
            : disabled
            ? 'bg-gray-600 cursor-not-allowed scale-100'
            : 'bg-cyan-600 hover:bg-cyan-700 hover:scale-110 hover:shadow-2xl active:scale-95'
        }`}
      >
        {disabled ? (
          <Loader2 className="w-14 h-14 text-white animate-spin" />
        ) : isRecording ? (
          <Square className="w-14 h-14 text-white" fill="currentColor" />
        ) : (
          <Mic className="w-16 h-16 text-white" />
        )}
      </Button>
    </div>
  )
}
