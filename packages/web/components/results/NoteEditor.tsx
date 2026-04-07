"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, Share2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { FeedbackWidget } from "@/components/results/FeedbackWidget";
import type { FeedbackReason } from "@/lib/types/note.types";

interface NoteEditorProps {
  formattedNote: string;
  title: string;
  onCopy: () => void;
  onDownload: () => void;
  onShare?: () => void;
  rawText: string;
  onTextChange?: (text: string) => void;
  onSaveEdit?: () => void;
  isSaving?: boolean;
  isCopying?: boolean;
  isDownloading?: boolean;
  isSharing?: boolean;
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
  onShare,
  rawText,
  onTextChange,
  onSaveEdit,
  isSaving = false,
  isCopying = false,
  isDownloading = false,
  isSharing = false,
  onFeedbackSubmit,
  isFeedbackSubmitting = false,
  hasFeedbackSubmitted = false,
  feedbackValue = null,
  showFeedback = false,
}: NoteEditorProps) {
  const [activeTab, setActiveTab] = useState<"notes" | "transcript">("transcript");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [formattedNote, activeTab]);

  return (
    <div className="w-full max-w-[650px]">
      <Card className="bg-slate-900 border-cyan-700/30 rounded-2xl shadow-xl overflow-hidden">
        <CardHeader>
          {/* Title + action icons */}
          <div className="flex gap-6 justify-between items-center">
            <h2 className="text-xl font-semibold text-white truncate">
              {title || "Untitled Note"}
            </h2>

            <div className="hidden md:flex items-center gap-1">
              {isSaving && <Spinner className="w-4 h-4 text-cyan-500" />}
              <Button
                variant="ghost"
                size="sm"
                onClick={onCopy}
                disabled={isCopying}
                className="text-gray-400 hover:text-cyan-500 disabled:opacity-50"
              >
                {isCopying ? <Spinner className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDownload}
                disabled={isDownloading}
                className="text-gray-400 hover:text-cyan-500 disabled:opacity-50"
              >
                {isDownloading ? <Spinner className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              </Button>
              {onShare && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onShare}
                  disabled={isSharing}
                  className="text-gray-400 hover:text-cyan-500 disabled:opacity-50"
                >
                  {isSharing ? <Spinner className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </div>

          <Separator className="w-24 h-0.5 bg-cyan-500" />

          {/* Tabs */}
          <div className="flex gap-1 mt-2">
            <button
              onClick={() => setActiveTab("notes")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "notes"
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Notes
            </button>
            <button
              onClick={() => setActiveTab("transcript")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "transcript"
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Transcript
            </button>
          </div>
        </CardHeader>

        <CardContent>
          {activeTab === "notes" ? (
            <div className="text-md text-start text-gray-300 whitespace-pre-wrap min-h-[120px]">
              {rawText || "No notes available."}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={formattedNote}
              onChange={(e) => onTextChange?.(e.target.value)}
              onBlur={onSaveEdit}
              placeholder="AI output will appear here..."
              className="w-full bg-transparent text-md text-gray-300 leading-relaxed focus:outline-none resize-none border-none p-0 min-h-[120px] placeholder:text-gray-600"
            />
          )}

          {/* Mobile action buttons */}
          <div className="flex md:hidden justify-center items-center mt-6 pt-6 border-t border-slate-700/50">
            <div className="flex gap-4">
              {isSaving && (
                <div className="flex flex-col items-center gap-1">
                  <Spinner className="w-5 h-5 text-cyan-500" />
                  <span className="text-[10px] uppercase tracking-wider font-medium text-gray-400">
                    Saving
                  </span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onCopy}
                disabled={isCopying}
                className="text-gray-400 hover:text-cyan-500 disabled:opacity-50 flex flex-col items-center gap-1 h-auto py-2"
              >
                {isCopying ? <Spinner className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                <span className="text-[10px] uppercase tracking-wider font-medium">Copy</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDownload}
                disabled={isDownloading}
                className="text-gray-400 hover:text-cyan-500 disabled:opacity-50 flex flex-col items-center gap-1 h-auto py-2"
              >
                {isDownloading ? <Spinner className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                <span className="text-[10px] uppercase tracking-wider font-medium">Download</span>
              </Button>
              {onShare && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onShare}
                  disabled={isSharing}
                  className="text-gray-400 hover:text-cyan-500 disabled:opacity-50 flex flex-col items-center gap-1 h-auto py-2"
                >
                  {isSharing ? <Spinner className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
                  <span className="text-[10px] uppercase tracking-wider font-medium">Share</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
