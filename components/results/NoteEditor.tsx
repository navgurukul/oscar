"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Copy, Download, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NoteEditorProps {
  formattedNote: string;
  title: string;
  onSave: (note: string) => void;
  onCopy: () => void;
  onDownload: () => void;
  showRawTranscript: boolean;
  onToggleTranscript: () => void;
  rawText: string;
  onCopyRaw: () => void;
  onDownloadRaw: () => void;
}

export function NoteEditor({
  formattedNote,
  title,
  onSave,
  onCopy,
  onDownload,
  showRawTranscript,
  onToggleTranscript,
  rawText,
  onCopyRaw,
  onDownloadRaw,
}: NoteEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNote, setEditedNote] = useState(formattedNote);
  const { toast } = useToast();

  const handleSave = () => {
    onSave(editedNote);
    setIsEditing(false);
    toast({
      title: "Saved",
      description: "Your changes have been saved.",
    });
  };

  const handleCancel = () => {
    setEditedNote(formattedNote);
    setIsEditing(false);
  };

  const handleCopy = () => {
    onCopy();
    toast({
      title: "Copied!",
      description: "Note copied to clipboard.",
    });
  };

  const handleDownload = () => {
    onDownload();
    toast({
      title: "Downloaded!",
      description: "Note saved to your device.",
    });
  };

  return (
    <div className="w-[650px]">
      <Card className="bg-slate-900 border-cyan-700/30 rounded-t-2xl shadow-xl overflow-hidden">
        <CardHeader>
          {/* AI Title */}
          <div className="mb-4 flex gap-6 justify-between">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold text-white truncate">
                  {title || "Untitled Note"}
                </h2>
                {/* Cyan Separator */}
                <div className="w-16 h-0.5 bg-cyan-500"></div>
              </div>
            </div>

            <div className="flex items-center">
              <div className="flex">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="text-gray-400 hover:text-cyan-500"
                >
                  <Copy className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="text-gray-400 hover:text-cyan-500"
                >
                  <Download className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isEditing ? (
            <Textarea
              value={editedNote}
              onChange={(e) => setEditedNote(e.target.value)}
              className="w-full min-h-[300px] bg-slate-800 text-white border-cyan-700/30 focus:ring-2 focus:ring-cyan-600"
            />
          ) : (
            <div className="text-start text-gray-300 whitespace-pre-wrap">
              {formattedNote}
            </div>
          )}
        </CardContent>
      </Card>

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
              <Card className="bg-white border-none rounded-t-none rounded-b-2xl shadow-xl w-[580px]">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Raw Transcript Text */}
                    <div className="text-gray-800 text-lg whitespace-pre-wrap leading-relaxed">
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
