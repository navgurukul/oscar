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
import { v2 } from "@/components/v2/V2Primitives";

interface ScribbleActionsProps {
  onSave?: () => Promise<void>;
  isSaving?: boolean;
  showSave?: boolean;
}

export function ScribbleActions({ onSave, isSaving, showSave }: ScribbleActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const hideContinueRecording = !!user && pathname === ROUTES.RECORDING;

  const handleContinueRecording = () => {
    storageService.setContinueMode(true);
    router.push(ROUTES.RECORDING);
  };

  const handleRecordAgain = async () => {
    storageService.clearScribble();
    router.push(ROUTES.RECORDING);
  };

  const tooltipStyle = { background: v2.ink, color: v2.cream, border: `1px solid ${v2.ink}` };
  const primaryButton = {
    background: v2.accent,
    color: v2.cream,
    border: "none",
  };
  const secondaryButton = {
    background: v2.cream2,
    color: v2.ink,
    border: `1px solid ${v2.rule}`,
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
                className="shadow-lg w-12 h-12 rounded-full"
                style={secondaryButton}
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" style={tooltipStyle}>
            <p>{UI_STRINGS.RECORD_AGAIN}</p>
          </TooltipContent>
        </Tooltip>

        {showSave && onSave && (
          <motion.div
            whileHover={{ y: -5 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <Button
              onClick={onSave}
              disabled={isSaving}
              className="rounded-full px-6 h-12 gap-2 shadow-lg"
              style={primaryButton}
            >
              {isSaving ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span className="text-sm font-semibold">Save</span>
            </Button>
          </motion.div>
        )}

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
                  className="shadow-lg w-12 h-12 rounded-full"
                  style={primaryButton}
                >
                  <Play className="w-5 h-5" />
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent side="top" style={tooltipStyle}>
              <p>{UI_STRINGS.CONTINUE_RECORDING}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
