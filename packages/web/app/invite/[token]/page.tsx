"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { organizationService } from "@/lib/services/organization.service";
import { ROUTES } from "@/lib/constants";
import { isOrgFeatureEnabled } from "@/lib/featureFlags";

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
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-400">Invites are not available in this build.</p>
      </main>
    );
  }

  const inviteUrl = `${ROUTES.INVITE}/${encodeURIComponent(token)}`;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        {status === "auth_required" && (
          <>
            <h1 className="text-2xl text-white">Sign in to accept your invite</h1>
            <p className="text-gray-400 text-sm">
              We&apos;ll add you to the workspace as soon as you&apos;re signed in.
            </p>
            <Button
              onClick={() => void signInWithGoogle(inviteUrl)}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              Continue with Google
            </Button>
          </>
        )}

        {(status === "idle" || status === "accepting") && (
          <div className="text-gray-300 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            Joining workspace...
          </div>
        )}

        {status === "ok" && (
          <div className="space-y-3">
            <CheckCircle2 className="w-10 h-10 text-cyan-400 mx-auto" />
            <h1 className="text-2xl text-white">You&apos;re in</h1>
            <p className="text-gray-400 text-sm">Redirecting to your workspace...</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
            <h1 className="text-2xl text-white">Invite couldn&apos;t be used</h1>
            <p className="text-gray-400 text-sm">{message}</p>
            <Link
              href={ROUTES.SCRIBBLE}
              className="text-cyan-400 hover:text-cyan-300 text-sm inline-block"
            >
              Go to your workspace →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
