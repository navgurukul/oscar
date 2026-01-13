// Error message constants

export const ERROR_MESSAGES = {
  // Browser/Device Errors
  BROWSER_NOT_SUPPORTED: 'Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.',
  MIC_NOT_FOUND: 'No microphone found. Check your device and try again.',
  MIC_PERMISSION_DENIED: 'Microphone permission required. Enable it from browser settings and reload.',
  MIC_IN_USE: 'Microphone in use. Close other apps and try again.',
  
  // Recording Errors
  RECORDING_FAILED: 'Failed to start recording. Please check microphone permissions.',
  NO_SPEECH_DETECTED: 'No speech detected. Please try recording again.',
  RECORDING_TOO_SHORT: 'Recording was too short. Please record for at least 3-5 seconds.',
  STT_INIT_FAILED: 'Failed to initialize speech recognition. Please check browser compatibility and microphone permissions.',
  
  // Processing Errors
  PROCESSING_FAILED: 'Failed to process recording. Please try again.',
  FORMATTING_FAILED: 'Failed to format text. Please try again.',
  TITLE_GENERATION_FAILED: 'Failed to generate title.',
  
  // API Errors
  API_ERROR: 'API request failed. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  
  // Storage Errors
  STORAGE_ERROR: 'Failed to save data. Please try again.',
  
  // Generic
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const

export const ERROR_TIPS = {
  MIC_TIPS: [
    'Make sure your microphone is working',
    'Speak clearly and loudly',
    'Check browser microphone permissions',
    'Try using Chrome, Safari, or Edge browser',
    'Record for at least 3-5 seconds',
  ],
} as const
