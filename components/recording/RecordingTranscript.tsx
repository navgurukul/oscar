'use client'

import React from 'react'
import { Card } from '@/components/ui/card'

interface RecordingTranscriptProps {
  transcript: string
  isRecording: boolean
}

export function RecordingTranscript({ transcript, isRecording }: RecordingTranscriptProps) {
  if (!isRecording) return null

  return (
    <Card className="w-full bg-white rounded-xl shadow-lg border-2 border-teal-200 p-6 min-h-[300px] max-h-[500px] overflow-y-auto">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
        <p className="text-sm font-semibold text-gray-600">Live Transcription</p>
      </div>
      {transcript ? (
        <div className="prose prose-lg max-w-none">
          <p className="text-gray-900 text-lg leading-relaxed whitespace-pre-wrap font-normal">
            {transcript}
            <span className="inline-block w-2 h-5 bg-teal-700 ml-1 animate-pulse"></span>
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[200px] text-gray-400">
          <svg className="w-12 h-12 mb-3 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
          </svg>
          <p className="text-lg italic">Start speaking... Your words will appear here in real-time</p>
        </div>
      )}
    </Card>
  )
}
