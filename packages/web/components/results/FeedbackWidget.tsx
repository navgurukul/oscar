"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ThumbsUp, ThumbsDown, X, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FeedbackReason } from "@/lib/types/scribble.types";
import { Textarea } from "@/components/ui/textarea";

interface FeedbackWidgetProps {
  onSubmit: (helpful: boolean, reasons?: string[]) => void;
  isSubmitting?: boolean;
  hasSubmitted?: boolean;
  submittedValue?: boolean | null;
}

const FEEDBACK_REASONS: Array<{ value: FeedbackReason; label: string }> = [
  { value: "too_short", label: "Too short" },
  { value: "missed_key_info", label: "Missed key info" },
  { value: "incorrect_grammar", label: "Incorrect grammar" },
  { value: "wrong_tone", label: "Wrong tone" },
  { value: "poor_formatting", label: "Poor formatting" },
  { value: "other", label: "Other" },
];

export function FeedbackWidget({
  onSubmit,
  isSubmitting = false,
  hasSubmitted = false,
  submittedValue = null,
}: FeedbackWidgetProps) {
  const [showReasons, setShowReasons] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [clickedValue, setClickedValue] = useState<boolean | null>(null);
  const [otherText, setOtherText] = useState("");

  const handleYesClick = () => {
    setClickedValue(true);
    onSubmit(true);
  };

  const handleNoClick = () => {
    setClickedValue(false);
    setShowReasons(true);
  };

  const handleReasonToggle = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    );
  };

  const handleSubmitReasons = () => {
    // Validation: If "other" is selected, otherText must be filled
    if (selectedReasons.includes("other") && !otherText.trim()) {
      return;
    }

    const finalReasons = selectedReasons.filter(r => r !== "other");
    
    if (selectedReasons.includes("other") && otherText.trim()) {
      finalReasons.push(otherText.trim());
    }
    
    onSubmit(false, finalReasons.length > 0 ? finalReasons : undefined);
  };

  const handleCancel = () => {
    setShowReasons(false);
    setClickedValue(null);
    setSelectedReasons([]);
    setOtherText("");
  };

  if (hasSubmitted && submittedValue !== null) {
    return (
      <div
        className="rounded-md py-3 px-4 flex items-center justify-between"
        style={{ background: "#efeae0", border: "1px solid #e5e0d6" }}
      >
        <p className="text-sm" style={{ color: "#5a5852" }}>
          {submittedValue ? "✓ Thanks for your feedback." : "✓ Thanks — we'll work on it."}
        </p>
        <span
          className="text-xs"
          style={{
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#8b8780",
            fontSize: 10,
          }}
        >
          {submittedValue ? "HELPFUL" : "NEEDS IMPROVEMENT"}
        </span>
      </div>
    );
  }

  return (
    <div
      className="rounded-md py-3 px-4"
      style={{ background: "#efeae0", border: "1px solid #e5e0d6" }}
    >
      <AnimatePresence mode="wait">
        {!showReasons ? (
          <motion.div
            key="initial"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm" style={{ color: "#1a1816" }}>
                Was this formatting helpful?
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleYesClick}
                  disabled={isSubmitting || clickedValue !== null}
                  className="hover:bg-transparent"
                  style={{ color: "#5a5852" }}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span className="ml-1.5">Yes</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNoClick}
                  disabled={isSubmitting || clickedValue !== null}
                  className="hover:bg-transparent"
                  style={{ color: "#5a5852" }}
                >
                  <ThumbsDown className="w-4 h-4" />
                  <span className="ml-1.5">No</span>
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="reasons"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: "#1a1816" }}>
                  What could be improved?{" "}
                  <span style={{ color: "#8b8780" }}>(optional)</span>
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="h-6 w-6 p-0 hover:bg-transparent"
                  style={{ color: "#8b8780" }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {FEEDBACK_REASONS.map((reason) => {
                  const active = selectedReasons.includes(reason.value);
                  return (
                    <button
                      key={reason.value}
                      onClick={() => handleReasonToggle(reason.value)}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 text-xs rounded-full transition-colors"
                      style={{
                        background: active ? "rgba(184,98,61,0.12)" : "transparent",
                        color: active ? "#b8623d" : "#5a5852",
                        border: `1px solid ${active ? "#b8623d" : "#e5e0d6"}`,
                      }}
                    >
                      {reason.label}
                    </button>
                  );
                })}
              </div>
              {selectedReasons.includes("other") && (
                <div className="pt-2">
                  <Textarea
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    placeholder="Please describe briefly..."
                    className="text-sm"
                    style={{
                      background: "#f7f4ee",
                      border: "1px solid #e5e0d6",
                      color: "#1a1816",
                    }}
                  />
                  <p className="mt-1 text-xs" style={{ color: "#8b8780" }}>
                    Your Scribble will be sent with feedback.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSubmitReasons}
                  disabled={isSubmitting || (selectedReasons.includes("other") && !otherText.trim())}
                  className="hover:bg-transparent disabled:opacity-40"
                  style={{ color: "#b8623d" }}
                >
                  <SendHorizontal className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}