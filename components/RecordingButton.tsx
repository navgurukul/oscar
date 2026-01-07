'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getTranscriptFromSTT } from '@/lib/audioToText'
import { formatWithAI } from '@/lib/aiFormatter'
import type { STTLogic } from 'stt-tts-lib'

export default function RecordingButton() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const sttRef = useRef<STTLogic | null>(null)
  const accumulatedTranscriptRef = useRef<string>('')
  const router = useRouter()

  // Initialize STT on component mount
  useEffect(() => {
    async function initSTT() {
      try {
        // Check browser support
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) {
          alert('Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.')
          return
        }

        setIsInitializing(true)
        const { STTLogic } = await import('stt-tts-lib')
        
        // Create STT instance with transcript callback that merges updates
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
            sessionDurationMs: 60000, // 60 seconds
            interimSaveIntervalMs: 5000,
            preserveTranscriptOnStart: true,
          }
        )
        
        sttRef.current = stt
        console.log('STT initialized successfully')
      } catch (error) {
        console.error('Error initializing STT:', error)
        alert('Failed to initialize speech recognition. Please check browser compatibility and microphone permissions.')
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
    }
  }, [])

  const startRecording = async () => {
    // Navigate to recording page
    router.push('/recording')
  }

  const stopRecording = async () => {
    if (sttRef.current && isRecording) {
      try {
        setIsProcessing(true)
        sttRef.current.stop()
        setIsRecording(false)

        // Wait longer for final transcript to be processed (browser needs time)
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Get the transcript - try both state and direct method
        let transcribedText = currentTranscript.trim() || getTranscriptFromSTT(sttRef.current).trim()
        
        // If still empty, wait a bit more and try again
        if (!transcribedText) {
          await new Promise(resolve => setTimeout(resolve, 500))
          transcribedText = currentTranscript.trim() || getTranscriptFromSTT(sttRef.current).trim()
        }
        
        console.log('Current transcript state:', currentTranscript)
        console.log('Final transcript from STT:', transcribedText)
        
        if (transcribedText && transcribedText.length > 0) {
          // Step 1: Format text with AI
          const formattedText = await formatWithAI(transcribedText)
          
          // Store in sessionStorage and navigate to results page
          sessionStorage.setItem('formattedNote', formattedText)
          sessionStorage.setItem('rawText', transcribedText)
          router.push('/results')
        } else {
          alert('No speech detected. Please try recording again.\n\nTips:\n- Make sure your microphone is working\n- Speak clearly and loudly\n- Check browser microphone permissions\n- Try using Chrome, Safari, or Edge browser')
        }
      } catch (error) {
        console.error('Error processing recording:', error)
        alert('Failed to process recording. Please try again.')
      } finally {
        setIsProcessing(false)
      }
    }
  }

  return (
    <div className="w-full max-w-4xl flex flex-col items-center gap-6">
      {/* Live transcript display while recording - AudioPen style */}
      {isRecording && (
        <div className="w-full bg-white rounded-xl shadow-lg border-2 border-purple-200 p-6 min-h-[300px] max-h-[500px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <p className="text-sm font-semibold text-gray-600">Live Transcription</p>
          </div>
          {currentTranscript ? (
            <div className="prose prose-lg max-w-none">
              <p className="text-gray-900 text-lg leading-relaxed whitespace-pre-wrap font-normal">
                {currentTranscript}
                <span className="inline-block w-2 h-5 bg-purple-500 ml-1 animate-pulse"></span>
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
        </div>
      )}

      {/* Mic Icon Button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing || isInitializing}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 ${
          isRecording 
            ? 'bg-red-500 hover:bg-red-600 shadow-lg hover:shadow-xl ring-4 ring-red-200 animate-pulse' 
            : 'bg-gradient-to-br from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 shadow-lg hover:shadow-xl'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isInitializing || isProcessing ? (
          <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : isRecording ? (
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v4a1 1 0 11-2 0V7zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V7a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
          </svg>
        )}
      </button>
    </div>
  )
}

function mergeTranscripts(previous: string, incoming: string): string {
  if (!incoming) return previous
  if (!previous) return incoming

  if (incoming.startsWith(previous)) return incoming
  if (incoming.includes(previous)) return incoming
  if (previous.includes(incoming)) return previous

  const max = Math.min(previous.length, incoming.length)
  for (let i = max; i > 0; i--) {
    if (previous.slice(-i) === incoming.slice(0, i)) {
      return previous + incoming.slice(i)
    }
  }
  return previous + (previous.endsWith(' ') ? '' : ' ') + incoming
}

