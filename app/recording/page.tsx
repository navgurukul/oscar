"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useRecording } from "@/lib/hooks/useRecording";
import { storageService } from "@/lib/services/storage.service";
import { notesService } from "@/lib/services/notes.service";
import { aiService } from "@/lib/services/ai.service";
import { useAIFormatting } from "@/lib/hooks/useAIFormatting";
import { useAuth } from "@/lib/contexts/AuthContext";
import { RecordingControls } from "@/components/recording/RecordingControls";
import { RecordingTimer } from "@/components/recording/RecordingTimer";

import { DottedGlowBackground } from "@/components/ui/dotted-glow-background";
import { ProcessingScreen } from "@/components/shared/ProcessingScreen";
import { Dialog } from "@/components/ui/dialog";
import { ERROR_MESSAGES, ERROR_TIPS } from "@/lib/constants";
import { ROUTES, UI_STRINGS, RECORDING_CONFIG } from "@/lib/constants";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";

function RecordingPageInner() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const {
    isInitializing,
    isRequestingPermission,
    isRecording,
    isProcessing,
    recordingTime,
    error: recordingError,
    startRecording,
    stopRecording,
    hasError,
    retryInitialize,
  } = useRecording();

  const { formatText } = useAIFormatting();

  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showProcessing, setShowProcessing] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorTitle, setErrorTitle] = useState<string>("");
  const [errorDescription, setErrorDescription] = useState<string>("");

  // Refs to track intervals for cleanup
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stepIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current);
      }
    };
  }, []);

  // Check for continue mode and auto-start with seed transcript
  useEffect(() => {
    // Only run once when component mounts and recording is ready
    if (!isInitializing && !isRequestingPermission && !isRecording) {
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
    startRecording,
    toast,
  ]);

  // Helper to clear all intervals
  const clearAllIntervals = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (stepIntervalRef.current) {
      clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
    }
  };

  // If initialization failed (e.g., permission denied), attempt to reinitialize
  // useEffect(() => {
  //   if (autoStart && hasError && !isRecording && !isReady) {
  //     retryInitialize();
  //   }
  // }, [autoStart, hasError, isRecording, isReady, retryInitialize]);

  const handleStartRecording = async () => {
    // Revert to earlier behavior: start recording directly
    // (Permission is requested during STT initialization)
    await startRecording();
  };

  const handleStopRecording = async () => {
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

      // Persist raw transcript immediately to support continue mode
      storageService.updateRawText(transcript);

      if (!transcript || transcript.length === 0) {
        clearAllIntervals();
        setShowProcessing(false);

        const message = [
          ERROR_MESSAGES.NO_SPEECH_DETECTED,
          recordingTime < RECORDING_CONFIG.MIN_RECORDING_TIME
            ? `\n⚠️ ${ERROR_MESSAGES.RECORDING_TOO_SHORT}`
            : "",
          "\n\nTips:\n" + ERROR_TIPS.MIC_TIPS.map((tip) => `• ${tip}`).join("\n"),
        ]
          .filter(Boolean)
          .join("");
        setErrorTitle("Recording Issue");
        setErrorDescription(message);
        setErrorOpen(true);
        return;
      }

      // Format with AI
      const result = await formatText(transcript);

      clearAllIntervals();

      if (result.success && result.formattedText) {
        // Generate title before saving
        const titleResult = await aiService.generateTitle(result.formattedText);
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
          const { data: savedNote, error: saveError } =
            await notesService.createNote({
              user_id: user.id,
              title: generatedTitle || "Untitled Note",
              raw_text: transcript,
              original_formatted_text: result.formattedText,
            });

          if (saveError) {
            console.error("Failed to save note to database:", saveError);
            // Show non-blocking warning toast
            toast({
              title: "Note Saved Locally",
              description:
                "Could not sync to cloud, but your note is safe in this session.",
              variant: "default",
            });
          } else if (savedNote) {
            // Store the note ID for the results page
            if (typeof window !== "undefined") {
              sessionStorage.setItem("currentNoteId", savedNote.id);
            }
          }
        }

        setProcessingProgress(100);

        await new Promise((resolve) =>
          setTimeout(resolve, RECORDING_CONFIG.COMPLETION_DELAY_MS)
        );
        router.push(ROUTES.RESULTS);
      } else {
        setShowProcessing(false);
        setErrorTitle("Formatting Failed");
        setErrorDescription(ERROR_MESSAGES.FORMATTING_FAILED);
        setErrorOpen(true);
      }
    } catch (error) {
      clearAllIntervals();
      setShowProcessing(false);
      console.error("Processing error:", error);
      setErrorTitle("Processing Failed");
      setErrorDescription(ERROR_MESSAGES.PROCESSING_FAILED);
      setErrorOpen(true);
    }
  };

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
      {/* Error Dialog */}
      <Dialog
        open={errorOpen || !!recordingError}
        title={errorTitle || "Error"}
        description={errorDescription || recordingError || "An error occurred."}
        onClose={() => {
          setErrorOpen(false);
          setErrorTitle("");
          setErrorDescription("");
        }}
        primaryActionLabel="Close"
        onPrimaryAction={() => {
          setErrorOpen(false);
          setErrorTitle("");
          setErrorDescription("");
        }}
      />

      {/* Permission flow uses native browser prompt during initialization */}

      <div className="w-full max-w-xl flex flex-col items-center gap-8 mt-16">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">
            Record Your <span className="text-cyan-500">Voice</span>
          </h1>
        </div>

        {/* Main Recording Container */}
        <div className="bg-slate-900 size-[500px] rounded-3xl shadow-xl border border-cyan-700/30 p-8 md:p-12  space-y-12 relative overflow-hidden">
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
