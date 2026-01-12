'use client'

import React from 'react'

interface ProcessingScreenProps {
  isProcessing: boolean
  progress: number
  currentStep: number
}

const processingSteps = [
  { title: 'Analyzing Audio', description: 'Processing sound waves...', icon: '🎙️' },
  { title: 'AI Recognition', description: 'Understanding speech patterns...', icon: '🧠' },
  { title: 'Formatting', description: 'Structuring your text...', icon: '📝' },
]

export function ProcessingScreen({ isProcessing, progress, currentStep }: ProcessingScreenProps) {
  if (!isProcessing) return null

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4 pt-8">
      <div className="w-full max-w-2xl">
        <div className="bg-slate-900 rounded-3xl shadow-2xl border border-teal-700/30 p-8 md:p-12 text-center relative overflow-hidden">
          {/* Decorative gradients */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-teal-900/40 to-transparent rounded-bl-3xl opacity-40"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-teal-900/30 to-transparent rounded-tr-3xl opacity-30"></div>

          <div className="relative z-10">
            {/* Header */}
            <h1 className="text-4xl md:text-5xl font-bold mb-2">
              <span className="text-teal-500">Processing</span>
            </h1>
            <p className="text-gray-300 text-lg mb-12">Oscar's AI is working its magic... ✨</p>

            {/* Central Animation */}
            <div className="w-40 h-40 mx-auto mb-8 flex items-center justify-center relative">
              {/* Outer rotating ring */}
              <div className="absolute inset-0 rounded-full border-4 border-gray-700"></div>
              <div 
                className="absolute inset-0 rounded-full border-4 border-transparent border-t-teal-600 border-r-teal-600 animate-spin"
                style={{ animationDuration: '2s' }}
              />
              
              {/* Middle pulse ring */}
              <div className="absolute inset-4 rounded-full border-2 border-teal-600 animate-pulse opacity-50"></div>
              
              {/* Center icon */}
              <div className="relative z-10 text-teal-500 text-5xl">
                {processingSteps[currentStep]?.icon}
              </div>
            </div>

            {/* Current Step Info */}
            <div className="mb-8 min-h-20">
              <h2 className="text-2xl font-bold mb-2 text-white transition-all duration-300">
                {processingSteps[currentStep]?.title}
              </h2>
              <p className="text-gray-400 text-base">
                {processingSteps[currentStep]?.description}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-lg mx-auto mb-8">
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-teal-600 transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="text-sm text-gray-400 mt-3 font-medium">
                {Math.min(Math.round(progress), 100)}% Complete
              </p>
            </div>

            {/* Steps Indicator */}
            <div className="flex justify-center gap-2 mb-8">
              {processingSteps.map((_, i) => (
                <div
                  key={i}
                  className={`transition-all duration-300 ${
                    i <= currentStep
                      ? 'w-4 h-4 bg-teal-600 rounded-full scale-100'
                      : 'w-3 h-3 bg-gray-600 rounded-full scale-75'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
