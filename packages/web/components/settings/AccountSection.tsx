"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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
import { v2, v2Serif, v2Mono, V2Caps } from "@/components/v2/V2Primitives";

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
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

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

      {/* Danger zone */}
      <section
        className="grid grid-cols-12 gap-6 md:gap-10"
        style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 24 }}
      >
        <div className="col-span-12 md:col-span-3">
          <V2Caps color="#8c2f25">DANGER</V2Caps>
        </div>
        <div
          className="col-span-12 md:col-span-9 rounded-md p-5 flex items-start justify-between gap-4 flex-wrap"
          style={{ border: "1px solid #d6b3a8" }}
        >
          <div>
            <div
              style={{
                fontFamily: v2Serif,
                fontSize: 20,
                fontWeight: 500,
                color: "#8c2f25",
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
                style={{ color: "#8c2f25", border: "1px solid #d6b3a8" }}
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
                  <AlertTriangle style={{ color: "#8c2f25" }} className="w-6 h-6" />
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
                  style={{ background: "#8c2f25", color: v2.cream }}
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
