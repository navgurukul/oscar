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
      // Tokens come in the URL fragment (#) — that's where Supabase puts them.
      // Google code-flow returns params as query strings (?), not fragments.
      const hash = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hash);

      const queryParams = new URLSearchParams(window.location.search);
      const desktopState = queryParams.get("desktop_state");

      // Read from both hash (Supabase implicit) and query (Google code flow)
      const accessToken  = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const expiresIn    = hashParams.get("expires_in");
      const authError    = hashParams.get("error") || queryParams.get("error");
      const errorDescription =
        hashParams.get("error_description") || queryParams.get("error_description");
      const oauthState =
        hashParams.get("state") || queryParams.get("state") || "";

      // ── Calendar-only OAuth (PKCE authorization-code flow) ───────────────
      if (oauthState.startsWith("calendar_connect")) {
        if (authError) {
          const desc = errorDescription
            ? decodeURIComponent(errorDescription)
            : authError;
          const url = `oscar://auth/callback?error=${encodeURIComponent(authError)}`;
          setDeepLinkUrl(url);
          setErrorMessage(desc);
          setState("error");
          return;
        }

        // PKCE code flow: Google returns `code` as a query param (not fragment)
        const calendarCode = queryParams.get("code");
        if (calendarCode) {
          // Forward the code to the desktop; the app holds the code_verifier
          // in memory and will exchange it via the exchange-calendar-token edge fn.
          const url = `oscar://auth/callback?calendar_code=${encodeURIComponent(calendarCode)}`;
          setDeepLinkUrl(url);
          setState("ready");
          return;
        }

        // Legacy: implicit flow returned an access_token in the fragment
        if (accessToken) {
          const url = `oscar://auth/callback?calendar_token=${encodeURIComponent(accessToken)}`;
          setDeepLinkUrl(url);
          setState("ready");
          return;
        }

        setDeepLinkUrl("oscar://auth/callback?error=no_calendar_token");
        setErrorMessage("No calendar token received. Please try again.");
        setState("error");
        return;
      }

      if (authError) {
        const url = `oscar://auth/callback?error=${encodeURIComponent(authError)}&error_description=${encodeURIComponent(errorDescription || "")}`;
        setDeepLinkUrl(url);
        setErrorMessage(decodeURIComponent(errorDescription || authError));
        setState("error");
        return;
      }

      if (accessToken && refreshToken) {
        // provider_token (Google access token with calendar scope) may be in the hash
        const providerToken = hashParams.get("provider_token") || "";
        const providerRefreshToken =
          hashParams.get("provider_refresh_token") || "";

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
          providerToken ? `&provider_token=${encodeURIComponent(providerToken)}` : "",
          providerRefreshToken
            ? `&provider_refresh_token=${encodeURIComponent(providerRefreshToken)}`
            : "",
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

  // Auto-launch the desktop app via custom protocol once we know which deep
  // link to fire. The manual "Open Oscar" button below remains as a fallback
  // for browsers that gate custom-scheme navigation behind a user gesture
  // (or for users who dismissed the system "Open in Oscar?" prompt).
  // Skip auto-launch on the error path so the user can read the message.
  useEffect(() => {
    if (state !== "ready" || !deepLinkUrl) return;
    // Use replace() so the deep-link URL doesn't pollute browser history.
    window.location.replace(deepLinkUrl);
  }, [state, deepLinkUrl]);

  if (state === "loading") {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#f7f4ee", color: "#1a1816", fontFamily: "var(--font-figtree), system-ui" }}
      >
        <div className="text-center max-w-md px-6">
          <span
            style={{
              fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#8b8780",
              fontSize: 10,
            }}
          >
            01 · WAITING
          </span>
          <div className="mt-6 inline-flex items-center gap-1.5" style={{ height: 14 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className="rounded-full animate-pulse"
                style={{
                  width: 3,
                  height: 6 + (i % 3) * 4,
                  background: i < 4 ? "#b8623d" : "#d8d2c4",
                  animationDelay: `${i * 0.08}s`,
                }}
              />
            ))}
          </div>
          <h2
            className="mt-7"
            style={{
              fontFamily: '"EB Garamond", Georgia, serif',
              fontSize: 32,
              lineHeight: 1.05,
              fontWeight: 500,
              letterSpacing: "-0.015em",
            }}
          >
            Logging you in…
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "#5a5852" }}>
            Holding open a secure handoff to the desktop app.
          </p>
        </div>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#f7f4ee", color: "#1a1816", fontFamily: "var(--font-figtree), system-ui" }}
      >
        <div className="text-center max-w-md px-6">
          <span
            style={{
              fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#8c2f25",
              fontSize: 10,
            }}
          >
            03 · COULDN&rsquo;T HAND OFF
          </span>
          <svg className="mt-6 mx-auto" width="44" height="44" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" stroke="#8c2f25" strokeWidth="1.3" />
            <path
              d="M12 7v6M12 16v0.5"
              stroke="#8c2f25"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
          <h2
            className="mt-6"
            style={{
              fontFamily: '"EB Garamond", Georgia, serif',
              fontSize: 32,
              lineHeight: 1.05,
              fontWeight: 500,
              letterSpacing: "-0.015em",
            }}
          >
            Oscar didn&rsquo;t hear back.
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "#5a5852" }}>
            {errorMessage}
          </p>
          <a
            href="/auth"
            className="mt-7 inline-block rounded-full px-5 py-2.5 text-[13px] font-medium"
            style={{ background: "#1a1816", color: "#f7f4ee" }}
          >
            Try again
          </a>
        </div>
      </main>
    );
  }

  // state === "ready"
  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#f7f4ee", color: "#1a1816", fontFamily: "var(--font-figtree), system-ui" }}
    >
      <div className="text-center max-w-md px-6">
        <span
          style={{
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#b8623d",
            fontSize: 10,
          }}
        >
          02 · SUCCESS
        </span>
        <svg className="mt-6 mx-auto" width="44" height="44" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" stroke="#b8623d" strokeWidth="1.3" />
          <path
            d="M7 12l3.5 3.5L17 9"
            stroke="#b8623d"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h2
          className="mt-6"
          style={{
            fontFamily: '"EB Garamond", Georgia, serif',
            fontSize: 36,
            lineHeight: 1.05,
            fontWeight: 500,
            letterSpacing: "-0.015em",
          }}
        >
          You&rsquo;re in. <em style={{ fontStyle: "italic", color: "#b8623d" }}>Switch to Oscar.</em>
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "#5a5852" }}>
          The desktop app picked up the handoff. You can close this tab.
        </p>

        <a
          href={deepLinkUrl || "#"}
          className="mt-8 inline-block rounded-full px-6 py-3 text-[14px] font-medium"
          style={{ background: "#1a1816", color: "#f7f4ee" }}
        >
          Back to Oscar
        </a>

        <p className="mt-5 text-[12px]" style={{ color: "#8b8780" }}>
          If Oscar doesn&rsquo;t open, make sure the app is{" "}
          <a href="/download" className="underline" style={{ color: "#5a5852" }}>
            installed
          </a>{" "}
          and launched at least once.
        </p>
      </div>
    </main>
  );
}

export default function DesktopCallbackPage() {
  return (
    <Suspense
      fallback={
        <main
          className="min-h-screen flex items-center justify-center"
          style={{ background: "#f7f4ee" }}
        >
          <Spinner />
        </main>
      }
    >
      <DesktopCallbackContent />
    </Suspense>
  );
}
