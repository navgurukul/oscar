"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";

export default function PostCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get("next") ?? "/";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = async () => {
      try {
        const supabase = createClient();

        // 1) Read session (this also ensures the client is initialized)
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        // 2) Force a refresh attempt (helps when cookies changed during server exchange)
        // If refresh fails but we still have a session, proceed anyway.
        if (!sessionData.session) {
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (!refreshData.session) {
            throw new Error("No active session after sign-in");
          }
        }

        router.replace(next);
        router.refresh();
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Could not finalize sign-in";
        setError(message);
        // Send user back to auth with error message.
        router.replace(`/auth?error=${encodeURIComponent(message)}`);
      }
    };

    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black">
      {error ? (
        <div className="text-sm text-red-400">{error}</div>
      ) : (
        <Spinner className="text-cyan-500" />
      )}
    </main>
  );
}


