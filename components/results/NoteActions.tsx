"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
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

  const handleContinueRecording = () => {
    // Set continue mode flag so recording page knows to seed the transcript
    storageService.setContinueMode(true);
    // Navigate to recording page
    router.push(ROUTES.RECORDING);
  };

  return (
    <TooltipProvider>
      <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 flex items-center justify-center gap-3 z-50">
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
      </div>
    </TooltipProvider>
  );
}
