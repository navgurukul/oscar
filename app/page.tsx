'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordingButton from '@/components/RecordingButton'
import FeatureCard from '@/components/FeatureCard'

export default function Home() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-4xl w-full flex flex-col items-center">
        {/* AI-Powered Badge */}
        <div className="mb-6 flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm text-gray-600">
          <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
          <span>AI-Powered Voice Notes</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-5xl md:text-6xl font-bold text-center mb-4">
          Speak your thoughts.{' '}
          <span className="text-purple-500">Let AI write.</span>
        </h1>

        {/* Description */}
        <p className="text-gray-600 text-lg text-center mb-12 max-w-2xl">
          Turn your voice into clear, formatted text using AI. Just talk, and OSCAR handles the rest.
        </p>

        {/* Start Recording Button */}
        <RecordingButton />

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full max-w-4xl">
          <FeatureCard
            icon={
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            }
            title="Speak Freely"
            description="Just talk naturally. No need to worry about formatting."
          />
          <FeatureCard
            icon={
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
            }
            title="AI Formats"
            description="Our AI transforms your words into clean, structured text."
          />
          <FeatureCard
            icon={
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            }
            title="Ready to Use"
            description="Copy, edit, or download your polished notes instantly."
          />
        </div>
      </div>
    </main>
  )
}

