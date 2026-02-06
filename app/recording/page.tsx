"use client";

import { useState, useRef, useEffect, Suspense, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRecording } from "@/lib/hooks/useRecording";
import { storageService } from "@/lib/services/storage.service";
import { notesService } from "@/lib/services/notes.service";
import { aiService } from "@/lib/services/ai.service";
import { useAIFormatting } from "@/lib/hooks/useAIFormatting";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useSubscriptionContext } from "@/lib/contexts/SubscriptionContext";
import { RecordingControls } from "@/components/recording/RecordingControls";
import { RecordingTimer } from "@/components/recording/RecordingTimer";
import { PermissionErrorModal } from "@/components/recording/PermissionErrorModal";
import { UpgradePrompt } from "@/components/subscription/UpgradePrompt";

import { DottedGlowBackground } from "@/components/ui/dotted-glow-background";
import { ProcessingScreen } from "@/components/shared/ProcessingScreen";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { ERROR_MESSAGES, ERROR_TIPS } from "@/lib/constants";
import { ROUTES, UI_STRINGS, RECORDING_CONFIG } from "@/lib/constants";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";

function RecordingPageInner() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    canRecord,
    recordingsThisMonth,
    incrementUsage,
  } = useSubscriptionContext();

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
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showProcessing, setShowProcessing] = useState(false);
  const [isRetryingPermission, setIsRetryingPermission] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // Refs for race condition protection
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stepIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup on unmount
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Cancel any in-flight formatting requests
      cancelFormatting();
    };
  }, [cancelFormatting]);

  // Check for continue mode and auto-start with seed transcript
  useEffect(() => {
    // Only run once when component mounts and recording is ready
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
          // Clear continue mode flag
          storageService.clearContinueMode();
          // Start recording with existing transcript as seed
          toast({
            title: "Continuing Recording",
            description: "Adding to your existing note...",
          });
          // Small delay to show toast
          setTimeout(() => {
            startRecording(rawText);
          }, 500);
        } else {
          // No raw text to continue with, clear flag
          storageService.clearContinueMode();
        }
      }
    }
  }, [
    isInitializing,
    isRequestingPermission,
    isRecording,
    isPermissionDenied,
    startRecording,
    toast,
  ]);

  // Helper to clear all intervals
  const clearAllIntervals = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (stepIntervalRef.current) {
      clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
    }
  }, []);

  const handleStartRecording = async () => {
    // Check if user can record (subscription limit)
    if (user && !canRecord) {
      setShowUpgradePrompt(true);
      return;
    }
    await startRecording();
  };

  const handleRetryPermission = async () => {
    setIsRetryingPermission(true);
    try {
      await retryPermission();
    } finally {
      if (isMountedRef.current) {
        setIsRetryingPermission(false);
      }
    }
  };

  const handleStopRecording = async () => {
    // Guard against multiple concurrent processing
    if (isProcessingRef.current) {
      return;
    }
    isProcessingRef.current = true;

    // Create abort controller for this processing session
    abortControllerRef.current = new AbortController();

    setShowProcessing(true);
    setProcessingStep(0);
    setProcessingProgress(0);

    // Clear any existing intervals before starting new ones
    clearAllIntervals();

    // Simulate progress
    progressIntervalRef.current = setInterval(() => {
      setProcessingProgress((prev) => {
        if (prev < 70) return prev + Math.random() * 8 + 3;
        if (prev < 85) return prev + Math.random() * 4 + 1;
        if (prev < 95) return prev + Math.random() * 2 + 0.5;
        if (prev < 99) return prev + 0.3;
        return Math.min(prev, 99);
      });
    }, 400);

    stepIntervalRef.current = setInterval(() => {
      setProcessingStep((prev) => {
        if (prev >= 2) {
          return prev;
        }
        return prev + 1;
      });
    }, 1200);

    try {
      // Stop recording and get transcript
      const transcript = await stopRecording();

      // Check if unmounted or cancelled
      if (!isMountedRef.current || abortControllerRef.current?.signal.aborted) {
        clearAllIntervals();
        isProcessingRef.current = false;
        return;
      }

      // Persist raw transcript immediately to support continue mode
      storageService.updateRawText(transcript);

      if (!transcript || transcript.length === 0) {
        clearAllIntervals();
        if (isMountedRef.current) {
          setShowProcessing(false);

          // Build error message
          let errorDescription = ERROR_MESSAGES.NO_SPEECH_DETECTED;
          if (recordingTime < RECORDING_CONFIG.MIN_RECORDING_TIME) {
            errorDescription += " " + ERROR_MESSAGES.RECORDING_TOO_SHORT;
          }

          toast({
            title: "Recording Failed",
            description: errorDescription,
            variant: "destructive",
          });

          // Show tips in a second toast
          setTimeout(() => {
            toast({
              title: "Tips for Better Recording",
              description: ERROR_TIPS.MIC_TIPS.join(" • "),
            });
          }, 500);
        }
        isProcessingRef.current = false;
        return;
      }

      // Format with AI
      const result = await formatText(transcript);

      // Check if unmounted or cancelled
      if (!isMountedRef.current || abortControllerRef.current?.signal.aborted) {
        clearAllIntervals();
        isProcessingRef.current = false;
        return;
      }

      clearAllIntervals();

      if (result.success && result.formattedText) {
        // Show fallback notification if local formatting was used
        if (result.fallback) {
          toast({
            title: "Basic Formatting Applied",
            description: ERROR_MESSAGES.FORMATTING_FALLBACK,
          });
        }

        // Generate title before saving
        const titleResult = await aiService.generateTitle(
          result.formattedText,
          abortControllerRef.current?.signal
        );

        // Check if unmounted or cancelled
        if (
          !isMountedRef.current ||
          abortControllerRef.current?.signal.aborted
        ) {
          isProcessingRef.current = false;
          return;
        }

        const generatedTitle = titleResult.success
          ? titleResult.title
          : "Untitled Note";

        // Store in session storage for immediate display
        storageService.saveNote(
          result.formattedText,
          transcript,
          generatedTitle
        );

        // Save to Supabase if user is authenticated
        if (user) {
          const currentNoteId = storageService.getCurrentNoteId();
          const isContinuingExistingNote = Boolean(currentNoteId);
          let saveResult;

          if (currentNoteId) {
            // Update existing note if we have an ID
            saveResult = await notesService.updateNote(currentNoteId, {
              title: generatedTitle || "Untitled Note",
              raw_text: transcript,
              original_formatted_text: result.formattedText,
            });
          } else {
            // Create new note
            saveResult = await notesService.createNote({
              user_id: user.id,
              title: generatedTitle || "Untitled Note",
              raw_text: transcript,
              original_formatted_text: result.formattedText,
            });
          }

          const { data: savedNote, error: saveError } = saveResult;

          if (saveError) {
            console.error("Failed to save note to database:", saveError);
            // Show non-blocking warning toast
            if (isMountedRef.current) {
              toast({
                title: "Note Saved Locally",
                description:
                  "Could not sync to cloud, but your note is safe in this session.",
                variant: "default",
              });
            }
          } else if (savedNote) {
            // Store the note ID for the results page
            storageService.setCurrentNoteId(savedNote.id);
            // Increment usage count only when creating a new note
            if (!isContinuingExistingNote) {
              await incrementUsage();
            }
          }
        }

        if (isMountedRef.current) {
          setProcessingProgress(100);

          await new Promise((resolve) =>
            setTimeout(resolve, RECORDING_CONFIG.COMPLETION_DELAY_MS)
          );

          if (isMountedRef.current) {
            router.push(ROUTES.RESULTS);
          }
        }
      } else {
        if (isMountedRef.current) {
          setShowProcessing(false);
          toast({
            title: "Formatting Failed",
            description:
              ERROR_MESSAGES.FORMATTING_FAILED + " Please try again.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      clearAllIntervals();
      if (isMountedRef.current) {
        setShowProcessing(false);
        console.error("Processing error:", error);
        toast({
          title: "Processing Failed",
          description:
            ERROR_MESSAGES.PROCESSING_FAILED + " Please try recording again.",
          variant: "destructive",
        });
      }
    } finally {
      isProcessingRef.current = false;
    }
  };

  // Show permission error modal
  if (isPermissionDenied) {
    return (
      <main className="min-h-screen bg-black">
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
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Spinner className="text-cyan-500" />
          </div>
          <p className="text-gray-300">
            {isRequestingPermission
              ? UI_STRINGS.REQUESTING_PERMISSION
              : UI_STRINGS.INITIALIZING}
          </p>
          {isRequestingPermission && (
            <p className="text-gray-500 text-sm mt-2">
              Please allow microphone access to continue
            </p>
          )}
        </div>
      </main>
    );
  }

  if (showProcessing) {
    return (
      <ProcessingScreen
        isProcessing={showProcessing}
        progress={processingProgress}
        currentStep={processingStep}
      />
    );
  }

  return (
    <main className="flex flex-col items-center px-4 pt-8">
      {/* Upgrade Prompt Modal */}
      {showUpgradePrompt && (
        <UpgradePrompt
          limitType="recordings"
          currentUsage={recordingsThisMonth}
          onClose={() => setShowUpgradePrompt(false)}
        />
      )}

      {/* Error Alert */}
      {recordingError && !isPermissionDenied && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-[90%] max-w-md">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{recordingError}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="w-full max-w-xl flex flex-col items-center gap-8 mt-16">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">
            Record Your <span className="text-cyan-500">Voice</span>
          </h1>
        </div>

        {/* Main Recording Container */}
        <div className="bg-slate-900 w-full max-w-[500px] aspect-square rounded-3xl shadow-xl border border-cyan-700/30 p-6 sm:p-8 md:p-12 space-y-8 sm:space-y-12 relative overflow-hidden">
          <DottedGlowBackground
            gap={20}
            radius={1.3}
            color="rgba(6, 182, 212, 0.4)"
            glowColor="rgba(6, 182, 212, 0.7)"
            opacity={0.6}
            speedMin={0.6}
            speedMax={1.4}
            speedScale={1.2}
          />

          {/* Timer - always reserve space */}
          <div className="h-8">
            {isRecording && <RecordingTimer seconds={recordingTime} />}
          </div>

          {/* Recording Controls */}
          <RecordingControls
            isRecording={isRecording}
            isProcessing={isProcessing}
            isInitializing={isInitializing}
            isRequestingPermission={isRequestingPermission}
            onStart={handleStartRecording}
            onStop={handleStopRecording}
          />

          {/* Instruction Text - only when NOT recording */}
          <div className="text-center pt-4 h-16 flex items-center justify-center">
            {!isRecording && (
              <p className="text-gray-400 text-lg">
                Press the microphone button and start speaking. Oscar will do
                the rest.
              </p>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes waveform {
          0%,
          100% {
            height: 24px;
            opacity: 0.6;
          }
          50% {
            height: 48px;
            opacity: 1;
          }
        }
      `}</style>
    </main>
  );
}

export default function RecordingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Spinner className="text-cyan-500" />
        </div>
      }
    >
      <RecordingPageInner />
    </Suspense>
  );
}
