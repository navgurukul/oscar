"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, Save } from "lucide-react";
import { storageService } from "@/lib/services/storage.service";
import { ROUTES, UI_STRINGS } from "@/lib/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NoteActionsProps {
  canSaveNew?: boolean;
  onSaveNew?: () => void;
  isSavingNew?: boolean;
}

export function NoteActions({
  canSaveNew = false,
  onSaveNew,
  isSavingNew = false,
}: NoteActionsProps) {
  const router = useRouter();

  const handleRecordAgain = () => {
    // Clear previous session data
    storageService.clearNote();
    // Navigate to recording page
    router.push(ROUTES.RECORDING);
  };

  const handleContinueRecording = () => {
    // Mark continue mode for recording page
    storageService.setContinueMode(true);
    // Navigate to recording page with auto-start
    router.push(ROUTES.RECORDING_CONTINUE);
  };

  return (
    <TooltipProvider>
      <div className="fixed bottom-16 left-1/2 transform -translate-x-1/2 flex items-center justify-center gap-3 z-50">
        {canSaveNew && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onSaveNew}
                size="icon"
                disabled={isSavingNew}
                className="bg-cyan-700 hover:bg-cyan-800 shadow-lg"
              >
                {isSavingNew ? (
                  <span className="w-5 h-5 inline-block animate-spin border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Save note</p>
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleContinueRecording}
              size="icon"
              className="bg-cyan-700 hover:bg-cyan-800 shadow-lg"
            >
              <Play className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{UI_STRINGS.CONTINUE_RECORDING}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleRecordAgain}
              size="icon"
              className="bg-cyan-700 hover:bg-cyan-800 shadow-lg"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{UI_STRINGS.RECORD_AGAIN}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
