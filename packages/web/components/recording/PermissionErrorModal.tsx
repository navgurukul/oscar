"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
      <div className="absolute inset-0" style={{ background: "rgba(15,13,10,0.55)" }} />

      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: "#f7f4ee", border: "1px solid #e5e0d6", color: "#1a1816" }}
      >
        <div className="p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: "rgba(184,98,61,0.10)" }}
            >
              <AlertCircle className="w-8 h-8" style={{ color: "#b8623d" }} />
            </div>
            <h2
              className="mb-2"
              style={{
                fontFamily: '"EB Garamond", Georgia, serif',
                fontSize: 28,
                fontWeight: 500,
                letterSpacing: "-0.015em",
                color: "#1a1816",
              }}
            >
              Microphone access required
            </h2>
            <p className="text-sm" style={{ color: "#5a5852" }}>
              {canRetry
                ? "Oscar needs the mic to listen. Allow access to continue."
                : "Microphone access was blocked. Enable it in your browser settings."}
            </p>
          </div>

          {canRetry && (
            <Button
              onClick={onRetry}
              disabled={isRetrying}
              className="w-full mb-4"
              style={{ background: "#1a1816", color: "#f7f4ee" }}
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Requesting access…
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try again
                </>
              )}
            </Button>
          )}

          {retryCount > 0 && canRetry && (
            <p
              className="text-center text-xs mb-4"
              style={{
                fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#8b8780",
                fontSize: 10,
              }}
            >
              ATTEMPT {retryCount + 1} OF {PERMISSION_CONFIG.MAX_RETRY_ATTEMPTS + 1}
            </p>
          )}

          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-full flex items-center justify-between py-3 px-4 rounded-lg text-left transition-colors"
            style={{ background: "#efeae0" }}
          >
            <span className="text-sm font-medium" style={{ color: "#1a1816" }}>
              How to enable microphone in {instructions.browser}
            </span>
            {showInstructions ? (
              <ChevronUp className="w-5 h-5" style={{ color: "#8b8780" }} />
            ) : (
              <ChevronDown className="w-5 h-5" style={{ color: "#8b8780" }} />
            )}
          </button>

          {showInstructions && (
            <div
              className="mt-3 p-4 rounded-lg"
              style={{ background: "#efeae0", border: "1px solid #e5e0d6" }}
            >
              <ol className="space-y-2">
                {instructions.steps.map((step, index) => (
                  <li key={index} className="flex gap-3 text-sm">
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium"
                      style={{ background: "rgba(184,98,61,0.18)", color: "#b8623d" }}
                    >
                      {index + 1}
                    </span>
                    <span style={{ color: "#1a1816" }}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-sm underline transition-colors"
              style={{ color: "#5a5852" }}
            >
              Return to home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
