"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { permissionService } from "@/lib/services/permission.service";
import { PERMISSION_CONFIG } from "@/lib/constants";

interface PermissionErrorModalProps {
  onRetry: () => void;
  retryCount: number;
  isRetrying?: boolean;
}

export function PermissionErrorModal({
  onRetry,
  retryCount,
  isRetrying = false,
}: PermissionErrorModalProps) {
  const [showInstructions, setShowInstructions] = useState(false);
  const instructions = permissionService.getPermissionInstructions();
  const canRetry = retryCount < PERMISSION_CONFIG.MAX_RETRY_ATTEMPTS;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <Card className="relative bg-slate-900 border-red-500/30 w-full max-w-md shadow-2xl">
        <CardContent className="pt-6">
          {/* Error Icon and Title */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Microphone Access Required
            </h2>
            <p className="text-gray-400 text-sm">
              {canRetry
                ? "Oscar needs microphone access to record your voice. Please allow access to continue."
                : "Microphone access has been blocked. Please enable it in your browser settings."}
            </p>
          </div>

          {/* Retry Button */}
          {canRetry && (
            <Button
              onClick={onRetry}
              disabled={isRetrying}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white mb-4"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Requesting Access...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </>
              )}
            </Button>
          )}

          {/* Retry count indicator */}
          {retryCount > 0 && canRetry && (
            <p className="text-center text-gray-500 text-xs mb-4">
              Attempt {retryCount + 1} of{" "}
              {PERMISSION_CONFIG.MAX_RETRY_ATTEMPTS + 1}
            </p>
          )}

          {/* Instructions Toggle */}
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-left"
          >
            <span className="text-gray-300 text-sm font-medium">
              How to enable microphone in {instructions.browser}
            </span>
            {showInstructions ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {/* Instructions Content */}
          {showInstructions && (
            <div className="mt-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <ol className="space-y-2">
                {instructions.steps.map((step, index) => (
                  <li key={index} className="flex gap-3 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-600/20 text-cyan-400 flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </span>
                    <span className="text-gray-300">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Back to Home Link */}
          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-gray-500 hover:text-gray-300 text-sm underline transition-colors"
            >
              Return to Home
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
