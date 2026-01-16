"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

function RecordingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoStart = searchParams.get("autoStart") === "true";
  const continueMode = searchParams.get("mode") === "continue";
  const { user } = useAuth();

  const {
    isInitializing,
    isRequestingPermission,
    isReady,
    isRecording,
    isProcessing,
    recordingTime,
    error: recordingError,
    startRecording,
    stopRecording,
  } = useRecording();

  const { formatText } = useAIFormatting();

  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showProcessing, setShowProcessing] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorTitle, setErrorTitle] = useState<string>("");
  const [errorDescription, setErrorDescription] = useState<string>("");

  // Auto-start only when STT is ready to avoid race conditions
  useEffect(() => {
    if (autoStart && isReady && !isRecording) {
      const seedTranscript = continueMode
        ? storageService.getRawText() || ""
        : "";
      if (continueMode) {
        storageService.clearContinueMode();
      }
      // Auto-start: attempt recording directly (permission already requested in init)
      startRecording(seedTranscript);
    }
  }, [autoStart, continueMode, isRecording, isReady, startRecording]);

  const handleStartRecording = async () => {
    // Revert to earlier behavior: start recording directly
    // (Permission is requested during STT initialization)
    await startRecording();
  };

  const handleStopRecording = async () => {
    setShowProcessing(true);
    setProcessingStep(0);
    setProcessingProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProcessingProgress((prev) => {
        if (prev < 70) return prev + Math.random() * 8 + 3;
        if (prev < 85) return prev + Math.random() * 4 + 1;
        if (prev < 95) return prev + Math.random() * 2 + 0.5;
        if (prev < 99) return prev + 0.3;
        return Math.min(prev, 99);
      });
    }, 400);

    const stepInterval = setInterval(() => {
      setProcessingStep((prev) => {
        if (prev >= 2) {
          clearInterval(stepInterval);
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
        clearInterval(progressInterval);
        clearInterval(stepInterval);
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

      clearInterval(progressInterval);
      clearInterval(stepInterval);

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
          } else if (savedNote) {
            // Store the note ID for the results page
            sessionStorage.setItem("currentNoteId", savedNote.id);
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
    } catch {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
      setShowProcessing(false);
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

          {/* Continue Mode Hint */}
          {!isRecording && continueMode && (
            <div className="text-center -mt-6 mb-4">
              <p className="text-cyan-400 text-sm">
                Continuing from previous recording…
              </p>
            </div>
          )}
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
