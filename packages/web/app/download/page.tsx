"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  v2,
  v2Serif,
  v2Mono,
  V2Caps,
  V2Mono,
  V2Wordmark,
} from "@/components/v2/V2Primitives";

// Platform type definition
type Platform = "mac-intel" | "mac-silicon" | "windows" | "linux" | null;

// Download configuration - GitHub Releases
const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO ?? "navgurukul/oscar";
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.5.26";
const GITHUB_RELEASE_BASE = `https://github.com/${GITHUB_REPO}/releases/download/v${APP_VERSION}`;

const DOWNLOAD_URLS: Record<Exclude<Platform, null>, string> = {
  "mac-intel": `${GITHUB_RELEASE_BASE}/OSCAR_${APP_VERSION}_x64.dmg`,
  "mac-silicon": `${GITHUB_RELEASE_BASE}/OSCAR_${APP_VERSION}_aarch64.dmg`,
  windows: `${GITHUB_RELEASE_BASE}/OSCAR_${APP_VERSION}_x64-setup.exe`,
  linux: `${GITHUB_RELEASE_BASE}/OSCAR_${APP_VERSION}_amd64.AppImage`,
};

const PLATFORM_LABELS: Record<Exclude<Platform, null>, { eyebrow: string; file: string }> = {
  "mac-silicon": {
    eyebrow: "DETECTED · MAC · APPLE SILICON",
    file: `OSCAR_${APP_VERSION}_aarch64.dmg`,
  },
  "mac-intel": {
    eyebrow: "DETECTED · MAC · INTEL",
    file: `OSCAR_${APP_VERSION}_x64.dmg`,
  },
  windows: {
    eyebrow: "DETECTED · WINDOWS",
    file: `OSCAR_${APP_VERSION}_x64-setup.exe`,
  },
  linux: {
    eyebrow: "DETECTED · LINUX",
    file: `OSCAR_${APP_VERSION}_amd64.AppImage`,
  },
};

const SLIDES = [
  {
    eyebrow: "WORKS OFFLINE",
    big: "100% local",
    title: "No internet needed.",
    body: "Whisper AI runs entirely on your device. Your voice never leaves your computer.",
  },
  {
    eyebrow: "WORKS EVERYWHERE",
    big: "Global shortcut",
    title: (
      <>
        Press{" "}
        <V2Mono
          style={{
            background: "rgba(184,98,61,0.18)",
            padding: "1px 8px",
            borderRadius: 4,
            color: v2.accentSoft,
          }}
        >
          Fn
        </V2Mono>{" "}
        to record.
      </>
    ),
    body: "Start recording from any app, any window. No need to switch contexts.",
  },
  {
    eyebrow: "OPTIONAL CLOUD AI",
    big: "AI polish",
    title: "Perfect formatting.",
    body: "Enable cloud AI to remove filler words, fix grammar, and structure your Scribbles beautifully.",
  },
] as const;

export default function DownloadPage() {
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const hasDownloaded = useRef(false);

  useEffect(() => {
    if (hasDownloaded.current) return;

    const detectPlatform = async (): Promise<Platform> => {
      const userAgent = navigator.userAgent.toLowerCase();
      const platform = navigator.platform.toLowerCase();

      if (userAgent.includes("mac") || platform.includes("mac")) {
        try {
          if (navigator.userAgentData?.getHighEntropyValues) {
            const hints = await navigator.userAgentData.getHighEntropyValues(["architecture"]);
            if (hints.architecture === "arm") return "mac-silicon";
            if (hints.architecture === "x86") return "mac-intel";
          }
        } catch {
          // ignore
        }
        if (userAgent.includes("arm64") || userAgent.includes("aarch64")) return "mac-silicon";
        return "mac-intel";
      } else if (userAgent.includes("win") || platform.includes("win")) {
        return "windows";
      } else if (userAgent.includes("linux") || platform.includes("linux")) {
        return "linux";
      }
      return null;
    };

    detectPlatform().then((p) => {
      setDetectedPlatform(p);
      if (p && !hasDownloaded.current) {
        hasDownloaded.current = true;
        triggerDownload(p);
      }
    });
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCurrentSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const triggerDownload = (p: Platform) => {
    if (!p) return;
    window.open(DOWNLOAD_URLS[p], "_blank");
  };

  const handleManualDownload = () => {
    if (detectedPlatform) triggerDownload(detectedPlatform);
  };

  const isMac = detectedPlatform === "mac-intel" || detectedPlatform === "mac-silicon";
  const detectedLabel = detectedPlatform ? PLATFORM_LABELS[detectedPlatform] : null;
  const slide = SLIDES[currentSlide];

  return (
    <main
      style={{
        background: v2.cream,
        color: v2.ink,
        minHeight: "100vh",
        fontFamily: "var(--font-figtree), system-ui",
      }}
    >
      <header className="flex items-center justify-between px-6 md:px-14 py-7">
        <V2Wordmark />
        <nav className="hidden md:flex items-center gap-9">
          <Link href="/"><V2Caps>PRODUCT</V2Caps></Link>
          <Link href="/pricing"><V2Caps>PRICING</V2Caps></Link>
          <Link href="/auth"><V2Caps>SIGN IN</V2Caps></Link>
        </nav>
        <span
          style={{
            fontFamily: v2Mono,
            fontSize: 11,
            letterSpacing: "0.18em",
            color: v2.ink,
            borderBottom: `1px solid ${v2.ink}`,
            paddingBottom: 2,
          }}
        >
          DOWNLOAD
        </span>
      </header>

      <section
        className="grid grid-cols-1 lg:grid-cols-2 px-6 md:px-14 pt-8 md:pt-10 pb-14 gap-10 lg:gap-14"
        style={{ borderTop: `1px solid ${v2.rule}` }}
      >
        {/* LEFT — confirmation + arch picker */}
        <div className="flex flex-col" style={{ minHeight: 620 }}>
          <V2Caps color={v2.accent}>
            {detectedPlatform ? `DOWNLOAD STARTED · OSCAR ${APP_VERSION}` : "DETECTING…"}
          </V2Caps>
          <h1
            className="mt-3"
            style={{
              fontFamily: v2Serif,
              fontSize: "clamp(48px, 8vw, 76px)",
              lineHeight: 0.96,
              letterSpacing: "-0.025em",
              fontWeight: 500,
            }}
          >
            Oscar is on its <em style={{ fontStyle: "italic", color: v2.accent }}>way</em>.
          </h1>
          <p className="mt-6 text-[16px] leading-relaxed" style={{ color: v2.inkSoft, maxWidth: 480 }}>
            We detected your machine and started the right build. While you wait, take a look at what
            makes the desktop app different from the web.
          </p>

          <div
            className="mt-8 rounded-md px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
            style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-block rounded-full"
                style={{ height: 10, width: 10, background: v2.accent }}
              />
              <div>
                <V2Caps>{detectedLabel?.eyebrow ?? "DETECTING…"}</V2Caps>
                <V2Mono
                  style={{ display: "block", fontSize: 12, color: v2.ink, marginTop: 4 }}
                >
                  {detectedLabel?.file ?? "Determining build…"}
                </V2Mono>
              </div>
            </div>
            <button
              onClick={handleManualDownload}
              disabled={!detectedPlatform}
              className="text-[12px] rounded-full px-4 py-2 disabled:opacity-50"
              style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
            >
              Didn&rsquo;t start? Click again
            </button>
          </div>

          {isMac && (
            <div className="mt-7">
              <V2Caps>NOT SURE WHICH MAC YOU HAVE</V2Caps>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  onClick={() => triggerDownload("mac-silicon")}
                  className="rounded-md px-4 py-3.5 text-left"
                  style={{
                    background: v2.cream,
                    border: `1px solid ${
                      detectedPlatform === "mac-silicon" ? v2.accent : v2.rule
                    }`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      style={{
                        fontSize: 14,
                        color: detectedPlatform === "mac-silicon" ? v2.ink : v2.inkSoft,
                        fontWeight: detectedPlatform === "mac-silicon" ? 500 : 400,
                      }}
                    >
                      Apple Silicon
                    </span>
                    {detectedPlatform === "mac-silicon" ? (
                      <V2Mono style={{ fontSize: 11, color: v2.accent }}>CHOSEN</V2Mono>
                    ) : (
                      <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>→</V2Mono>
                    )}
                  </div>
                  <V2Caps>M1 · M2 · M3 · M4</V2Caps>
                </button>
                <button
                  onClick={() => triggerDownload("mac-intel")}
                  className="rounded-md px-4 py-3.5 text-left"
                  style={{
                    background: v2.cream,
                    border: `1px solid ${
                      detectedPlatform === "mac-intel" ? v2.accent : v2.rule
                    }`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      style={{
                        fontSize: 14,
                        color: detectedPlatform === "mac-intel" ? v2.ink : v2.inkSoft,
                        fontWeight: detectedPlatform === "mac-intel" ? 500 : 400,
                      }}
                    >
                      Intel
                    </span>
                    {detectedPlatform === "mac-intel" ? (
                      <V2Mono style={{ fontSize: 11, color: v2.accent }}>CHOSEN</V2Mono>
                    ) : (
                      <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>→</V2Mono>
                    )}
                  </div>
                  <V2Caps>2019 AND EARLIER</V2Caps>
                </button>
              </div>
              <p className="mt-3 text-[12px]" style={{ color: v2.inkFaint }}>
                Not sure?{" "}
                <a
                  href="https://support.apple.com/en-us/116943"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: v2.accent }}
                >
                  Check your Mac chip →
                </a>
              </p>
            </div>
          )}

          <div
            className="mt-auto pt-9 grid grid-cols-2 md:grid-cols-4 gap-3"
            style={{ borderTop: `1px solid ${v2.rule}` }}
          >
            {(
              [
                ["MAC ARM", "aarch64.dmg", "mac-silicon"],
                ["MAC X64", "x64.dmg", "mac-intel"],
                ["WINDOWS", "x64-setup.exe", "windows"],
                ["LINUX", "amd64.AppImage", "linux"],
              ] as const
            ).map(([k, fname, p]) => (
              <button
                key={k}
                onClick={() => triggerDownload(p)}
                className="text-left"
              >
                <V2Caps>{k}</V2Caps>
                <V2Mono
                  style={{ display: "block", fontSize: 11, color: v2.ink, marginTop: 4 }}
                >
                  {fname}
                </V2Mono>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT — showcase slide on dark stage */}
        <div
          className="rounded-lg overflow-hidden flex flex-col relative"
          style={{ background: v2.night, color: v2.cream, minHeight: 620, padding: 40 }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(60% 50% at 30% 30%, rgba(184,98,61,0.18), transparent 70%)",
            }}
          />
          <V2Caps color={v2.accentSoft}>
            SHOWCASE · SLIDE 0{currentSlide + 1} / 0{SLIDES.length}
          </V2Caps>
          <div className="mt-auto relative">
            <V2Caps color={v2.accentSoft}>{slide.eyebrow}</V2Caps>
            <h2
              className="mt-4"
              style={{
                fontFamily: v2Serif,
                fontStyle: "italic",
                fontSize: "clamp(40px, 6vw, 64px)",
                lineHeight: 0.98,
                letterSpacing: "-0.02em",
                fontWeight: 500,
              }}
            >
              {slide.title}
            </h2>
            <p
              className="mt-5 text-[16px] leading-relaxed"
              style={{
                color: "rgba(247,244,238,0.7)",
                maxWidth: 380,
                fontStyle: "italic",
                fontFamily: v2Serif,
              }}
            >
              {slide.body}
            </p>
            <div className="mt-9 flex items-center gap-2">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className="rounded-full transition-all"
                  style={{
                    height: 6,
                    width: i === currentSlide ? 22 : 6,
                    background:
                      i === currentSlide ? v2.cream : "rgba(247,244,238,0.3)",
                  }}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
              <V2Mono
                style={{
                  marginLeft: 14,
                  fontSize: 10,
                  color: "rgba(247,244,238,0.45)",
                  letterSpacing: "0.16em",
                }}
              >
                AUTO · 5s
              </V2Mono>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 md:px-14 pb-16 md:pb-20">
        <V2Caps>THE THREE PROMO SLIDES · ROTATE EVERY 5 SECONDS</V2Caps>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-6">
          {SLIDES.map((s, i) => (
            <div
              key={i}
              className="rounded-lg overflow-hidden p-7"
              style={{ background: v2.night, color: v2.cream, minHeight: 220 }}
            >
              <V2Caps color={v2.accentSoft}>{s.eyebrow}</V2Caps>
              <div
                className="mt-4"
                style={{
                  fontFamily: v2Serif,
                  fontSize: 28,
                  fontStyle: "italic",
                  lineHeight: 1.05,
                  fontWeight: 500,
                  letterSpacing: "-0.015em",
                }}
              >
                {s.title}
              </div>
              <p
                className="mt-4 text-[12.5px] leading-relaxed"
                style={{ color: "rgba(247,244,238,0.65)" }}
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
