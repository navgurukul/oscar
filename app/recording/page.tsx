'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getTranscriptFromSTT } from '@/lib/audioToText'
import { formatWithAI } from '@/lib/aiFormatter'
import type { STTLogic } from 'stt-tts-lib'

export default function RecordingPage() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [recordingTime, setRecordingTime] = useState(0)
  const sttRef = useRef<STTLogic | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // Accumulate transcript robustly across STT internal restarts
  const accumulatedTranscriptRef = useRef<string>('')
  // iOS-specific preemptive restart timer to reduce 30–60s gap losses
  const restartIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  // Initialize STT on component mount
  useEffect(() => {
    async function initSTT() {
      try {
        // Check browser support
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) {
          alert('Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.')
          router.push('/')
          return
        }

        setIsInitializing(true)
        const { STTLogic } = await import('stt-tts-lib')
        
        // Create STT instance with transcript callback
        const stt = new STTLogic(
          (message, level) => {
            console.log(`[STT ${level || 'info'}]`, message)
          },
          (transcript) => {
            const incoming = transcript || ''
            const merged = mergeTranscripts(accumulatedTranscriptRef.current, incoming)
            accumulatedTranscriptRef.current = merged
            setCurrentTranscript(merged)
            if (incoming.trim()) {
              console.log('Transcript updated:', incoming)
            }
          },
          {
            sessionDurationMs: 60000,
            interimSaveIntervalMs: 1000, // Tighter interim updates reduce perceived drops
            // Preserve text across internal restarts (common on mobile Safari)
            preserveTranscriptOnStart: true,
          }
        )
        
        // Set up word update callback to track real-time updates
        stt.setWordsUpdateCallback((words) => {
          console.log('Words update:', words)
        })
        
        sttRef.current = stt
        console.log('STT initialized successfully')
      } catch (error) {
        console.error('Error initializing STT:', error)
        alert('Failed to initialize speech recognition. Please check browser compatibility and microphone permissions.')
        router.push('/')
      } finally {
        setIsInitializing(false)
      }
    }

    initSTT()

    // Cleanup on unmount
    return () => {
      if (sttRef.current) {
        sttRef.current.destroy()
        sttRef.current = null
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [router])

  // Start recording
  useEffect(() => {
    if (isRecording && sttRef.current) {
      // Reset timer
      setRecordingTime(0)
      
      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

      // Start STT
      try {
        // Start a fresh session, but preserve text across internal restarts
        accumulatedTranscriptRef.current = ''
        setCurrentTranscript('')
        sttRef.current.start()
        console.log('STT started, waiting for speech...')

        // On iOS Safari, preemptively restart before engine's 30–60s cutoff to
        // minimize the brief gap where speech may be missed.
        if (isIOSSafari()) {
          if (restartIntervalRef.current) {
            clearInterval(restartIntervalRef.current)
            restartIntervalRef.current = null
          }
          // Restart cycle slightly before typical 30s limit
          restartIntervalRef.current = setInterval(() => {
            try {
              // Quick stop-start; our merge + preservation avoids content loss/duplication
              sttRef.current?.stop()
              setTimeout(() => {
                try {
                  sttRef.current?.start()
                } catch (e) {
                  console.warn('Preemptive restart start() failed:', e)
                }
              }, 150)
            } catch (e) {
              console.warn('Preemptive restart stop() failed:', e)
            }
          }, 25000)
        }
      } catch (error) {
        console.error('Error starting recording:', error)
        setIsRecording(false)
        alert('Failed to start recording. Please check microphone permissions.')
      }
    } else {
      // Stop timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      // Clear iOS preemptive restart timer
      if (restartIntervalRef.current) {
        clearInterval(restartIntervalRef.current)
        restartIntervalRef.current = null
      }
    }
  }, [isRecording])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStop = async () => {
    if (sttRef.current && isRecording) {
      try {
        setIsProcessing(true)
        setIsRecording(false)
        
        // Stop STT first
        sttRef.current.stop()

        // Wait longer for final transcript to be processed
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Try multiple times to get transcript
        let transcribedText = ''
        let attempts = 0
        const maxAttempts = 3
        
        while (!transcribedText && attempts < maxAttempts) {
          // Try from state first
          transcribedText = currentTranscript.trim()
          
          // If empty, try from STT instance
          if (!transcribedText) {
            transcribedText = getTranscriptFromSTT(sttRef.current).trim()
          }
          
          // If still empty, wait and try again
          if (!transcribedText && attempts < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
          
          attempts++
        }
        
        console.log('Final transcript after', attempts, 'attempts:', transcribedText)
        console.log('Current transcript state:', currentTranscript)
        console.log('STT full transcript:', getTranscriptFromSTT(sttRef.current))
        
        if (transcribedText && transcribedText.length > 0) {
          // Format with AI
          const formattedText = await formatWithAI(transcribedText)
          
          // Store and navigate
          sessionStorage.setItem('formattedNote', formattedText)
          sessionStorage.setItem('rawText', transcribedText)
          router.push('/results')
        } else {
          // Check if recording was too short
          const recordingDuration = recordingTime
          let errorMessage = 'No speech detected. Please try recording again.\n\n'
          
          if (recordingDuration < 2) {
            errorMessage += '⚠️ Recording was too short. Please record for at least 3-5 seconds.\n\n'
          }
          
          errorMessage += 'Tips:\n'
          errorMessage += '• Make sure your microphone is working\n'
          errorMessage += '• Speak clearly and loudly\n'
          errorMessage += '• Check browser microphone permissions\n'
          errorMessage += '• Try using Chrome, Safari, or Edge browser\n'
          errorMessage += '• Record for at least 3-5 seconds'
          
          alert(errorMessage)
          setIsProcessing(false)
        }
      } catch (error) {
        console.error('Error processing recording:', error)
        alert('Failed to process recording. Please try again.')
        setIsProcessing(false)
      }
    }
  }

  if (isInitializing) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      {/* Back button */}
      <div className="absolute top-6 left-6">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>
      </div>

      <div className="flex flex-col items-center gap-8 mt-20">
        {/* Tap to start / Timer */}
        {!isRecording ? (
          <p className="text-gray-500 text-lg">Tap to start speaking</p>
        ) : (
          <div className="text-center">
            <div className="text-4xl font-mono font-bold text-gray-900 mb-2">
              {formatTime(recordingTime)}
            </div>
          </div>
        )}

        {/* Purple circles visualizer */}
        {isRecording && (
          <div className="flex gap-2 items-center">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"
                style={{
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '1s',
                }}
              />
            ))}
          </div>
        )}

        {/* Microphone button */}
        <button
          onClick={isRecording ? handleStop : () => setIsRecording(true)}
          disabled={isProcessing}
          className={`
            w-24 h-24 rounded-full flex items-center justify-center
            transition-all duration-200 shadow-lg
            ${isRecording 
              ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
              : isProcessing
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-purple-500 hover:bg-purple-600 hover:scale-105'
            }
          `}
        >
          {isProcessing ? (
            <svg className="animate-spin h-10 w-10 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Instruction text */}
        <p className="text-gray-500 text-center max-w-md">
          {isRecording 
            ? 'Speak naturally and we\'ll transcribe everything' 
            : 'Speak naturally and we\'ll transcribe everything'
          }
        </p>

        {/* Live transcript preview */}
        {isRecording && (
          <div className="w-full max-w-2xl mt-8 bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-48 overflow-y-auto min-h-[100px]">
            <p className="text-sm text-gray-500 mb-2">
              {currentTranscript ? 'Live transcription:' : 'Listening... (speak now)'}
            </p>
            {currentTranscript ? (
              <p className="text-gray-800 text-sm whitespace-pre-wrap">{currentTranscript}</p>
            ) : (
              <p className="text-gray-400 italic text-sm">Waiting for speech...</p>
            )}
          </div>
        )}
        
        {/* Recording time warning */}
        {isRecording && recordingTime < 3 && (
          <p className="text-xs text-orange-500 mt-2">
            Please speak for at least 3 seconds for best results
          </p>
        )}
      </div>
    </main>
  )
}

// Merge incoming transcript updates with previously accumulated text.
// Handles restarts that reset the incoming text and avoids repeating sentences.
function mergeTranscripts(previous: string, incoming: string): string {
  if (!incoming) return previous
  if (!previous) return incoming

  // If incoming is a superset (common when recognition continues), prefer it.
  if (incoming.startsWith(previous)) return incoming
  if (incoming.includes(previous)) return incoming

  // If incoming is wholly contained in previous, ignore to avoid repeats.
  if (previous.includes(incoming)) return previous

  // Compute maximal overlap where previous suffix equals incoming prefix.
  const max = Math.min(previous.length, incoming.length)
  for (let i = max; i > 0; i--) {
    if (previous.slice(-i) === incoming.slice(0, i)) {
      return previous + incoming.slice(i)
    }
  }

  // Fallback: append with a separating space.
  return previous + (previous.endsWith(' ') ? '' : ' ') + incoming
}

// Basic detection for iOS Safari to apply preemptive restart strategy
function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS/i.test(ua)
  return isIOS && isSafari
}

