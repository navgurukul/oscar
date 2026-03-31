"use client";

import { useEffect, Suspense, useState, useRef } from "react";

// Force dynamic rendering to avoid prerendering at build time
export const dynamic = "force-dynamic";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";

function DesktopCallbackContent() {
  const searchParams = useSearchParams();
  // "ready" = show Open Oscar button, "error" = show error, "loading" = processing
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const didRun = useRef(false);

  useEffect(() => {
    // Strict-mode guard — only run once
    if (didRun.current) return;
    didRun.current = true;

    async function handleCallback() {
      // Tokens come in the URL fragment (#) — that's where Supabase puts them
      const hash = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hash);

      const queryParams = new URLSearchParams(window.location.search);
      const desktopState = queryParams.get("desktop_state");

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const expiresIn = hashParams.get("expires_in");
      const authError = hashParams.get("error");
      const errorDescription = hashParams.get("error_description");

      if (authError) {
        const url = `oscar://auth/callback?error=${encodeURIComponent(authError)}&error_description=${encodeURIComponent(errorDescription || "")}`;
        setDeepLinkUrl(url);
        setErrorMessage(decodeURIComponent(errorDescription || authError));
        setState("error");
        return;
      }

      if (accessToken && refreshToken) {
        // Establish the web session so the web app is also logged in
        try {
          const supabase = createClient();
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } catch (err) {
          console.error(
            "[desktop-callback] Failed to establish web session:",
            err,
          );
          // Non-fatal — still open the desktop app
        }

        const url = [
          `oscar://auth/callback?success=true`,
          `&access_token=${encodeURIComponent(accessToken)}`,
          `&refresh_token=${encodeURIComponent(refreshToken)}`,
          `&expires_in=${expiresIn || "3600"}`,
          desktopState ? `&state=${encodeURIComponent(desktopState)}` : "",
        ].join("");

        setDeepLinkUrl(url);
        setState("ready");
        return;
      }

      // Authorization-code flow — hand off to the server callback
      const code = searchParams.get("code");
      if (code) {
        window.location.href = `/auth/callback?code=${encodeURIComponent(code)}&desktop=true${desktopState ? `&desktop_state=${encodeURIComponent(desktopState)}` : ""}`;
        return;
      }

      // Nothing usable
      setDeepLinkUrl("oscar://auth/callback?error=no_tokens");
      setErrorMessage(
        "No authentication tokens were received. Please try signing in again.",
      );
      setState("error");
    }

    handleCallback();
  }, [searchParams]);

  // Once the deep link URL is ready, try opening it automatically.
  // Browsers may block this (not a user gesture), so we always show the
  // manual button too — that click IS a user gesture and will always work.
  useEffect(() => {
    if (deepLinkUrl) {
      window.location.href = deepLinkUrl;
    }
  }, [deepLinkUrl]);

  const openDesktopApp = () => {
    if (deepLinkUrl) {
      window.location.href = deepLinkUrl;
    }
  };

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black">
        <div className="text-center">
          <Spinner className="text-cyan-500 mx-auto mb-4" />
          <p className="text-gray-400">Completing authentication…</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black">
        <div className="text-center max-w-sm px-6">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-white font-semibold text-lg mb-2">
            Authentication failed
          </h2>
          <p className="text-gray-400 text-sm mb-6">{errorMessage}</p>
          <a
            href="/auth"
            className="inline-block px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Try again
          </a>
        </div>
      </div>
    );
  }

  // state === "ready"
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black">
      <div className="text-center max-w-sm px-6">
        {/* Success check */}
        <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-5">
          <svg
            className="w-6 h-6 text-cyan-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h2 className="text-white font-semibold text-xl mb-2">
          You&apos;re signed in
        </h2>
        <p className="text-gray-400 text-sm mb-7">
          Click the button below to open the Oscar desktop app.
        </p>

        <button
          onClick={openDesktopApp}
          className="w-full py-3 px-5 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-gray-950 text-sm font-semibold rounded-lg transition-colors"
        >
          Open Oscar
        </button>

        <p className="mt-4 text-xs text-gray-600">
          If Oscar doesn&apos;t open,{" "}
          <a
            href="/download"
            className="text-gray-400 hover:text-gray-300 underline"
          >
            download the app
          </a>{" "}
          first.
        </p>
      </div>
    </div>
  );
}

export default function DesktopCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black">
          <Spinner className="text-cyan-500" />
        </div>
      }
    >
      <DesktopCallbackContent />
    </Suspense>
  );
}
