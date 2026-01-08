'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordingButton from '@/components/RecordingButton'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16">
      <div className="max-w-6xl w-full flex flex-col items-center text-center">
        {/* AI-Powered Badge */}
        <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white/60 text-sm text-gray-700 shadow-sm">
          <svg className="w-4 h-4 text-teal-700" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
          <span>AI-Powered Voice Notes</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-5xl md:text-6xl font-bold text-center mb-8 mt-12">
          Speak your thoughts.{' '}
          <span className="text-teal-700">Let AI write.</span>
        </h1>

        {/* Description */}
        <p className="text-gray-600 text-lg text-center mb-16 max-w-2xl">
          Turn your voice into clear, formatted text using AI. Just talk, and OSCAR handles the rest.
        </p>

        {/* Start Recording Button */}
        <div className="mt-20">
          <div className="scale-150">
            <RecordingButton />
          </div>
        </div>
      </div>
    </main>
  )
}

