'use client'

import React from 'react'

interface RecordingTimerProps {
  seconds: number
}

export function RecordingTimer({ seconds }: RecordingTimerProps) {
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="text-center">
      <div className="text-6xl font-bold text-teal-500 font-mono tracking-wider">
        {formatTime(seconds)}
      </div>
    </div>
  )
}
