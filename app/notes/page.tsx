'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

type NoteEntry = {
  id: number
  text: string
  createdAt: string
}

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteEntry[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('oscar_notes')
      const list = raw ? JSON.parse(raw) : []
      setNotes(list)
    } catch (e) {
      console.error('Failed to load notes:', e)
    }
  }, [])

  const remove = (id: number) => {
    const list = notes.filter(n => n.id !== id)
    setNotes(list)
    localStorage.setItem('oscar_notes', JSON.stringify(list))
  }

  const download = (note: NoteEntry) => {
    const blob = new Blob([note.text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `oscar-note-${new Date(note.createdAt).toISOString().slice(0,19)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Saved Notes</h1>
          <Link href="/">
            <Button variant="outline">Back</Button>
          </Link>
        </div>

        {notes.length === 0 ? (
          <p className="text-gray-600">No saved notes yet.</p>
        ) : (
          <div className="space-y-4">
            {notes.map(note => (
              <div key={note.id} className="rounded-lg border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">
                    {new Date(note.createdAt).toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => download(note)}>Download</Button>
                    <Button variant="outline" onClick={() => remove(note.id)}>Delete</Button>
                  </div>
                </div>
                <div className="prose prose-sm max-w-none text-gray-900 whitespace-pre-wrap">
                  {note.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}