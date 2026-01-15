"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRecording } from "@/lib/hooks/useRecording";
import { useAIFormatting } from "@/lib/hooks/useAIFormatting";
import { storageService } from "@/lib/services/storage.service";
import { browserService } from "@/lib/services/browser.service";
import { RecordingControls } from "@/components/recording/RecordingControls";
import { RecordingTimer } from "@/components/recording/RecordingTimer";
import { RecordingTranscript } from "@/components/recording/RecordingTranscript";
import { DottedGlowBackground } from "@/components/ui/dotted-glow-background";
import { ProcessingScreen } from "@/components/shared/ProcessingScreen";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ERROR_MESSAGES, ERROR_TIPS } from "@/lib/constants/errors";

function RecordingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoStart = searchParams.get("autoStart") === "true";
  const continueMode = searchParams.get("mode") === "continue";

  const {
    isInitializing,
    isReady,
    isRecording,
    isProcessing,
    currentTranscript,
    recordingTime,
    error: recordingError,
    startRecording,
    stopRecording,
    clearError,
  } = useRecording();

  const { formatText, isFormatting } = useAIFormatting();

  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showProcessing, setShowProcessing] = useState(false);
  const [isErrorOpen, setIsErrorOpen] = useState(false);
  const [errorTitle, setErrorTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPermissionOpen, setIsPermissionOpen] = useState(false);
  const [micGranted, setMicGranted] = useState(false);

  // Auto-start only when STT is ready to avoid race conditions
  useEffect(() => {
    if (autoStart && isReady && !isRecording) {
      if (!micGranted) {
        setIsPermissionOpen(true);
        return;
      }
      const seedTranscript = continueMode ? storageService.getRawText() || "" : "";
      if (continueMode) {
        storageService.clearContinueMode();
      }
      startRecording(seedTranscript);
    }
  }, [autoStart, continueMode, isRecording, isReady, micGranted]);

  useEffect(() => {
    if (recordingError) {
      setErrorTitle("Recording Error");
      setErrorMessage(recordingError);
      setIsErrorOpen(true);
    }
  }, [recordingError]);

  const promptMicAccess = async () => {
    const result = await browserService.checkMicrophonePermission();
    if (result.granted) {
      setMicGranted(true);
      setIsPermissionOpen(false);
      // If autoStart was requested, kick off recording now
      if (autoStart && isReady && !isRecording) {
        const seedTranscript = continueMode ? storageService.getRawText() || "" : "";
        if (continueMode) storageService.clearContinueMode();
        await startRecording(seedTranscript);
      }
    } else {
      setErrorTitle("Microphone Permission Required");
      setErrorMessage(result.error || "Please enable microphone access to record.");
      setIsErrorOpen(true);
    }
  };

  const handleStartRecording = async () => {
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

        let msg = ERROR_MESSAGES.NO_SPEECH_DETECTED + "\n\n";
        if (recordingTime < 2) {
          msg += "⚠️ " + ERROR_MESSAGES.RECORDING_TOO_SHORT + "\n\n";
        }
        msg +=
          "Tips:\n" + ERROR_TIPS.MIC_TIPS.map((tip) => `• ${tip}`).join("\n");
        setErrorTitle("No Speech Detected");
        setErrorMessage(msg);
        setIsErrorOpen(true);
        return;
      }

      // Format with AI
      const result = await formatText(transcript);

      clearInterval(progressInterval);
      clearInterval(stepInterval);

      if (result.success && result.formattedText) {
        // Store and navigate
        storageService.saveNote(result.formattedText, transcript);
        setProcessingProgress(100);

        await new Promise((resolve) => setTimeout(resolve, 600));
        router.push("/results");
      } else {
        setShowProcessing(false);
        setErrorTitle("Formatting Failed");
        setErrorMessage(ERROR_MESSAGES.FORMATTING_FAILED);
        setIsErrorOpen(true);
      }
    } catch (error) {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
      setShowProcessing(false);
      setErrorTitle("Processing Error");
      setErrorMessage(ERROR_MESSAGES.PROCESSING_FAILED);
      setIsErrorOpen(true);
    }
  };

  if (isInitializing) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Initializing...</p>
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
      <Dialog open={isErrorOpen} onOpenChange={(open) => {
        setIsErrorOpen(open);
        if (!open) clearError();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-black">{errorTitle}</DialogTitle>
            <DialogDescription>
              Please review the details below.
            </DialogDescription>
          </DialogHeader >
          <div className="text-sm text-gray-400 whitespace-pre-wrap">{errorMessage}</div>
          <DialogFooter className="mt-4 ">
            <Button onClick={() => {
              setIsErrorOpen(false);
              clearError();
            }} className="bg-cyan-700 hover:bg-cyan-800">OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <p className="text-cyan-400 text-sm">Continuing from previous recording…</p>
            </div>
          )}

          {/* Live Transcript - shows existing and new speech while recording */}
          <RecordingTranscript transcript={currentTranscript} isRecording={isRecording} />
        </div>
      </div>

      {/* Microphone Permission Dialog */}
      <Dialog open={isPermissionOpen} onOpenChange={setIsPermissionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable Microphone</DialogTitle>
            <DialogDescription>
              To continue recording, please allow microphone access.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-gray-200">
            We’ll prompt your browser for permission. If denied, enable it from
            browser settings and reload the page.
          </div>
          <DialogFooter>
            <Button onClick={promptMicAccess} className="bg-cyan-700 hover:bg-cyan-800">
              Enable Microphone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        <div className="min-h-screen flex items-center justify-center text-gray-600">
          Loading recording page…
        </div>
      }
    >
      <RecordingPageInner />
    </Suspense>
  );
}
