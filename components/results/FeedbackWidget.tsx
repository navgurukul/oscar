"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ThumbsUp, ThumbsDown, X, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FeedbackReason } from "@/lib/types/note.types";

interface FeedbackWidgetProps {
  onSubmit: (helpful: boolean, reasons?: FeedbackReason[]) => void;
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
  const [selectedReasons, setSelectedReasons] = useState<FeedbackReason[]>([]);
  const [clickedValue, setClickedValue] = useState<boolean | null>(null);

  const handleYesClick = () => {
    setClickedValue(true);
    onSubmit(true);
  };

  const handleNoClick = () => {
    setClickedValue(false);
    setShowReasons(true);
  };

  const handleReasonToggle = (reason: FeedbackReason) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    );
  };

  const handleSubmitReasons = () => {
    onSubmit(false, selectedReasons.length > 0 ? selectedReasons : undefined);
  };

  const handleCancel = () => {
    setShowReasons(false);
    setClickedValue(null);
    setSelectedReasons([]);
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

                <div className="flex justify-end gap-2 pt-2">
                  {/* <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    className="text-gray-400 hover:text-gray-300"
                  >
                    Cancel
                  </Button> */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSubmitReasons}
                    disabled={isSubmitting}
                    className=" hover:text-white text-cyan-500"
                  >
                    <SendHorizontal className="w-4 h-4" />
                    {/* {isSubmitting ? "Submitting..." : "Submit"} */}
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
