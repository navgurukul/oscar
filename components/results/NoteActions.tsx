"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";
import { storageService } from "@/lib/services/storage.service";
import { ROUTES, UI_STRINGS } from "@/lib/constants";
import { motion } from "motion/react";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function NoteActions() {
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

  const handleRecordAgain = () => {
    // Clear previous session data
    storageService.clearNote();
    // Navigate to recording page
    router.push(ROUTES.RECORDING);
  };

  return (
    <TooltipProvider>
      <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 flex items-center justify-center gap-4 z-50">
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              whileHover={{ y: -5 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <Button
                onClick={handleRecordAgain}
                size="icon"
                className="bg-slate-800 hover:bg-slate-700 text-white shadow-lg w-12 h-12 rounded-full"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{UI_STRINGS.RECORD_AGAIN}</p>
          </TooltipContent>
        </Tooltip>

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
                  className="bg-cyan-600 hover:bg-cyan-700 text-white w-12 h-12 shadow-lg rounded-full"
                >
                  <Play className="w-5 h-5" />
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{UI_STRINGS.CONTINUE_RECORDING}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
