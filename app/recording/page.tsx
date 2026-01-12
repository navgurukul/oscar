'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRecording } from '@/lib/hooks/useRecording'
import { useAIFormatting } from '@/lib/hooks/useAIFormatting'
import { storageService } from '@/lib/services/storage.service'
import { RecordingControls } from '@/components/recording/RecordingControls'
import { RecordingTimer } from '@/components/recording/RecordingTimer'
import { DottedGlowBackground } from '@/components/ui/dotted-glow-background'
import { ProcessingScreen } from '@/components/shared/ProcessingScreen'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { ERROR_MESSAGES, ERROR_TIPS } from '@/lib/constants/errors'

function RecordingPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const autoStart = searchParams.get('autoStart') === 'true'
  const continueMode = searchParams.get('mode') === 'continue'

  const {
    isInitializing,
    isRecording,
    isProcessing,
    currentTranscript,
    recordingTime,
    error: recordingError,
    startRecording,
    stopRecording,
    clearError,
  } = useRecording()

  const { formatText, isFormatting } = useAIFormatting()

  const [processingStep, setProcessingStep] = useState(0)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [showProcessing, setShowProcessing] = useState(false)

  // Auto-start if URL param is set
  useEffect(() => {
    if (autoStart && !isRecording && !isInitializing) {
      const seedTranscript = continueMode ? storageService.getRawText() || '' : ''
      if (continueMode) {
        storageService.clearContinueMode()
      }
      startRecording(seedTranscript)
    }
  }, [autoStart, continueMode, isRecording, isInitializing])

  const handleStartRecording = async () => {
    await startRecording()
  }

  const handleStopRecording = async () => {
    setShowProcessing(true)
    setProcessingStep(0)
    setProcessingProgress(0)

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProcessingProgress((prev) => {
        if (prev < 70) return prev + Math.random() * 8 + 3
        if (prev < 85) return prev + Math.random() * 4 + 1
        if (prev < 95) return prev + Math.random() * 2 + 0.5
        if (prev < 99) return prev + 0.3
        return Math.min(prev, 99)
      })
    }, 400)

    const stepInterval = setInterval(() => {
      setProcessingStep((prev) => {
        if (prev >= 2) {
          clearInterval(stepInterval)
          return prev
        }
        return prev + 1
      })
    }, 1200)

    try {
      // Stop recording and get transcript
      const transcript = await stopRecording()

      if (!transcript || transcript.length === 0) {
        clearInterval(progressInterval)
        clearInterval(stepInterval)
        setShowProcessing(false)
        
        let errorMessage = ERROR_MESSAGES.NO_SPEECH_DETECTED + '\n\n'
        if (recordingTime < 2) {
          errorMessage += '⚠️ ' + ERROR_MESSAGES.RECORDING_TOO_SHORT + '\n\n'
        }
        errorMessage += 'Tips:\n' + ERROR_TIPS.MIC_TIPS.map(tip => `• ${tip}`).join('\n')
        alert(errorMessage)
        return
      }

      // Format with AI
      const result = await formatText(transcript)
      
      clearInterval(progressInterval)
      clearInterval(stepInterval)

      if (result.success && result.formattedText) {
        // Store and navigate
        storageService.saveNote(result.formattedText, transcript)
        setProcessingProgress(100)
        
        await new Promise(resolve => setTimeout(resolve, 600))
        router.push('/results')
      } else {
        setShowProcessing(false)
        alert(ERROR_MESSAGES.FORMATTING_FAILED)
      }
    } catch (error) {
      clearInterval(progressInterval)
      clearInterval(stepInterval)
      setShowProcessing(false)
      alert(ERROR_MESSAGES.PROCESSING_FAILED)
    }
  }

  if (isInitializing) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-300">Initializing...</p>
        </div>
      </main>
    )
  }

  if (showProcessing) {
    return (
      <ProcessingScreen
        isProcessing={showProcessing}
        progress={processingProgress}
        currentStep={processingStep}
      />
    )
  }

  return (
    <main className="min-h-screen bg-black flex flex-col items-center px-4 pt-8">
      {/* Error Alert */}
      {recordingError && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-[90%] max-w-md">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{recordingError}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="w-full max-w-2xl flex flex-col items-center gap-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold">
            Record Your <span className="text-teal-500">Voice</span>
          </h1>
        </div>

        {/* Main Recording Container */}
        <div className="w-full bg-slate-900 rounded-3xl shadow-xl border border-teal-700/30 p-8 md:p-12 space-y-8 relative overflow-hidden">
          <DottedGlowBackground
            gap={20}
            radius={1.5}
            color="rgba(20, 184, 166, 0.4)"
            glowColor="rgba(20, 184, 166, 0.7)"
            opacity={0.6}
            speedMin={0.6}
            speedMax={1.4}
            speedScale={1.2}
          />

          {/* Animated waveform when recording */}
          {isRecording && (
            <div className="flex justify-center items-center gap-1 h-16">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <div
                  key={i}
                  className="w-1 bg-teal-700 rounded-full"
                  style={{
                    height: `${24 + Math.sin(i * 0.4) * 18}px`,
                    animation: `waveform 0.6s ease-in-out infinite`,
                    animationDelay: `${i * 0.06}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Timer - only show when recording */}
          {isRecording && <RecordingTimer seconds={recordingTime} />}

          {/* Recording Controls */}
          <RecordingControls
            isRecording={isRecording}
            isProcessing={isProcessing}
            isInitializing={isInitializing}
            onStart={handleStartRecording}
            onStop={handleStopRecording}
          />

          {/* Instruction Text - only when NOT recording */}
          {!isRecording && (
            <div className="text-center pt-4">
              <p className="text-gray-400 text-lg">
                Press the microphone button and start speaking. Oscar will do the rest.
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes waveform {
          0%, 100% {
            height: 24px;
            opacity: 0.6;
          }
          50% {
            height: 48px;
            opacity: 1;
          }
        }
      `}</style>
    </main>
  )
}

export default function RecordingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Loading recording page…
      </div>
    }>
      <RecordingPageInner />
    </Suspense>
  )
}
