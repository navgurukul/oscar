'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import RecordingButton from '@/components/RecordingButton'
import { generateTitle } from '@/lib/aiFormatter'

export default function ResultsPage() {
  const [formattedNote, setFormattedNote] = useState('')
  const [rawText, setRawText] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editedNote, setEditedNote] = useState('')
  const [showRawTranscript, setShowRawTranscript] = useState(false)
  const [aiTitle, setAiTitle] = useState('')
  const [isTitleLoading, setIsTitleLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const note = sessionStorage.getItem('formattedNote')
    const raw = sessionStorage.getItem('rawText')
    if (note) {
      setFormattedNote(note)
      setEditedNote(note)
    } else {
      router.push('/')
    }
    if (raw) {
      setRawText(raw)
    }
    // Generate a concise AI title based on formatted note (fallback to raw)
    const source = note || raw || ''
    if (source.trim()) {
      setIsTitleLoading(true)
      generateTitle(source)
        .then((title) => setAiTitle(title))
        .catch(() => setAiTitle(''))
        .finally(() => setIsTitleLoading(false))
    } else {
      setAiTitle('')
    }
  }, [router])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedNote)
      alert('Copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([editedNote], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'oscar-note.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleSave = () => {
    setFormattedNote(editedNote)
    setIsEditing(false)
    sessionStorage.setItem('formattedNote', editedNote)
  }

  const handleCancel = () => {
    setEditedNote(formattedNote)
    setIsEditing(false)
  }

  return (
    <main className=" bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
        {/* Header */}
        <div className="text-center space-y-2 mt-8">
          <h1 className="text-4xl font-bold text-gray-500 ">Here's is your note</h1>
          <p className='mb-8'>AI is formatted your thought into Clean text</p>
          
        </div>

        {/* AI Formatted - Full Width with AI Title */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mt-8">
            {/* AI Title */}
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {isTitleLoading ? 'Generating title…' : aiTitle || 'Untitled Note'}
                </h2>
                {aiTitle && (
                  <span className="text-xs text-gray-400">AI Title</span>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">AI Formatted</h2>
              {!isEditing ? (
                <>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-2 text-gray-600 hover:text-purple-500 transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-2 text-gray-600 hover:text-purple-500 transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-2 text-gray-600 hover:text-purple-500 transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      <span>Download</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-2 text-green-600 hover:text-green-700 transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>Save</span>
                    </button>
                    <button
                      onClick={handleCancel}
                      className="flex items-center gap-2 text-red-600 hover:text-red-700 transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      <span>Cancel</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {isEditing ? (
              <textarea
                value={editedNote}
                onChange={(e) => setEditedNote(e.target.value)}
                className="w-full min-h-[300px] p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
              />
            ) : (
              <div className="prose prose-lg max-w-none text-gray-900 whitespace-pre-wrap">
                {formattedNote}
              </div>
            )}
          </div>
        </div>

        {/* Raw Transcript Toggle Button */}
        <div className="flex mt-5 mx-auto ">
          <button
            onClick={() => setShowRawTranscript(!showRawTranscript)}
            className="flex items-center gap-2 px-6 py-3   rounded-lg   text-purple-600 hover:bg-purple-50 hover:border-purple-300 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="font-medium">
              {showRawTranscript ? 'Hide Raw Transcript' : 'Show Raw Transcript'}
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${showRawTranscript ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Raw Transcript - Expandable Section */}
        {showRawTranscript && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 animate-fadeIn mt-5 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Raw Transcript</h2>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(rawText)
                      alert('Raw copied!')
                    } catch (e) {
                      console.error('Copy failed', e)
                    }
                  }}
                  className="flex items-center gap-2 text-gray-600 hover:text-purple-500 transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Copy</span>
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([rawText], { type: 'text/plain' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'oscar-raw.txt'
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                  }}
                  className="flex items-center gap-2 text-gray-600 hover:text-purple-500 transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  <span>Download</span>
                </button>
              </div>
            </div>
            <div className="prose prose-lg max-w-none text-gray-900 whitespace-pre-wrap">
              {rawText || 'Raw transcript nahi mila.'}
            </div>
          </div>
        )}

        {/* Record Again Button */}
        <div className="flex justify-center gap-4">
          <RecordingButton />
        </div>
      </div>
    </main>
  )
}