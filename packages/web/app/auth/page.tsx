"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import {
  v2,
  v2Serif,
  V2Caps,
  V2Wordmark,
} from "@/components/v2/V2Primitives";

function AuthFormInner() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirectTo") ?? "/";
  const { signInWithGoogle, isLoading: authLoading } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errorParam = searchParams?.get("error");
  const initialError = errorParam ? decodeURIComponent(errorParam) : null;

  const handleGoogleSignIn = async () => {
    setError(initialError);
    setIsSubmitting(true);
    try {
      await signInWithGoogle(redirectTo);
    } catch {
      setError("Failed to start Google sign-in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: v2.cream }}
      >
        <Spinner />
      </main>
    );
  }

  return (
    <main
      className="min-h-screen grid grid-cols-1 md:grid-cols-12"
      style={{ background: v2.cream, color: v2.ink, fontFamily: "var(--font-figtree), system-ui" }}
    >
      {/* Left — form */}
      <div className="md:col-span-6 px-6 md:px-16 py-10 md:py-12 flex flex-col">
        <V2Wordmark />
        <div className="flex-1 flex flex-col justify-center py-12" style={{ maxWidth: 460 }}>
          <V2Caps>SIGN IN · WELCOME BACK</V2Caps>
          <h1
            className="mt-3"
            style={{
              fontFamily: v2Serif,
              fontSize: "clamp(40px, 6vw, 56px)",
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
              fontWeight: 500,
            }}
          >
            Pick up where<br />
            you <em style={{ fontStyle: "italic", color: v2.accent }}>left off</em>.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Continue with Google to sync your Scribbles, vocabulary, and Minutes across web and
            desktop.
          </p>

          {(initialError || error) && (
            <div
              className="mt-6 p-3 rounded-lg text-[13px]"
              style={{ background: "rgba(184,98,61,0.08)", border: `1px solid ${v2.accent}`, color: v2.accent }}
            >
              {initialError || error}
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="mt-8 inline-flex items-center justify-center gap-3 rounded-full px-6 py-4 text-[14px] font-medium transition disabled:opacity-60"
            style={{ background: v2.ink, color: v2.cream }}
          >
            {isSubmitting ? (
              <>
                <Spinner className="w-4 h-4" />
                Connecting…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92a8.78 8.78 0 0 0 2.68-6.61z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26a5.4 5.4 0 0 1-3.05.86c-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0a9 9 0 0 0-8.04 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </button>
          <p
            className="mt-4 text-center text-[12px]"
            style={{ color: v2.inkFaint }}
          >
            No account yet? Same button — we&rsquo;ll create one for you.
          </p>
        </div>
        <V2Caps>
          BY SIGNING IN YOU AGREE TO THE{" "}
          <Link href="/terms" className="underline">TERMS</Link>
          {" "}AND{" "}
          <Link href="/privacy" className="underline">PRIVACY POLICY</Link>
        </V2Caps>
      </div>

      {/* Right — pull-quote stage */}
      <div
        className="hidden md:flex md:col-span-6 px-16 py-12 flex-col"
        style={{ background: v2.night, color: v2.cream }}
      >
        <V2Caps color="#7a7670">A QUIET PROMISE</V2Caps>
        <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: 520 }}>
          <p
            style={{
              fontFamily: v2Serif,
              fontSize: 44,
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
              color: v2.cream,
              fontWeight: 500,
            }}
          >
            &ldquo;The fastest writing tool I&rsquo;ve owned is the one I never have to{" "}
            <em style={{ fontStyle: "italic", color: v2.accent }}>type with</em>.&rdquo;
          </p>
          <div className="mt-9 flex items-center gap-3">
            <div style={{ height: 36, width: 36, borderRadius: 999, background: v2.accent }} />
            <div>
              <div style={{ fontFamily: v2Serif, fontSize: 17, color: v2.cream }}>Mira Patel</div>
              <V2Caps color="#7a7670">DESIGNER · OSCAR USER SINCE 2025</V2Caps>
            </div>
          </div>
        </div>
        <V2Caps color="#7a7670">OSCAR · STREAM · MINUTES · SCRIBBLE</V2Caps>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main
          className="min-h-screen flex items-center justify-center"
          style={{ background: v2.cream }}
        >
          <Spinner />
        </main>
      }
    >
      <AuthFormInner />
    </Suspense>
  );
}
