import { useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { openUrl } from "@tauri-apps/plugin-opener";
import { supabase } from "../../supabase";
import { CoverShowcase } from "./CoverShowcase";
import { StepIndicator } from "./StepIndicator";

interface AuthScreenProps {
  onAuth: (session: Session) => void;
}

export function AuthScreen({ onAuth }: AuthScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [oauthState, setOauthState] = useState<{
    verifier: string;
    url: string;
  } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!oauthState) return undefined;

    pollingRef.current = setInterval(async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setOauthState(null);
        setLoading(false);
        onAuth(session);
      } catch (pollError) {
        console.warn("[auth] Polling error:", pollError);
      }
    }, 1000);

    const timeout = setTimeout(() => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setOauthState(null);
      setLoading(false);
      setError("Authentication timed out. Please try again.");
    }, 5 * 60 * 1000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      clearTimeout(timeout);
    };
  }, [oauthState, onAuth]);

  const signInWithGoogle = async () => {
    setError("");
    setLoading(true);

    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${import.meta.env.VITE_WEB_APP_URL || "https://oscar.samyarth.org"}/auth/desktop-callback`,
          skipBrowserRedirect: true,
        },
      });

      if (oauthError) throw oauthError;
      if (!data?.url) throw new Error("No OAuth URL returned");

      setOauthState({ verifier: "", url: data.url });
      await openUrl(data.url);
    } catch (authError: unknown) {
      setError((authError as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="split-layout">
      <StepIndicator currentStep="signin" />
      <div className="split-layout-inner">
        <div className="split-left">
          <div className="split-content">
            <div className="brand-header">
              <img
                src="/OSCAR_LIGHT_LOGO.png"
                alt="OSCAR"
                width="36"
                height="36"
              />
              <span className="brand-name">OSCAR</span>
            </div>

            <h1 className="split-title">Let's get you started</h1>
            <p className="split-description">
              Write faster in every app using your voice. Sign in with Google to
              sync your dictionary and enable AI editing.
            </p>

            {error && <p className="auth-error">{error}</p>}
            {oauthState && (
              <p className="auth-message">
                Waiting for authentication... Please complete the sign-in in
                your browser.
              </p>
            )}

            <button
              type="button"
              className="google-signin-btn"
              onClick={signInWithGoogle}
              disabled={loading}
            >
              <svg
                className="google-icon"
                viewBox="0 0 24 24"
                width="18"
                height="18"
              >
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
              {loading ? "Opening browser..." : "Continue with Google"}
            </button>

            <p className="terms-text">
              By signing up, you agree to our{" "}
              <button
                type="button"
                className="terms-link"
                onClick={() =>
                  openUrl(
                    `${import.meta.env.VITE_WEB_APP_URL || "https://oscar.samyarth.org"}/terms`,
                  )
                }
              >
                Terms of Service
              </button>{" "}
              and{" "}
              <button
                type="button"
                className="terms-link"
                onClick={() =>
                  openUrl(
                    `${import.meta.env.VITE_WEB_APP_URL || "https://oscar.samyarth.org"}/privacy`,
                  )
                }
              >
                Privacy Policy
              </button>
              .
            </p>

            {import.meta.env.DEV && (
              <button
                type="button"
                className="mt-4 w-full rounded-lg border border-dashed border-slate-300 bg-transparent px-4 py-2.5 text-[0.85rem] text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-600"
                onClick={() => {
                  onAuth({
                    user: {
                      id: "dev-user-id",
                      email: "dev@example.com",
                      user_metadata: { full_name: "Dev User" },
                      app_metadata: {},
                      aud: "dev",
                      created_at: new Date().toISOString(),
                    } as User,
                    access_token: "dev-token",
                    refresh_token: "dev-refresh",
                    expires_in: 3600,
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                    token_type: "bearer",
                  } as Session);
                }}
              >
                Skip Authentication (Dev Only)
              </button>
            )}
          </div>
        </div>
        <div className="split-right">
          <CoverShowcase />
        </div>
      </div>
    </div>
  );
}
