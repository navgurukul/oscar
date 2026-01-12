'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Mic, Play } from 'lucide-react'
import { storageService } from '@/lib/services/storage.service'

export function NoteActions() {
  const router = useRouter()

  const handleRecordAgain = () => {
    // Clear previous session data
    storageService.clearNote()
    // Navigate to recording page
    router.push('/recording')
  }

  const handleContinueRecording = () => {
    // Mark continue mode for recording page
    storageService.setContinueMode(true)
    // Navigate to recording page with auto-start
    router.push('/recording?autoStart=true&mode=continue')
  }

  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        onClick={handleContinueRecording}
        className="flex items-center gap-2 bg-cyan-700 hover:bg-cyan-800"
      >
        <Play className="w-5 h-5" />
        <span>Continue Recording</span>
      </Button>
      <Button
        onClick={handleRecordAgain}
        className="flex items-center gap-2 bg-cyan-700 hover:bg-cyan-800"
      >
        <Mic className="w-5 h-5" />
        <span>Record Again</span>
      </Button>
    </div>
  )
}
