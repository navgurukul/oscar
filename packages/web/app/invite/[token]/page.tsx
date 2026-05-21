"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { organizationService } from "@/lib/services/organization.service";
import { ROUTES } from "@/lib/constants";
import { isOrgFeatureEnabled } from "@/lib/featureFlags";
import {
  v2,
  v2Serif,
  V2Caps,
  V2Wordmark,
} from "@/components/v2/V2Primitives";

type Status = "idle" | "accepting" | "ok" | "error" | "auth_required";

export default function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const { user, isLoading: authLoading, signInWithGoogle } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const attempted = useRef(false);

  const accept = useCallback(async () => {
    if (attempted.current) return;
    attempted.current = true;
    setStatus("accepting");
    try {
      const { organization_id } = await organizationService.acceptInvite(token);
      setStatus("ok");
      setTimeout(() => {
        router.push(`${ROUTES.SCRIBBLE}?org=${organization_id}`);
      }, 900);
    } catch (err) {
      attempted.current = false;
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Could not accept this invite.");
    }
  }, [router, token]);

  useEffect(() => {
    if (!isOrgFeatureEnabled()) return;
    if (authLoading) return;
    if (!user) {
      setStatus("auth_required");
      return;
    }
    void accept();
  }, [accept, authLoading, user]);

  if (!isOrgFeatureEnabled()) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: v2.cream, color: v2.ink }}
      >
        <p style={{ color: v2.inkSoft }}>Invites are not available in this build.</p>
      </main>
    );
  }

  const inviteUrl = `${ROUTES.INVITE}/${encodeURIComponent(token)}`;

  return (
    <main
      className="min-h-screen grid grid-cols-1 md:grid-cols-12"
      style={{
        background: v2.cream,
        color: v2.ink,
        fontFamily: "var(--font-figtree), system-ui",
      }}
    >
      {/* Left — invite content */}
      <div className="md:col-span-7 px-6 md:px-16 py-10 md:py-12 flex flex-col">
        <V2Wordmark />
        <div className="flex-1 flex flex-col justify-center py-10" style={{ maxWidth: 540 }}>
          {status === "auth_required" && (
            <>
              <V2Caps>YOU&rsquo;VE BEEN INVITED</V2Caps>
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
                Sign in to <em style={{ fontStyle: "italic", color: v2.accent }}>accept</em>{" "}
                your invite.
              </h1>
              <p className="mt-6 text-[16px] leading-relaxed" style={{ color: v2.inkSoft }}>
                We&rsquo;ll add you to the workspace as soon as you&rsquo;re signed in.
              </p>
              <button
                onClick={() => void signInWithGoogle(inviteUrl)}
                className="mt-8 rounded-full px-6 py-3.5 text-[14px] font-medium inline-flex items-center gap-3 self-start"
                style={{ background: v2.ink, color: v2.cream }}
              >
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
              </button>
            </>
          )}

          {(status === "idle" || status === "accepting") && (
            <>
              <V2Caps>JOINING WORKSPACE</V2Caps>
              <h1
                className="mt-3"
                style={{
                  fontFamily: v2Serif,
                  fontSize: "clamp(36px, 5vw, 48px)",
                  lineHeight: 1.02,
                  letterSpacing: "-0.025em",
                  fontWeight: 500,
                }}
              >
                Setting you up<em style={{ fontStyle: "italic", color: v2.accent }}>…</em>
              </h1>
              <div className="mt-7 flex items-center gap-2" style={{ color: v2.inkSoft }}>
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: v2.accent }} />
                Joining workspace…
              </div>
            </>
          )}

          {status === "ok" && (
            <>
              <V2Caps color={v2.accent}>SUCCESS</V2Caps>
              <CheckCircle2 className="mt-6" style={{ width: 44, height: 44, color: v2.accent }} />
              <h1
                className="mt-6"
                style={{
                  fontFamily: v2Serif,
                  fontSize: "clamp(40px, 6vw, 56px)",
                  lineHeight: 0.98,
                  letterSpacing: "-0.025em",
                  fontWeight: 500,
                }}
              >
                You&rsquo;re <em style={{ fontStyle: "italic", color: v2.accent }}>in</em>.
              </h1>
              <p className="mt-3 text-[15px]" style={{ color: v2.inkSoft }}>
                Redirecting to your workspace…
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <V2Caps color="#8c2f25">INVITE COULDN&rsquo;T BE USED</V2Caps>
              <AlertTriangle className="mt-6" style={{ width: 44, height: 44, color: "#8c2f25" }} />
              <h1
                className="mt-6"
                style={{
                  fontFamily: v2Serif,
                  fontSize: "clamp(36px, 5vw, 48px)",
                  lineHeight: 1.02,
                  letterSpacing: "-0.025em",
                  fontWeight: 500,
                }}
              >
                That didn&rsquo;t work.
              </h1>
              <p className="mt-3 text-[15px]" style={{ color: v2.inkSoft }}>
                {message}
              </p>
              <Link
                href={ROUTES.SCRIBBLE}
                className="mt-7 inline-block text-[14px]"
                style={{ color: v2.accent }}
              >
                Go to your workspace →
              </Link>
            </>
          )}
        </div>
        <V2Caps>OSCAR · WORKSPACES</V2Caps>
      </div>

      {/* Right — pull-quote stage */}
      <div
        className="hidden md:flex md:col-span-5 px-12 py-12 flex-col"
        style={{ background: v2.night, color: v2.cream }}
      >
        <V2Caps color="#7a7670">THE TEAM, IN THEIR OWN WORDS</V2Caps>
        <div className="flex-1 flex flex-col justify-center space-y-9" style={{ maxWidth: 460 }}>
          {[
            ["It's the only place our meeting notes don't go to die.", "MIRA · DESIGNER"],
            ["I used to dread post-call. Now Oscar does it.", "ROSHNI · PM"],
            ["Felt natural from day one.", "KOMAL · MARKETING"],
          ].map(([q, who], i) => (
            <div key={i}>
              <p
                style={{
                  fontFamily: v2Serif,
                  fontSize: 22,
                  lineHeight: 1.4,
                  color: v2.cream,
                  letterSpacing: "-0.005em",
                }}
              >
                &ldquo;{q}&rdquo;
              </p>
              <V2Caps color="#7a7670">{who}</V2Caps>
            </div>
          ))}
        </div>
        <V2Caps color="#7a7670">WORKSPACES · ON OSCAR</V2Caps>
      </div>
    </main>
  );
}
