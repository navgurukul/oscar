"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, Save } from "lucide-react";
import { storageService } from "@/lib/services/storage.service";
import { ROUTES, UI_STRINGS } from "@/lib/constants";
import { motion } from "motion/react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NoteActionsProps {
  onSave?: () => Promise<void>;
  isSaving?: boolean;
  showSave?: boolean;
}

export function NoteActions({ onSave, isSaving, showSave }: NoteActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  // After login, on results page show only ONE bottom action button (hide the "audio/play" one)
  const hideContinueRecording = !!user && pathname === ROUTES.RECORDING;

  const handleContinueRecording = () => {
    // Set continue mode flag so recording page knows to seed the transcript
    storageService.setContinueMode(true);
    // Navigate to recording page
    router.push(ROUTES.RECORDING);
  };

  const handleRecordAgain = async () => {
    storageService.clearNote();
    router.push(ROUTES.RECORDING);
  };

  return (
    <TooltipProvider>
      <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 flex items-center justify-center gap-4 z-50">
        {/* Record Again */}
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              whileHover={{ y: -5 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <Button
                onClick={handleRecordAgain}
                size="icon"
                className="bg-slate-800 hover:bg-slate-700 text-white shadow-lg w-12 h-12 rounded-full border-none"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-slate-800 border-slate-700 text-white">
            <p>{UI_STRINGS.RECORD_AGAIN}</p>
          </TooltipContent>
        </Tooltip>

        {/* Save Button (In between) */}
        {showSave && onSave && (
          <motion.div
            whileHover={{ y: -5 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <Button
              onClick={onSave}
              disabled={isSaving}
              className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-full px-6 h-12 gap-2 shadow-lg border-none"
            >
              {isSaving ? (
                <Spinner className="w-4 h-4 text-white" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span className="text-sm font-bold">Save</span>
            </Button>
          </motion.div>
        )}

        {/* Continue Recording */}
        {!hideContinueRecording && (
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div
                whileHover={{ y: -5 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <Button
                  onClick={handleContinueRecording}
                  size="icon"
                  className="bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg w-12 h-12 rounded-full border-none"
                >
                  <Play className="w-5 h-5" />
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-cyan-800 border-cyan-700 text-white">
              <p>{UI_STRINGS.CONTINUE_RECORDING}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
