"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ROUTES } from "@/lib/constants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { v2, v2Serif, v2Mono, V2Caps, V2Mono } from "@/components/v2/V2Primitives";

function describeBrowser(): { device: string; meta: string } {
  if (typeof navigator === "undefined") return { device: "This browser", meta: "Current session" };
  const ua = navigator.userAgent;
  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";
  let platform = "Web";
  if (/Mac OS X|Macintosh/.test(ua)) platform = "macOS";
  else if (/Windows/.test(ua)) platform = "Windows";
  else if (/Linux/.test(ua)) platform = "Linux";
  else if (/iPhone|iPad/.test(ua)) platform = "iOS";
  else if (/Android/.test(ua)) platform = "Android";
  return { device: `${platform} · ${browser}`, meta: "Active now · this device" };
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div
      className="flex items-baseline justify-between py-4"
      style={{ borderBottom: `1px solid ${v2.rule}` }}
    >
      <V2Caps>{label}</V2Caps>
      <span style={{ fontFamily: v2Mono, fontSize: 13, color: v2.ink }}>
        {value || <span style={{ color: v2.inkFaint }}>—</span>}
      </span>
    </div>
  );
}

export default function AccountSection() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [device, setDevice] = useState<{ device: string; meta: string }>({
    device: "This browser",
    meta: "Current session",
  });

  useEffect(() => {
    setDevice(describeBrowser());
  }, []);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push(ROUTES.HOME);
      router.refresh();
    } catch (err) {
      setIsSigningOut(false);
      toast({
        title: "Sign out failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  }, [router, signOut, toast]);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/user/delete-account", { method: "DELETE" });
      if (!response.ok) throw new Error("Deletion failed");
      toast({
        title: "Account deleted",
        description: "Your account and all data have been permanently deleted.",
      });
    } catch {
      toast({
        title: "Failed to delete account",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? null;
  const language = (user?.user_metadata?.language as string | undefined) ?? null;
  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : null;

  return (
    <div className="space-y-12">
      {/* Identity */}
      <section
        className="grid grid-cols-12 gap-6 md:gap-10"
        style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 24 }}
      >
        <div className="col-span-12 md:col-span-3">
          <V2Caps>IDENTITY</V2Caps>
        </div>
        <div className="col-span-12 md:col-span-9">
          <Row label="DISPLAY NAME" value={fullName} />
          <Row label="EMAIL" value={user?.email ?? null} />
          <Row label="TIME ZONE" value={timezone} />
          <Row label="LANGUAGE" value={language ?? "English"} />
        </div>
      </section>

      {/* Voice profile (display-only — settings live elsewhere) */}
      <section
        className="grid grid-cols-12 gap-6 md:gap-10"
        style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 24 }}
      >
        <div className="col-span-12 md:col-span-3">
          <V2Caps>VOICE PROFILE</V2Caps>
        </div>
        <div className="col-span-12 md:col-span-9">
          <Row label="AUTO-CLEANUP" value="On · Gemini removes filler" />
          <Row label="CONTEXT-AWARE DICTATION" value="On · adapts per active app" />
          <Row label="PROFANITY" value="Filtered" />
        </div>
      </section>

      {/* Sessions */}
      <section
        className="grid grid-cols-12 gap-6 md:gap-10"
        style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 24 }}
      >
        <div className="col-span-12 md:col-span-3">
          <V2Caps>SESSIONS</V2Caps>
        </div>
        <div className="col-span-12 md:col-span-9">
          <div
            className="flex items-center justify-between py-4 gap-4"
            style={{ borderBottom: `1px solid ${v2.rule}` }}
          >
            <div>
              <div style={{ fontSize: 14, color: v2.ink }}>{device.device}</div>
              <V2Caps>{device.meta.toUpperCase()}</V2Caps>
            </div>
            <div className="flex items-center gap-4">
              <V2Mono
                style={{ fontSize: 11, color: v2.accent, letterSpacing: "0.14em" }}
              >
                HERE
              </V2Mono>
              <button
                onClick={() => void handleSignOut()}
                disabled={isSigningOut}
                className="text-[12px] hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{ color: v2.inkSoft, fontFamily: v2Mono }}
              >
                {isSigningOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
          <p className="mt-3 text-[12px]" style={{ color: v2.inkFaint }}>
            Signing out clears this browser&rsquo;s session. Your Scribbles and
            settings stay safe.
          </p>
        </div>
      </section>

      {/* Danger zone */}
      <section
        className="grid grid-cols-12 gap-6 md:gap-10"
        style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 24 }}
      >
        <div className="col-span-12 md:col-span-3">
          <V2Caps color={v2.danger}>DANGER</V2Caps>
        </div>
        <div
          className="col-span-12 md:col-span-9 rounded-md p-5 flex items-start justify-between gap-4 flex-wrap"
          style={{ border: `1px solid ${v2.dangerSoft}` }}
        >
          <div>
            <div
              style={{
                fontFamily: v2Serif,
                fontSize: 20,
                fontWeight: 500,
                color: v2.danger,
              }}
            >
              Delete account
            </div>
            <p className="mt-1 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
              Permanently delete every Scribble, every Minutes, your subscription. Cannot be
              undone. 30-day soft-delete first.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="text-[12px] rounded-full px-4 py-2 inline-flex items-center gap-2 shrink-0"
                style={{ color: v2.danger, border: `1px solid ${v2.dangerSoft}` }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete account
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent
              style={{ background: v2.cream, border: `1px solid ${v2.rule}`, color: v2.ink }}
            >
              <AlertDialogHeader>
                <AlertDialogTitle
                  style={{
                    fontFamily: v2Serif,
                    fontSize: 28,
                    fontWeight: 500,
                    letterSpacing: "-0.015em",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <AlertTriangle style={{ color: v2.danger }} className="w-6 h-6" />
                  Are you absolutely sure?
                </AlertDialogTitle>
                <AlertDialogDescription style={{ color: v2.inkSoft }}>
                  This permanently deletes your account and removes everything from our servers,
                  including:
                  <ul className="mt-3 space-y-1 text-[14px]" style={{ color: v2.ink }}>
                    <li>· All Scribbles and transcripts</li>
                    <li>· Your vocabulary entries</li>
                    <li>· Your subscription</li>
                    <li>· Account settings and preferences</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  style={{
                    background: "transparent",
                    border: `1px solid ${v2.rule}`,
                    color: v2.inkSoft,
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  style={{ background: v2.danger, color: v2.cream }}
                >
                  {isDeleting ? "Deleting…" : "Yes, delete my account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  );
}
