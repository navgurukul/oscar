'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import RecordingButton from '@/components/RecordingButton'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ResultsPage() {
  const [formattedNote, setFormattedNote] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editedNote, setEditedNote] = useState('')
  const router = useRouter()

  useEffect(() => {
    const note = sessionStorage.getItem('formattedNote')
    if (note) {
      setFormattedNote(note)
      setEditedNote(note)
    } else {
      router.push('/')
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
    try {
      const entry = {
        id: Date.now(),
        text: editedNote,
        createdAt: new Date().toISOString(),
      }
      const raw = localStorage.getItem('oscar_notes')
      const list = raw ? JSON.parse(raw) : []
      list.unshift(entry)
      localStorage.setItem('oscar_notes', JSON.stringify(list))
    } catch (e) {
      console.error('Failed to save history:', e)
    }
  }

  const handleCancel = () => {
    setEditedNote(formattedNote)
    setIsEditing(false)
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center px-4 py-12">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Here's your note ✨
          </h1>
          <p className="text-gray-600">
            AI has formatted your thoughts into clean text.
          </p>
        </div>

        {/* Note Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 mb-8">
          {/* Note Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Your Note</h2>
            <div className="flex gap-4">
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 text-gray-600 hover:text-purple-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 text-gray-600 hover:text-purple-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Copy</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 text-gray-600 hover:text-purple-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 text-purple-500 hover:text-purple-600 transition-colors"
                  >
                    <span>Save</span>
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-700 transition-colors"
                  >
                    <span>Cancel</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Note Content */}
          {isEditing ? (
            <textarea
              value={editedNote}
              onChange={(e) => setEditedNote(e.target.value)}
              className="w-full min-h-[400px] p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
            />
          ) : (
            <div className="prose prose-lg max-w-none text-gray-900 whitespace-pre-wrap">
              {formattedNote}
            </div>
          )}
        </div>

        {/* Record Again Button */}
        <div className="flex justify-center gap-4">
          <RecordingButton />
          <Link href="/notes">
            <Button variant="outline">View Saved Notes</Button>
          </Link>
        </div>
      </div>
    </main>
  )
}

