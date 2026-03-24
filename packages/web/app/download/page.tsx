"use client";

import { useState, useEffect, useRef } from "react";
import { SparklesCore } from "@/components/ui/sparkles";
import { Check } from "lucide-react";

// Platform type definition
type Platform = "mac-intel" | "mac-silicon" | "windows" | "linux" | null;

// Download configuration - GitHub Releases
const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO ?? "navgurukul/oscar";
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.2.12";
const GITHUB_RELEASE_BASE = `https://github.com/${GITHUB_REPO}/releases/download/v${APP_VERSION}`;

const DOWNLOAD_URLS: Record<Exclude<Platform, null>, string> = {
  "mac-intel": `${GITHUB_RELEASE_BASE}/OSCAR_${APP_VERSION}_x64.dmg`,
  "mac-silicon": `${GITHUB_RELEASE_BASE}/OSCAR_${APP_VERSION}_aarch64.dmg`,
  windows: `${GITHUB_RELEASE_BASE}/OSCAR_${APP_VERSION}_x64-setup.exe`,
  linux: `${GITHUB_RELEASE_BASE}/OSCAR_${APP_VERSION}_amd64.AppImage`,
};

export default function DownloadPage() {
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>(null);
  const hasDownloaded = useRef(false);

  useEffect(() => {
    if (hasDownloaded.current) return;

    const detectPlatform = async (): Promise<Platform> => {
      const userAgent = navigator.userAgent.toLowerCase();
      const platform = navigator.platform.toLowerCase();

      if (userAgent.includes("mac") || platform.includes("mac")) {
        // Check high-entropy UA hints (Chrome 90+) — the only reliable way to
        // distinguish Apple Silicon from Intel via the browser.
        try {
          if (navigator.userAgentData?.getHighEntropyValues) {
            const hints = await navigator.userAgentData.getHighEntropyValues(["architecture"]);
            if (hints.architecture === "arm") return "mac-silicon";
            if (hints.architecture === "x86") return "mac-intel";
          }
        } catch {
          // High-entropy hints not available or blocked — fall through
        }

        // Fallback: UA string rarely contains arch on macOS, but check anyway
        if (userAgent.includes("arm64") || userAgent.includes("aarch64")) {
          return "mac-silicon";
        }

        // Cannot reliably detect — default to Intel (safer: Rosetta can run
        // Intel builds on Apple Silicon, but Apple Silicon builds won't run on Intel)
        return "mac-intel";
      } else if (userAgent.includes("win") || platform.includes("win")) {
        return "windows";
      } else if (userAgent.includes("linux") || platform.includes("linux")) {
        return "linux";
      }
      return null;
    };

    detectPlatform().then((platform) => {
      setDetectedPlatform(platform);
      if (platform && !hasDownloaded.current) {
        hasDownloaded.current = true;
        triggerDownload(platform);
      }
    });
  }, []);

  const triggerDownload = (platform: Platform) => {
    if (!platform) return;
    const url = DOWNLOAD_URLS[platform];
    window.open(url, "_blank");
  };

  const handleManualDownload = () => {
    if (detectedPlatform) {
      triggerDownload(detectedPlatform);
    }
  };

  return (
    <main className="min-h-screen flex flex-col md:flex-row bg-[#fafafa]">
      {/* Left side - Download Confirmation */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-white">
        <div className="w-full max-w-sm text-center">
          {/* Success Icon */}
          <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mb-6 mx-auto">
            <Check className="w-8 h-8 text-cyan-500" />
          </div>

          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-3 tracking-tight leading-tight">
            Download started
          </h1>

          <p className="text-[0.95rem] text-gray-500 mb-8 leading-relaxed">
            Thanks for downloading OSCAR!
          </p>

          {/* Manual download link */}
          <button
            onClick={handleManualDownload}
            className="text-sm text-cyan-600 hover:text-cyan-700 underline underline-offset-2"
          >
            Download didn&apos;t start? Click here
          </button>

          {/* Mac architecture selector — shown only for Mac users */}
          {(detectedPlatform === "mac-intel" || detectedPlatform === "mac-silicon") && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide font-medium">
                Not sure which version downloaded?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => triggerDownload("mac-silicon")}
                  className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border text-sm transition-colors ${
                    detectedPlatform === "mac-silicon"
                      ? "border-cyan-500 bg-cyan-50 text-cyan-700 font-medium"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span>Mac (Apple Silicon)</span>
                  <span className="text-xs text-gray-400">M1 / M2 / M3 / M4</span>
                </button>
                <button
                  onClick={() => triggerDownload("mac-intel")}
                  className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border text-sm transition-colors ${
                    detectedPlatform === "mac-intel"
                      ? "border-cyan-500 bg-cyan-50 text-cyan-700 font-medium"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span>Mac (Intel)</span>
                  <span className="text-xs text-gray-400">2019 and earlier</span>
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Not sure?{" "}
                <a
                  href="https://support.apple.com/en-us/116943"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-600 hover:underline"
                >
                  Check your Mac chip
                </a>
              </p>
            </div>
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
