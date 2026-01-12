'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Mic } from 'lucide-react'
import { storageService } from '@/lib/services/storage.service'

export function HomeRecordingButton() {
  const router = useRouter()

  const handleStartRecording = () => {
    // Clear previous session data
    storageService.clearNote()
    // Navigate to recording page
    router.push('/recording')
  }

  return (
    <Button
      onClick={handleStartRecording}
      size="lg"
      className="w-16 h-16 rounded-full bg-teal-700 hover:bg-teal-600 shadow-lg hover:shadow-xl transition-all duration-200"
    >
      <Mic className="w-8 h-8 text-white" />
    </Button>
  )
}
