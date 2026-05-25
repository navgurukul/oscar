"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import {
  v2,
  v2Serif,
  V2Caps,
  V2Mono,
} from "@/components/v2/V2Primitives";

function PostCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryNext = searchParams?.get("next");
  const storedNext =
    typeof window !== "undefined" ? sessionStorage.getItem("auth_redirect_next") : null;
  const next = queryNext ?? storedNext ?? "/";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = async () => {
      try {
        const supabase = createClient();
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!sessionData.session) {
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (!refreshData.session) {
            throw new Error("No active session after sign-in");
          }
        }

        sessionStorage.removeItem("auth_redirect_next");
        router.replace(next);
        router.refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not finalize sign-in";
        setError(message);
        // Stay on this page so the user sees the error state, with a clear "Back to sign in" CTA.
      }
    };

    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only one-time OAuth session sync
  }, []);

  if (error) {
    return (
      <div className="text-center max-w-md">
        <V2Caps color={v2.danger}>02 · DIDN&rsquo;T FINALIZE</V2Caps>
        <svg className="mt-7 mx-auto" width="44" height="44" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" stroke={v2.danger} strokeWidth="1.3" />
          <path
            d="M12 7v6M12 16v0.5"
            stroke={v2.danger}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <h2
          className="mt-6"
          style={{
            fontFamily: v2Serif,
            fontSize: 32,
            lineHeight: 1.0,
            fontWeight: 500,
            letterSpacing: "-0.015em",
          }}
        >
          Couldn&rsquo;t finish signing you in.
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
          We received the handoff but no active session came back. Usually a stale cookie or a slow
          network — almost always fixed by trying once more.
        </p>
        <div
          className="mt-6 rounded-md px-4 py-3"
          style={{ background: v2.cream, border: `1px solid #d6b3a8` }}
        >
          <V2Caps color={v2.danger}>REPORTED ERROR</V2Caps>
          <V2Mono style={{ display: "block", fontSize: 12, color: v2.ink, marginTop: 4 }}>
            {error}
          </V2Mono>
        </div>
        <div className="mt-6 flex items-center gap-3 justify-center">
          <a
            href="/auth"
            className="text-[12px] rounded-full px-4 py-2 font-medium"
            style={{ background: v2.ink, color: v2.cream }}
          >
            Back to sign in
          </a>
          <a
            href="/"
            className="text-[12px] rounded-full px-4 py-2"
            style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
          >
            Get help →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center max-w-md">
      <V2Caps color={v2.accent}>01 · WORKING · &lt; 1 SEC</V2Caps>
      <div className="mt-7 flex items-center justify-center gap-1.5" style={{ height: 16 }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="rounded-full"
            style={{
              width: 3,
              height: 6 + (i % 4) * 3,
              background: i < 5 ? v2.accent : v2.ruleHard,
            }}
          />
        ))}
      </div>
      <h2
        className="mt-7"
        style={{
          fontFamily: v2Serif,
          fontSize: 32,
          lineHeight: 1.0,
          fontWeight: 500,
          letterSpacing: "-0.015em",
        }}
      >
        Restoring your <em style={{ fontStyle: "italic", color: v2.accent }}>session</em>.
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed mx-auto" style={{ color: v2.inkSoft, maxWidth: 380 }}>
        Reading the cookie. Refreshing the token. Then sending you where you were going.
      </p>
    </div>
  );
}

export default function PostCallbackPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        background: v2.cream,
        color: v2.ink,
        fontFamily: "var(--font-figtree), system-ui",
      }}
    >
      <Suspense fallback={<Spinner />}>
        <PostCallbackContent />
      </Suspense>
    </main>
  );
}
