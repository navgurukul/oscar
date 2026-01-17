"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { storageService } from "@/lib/services/storage.service";
import { motion } from "motion/react";
import { ROUTES } from "@/lib/constants";

export function HomeRecordingButton() {
  const router = useRouter();
  const pathname = usePathname();

  // Hide the button on the recording page
  if (pathname === ROUTES.RECORDING) {
    return null;
  }

  const handleStartRecording = () => {
    // Clear previous session data
    storageService.clearNote();
    // Navigate to recording page
    router.push(ROUTES.RECORDING);
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <Button
        onClick={handleStartRecording}
        size="lg"
        className="w-20 h-20 rounded-full text-slate-950 bg-cyan-500 hover:bg-cyan-500 hover:text-white shadow-lg hover:shadow-xl transition-all duration-200"
      >
        <Mic className="w-8 h-8 " />
      </Button>
    </motion.div>
  );
}
