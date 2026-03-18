"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

function DesktopCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Get tokens from URL fragment (after #) - this is where Supabase puts them
    const hash = window.location.hash.substring(1); // Remove the # prefix
    const params = new URLSearchParams(hash);
    
    // Get state from query params (it was added to redirectTo URL)
    const queryParams = new URLSearchParams(window.location.search);
    const desktopState = queryParams.get("desktop_state");
    
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const expiresIn = params.get("expires_in");
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    if (error) {
      // Redirect to desktop app with error
      window.location.href = `oscar://auth/callback?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || "")}`;
      return;
    }

    if (accessToken && refreshToken) {
      // Redirect to desktop app with tokens (include state for validation)
      const redirectUrl = `oscar://auth/callback?success=true&access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&expires_in=${expiresIn || "3600"}${desktopState ? `&state=${encodeURIComponent(desktopState)}` : ""}`;
      window.location.href = redirectUrl;
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
  }, [searchParams]);

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
