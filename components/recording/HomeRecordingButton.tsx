"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { storageService } from "@/lib/services/storage.service";

export function HomeRecordingButton() {
  const router = useRouter();

  const handleStartRecording = () => {
    // Clear previous session data
    storageService.clearNote();
    // Navigate to recording page
    router.push("/recording");
  };

  return (
    <Button
      onClick={handleStartRecording}
      size="lg"
      className="w-20 h-20 rounded-full text-slate-950 bg-cyan-500 hover:bg-cyan-500 hover:text-white shadow-lg hover:shadow-xl transition-all duration-200"
    >
      <Mic className="w-8 h-8 " />
    </Button>
  );
}
