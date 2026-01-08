'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getTranscriptFromSTT } from '@/lib/audioToText'
import { formatWithAI } from '@/lib/aiFormatter'
import type { STTLogic } from 'speech-to-speech'

function RecordingPageInner() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [recordingTime, setRecordingTime] = useState(0)
  const sttRef = useRef<STTLogic | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const accumulatedTranscriptRef = useRef<string>('')
  const restartIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const autoStartRef = useRef(searchParams.get('autoStart') === 'true')
  const continueModeRef = useRef(searchParams.get('mode') === 'continue' ||
    (typeof window !== 'undefined' && sessionStorage.getItem('continueRecording') === 'true'))

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
        const { STTLogic } = await import('speech-to-speech')
        
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
        
        // Auto-start recording if query param is set
        if (autoStartRef.current) {
          setIsRecording(true)
        }
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
  }, [])

  // Start recording
  useEffect(() => {
    if (isRecording && sttRef.current) {
      // Reset timer
      setRecordingTime(0)
      
      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

      // Seed transcript if continuing, otherwise start fresh
      try {
        if (continueModeRef.current) {
          const existing = sessionStorage.getItem('rawText') || ''
          accumulatedTranscriptRef.current = existing
          setCurrentTranscript(existing)
          // Clear the one-time flag so subsequent fresh starts are clean
          sessionStorage.removeItem('continueRecording')
        } else {
          // Start a fresh session, but preserve text across internal restarts
          accumulatedTranscriptRef.current = ''
          setCurrentTranscript('')
        }
        // Start STT
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

  const [processingStep, setProcessingStep] = useState(0)
  const [processingProgress, setProcessingProgress] = useState(0)

  const processingSteps = [
    { title: 'Analyzing Audio', description: 'Processing sound waves...' },
    { title: 'AI Recognition', description: 'Understanding speech patterns...' },
    { title: 'Formatting', description: 'Structuring your text...' },
  ]

  // Reset states when coming back to recording page, unless continuing
  useEffect(() => {
    if (!continueModeRef.current) {
      accumulatedTranscriptRef.current = ''
      setCurrentTranscript('')
      setRecordingTime(0)
    }
  }, [])

  const handleStop = async () => {
    if (sttRef.current && isRecording) {
      try {
        setIsProcessing(true)
        setIsRecording(false)
        setProcessingStep(0)
        setProcessingProgress(0)

        // Gradual progress updates - takes longer to reach 100%
        let currentProgress = 0
        const progressInterval = setInterval(() => {
          setProcessingProgress(prev => {
            let nextProgress = prev
            
            // Slow progression to ~70% in first part
            if (prev < 70) {
              nextProgress = prev + Math.random() * 8 + 3 // 3-11% increments
            }
            // Slower progression from 70-85%
            else if (prev < 85) {
              nextProgress = prev + Math.random() * 4 + 1 // 1-5% increments
            }
            // Very slow from 85-95%
            else if (prev < 95) {
              nextProgress = prev + Math.random() * 2 + 0.5 // 0.5-2.5% increments
            }
            // Don't reach 100% until processing actually completes
            else if (prev < 99) {
              nextProgress = prev + 0.3 // Tiny increments toward 100%
            }
            
            return Math.min(nextProgress, 99) // Cap at 99%, will reach 100 only at the end
          })
        }, 400) // Slower update interval

        const stepInterval = setInterval(() => {
          setProcessingStep(prev => {
            if (prev >= processingSteps.length - 1) {
              clearInterval(stepInterval)
              return prev
            }
            return prev + 1
          })
        }, 1200) // Slightly slower step transitions
        
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
          
          // Set progress to 100% when truly done
          setProcessingProgress(100)
          
          // Wait a brief moment for visual completion, then navigate
          await new Promise(resolve => setTimeout(resolve, 600))
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
          setProcessingStep(0)
          setProcessingProgress(0)
        }
      } catch (error) {
        console.error('Error processing recording:', error)
        alert('Failed to process recording. Please try again.')
        setIsProcessing(false)
        setProcessingStep(0)
        setProcessingProgress(0)
      }
    }
  }

  if (isInitializing) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing...</p>
        </div>
      </main>
    )
  }

  if (isProcessing) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-4 pt-8">
        <div className="w-full max-w-2xl">
          {/* Back to Home button */}
          <div className="fixed top-4 right-6 z-50">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 px-6 py-2.5 bg-teal-700 hover:bg-teal-700 text-white rounded-lg transition-all duration-200 hover:scale-105 shadow-md whitespace-nowrap text-base font-medium"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="font-medium">Back to Home</span>
            </button>
          </div>

          {/* Processing Card */}
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 md:p-12 text-center relative overflow-hidden">
            {/* Decorative gradients */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-100 to-transparent rounded-bl-3xl opacity-40"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-teal-50 to-transparent rounded-tr-3xl opacity-30"></div>

            <div className="relative z-10">
              {/* Header */}
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                <span className="text-teal-700">
                  Processing
                </span>
              </h1>
              <p className="text-gray-600 text-lg mb-12">Oscar's AI is working its magic... ✨</p>

              {/* Central Animation */}
              <div className="w-40 h-40 mx-auto mb-8 flex items-center justify-center relative">
                {/* Outer rotating ring */}
                <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                <div 
                  className="absolute inset-0 rounded-full border-4 border-transparent border-t-teal-700 border-r-teal-700 animate-spin"
                  style={{ animationDuration: '2s' }}
                />
                
                {/* Middle pulse ring */}
                <div className="absolute inset-4 rounded-full border-2 border-teal-700 animate-pulse opacity-50"></div>
                
                {/* Center icon */}
                <div className="relative z-10 text-teal-700 text-5xl">
                  {processingStep === 0 && '🎙️'}
                  {processingStep === 1 && '🧠'}
                  {processingStep === 2 && '📝'}
                </div>
              </div>

              {/* Current Step Info */}
              <div className="mb-8 min-h-20">
                <h2 className="text-2xl font-bold mb-2 text-gray-900 transition-all duration-300">
                  {processingSteps[processingStep].title}
                </h2>
                <p className="text-gray-600 text-base">
                  {processingSteps[processingStep].description}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-lg mx-auto mb-8">
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-teal-700 transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${Math.min(processingProgress, 100)}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-3 font-medium">{Math.min(Math.round(processingProgress), 100)}% Complete</p>
              </div>

              {/* Steps Indicator */}
              <div className="flex justify-center gap-2 mb-8">
                {processingSteps.map((_, i) => (
                  <div
                    key={i}
                    className={`transition-all duration-300 ${
                      i <= processingStep
                        ? 'w-4 h-4 bg-teal-700 rounded-full scale-100'
                        : 'w-3 h-3 bg-gray-300 rounded-full scale-75'
                    }`}
                  />
                ))}
              </div>


            </div>
          </div>
        </div>

        <style jsx>{``}</style>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center px-4 pt-8">
      {/* Back to Home button */}
      <div className="fixed top-4 right-6 z-50">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 px-6 py-2.5 bg-teal-700 hover:bg-teal-700 text-white rounded-lg transition-all duration-200 hover:scale-105 shadow-md whitespace-nowrap text-base font-medium"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="font-medium">Back to Home</span>
        </button>
      </div>

      <div className="w-full max-w-2xl flex flex-col items-center gap-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold">
            Record Your <span className="text-teal-700">Voice</span>
          </h1>
          <p className="text-gray-600 text-lg">
            Press the microphone button and start speaking. Oscar will do the rest.
          </p>
        </div>

        {/* Main Recording Container */}
        <div className="w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-8 md:p-12 space-y-8">
          
          {/* Animated waveform indicator */}
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

          {/* Timer Display */}
          <div className="text-center">
            <div className="text-6xl font-bold text-teal-700 font-mono tracking-wider">
              {formatTime(recordingTime)}
            </div>
          </div>

          {/* Microphone Button */}
          <div className="flex justify-center pt-4">
            <button
              onClick={isRecording ? handleStop : () => setIsRecording(true)}
              disabled={isProcessing}
              className={`
                w-32 h-32 rounded-full flex items-center justify-center
                transition-all duration-300 shadow-2xl transform
                ${isRecording 
                  ? 'bg-red-500 hover:bg-red-600 scale-100 ring-8 ring-red-200' 
                  : isProcessing
                  ? 'bg-gray-300 cursor-not-allowed scale-100'
                  : 'bg-teal-700 hover:bg-teal-700 hover:scale-110 hover:shadow-2xl active:scale-95'
                }
              `}
            >
              {isProcessing ? (
                <svg className="animate-spin h-14 w-14 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>

          {/* Instruction Text */}
          <div className="text-center pt-4">
            <p className="text-gray-600 text-lg flex items-center justify-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 15.707a1 1 0 010-1.414l5-5a1 1 0 011.414 0l5 5a1 1 0 11-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414 0z" clipRule="evenodd" transform="rotate(180)" />
              </svg>
              {isRecording ? 'Listening... Speak clearly!' : 'Click the microphone to start recording'}
            </p>
          </div>

        </div>

      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 1;
          }
        }
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-600">Loading recording page…</div>}>
      <RecordingPageInner />
    </Suspense>
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

