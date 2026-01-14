"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";
import { storageService } from "@/lib/services/storage.service";
import { ROUTES, UI_STRINGS } from "@/lib/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function NoteActions() {
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
