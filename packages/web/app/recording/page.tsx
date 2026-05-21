"use client";

import { useState, useRef, useEffect, Suspense, useCallback, TouchEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRecording } from "@/lib/hooks/useRecording";
import { storageService } from "@/lib/services/storage.service";
import { aiService } from "@/lib/services/ai.service";
import { useAIFormatting } from "@/lib/hooks/useAIFormatting";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useSubscriptionContext } from "@/lib/contexts/SubscriptionContext";
import { PermissionErrorModal } from "@/components/recording/PermissionErrorModal";
import { UpgradePrompt } from "@/components/subscription/UpgradePrompt";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { ERROR_MESSAGES, ERROR_TIPS, ROUTES, RECORDING_CONFIG } from "@/lib/constants";
import {
  v2,
  v2Serif,
  V2Caps,
  V2Mono,
  V2Wordmark,
} from "@/components/v2/V2Primitives";

const PROCESSING_STEPS = [
  "Transcribing audio",
  "Removing filler words",
  "Detecting context",
  "Formatting for the active app",
  "Suggesting a title",
];

function formatSeconds(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function RecordingPageInner() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const { canRecord, recordingsThisMonth, incrementUsage } = useSubscriptionContext();

  const {
    isInitializing,
    isRequestingPermission,
    isRecording,
    isProcessing,
    isPermissionDenied,
    recordingTime,
    error: recordingError,
    permissionRetryCount,
    startRecording,
    stopRecording,
    retryPermission,
  } = useRecording();

  const { formatText, cancelFormatting } = useAIFormatting();

  const [processingStep, setProcessingStep] = useState(0);
  const [showProcessing, setShowProcessing] = useState(false);
  const [isRetryingPermission, setIsRetryingPermission] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const swipeTouchStartY = useRef<number | null>(null);
  const stepIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      cancelFormatting();
    };
  }, [cancelFormatting]);

  useEffect(() => {
    if (
      !isInitializing &&
      !isRequestingPermission &&
      !isRecording &&
      !isPermissionDenied
    ) {
      const shouldContinue = storageService.getContinueMode();
      if (shouldContinue) {
        const rawText = storageService.getRawText();
        if (rawText) {
          toast({ title: "Resuming Recording", description: "Preparing to add to your Scribble…" });
          storageService.clearContinueMode();
          setTimeout(() => startRecording(rawText), 800);
        } else {
          storageService.clearContinueMode();
        }
      }
    }
  }, [isInitializing, isRequestingPermission, isRecording, isPermissionDenied, startRecording, toast]);

  const clearStepInterval = useCallback(() => {
    if (stepIntervalRef.current) {
      clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
    }
  }, []);

  const handleStart = async () => {
    if (user && !canRecord) {
      setShowUpgradePrompt(true);
      return;
    }
    if (user) {
      try {
        const response = await fetch("/api/usage/check");
        const data = await response.json();
        if (response.status === 402) {
          setShowUpgradePrompt(true);
          toast({
            title: "Recording limit reached",
            description: data.message || "Upgrade for unlimited recordings.",
            variant: "destructive",
          });
          return;
        }
        if (!response.ok) throw new Error(data.error || "Failed to check limit");
        if (!data.canRecord) {
          setShowUpgradePrompt(true);
          return;
        }
      } catch (err) {
        console.error("Pre-flight error:", err);
        toast({ title: "Error", description: "Failed to verify limit.", variant: "destructive" });
        return;
      }
    }
    await startRecording();
  };

  const handleRetryPermission = async () => {
    setIsRetryingPermission(true);
    try {
      await retryPermission();
    } finally {
      if (isMountedRef.current) setIsRetryingPermission(false);
    }
  };

  const handleStop = async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    abortControllerRef.current = new AbortController();

    setShowProcessing(true);
    setProcessingStep(0);
    clearStepInterval();

    stepIntervalRef.current = setInterval(() => {
      setProcessingStep((p) => (p >= PROCESSING_STEPS.length - 1 ? p : p + 1));
    }, 900);

    try {
      const transcript = await stopRecording();
      if (!isMountedRef.current || abortControllerRef.current?.signal.aborted) {
        clearStepInterval();
        isProcessingRef.current = false;
        return;
      }
      storageService.updateRawText(transcript);

      if (!transcript || transcript.length === 0) {
        clearStepInterval();
        if (isMountedRef.current) {
          setShowProcessing(false);
          let desc = ERROR_MESSAGES.NO_SPEECH_DETECTED;
          if (recordingTime < RECORDING_CONFIG.MIN_RECORDING_TIME) {
            desc += " " + ERROR_MESSAGES.RECORDING_TOO_SHORT;
          }
          toast({ title: "Recording failed", description: desc, variant: "destructive" });
          setTimeout(() => {
            toast({ title: "Tips", description: ERROR_TIPS.MIC_TIPS.join(" · ") });
          }, 500);
        }
        isProcessingRef.current = false;
        return;
      }

      const result = await formatText(transcript);
      if (!isMountedRef.current || abortControllerRef.current?.signal.aborted) {
        clearStepInterval();
        isProcessingRef.current = false;
        return;
      }
      clearStepInterval();

      if (result.success && result.formattedText) {
        if (result.fallback) {
          toast({ title: "Basic formatting", description: ERROR_MESSAGES.FORMATTING_FALLBACK });
        }
        const titleResult = await aiService.generateTitle(
          result.formattedText,
          abortControllerRef.current?.signal
        );
        if (!isMountedRef.current || abortControllerRef.current?.signal.aborted) {
          isProcessingRef.current = false;
          return;
        }
        const generatedTitle = titleResult.success ? titleResult.title : "Untitled Scribble";
        storageService.saveScribble(result.formattedText, transcript, generatedTitle);
        if (user) await incrementUsage();
        if (isMountedRef.current) {
          await new Promise((r) => setTimeout(r, RECORDING_CONFIG.COMPLETION_DELAY_MS));
          if (isMountedRef.current) router.push(ROUTES.RESULTS);
        }
      } else {
        if (isMountedRef.current) {
          setShowProcessing(false);
          toast({
            title: "Formatting failed",
            description: ERROR_MESSAGES.FORMATTING_FAILED + " Please try again.",
            variant: "destructive",
          });
        }
      }
    } catch (err) {
      clearStepInterval();
      if (isMountedRef.current) {
        setShowProcessing(false);
        console.error("Processing error:", err);
        toast({
          title: "Processing failed",
          description: ERROR_MESSAGES.PROCESSING_FAILED,
          variant: "destructive",
        });
      }
    } finally {
      isProcessingRef.current = false;
    }
  };

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (!isRecording) return;
    swipeTouchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (!isRecording || swipeTouchStartY.current === null) return;
    const dy = e.changedTouches[0].clientY - swipeTouchStartY.current;
    if (dy > 80) handleStop();
    swipeTouchStartY.current = null;
  };

  if (isPermissionDenied) {
    return (
      <main className="min-h-screen" style={{ background: v2.cream }}>
        <PermissionErrorModal
          onRetry={handleRetryPermission}
          retryCount={permissionRetryCount}
          isRetrying={isRetryingPermission}
        />
      </main>
    );
  }

  if (isInitializing || isRequestingPermission) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: v2.cream, color: v2.ink }}
      >
        <div className="text-center">
          <Spinner />
          <p className="mt-4 text-[14px]" style={{ color: v2.inkSoft }}>
            {isRequestingPermission ? "Asking for the mic…" : "Initializing…"}
          </p>
        </div>
      </main>
    );
  }

  if (showProcessing) {
    return (
      <main
        className="min-h-screen flex flex-col"
        style={{ background: v2.cream, color: v2.ink, fontFamily: "var(--font-figtree), system-ui" }}
      >
        <header
          className="flex items-center justify-between px-6 md:px-14 py-6"
          style={{ borderBottom: `1px solid ${v2.rule}` }}
        >
          <V2Wordmark />
          <V2Caps>PROCESSING · ABOUT 4 SECONDS</V2Caps>
        </header>
        <div className="flex-1 flex items-center justify-center px-6 md:px-14 py-12">
          <div className="text-center" style={{ maxWidth: 720 }}>
            <V2Caps>PROCESSING · ABOUT 4 SECONDS</V2Caps>
            <h1
              className="mt-5"
              style={{
                fontFamily: v2Serif,
                fontSize: "clamp(48px, 9vw, 84px)",
                lineHeight: 0.96,
                letterSpacing: "-0.025em",
                fontWeight: 500,
              }}
            >
              <em style={{ fontStyle: "italic", color: v2.accent }}>Shaping</em>
              <br />
              what you said.
            </h1>

            <div className="mt-14 mx-auto text-left" style={{ maxWidth: 460 }}>
              {PROCESSING_STEPS.map((label, i) => {
                const state = i < processingStep ? "done" : i === processingStep ? "active" : "pending";
                return (
                  <div key={i} className="flex items-center gap-4 py-2">
                    <span
                      className="inline-flex items-center justify-center"
                      style={{ width: 18, height: 18 }}
                    >
                      {state === "done" && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M5 12l5 5L20 7"
                            stroke={v2.accent}
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                      {state === "active" && (
                        <span
                          className="rounded-full animate-pulse"
                          style={{ height: 10, width: 10, background: v2.accent }}
                        />
                      )}
                      {state === "pending" && (
                        <span
                          className="rounded-full"
                          style={{ height: 7, width: 7, background: v2.ruleHard }}
                        />
                      )}
                    </span>
                    <V2Mono style={{ fontSize: 13, color: state === "pending" ? v2.inkFaint : v2.ink }}>
                      {label}
                    </V2Mono>
                  </div>
                );
              })}
            </div>

            <p className="mt-12 mx-auto text-[13px]" style={{ color: v2.inkSoft, maxWidth: 360 }}>
              Oscar takes a moment to clean and format. You&rsquo;ll see the result next.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: v2.cream, color: v2.ink, fontFamily: "var(--font-figtree), system-ui" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <header
        className="flex items-center justify-between px-6 md:px-14 py-6"
        style={{ borderBottom: `1px solid ${v2.rule}` }}
      >
        <V2Wordmark />
        <Link href="/scribble">
          <V2Caps>← LIBRARY</V2Caps>
        </Link>
      </header>

      {showUpgradePrompt && (
        <UpgradePrompt
          limitType="recordings"
          currentUsage={recordingsThisMonth}
          onClose={() => setShowUpgradePrompt(false)}
        />
      )}

      {recordingError && !isPermissionDenied && (
        <div
          className="mx-auto mt-6 px-4 py-2 rounded-lg max-w-md text-[13px]"
          style={{ background: "rgba(184,98,61,0.08)", border: `1px solid ${v2.accent}`, color: v2.accent }}
        >
          {recordingError}
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-6 md:px-14 py-12">
        <div className="text-center" style={{ maxWidth: 720 }}>
          <V2Caps color={isRecording ? v2.accent : v2.inkFaint}>
            {isRecording ? `● RECORDING · ${formatSeconds(recordingTime)}` : "READY TO LISTEN"}
          </V2Caps>
          <h1
            className="mt-5"
            style={{
              fontFamily: v2Serif,
              fontSize: "clamp(56px, 11vw, 96px)",
              lineHeight: 0.96,
              letterSpacing: "-0.025em",
              fontWeight: 500,
            }}
          >
            {isRecording ? (
              <em style={{ fontStyle: "italic", color: v2.accent }}>Listening</em>
            ) : (
              <>
                Press to <em style={{ fontStyle: "italic", color: v2.accent }}>listen</em>.
              </>
            )}
          </h1>
          <p className="mt-7 mx-auto max-w-md text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
            {isRecording
              ? "Speak naturally. Oscar will tighten and format when you’re done."
              : "Speak naturally — Oscar removes filler, fixes grammar, and titles it for you."}
          </p>

          <div className="mt-14 flex items-center justify-center gap-1.5" style={{ height: 140 }}>
            {Array.from({ length: 28 }).map((_, i) => {
              const baseH = 14 + Math.abs(Math.sin(i * 0.42 + (isRecording ? Date.now() * 0.0001 : 0))) * 92;
              const h = isRecording ? baseH : 6 + Math.abs(Math.sin(i * 0.4)) * 16;
              const opacity = isRecording
                ? 0.5 + Math.abs(Math.sin(i * 0.3)) * 0.4
                : 0.3 + Math.abs(Math.sin(i * 0.3)) * 0.2;
              return (
                <span
                  key={i}
                  className="rounded-full"
                  style={{
                    width: 4,
                    height: h,
                    background: isRecording ? v2.accent : v2.ruleHard,
                    opacity,
                    transition: "height 0.2s ease",
                  }}
                />
              );
            })}
          </div>

          <div className="mt-12 flex items-center justify-center gap-4 flex-wrap">
            {isRecording ? (
              <>
                <button
                  onClick={handleStop}
                  disabled={isProcessing}
                  className="rounded-full px-6 py-3 inline-flex items-center gap-3 transition disabled:opacity-50"
                  style={{ background: v2.ink, color: v2.cream, fontSize: 14, fontWeight: 500 }}
                >
                  <span
                    style={{ display: "inline-block", height: 10, width: 10, background: v2.accent, borderRadius: 2 }}
                  />
                  Stop · then Oscar shapes it
                </button>
                <span className="text-[13px]" style={{ color: v2.inkSoft }}>
                  · Swipe down to stop
                </span>
              </>
            ) : (
              <button
                onClick={() => void handleStart()}
                className="rounded-full px-7 py-3.5 inline-flex items-center gap-3"
                style={{ background: v2.ink, color: v2.cream, fontSize: 15, fontWeight: 500 }}
              >
                <span
                  className="inline-block rounded-full"
                  style={{ height: 8, width: 8, background: v2.accent }}
                />
                Start recording
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function RecordingPage() {
  return (
    <Suspense
      fallback={
        <main
          className="min-h-screen flex items-center justify-center"
          style={{ background: v2.cream }}
        >
          <Spinner />
        </main>
      }
    >
      <RecordingPageInner />
    </Suspense>
  );
}
