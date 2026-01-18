"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ThumbsUp, ThumbsDown, X, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
// Reasons are represented as free-form strings
import type { FeedbackReason } from "@/lib/types/note.types";

interface FeedbackWidgetProps {
  onSubmit: (
    helpful: boolean,
    reasons?: string[]
  ) => void;
  isSubmitting?: boolean;
  hasSubmitted?: boolean;
  submittedValue?: boolean | null;
}

const FEEDBACK_REASONS: Array<{ value: string; label: string }> = [
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
    const reasons = selectedReasons.includes("other")
      ? [
          ...selectedReasons.filter((r) => r !== "other"),
          otherText.trim(),
        ]
      : selectedReasons;
    onSubmit(false, reasons.length > 0 ? reasons : undefined);
  };

  const handleCancel = () => {
    setShowReasons(false);
    setClickedValue(null);
    setSelectedReasons([]);
    setOtherText("");
  };

  // If already submitted, show thank you message
  if (hasSubmitted && submittedValue !== null) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {submittedValue
                ? "✓ Thanks for your feedback!"
                : "✓ Thanks! We'll work on improving."}
            </p>
            <span className="text-xs text-gray-500">
              {submittedValue ? "Helpful" : "Needs improvement"}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardContent className="py-3 px-4">
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
                <p className="text-sm text-gray-300">
                  Was this formatting helpful?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleYesClick}
                    disabled={isSubmitting || clickedValue !== null}
                    className="text-gray-400 hover:text-white"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span className="ml-1.5">Yes</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNoClick}
                    disabled={isSubmitting || clickedValue !== null}
                    className="text-gray-400 hover:text-white"
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
                  <p className="text-sm text-gray-300">
                    What could be improved?{" "}
                    <span className="text-gray-500">(optional)</span>
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    className="text-gray-500 hover:text-gray-300 h-6 w-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {FEEDBACK_REASONS.map((reason) => (
                    <button
                      key={reason.value}
                      onClick={() => handleReasonToggle(reason.value)}
                      disabled={isSubmitting}
                      className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                        selectedReasons.includes(reason.value)
                          ? "bg-cyan-600/30 text-cyan-300 border border-cyan-500/50"
                          : "bg-slate-700/50 text-gray-400 border border-slate-600/50 hover:border-slate-500"
                      }`}
                    >
                      {reason.label}
                    </button>
                  ))}
                </div>

                {selectedReasons.includes("other") && (
                  <div className="pt-2">
                    <Textarea
                      value={otherText}
                      onChange={(e) => setOtherText(e.target.value)}
                      placeholder="Please describe briefly..."
                      className="text-sm text-gray-200 bg-slate-800/50 border-slate-700/50 placeholder:text-gray-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Your note will be sent with feedback.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSubmitReasons}
                    disabled={
                      isSubmitting ||
                      (selectedReasons.includes("other") && otherText.trim().length === 0)
                    }
                    className=" hover:text-white text-cyan-500"
                  >
                    <SendHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}