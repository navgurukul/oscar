// Audio to Text conversion using stt-tts-lib
// This package uses browser's Web Speech API which works with live microphone input

import type { STTLogic } from 'stt-tts-lib'

// Helper to get transcript from STT instance
export function getTranscriptFromSTT(stt: STTLogic): string {
  try {
    const transcript = stt.getFullTranscript()
    console.log('Getting transcript from STT:', transcript)
    return transcript || ''
  } catch (error) {
    console.error('Error getting transcript:', error)
    return ''
  }
}

// Check if browser supports speech recognition
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  return !!SpeechRecognition
}

