"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SparklesCore } from "@/components/ui/sparkles";

// Cover Showcase component matching desktop startup screen
function CoverShowcase() {
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

      {/* Slide 1: Speed */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-600 ease-out ${
          currentSlide === 0 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8 pointer-events-none"
        }`}
      >
        <div className="relative z-10 text-center text-white max-w-md">
          <p className="text-sm text-white/70 mb-2 tracking-wide">Using OSCAR</p>
          <h2 className="text-2xl md:text-3xl font-medium mb-4 font-serif italic">4x faster than typing</h2>
          <div className="mb-8">
            <span className="text-5xl md:text-6xl font-light font-serif">220 wpm</span>
          </div>
          <p className="text-sm text-white/60 italic leading-relaxed mb-8">
            &ldquo;Just started with the project, how would you like to set up the file? Here are a few options...&rdquo;
          </p>
          {/* Waveform */}
          <div className="flex items-center justify-center gap-1 h-10">
            {[12, 20, 28, 36, 28, 20, 28, 16].map((height, i) => (
              <div
                key={i}
                className="w-[3px] bg-white/40 rounded-full animate-waveform"
                style={{
                  height: `${height}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Slide 2: Warp Speed */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-600 ease-out ${
          currentSlide === 1 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8 pointer-events-none"
        }`}
      >
        <div className="relative z-10 text-center text-white max-w-md">
          <p className="text-sm text-white/70 mb-2 tracking-wide">Experience the future</p>
          <h2 className="text-2xl md:text-3xl font-medium mb-4 font-serif italic">
            Write at <span className="text-cyan-300">warp speed</span>
          </h2>
          <div className="mb-8">
            <span className="text-3xl md:text-4xl font-light font-serif text-white/90">AI-powered</span>
          </div>
          <p className="text-sm text-white/60 italic leading-relaxed mb-8">
            Transform your thoughts into text instantly. Just speak naturally and let OSCAR do the rest.
          </p>
          {/* Waveform */}
          <div className="flex items-center justify-center gap-1 h-10">
            {[12, 20, 28, 36, 28, 20, 28, 16].map((height, i) => (
              <div
                key={i}
                className="w-[3px] bg-white/40 rounded-full animate-waveform"
                style={{
                  height: `${height}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Slide 3: Anywhere */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-600 ease-out ${
          currentSlide === 2 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8 pointer-events-none"
        }`}
      >
        <div className="relative z-10 text-center text-white max-w-md">
          <p className="text-sm text-white/70 mb-2 tracking-wide">Works everywhere</p>
          <h2 className="text-2xl md:text-3xl font-medium mb-4 font-serif italic">Use in any app</h2>
          <div className="mb-8">
            <span className="text-2xl md:text-3xl font-light font-serif text-white/90">Global shortcut</span>
          </div>
          <p className="text-sm text-white/60 italic leading-relaxed mb-8">
            Hold <kbd className="px-2 py-1 bg-white/10 rounded text-white/80 font-mono text-xs">Ctrl</kbd>+
            <kbd className="px-2 py-1 bg-white/10 rounded text-white/80 font-mono text-xs">Space</kbd> to start dictating. Works in Slack, Notion, VS Code, and everywhere else.
          </p>
          {/* Waveform */}
          <div className="flex items-center justify-center gap-1 h-10">
            {[12, 20, 28, 36, 28, 20, 28, 16].map((height, i) => (
              <div
                key={i}
                className="w-[3px] bg-white/40 rounded-full animate-waveform"
                style={{
                  height: `${height}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Slide Indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2.5 z-20">
        {Array.from({ length: totalSlides }).map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              currentSlide === index ? "w-6 bg-white" : "w-2 bg-white/30 hover:bg-white/50"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function AuthFormInner() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirectTo") ?? "/";
  const { signInWithGoogle, isLoading: authLoading } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Show server-provided error from callback redirect
  const errorParam = searchParams?.get("error");
  const initialError = errorParam ? decodeURIComponent(errorParam) : null;

  const handleGoogleSignIn = async () => {
    setError(initialError);
    setIsSubmitting(true);
    try {
      await signInWithGoogle(redirectTo);
      // Redirect handled by Supabase, this code may not run
    } catch {
      setError("Failed to start Google sign-in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <Spinner className="text-cyan-500" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col md:flex-row bg-[#fafafa]">
      {/* Left side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-white">
        <div className="w-full max-w-sm">
          {/* Brand Header */}
          {/* <div className="flex items-center gap-2.5 mb-8">
            <img src="/OSCAR_LIGHT_LOGO.png" alt="OSCAR" width="36" height="36" />
            <span className="text-lg font-semibold text-gray-900 tracking-tight">OSCAR</span>
          </div> */}

          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-3 tracking-tight leading-tight">
            Let&apos;s get you started
          </h1>
          <p className="text-[0.95rem] text-gray-500 mb-8 leading-relaxed">
            Write faster in every app using your voice. Sign in with Google to sync your dictionary and enable AI editing.
          </p>

          {initialError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{initialError}</p>
            </div>
          )}

          {error && !initialError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <Button
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full bg-white text-gray-700 hover:bg-gray-50 font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border border-gray-200 shadow-sm min-h-[48px]"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner className="w-5 h-5" />
                Connecting…
              </span>
            ) : (
              <>
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </Button>

          <p className="text-xs text-gray-400 text-center mt-4">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>

      {/* Right side - Cover Showcase */}
      <div className="hidden md:flex flex-1 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
        <CoverShowcase />
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black">
          <Spinner className="text-cyan-500" />
        </main>
      }
    >
      <AuthFormInner />
    </Suspense>
  );
}
