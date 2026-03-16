"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  Download,
  Apple,
  Monitor,
  Laptop,
  Check,
  Sparkles,
  Mic,
  Brain,
  Keyboard,
  Globe,
} from "lucide-react";

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
  },
  "mac-silicon": {
    name: "Apple Silicon",
    icon: Apple,
    description: "For Macs with M1, M2, or M3 chips",
    fileSize: "~150 MB",
  },
  windows: {
    name: "Windows",
    icon: Monitor,
    description: "Windows 10 or later",
    fileSize: "~120 MB",
  },
  linux: {
    name: "Linux",
    icon: Laptop,
    description: "Most Linux distributions",
    fileSize: "~130 MB",
  },
};

const DESKTOP_FEATURES = [
  {
    icon: Keyboard,
    title: "Global Shortcut",
    description: "Press Fn to start recording from anywhere",
  },
  {
    icon: Mic,
    title: "Works Offline",
    description: "Local transcription with Whisper AI",
  },
  {
    icon: Brain,
    title: "AI Enhancement",
    description: "Optional cloud AI for perfect formatting",
  },
  {
    icon: Globe,
    title: "Auto-Updates",
    description: "Always stay on the latest version",
  },
];

export default function DownloadPage() {
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>(null);
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    // Detect platform from user agent
    const detectPlatform = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const platform = navigator.platform.toLowerCase();

      if (userAgent.includes("mac") || platform.includes("mac")) {
        // Check for Apple Silicon
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
    setIsDetecting(false);
  }, []);

  const handleDownload = (platform: Platform) => {
    if (!platform) return;
    const url = DOWNLOAD_URLS[platform];
    const link = document.createElement("a");
    link.href = url;
    link.download = url.split("/").pop() || "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const DownloadCard = ({
    platform,
    isRecommended = false,
  }: {
    platform: Exclude<Platform, null>;
    isRecommended?: boolean;
  }) => {
    const info = PLATFORM_INFO[platform];
    const Icon = info.icon;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`relative bg-slate-900 border rounded-2xl p-6 transition-all hover:border-cyan-500/50 ${
          isRecommended
            ? "border-cyan-500/50 ring-1 ring-cyan-500/50"
            : "border-cyan-700/30"
        }`}
      >
        {isRecommended && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="px-3 py-1 text-xs font-medium bg-cyan-500 text-white rounded-full">
              Recommended
            </span>
          </div>
        )}

        <div className="text-center">
          <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon className="w-8 h-8 text-cyan-400" />
          </div>

          <h3 className="text-xl font-bold text-white mb-2">{info.name}</h3>
          <p className="text-gray-400 text-sm mb-2">{info.description}</p>
          <p className="text-gray-500 text-xs mb-6">{info.fileSize}</p>

          <Button
            onClick={() => handleDownload(platform)}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
            size="lg"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </motion.div>
    );
  };

  return (
    <main className="min-h-screen py-16 px-4 mt-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 mt-7 pt-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 mt-3">
              Download <span className="text-cyan-500">OSCAR</span> Desktop
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              The fastest way to capture your thoughts. Works entirely on your
              device with optional AI enhancement.
            </p>
          </motion.div>
        </div>

        {/* Platform Detection Status */}
        {isDetecting ? (
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              Detecting your platform...
            </div>
          </div>
        ) : detectedPlatform ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="max-w-md mx-auto mb-16"
          >
            <DownloadCard platform={detectedPlatform} isRecommended />
          </motion.div>
        ) : null}

        {/* All Platforms Grid */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            All Platforms
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {(Object.keys(PLATFORM_INFO) as Array<keyof typeof PLATFORM_INFO>)
              .filter((p) => p !== detectedPlatform)
              .map((platform) => (
                <DownloadCard key={platform} platform={platform} />
              ))}
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Why Use the Desktop App?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {DESKTOP_FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="bg-slate-900/50 border border-cyan-700/20 rounded-xl p-6 text-center"
                >
                  <div className="w-12 h-12 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Getting Started
          </h2>
          <div className="max-w-3xl mx-auto">
            <div className="space-y-6">
              {[
                {
                  step: 1,
                  title: "Download & Install",
                  description:
                    "Download the app for your platform and install it like any other application.",
                },
                {
                  step: 2,
                  title: "Set Up (One-time)",
                  description:
                    "The app downloads the AI model on first launch. This happens once and takes about a minute.",
                },
                {
                  step: 3,
                  title: "Start Recording",
                  description:
                    "Press Fn key from anywhere to start recording. Press again to stop. Your note is ready instantly.",
                },
              ].map((item, index) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="flex gap-4 items-start"
                >
                  <div className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">{item.step}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {item.title}
                    </h3>
                    <p className="text-gray-400">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Free vs Pro */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Free vs Pro
          </h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="bg-slate-900/50 border border-cyan-700/30 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Free</h3>
              <ul className="space-y-3">
                {[
                  "Local transcription (works offline)",
                  "10 recordings per month",
                  "Up to 50 notes",
                  "Custom vocabulary (up to 20 entries)",
                  "Basic AI formatting",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-900/50 border border-cyan-500/50 rounded-xl p-6 relative">
              <div className="absolute -top-3 left-6">
                <span className="px-3 py-1 text-xs font-medium bg-cyan-500 text-white rounded-full">
                  Recommended
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                Pro
              </h3>
              <ul className="space-y-3">
                {[
                  "Everything in Free",
                  "Unlimited recordings",
                  "Unlimited notes",
                  "Unlimited vocabulary",
                  "Priority AI processing",
                  "Priority support",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Common Questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "Is the desktop app really free?",
                a: "Yes! The desktop app is completely free to download and use. You get 10 recordings per month with local AI processing. Upgrade to Pro for unlimited recordings and cloud AI enhancement.",
              },
              {
                q: "Does it work offline?",
                a: "Absolutely. Once the AI model is downloaded (one-time setup), all transcription happens locally on your device. No internet required for recording and basic formatting.",
              },
              {
                q: "What is the Fn key shortcut?",
                a: "The Fn (Function) key is a global shortcut that works from anywhere on your computer. Press it to start recording, press again to stop. No need to switch to the app.",
              },
              {
                q: "How do updates work?",
                a: "The app automatically checks for updates and installs them in the background. You'll always have the latest features and improvements without manual downloads.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="bg-slate-900/50 border border-gray-800 rounded-lg p-6"
              >
                <h3 className="text-lg font-semibold text-white mb-2">
                  {item.q}
                </h3>
                <p className="text-gray-400">{item.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
