'use client'

import React, { useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Edit, Copy, Download, Check, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface NoteEditorProps {
  formattedNote: string
  title: string
  isTitleLoading: boolean
  onSave: (note: string) => void
  onCopy: () => void
  onDownload: () => void
}

export function NoteEditor({
  formattedNote,
  title,
  isTitleLoading,
  onSave,
  onCopy,
  onDownload,
}: NoteEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedNote, setEditedNote] = useState(formattedNote)
  const { toast } = useToast()

  const handleSave = () => {
    onSave(editedNote)
    setIsEditing(false)
    toast({
      title: "Saved",
      description: "Your changes have been saved.",
    })
  }

  const handleCancel = () => {
    setEditedNote(formattedNote)
    setIsEditing(false)
  }

  const handleCopy = () => {
    onCopy()
    toast({
      title: "Copied!",
      description: "Note copied to clipboard.",
    })
  }

  const handleDownload = () => {
    onDownload()
    toast({
      title: "Downloaded!",
      description: "Note saved to your device.",
    })
  }

  return (
    <Card className="bg-slate-900 border-teal-700/30">
      <CardHeader>
        {/* AI Title */}
        <div className="mb-4">
          {isTitleLoading ? (
            <Skeleton className="h-8 w-64 bg-slate-700" />
          ) : (
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {title || 'Untitled Note'}
              </h2>
              {title && (
                <span className="text-xs text-gray-400">AI Title</span>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">AI Formatted</h3>
          
          {!isEditing ? (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="text-gray-400 hover:text-teal-500"
              >
                <Edit className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="text-gray-400 hover:text-teal-500"
              >
                <Copy className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="text-gray-400 hover:text-teal-500"
              >
                <Download className="w-5 h-5" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSave}
                className="text-green-500 hover:text-green-400"
              >
                <Check className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="text-red-500 hover:text-red-400"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>
        <Separator className="mt-3 bg-gray-700" />
      </CardHeader>

      <CardContent>
        {isEditing ? (
          <Textarea
            value={editedNote}
            onChange={(e) => setEditedNote(e.target.value)}
            className="w-full min-h-[300px] bg-slate-800 text-white border-teal-700/30 focus:ring-2 focus:ring-teal-600"
          />
        ) : (
          <div className="prose prose-lg max-w-none text-gray-300 whitespace-pre-wrap">
            {formattedNote}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
