"use client";

import { useState, useEffect, useRef } from "react";
import { SparklesCore } from "@/components/ui/sparkles";
import { Download, Apple, Monitor, Laptop, Check } from "lucide-react";

// Platform type definition
type Platform = "mac-intel" | "mac-silicon" | "windows" | "linux" | null;

// Download configuration
const DOWNLOAD_URLS = {
  "mac-intel": "/tauri/oscar_0.1.0_x64.dmg",
  "mac-silicon": "/tauri/oscar_0.1.0_aarch64.dmg",
  windows: "/tauri/oscar_0.1.0_x64-setup.exe",
  linux: "/tauri/oscar_0.1.0_amd64.AppImage",
};

const PLATFORM_INFO = {
  "mac-intel": {
    name: "Intel Mac",
    icon: Apple,
    description: "For Macs with Intel processors",
    fileSize: "~150 MB",
    extension: ".dmg",
  },
  "mac-silicon": {
    name: "Apple Silicon",
    icon: Apple,
    description: "For Macs with M1, M2, or M3 chips",
    fileSize: "~150 MB",
    extension: ".dmg",
  },
  windows: {
    name: "Windows",
    icon: Monitor,
    description: "Windows 10 or later",
    fileSize: "~120 MB",
    extension: ".exe",
  },
  linux: {
    name: "Linux",
    icon: Laptop,
    description: "Most Linux distributions",
    fileSize: "~130 MB",
    extension: ".AppImage",
  },
};

export default function DownloadPage() {
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const hasDownloaded = useRef(false);

  useEffect(() => {
    if (hasDownloaded.current) return;

    const detectPlatform = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const platform = navigator.platform.toLowerCase();

      if (userAgent.includes("mac") || platform.includes("mac")) {
        if (
          userAgent.includes("arm64") ||
          userAgent.includes("aarch64") ||
          (typeof navigator !== "undefined" &&
            // @ts-expect-error - navigator.userAgentData is not in standard types yet
            navigator.userAgentData?.platform === "macOS")
        ) {
          return "mac-silicon" as Platform;
        }
        return "mac-intel" as Platform;
      } else if (userAgent.includes("win") || platform.includes("win")) {
        return "windows" as Platform;
      } else if (userAgent.includes("linux") || platform.includes("linux")) {
        return "linux" as Platform;
      }
      return null;
    };

    const platform = detectPlatform();
    setDetectedPlatform(platform);

    // Auto-start download after brief delay (only once)
    if (platform) {
      const timer = setTimeout(() => {
        if (!hasDownloaded.current) {
          hasDownloaded.current = true;
          triggerDownload(platform);
          setDownloadStarted(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const triggerDownload = (platform: Platform) => {
    if (!platform) return;
    const url = DOWNLOAD_URLS[platform];
    const link = document.createElement("a");
    link.href = url;
    link.download = url.split("/").pop() || "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleManualDownload = () => {
    if (detectedPlatform) {
      triggerDownload(detectedPlatform);
      setDownloadStarted(true);
    }
  };

  const PlatformIcon = detectedPlatform
    ? PLATFORM_INFO[detectedPlatform].icon
    : Download;

  return (
    <main className="min-h-screen flex flex-col md:flex-row bg-[#fafafa]">
      {/* Left side - Download Confirmation */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-white">
        <div className="w-full max-w-sm text-center">
          {/* Success Icon */}
          <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mb-6 mx-auto">
            {downloadStarted ? (
              <Check className="w-8 h-8 text-cyan-500" />
            ) : (
              <PlatformIcon className="w-8 h-8 text-cyan-500" />
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-3 tracking-tight leading-tight">
            {downloadStarted ? "Download started" : "Preparing download..."}
          </h1>

          <p className="text-[0.95rem] text-gray-500 mb-8 leading-relaxed">
            {downloadStarted
              ? "Thanks for downloading OSCAR!"
              : "Detecting your platform..."}
          </p>

          {/* Manual download link */}
          {downloadStarted && (
            <button
              onClick={handleManualDownload}
              className="text-sm text-cyan-600 hover:text-cyan-700 underline underline-offset-2"
            >
              Download didn&apos;t start? Click here
            </button>
          )}
        </div>
      </div>

      {/* Right side - Feature Showcase */}
      <div className="hidden md:flex flex-1 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
        <FeatureShowcase />
      </div>
    </main>
  );
}

function FeatureShowcase() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 3;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center p-8 md:p-12">
      {/* Sparkles background */}
      <div className="absolute inset-0 opacity-60">
        <SparklesCore
          background="transparent"
          minSize={0.4}
          maxSize={1}
          particleDensity={100}
          className="w-full h-full"
          particleColor="#FFFFFF"
        />
      </div>

      {/* Slide 1: Offline */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-600 ease-out ${
          currentSlide === 0
            ? "opacity-100 translate-x-0"
            : "opacity-0 translate-x-8 pointer-events-none"
        }`}
      >
        <div className="relative z-10 text-center text-white max-w-md">
          <p className="text-sm text-white/70 mb-2 tracking-wide">
            Works offline
          </p>
          <h2 className="text-2xl md:text-3xl font-medium mb-4 font-serif italic">
            No internet needed
          </h2>
          <div className="mb-8">
            <span className="text-3xl md:text-4xl font-light font-serif">
              100% local
            </span>
          </div>
          <p className="text-sm text-white/60 italic leading-relaxed">
            Whisper AI runs entirely on your device. Your voice never leaves
            your computer.
          </p>
        </div>
      </div>

      {/* Slide 2: Global Shortcut */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-600 ease-out ${
          currentSlide === 1
            ? "opacity-100 translate-x-0"
            : "opacity-0 translate-x-8 pointer-events-none"
        }`}
      >
        <div className="relative z-10 text-center text-white max-w-md">
          <p className="text-sm text-white/70 mb-2 tracking-wide">
            Works everywhere
          </p>
          <h2 className="text-2xl md:text-3xl font-medium mb-4 font-serif italic">
            Press <span className="text-cyan-300">Fn</span> to record
          </h2>
          <div className="mb-8">
            <span className="text-2xl md:text-3xl font-light font-serif text-white/90">
              Global shortcut
            </span>
          </div>
          <p className="text-sm text-white/60 italic leading-relaxed">
            Start recording from any app, any window. No need to switch
            contexts.
          </p>
        </div>
      </div>

      {/* Slide 3: AI Enhancement */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-600 ease-out ${
          currentSlide === 2
            ? "opacity-100 translate-x-0"
            : "opacity-0 translate-x-8 pointer-events-none"
        }`}
      >
        <div className="relative z-10 text-center text-white max-w-md">
          <p className="text-sm text-white/70 mb-2 tracking-wide">
            Optional cloud AI
          </p>
          <h2 className="text-2xl md:text-3xl font-medium mb-4 font-serif italic">
            Perfect formatting
          </h2>
          <div className="mb-8">
            <span className="text-2xl md:text-3xl font-light font-serif text-white/90">
              AI-powered polish
            </span>
          </div>
          <p className="text-sm text-white/60 italic leading-relaxed">
            Enable cloud AI to remove filler words, fix grammar, and structure
            your notes beautifully.
          </p>
        </div>
      </div>

      {/* Slide Indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2.5 z-20">
        {Array.from({ length: totalSlides }).map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              currentSlide === index
                ? "w-6 bg-white"
                : "w-2 bg-white/30 hover:bg-white/50"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
