"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, Share2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { FeedbackWidget } from "@/components/results/FeedbackWidget";
import { v2, v2Serif } from "@/components/v2/V2Primitives";
import type { FeedbackReason } from "@/lib/types/scribble.types";

interface ScribbleEditorProps {
  formattedScribble: string;
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

export function ScribbleEditor({
  formattedScribble,
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
}: ScribbleEditorProps) {
  const [activeTab, setActiveTab] = useState<"scribble" | "transcript">("scribble");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [formattedScribble, activeTab]);

  const iconBtnStyle = { color: v2.inkSoft };

  return (
    <div className="w-full max-w-[650px]">
      <Card
        className="rounded-2xl overflow-hidden"
        style={{ background: v2.cream2, border: `1px solid ${v2.rule}`, color: v2.ink }}
      >
        <CardHeader>
          <div className="flex gap-6 justify-between items-center">
            <h2
              className="truncate"
              style={{
                fontFamily: v2Serif,
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.015em",
                color: v2.ink,
              }}
            >
              {title || "Untitled Scribble"}
            </h2>

            <div className="hidden md:flex items-center gap-1">
              {isSaving && <Spinner className="w-4 h-4" style={{ color: v2.accent }} />}
              <Button
                variant="ghost"
                size="sm"
                onClick={onCopy}
                disabled={isCopying}
                className="disabled:opacity-50 hover:opacity-80"
                style={iconBtnStyle}
              >
                {isCopying ? <Spinner className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDownload}
                disabled={isDownloading}
                className="disabled:opacity-50 hover:opacity-80"
                style={iconBtnStyle}
              >
                {isDownloading ? <Spinner className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              </Button>
              {onShare && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onShare}
                  disabled={isSharing}
                  className="disabled:opacity-50 hover:opacity-80"
                  style={iconBtnStyle}
                >
                  {isSharing ? <Spinner className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </div>

          <Separator className="w-24 h-0.5" style={{ background: v2.accent }} />

          <div className="flex gap-1 mt-2">
            <button
              onClick={() => setActiveTab("transcript")}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={
                activeTab === "transcript"
                  ? { background: v2.accentSoft, color: v2.accent }
                  : { color: v2.inkFaint }
              }
            >
              Raw Transcript
            </button>
            <button
              onClick={() => setActiveTab("scribble")}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={
                activeTab === "scribble"
                  ? { background: v2.accentSoft, color: v2.accent }
                  : { color: v2.inkFaint }
              }
            >
              Scribble
            </button>
          </div>
        </CardHeader>

        <CardContent>
          {activeTab === "scribble" ? (
            <textarea
              ref={textareaRef}
              value={formattedScribble}
              onChange={(e) => onTextChange?.(e.target.value)}
              onBlur={onSaveEdit}
              placeholder="Your Scribble will appear here..."
              className="w-full bg-transparent text-md leading-relaxed focus:outline-none resize-none border-none p-0 min-h-[120px]"
              style={{ color: v2.ink }}
            />
          ) : (
            <div
              className="text-md text-start whitespace-pre-wrap min-h-[120px]"
              style={{ color: v2.ink }}
            >
              {rawText || "No transcript available."}
            </div>
          )}

          <div
            className="flex md:hidden justify-center items-center mt-6 pt-6"
            style={{ borderTop: `1px solid ${v2.rule}` }}
          >
            <div className="flex gap-4">
              {isSaving && (
                <div className="flex flex-col items-center gap-1">
                  <Spinner className="w-5 h-5" style={{ color: v2.accent }} />
                  <span
                    className="text-[10px] uppercase tracking-wider font-medium"
                    style={{ color: v2.inkSoft }}
                  >
                    Saving
                  </span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onCopy}
                disabled={isCopying}
                className="disabled:opacity-50 flex flex-col items-center gap-1 h-auto py-2 hover:opacity-80"
                style={iconBtnStyle}
              >
                {isCopying ? <Spinner className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                <span className="text-[10px] uppercase tracking-wider font-medium">Copy</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDownload}
                disabled={isDownloading}
                className="disabled:opacity-50 flex flex-col items-center gap-1 h-auto py-2 hover:opacity-80"
                style={iconBtnStyle}
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
                  className="disabled:opacity-50 flex flex-col items-center gap-1 h-auto py-2 hover:opacity-80"
                  style={iconBtnStyle}
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
