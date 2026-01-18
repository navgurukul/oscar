"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, Edit3, Save, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { FeedbackWidget } from "@/components/results/FeedbackWidget";
import type { FeedbackReason } from "@/lib/types/note.types";

interface NoteEditorProps {
  formattedNote: string;
  title: string;
  onCopy: () => void;
  onDownload: () => void;
  showRawTranscript: boolean;
  onToggleTranscript: () => void;
  rawText: string;
  isEditing?: boolean;
  onStartEditing?: () => void;
  onCancelEditing?: () => void;
  onSaveEdit?: () => void;
  onTextChange?: (text: string) => void;
  isSaving?: boolean;
  canEdit?: boolean;
  isCopying?: boolean;
  isDownloading?: boolean;
  // Feedback props
  onFeedbackSubmit?: (helpful: boolean, reasons?: FeedbackReason[]) => void;
  isFeedbackSubmitting?: boolean;
  hasFeedbackSubmitted?: boolean;
  feedbackValue?: boolean | null;
  showFeedback?: boolean;
}

export function NoteEditor({
  formattedNote,
  title,
  onCopy,
  onDownload,
  showRawTranscript,
  onToggleTranscript,
  rawText,
  isEditing = false,
  onStartEditing,
  onCancelEditing,
  onSaveEdit,
  onTextChange,
  isSaving = false,
  canEdit = false,
  isCopying = false,
  isDownloading = false,
  // Feedback props
  onFeedbackSubmit,
  isFeedbackSubmitting = false,
  hasFeedbackSubmitted = false,
  feedbackValue = null,
  showFeedback = false,
}: NoteEditorProps) {
  const handleCopy = () => {
    onCopy();
    // Toast is now handled in the parent component
  };

  const handleDownload = () => {
    onDownload();
    // Toast is now handled in the parent component
  };

  return (
    <div className="w-full max-w-[650px]">
      <Card className="bg-slate-900 border-cyan-700/30 rounded-t-2xl shadow-xl overflow-hidden">
        <CardHeader>
          {/* AI Title */}
          <div className="flex gap-6 justify-between items-center">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold text-white truncate">
                  {title || "Untitled Note"}
                </h2>
              </div>
            </div>

            <div className="flex items-center">
              <div className="flex">
                {isEditing ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onSaveEdit}
                      disabled={isSaving}
                      className="text-cyan-500 hover:text-cyan-400"
                    >
                      {isSaving ? (
                        <Spinner className="w-4 h-4" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onCancelEditing}
                      disabled={isSaving}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onStartEditing}
                        className="text-gray-400 hover:text-cyan-500"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                      disabled={isCopying}
                      className="text-gray-400 hover:text-cyan-500 disabled:opacity-50"
                    >
                      {isCopying ? (
                        <Spinner className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDownload}
                      disabled={isDownloading}
                      className="text-gray-400 hover:text-cyan-500 disabled:opacity-50"
                    >
                      {isDownloading ? (
                        <Spinner className="w-4 h-4" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
          <Separator className="w-24 h-0.5 bg-cyan-500" />
        </CardHeader>

        <CardContent>
          {isEditing ? (
            <textarea
              value={formattedNote}
              onChange={(e) => onTextChange?.(e.target.value)}
              className="w-full min-h-[300px] bg-slate-800 text-gray-300 rounded-lg p-4 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-slate-700"
              autoFocus
            />
          ) : (
            <div className="text-md text-start text-gray-300 whitespace-pre-wrap">
              {formattedNote}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback Widget */}
      {showFeedback && onFeedbackSubmit && (
        <div className="mt-4 w-full">
          <FeedbackWidget
            onSubmit={onFeedbackSubmit}
            isSubmitting={isFeedbackSubmitting}
            hasSubmitted={hasFeedbackSubmitted}
            submittedValue={feedbackValue}
          />
        </div>
      )}

      {/* Raw Transcript - Slide In/Out with Framer Motion */}
      <AnimatePresence mode="wait">
        {showRawTranscript ? (
          <motion.div
            key="transcript-visible"
            initial={{ opacity: 0, scaleY: 0, y: 0 }}
            animate={{ opacity: 1, scaleY: 1, y: 0 }}
            exit={{ opacity: 0, scaleY: 0, y: 0 }}
            transition={{
              duration: 0.3,
              ease: "easeInOut",
            }}
            style={{ originY: 0 }}
          >
            <div className="flex justify-center">
              <Card className="bg-white border-none rounded-t-none rounded-b-2xl shadow-xl w-full max-w-[90%]">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Raw Transcript Text */}
                    <div className="text-gray-800 text-md whitespace-pre-wrap leading-relaxed">
                      {rawText || "No transcript available."}
                    </div>

                    {/* Action Buttons */}
                    {/* <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <Button
                        variant="ghost"
                        onClick={onCopyRaw}
                        className="text-gray-600 hover:text-gray-900 font-medium"
                      >
                        copy transcript
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          onCopyRaw();
                          onCopy();
                        }}
                        className="text-gray-600 hover:text-gray-900 font-medium"
                      >
                        copy note + transcript
                      </Button>
                    </div> */}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Hide Button - Below Raw Transcript with Delayed Animation */}
            <motion.div
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 0 }}
              transition={{
                duration: 0.2,
                ease: "easeOut",
                delay: 0.2,
              }}
              className="flex justify-center"
            >
              <button
                onClick={onToggleTranscript}
                className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white font-medium py-2.5 px-10 transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl flex items-center justify-center gap-2 rounded-b-2xl"
              >
                <span className="text-sm">hide original transcript</span>
              </button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="transcript-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.2,
              ease: "easeOut",
            }}
            className="flex justify-center"
          >
            <button
              onClick={onToggleTranscript}
              className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white font-medium py-2.5 px-10 transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl flex items-center justify-center gap-2 rounded-b-2xl"
            >
              <span className="text-sm">view original transcript</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
