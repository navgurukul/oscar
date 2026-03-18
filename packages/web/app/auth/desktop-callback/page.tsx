"use client";

import { useEffect, Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";

function DesktopCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      // Get tokens from URL fragment (after #) - this is where Supabase puts them
      const hash = window.location.hash.substring(1); // Remove the # prefix
      const params = new URLSearchParams(hash);
      
      // Get state from query params (it was added to redirectTo URL)
      const queryParams = new URLSearchParams(window.location.search);
      const desktopState = queryParams.get("desktop_state");
      
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const expiresIn = params.get("expires_in");
      const authError = params.get("error");
      const errorDescription = params.get("error_description");

      if (authError) {
        // Trigger deep link to desktop app with error
        window.location.href = `oscar://auth/callback?error=${encodeURIComponent(authError)}&error_description=${encodeURIComponent(errorDescription || "")}`;
        // Navigate browser to auth page with error after a short delay
        setTimeout(() => {
          router.replace(`/auth?error=${encodeURIComponent(authError)}`);
        }, 500);
        return;
      }

      if (accessToken && refreshToken) {
        // Establish web session before redirecting to desktop app
        // This ensures both apps end up authenticated
        try {
          const supabase = createClient();
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } catch (err) {
          // Log error and redirect to auth with error
          console.error("Failed to establish web session:", err);
          const errorMessage = err instanceof Error ? err.message : "Failed to establish session";
          setError(errorMessage);
          router.replace(`/auth?error=${encodeURIComponent(errorMessage)}`);
          return;
        }

        // Trigger deep link to desktop app with tokens (include state for validation)
        // Note: This opens the desktop app but browser stays on this page
        const deepLinkUrl = `oscar://auth/callback?success=true&access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&expires_in=${expiresIn || "3600"}${desktopState ? `&state=${encodeURIComponent(desktopState)}` : ""}`;
        window.location.href = deepLinkUrl;
        
        // After triggering deep link, navigate browser to home page
        // Small delay to give OS time to process the deep link
        setTimeout(() => {
          router.replace("/");
        }, 500);
        return;
      }

      // If no tokens in fragment, check if there's a code in query params (authorization code flow)
      const code = searchParams.get("code");
      if (code) {
        // Let the server handle it via the regular callback route (pass state for validation)
        window.location.href = `/auth/callback?code=${encodeURIComponent(code)}&desktop=true${desktopState ? `&desktop_state=${encodeURIComponent(desktopState)}` : ""}`;
        return;
      }

      // No tokens or code - something went wrong
      window.location.href = "oscar://auth/callback?error=no_tokens";
      // Navigate browser to auth page with error
      setTimeout(() => {
        router.replace("/auth?error=no_tokens");
      }, 500);
    }

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black">
      <div className="text-center">
        <Spinner className="text-cyan-500 mx-auto mb-4" />
        <p className="text-gray-400">Completing authentication...</p>
      </div>
    </div>
  );
}

export default function DesktopCallbackPage() {
  return (
    <Suspense fallback={<Spinner className="text-cyan-500" />}>
      <DesktopCallbackContent />
    </Suspense>
  );
}
