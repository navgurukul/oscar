"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Copy } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
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
import { useToast } from "@/hooks/use-toast";
import { streamsService } from "@/lib/services/streams.service";
import { ROUTES } from "@/lib/constants";
import type { DBStream } from "@oscar/shared/types";
import {
  v2,
  v2Serif,
  V2Caps,
  V2Mono,
  V2Source,
  V2WebHeader,
} from "@/components/v2/V2Primitives";

function formatDate(iso: string) {
  return new Date(iso)
    .toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .toUpperCase();
}

export default function StreamsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [streams, setStreams] = useState<DBStream[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await streamsService.list({ limit: 100 });
      setStreams(items);
    } catch (err) {
      console.error("[streams] load failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`${ROUTES.AUTH}?redirectTo=${ROUTES.STREAMS}`);
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  const remove = useCallback(
    async (id: string) => {
      try {
        await streamsService.remove(id);
        setStreams((prev) => prev.filter((s) => s.id !== id));
        toast({ title: "Stream deleted" });
      } catch (err) {
        toast({
          title: "Delete failed",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const copy = useCallback(
    async (text: string) => {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied" });
    },
    [toast]
  );

  if (authLoading || loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: v2.cream }}
      >
        <Spinner />
      </main>
    );
  }

  return (
    <main
      style={{
        background: v2.cream,
        color: v2.ink,
        minHeight: "100vh",
        fontFamily: "var(--font-figtree), system-ui",
      }}
    >
      <V2WebHeader />

      <section className="px-6 md:px-14 pt-16 md:pt-20 pb-10 md:pb-12">
        <V2Caps>
          STREAM HISTORY · {streams.length} DICTATION{streams.length === 1 ? "" : "S"}
        </V2Caps>
        <h1
          className="mt-3"
          style={{
            fontFamily: v2Serif,
            fontSize: "clamp(40px, 7vw, 76px)",
            lineHeight: 0.96,
            letterSpacing: "-0.025em",
            fontWeight: 500,
          }}
        >
          Every <em style={{ fontStyle: "italic", color: v2.accent }}>paste</em> through the pill.
        </h1>
        <p className="mt-7 max-w-xl text-[16px] leading-relaxed" style={{ color: v2.inkSoft }}>
          Dictations from the desktop pill — kept private to you, not shared with workspace
          members. Search through what you pasted, where you pasted it.
        </p>
      </section>

      <section
        className="px-6 md:px-14 pb-20"
        style={{ borderTop: `1px solid ${v2.rule}` }}
      >
        {streams.length === 0 ? (
          <div className="py-20 text-center">
            <V2Caps color={v2.accent}>NO STREAMS YET</V2Caps>
            <h3
              className="mt-3"
              style={{
                fontFamily: v2Serif,
                fontSize: 48,
                lineHeight: 0.98,
                letterSpacing: "-0.025em",
                fontWeight: 500,
              }}
            >
              Dictate something <em style={{ color: v2.accent }}>through the pill</em>.
            </h3>
            <p
              className="mt-5 mx-auto max-w-md text-[14px] leading-relaxed"
              style={{ color: v2.inkSoft }}
            >
              Pastes from the desktop app show up here. Hold{" "}
              <V2Mono
                style={{
                  background: v2.cream2,
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                Ctrl+Space
              </V2Mono>{" "}
              anywhere.
            </p>
          </div>
        ) : (
          <div className="pt-2">
            {streams.map((s) => (
              <article
                key={s.id}
                className="grid grid-cols-12 gap-4 md:gap-10 py-7 group"
                style={{ borderTop: `1px solid ${v2.rule}` }}
              >
                <div className="col-span-12 md:col-span-2">
                  <V2Mono style={{ fontSize: 12, color: v2.ink }}>
                    {formatDate(s.created_at)}
                  </V2Mono>
                  <div className="mt-1.5">
                    <V2Source
                      name={(s.destination_app ?? s.app_key ?? "STREAM").toUpperCase()}
                      kind="DICTATED"
                    />
                  </div>
                </div>
                <div className="col-span-12 md:col-span-9">
                  {s.formatted_text ? (
                    <p
                      style={{
                        fontFamily: v2Serif,
                        fontSize: 18,
                        lineHeight: 1.55,
                        color: v2.ink,
                        letterSpacing: "-0.005em",
                      }}
                      className="whitespace-pre-wrap"
                    >
                      {s.formatted_text}
                    </p>
                  ) : (
                    <p
                      className="text-[14px] leading-relaxed italic whitespace-pre-wrap"
                      style={{ color: v2.inkSoft }}
                    >
                      {s.raw_transcript}
                    </p>
                  )}
                </div>
                <div className="col-span-12 md:col-span-1 flex md:justify-end items-start gap-1">
                  <button
                    onClick={() => void copy(s.formatted_text || s.raw_transcript)}
                    className="p-1.5 rounded-full transition"
                    style={{ color: v2.inkFaint }}
                    title="Copy"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="p-1.5 rounded-full transition"
                        style={{ color: v2.inkFaint }}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent
                      style={{
                        background: v2.cream,
                        border: `1px solid ${v2.rule}`,
                        color: v2.ink,
                      }}
                    >
                      <AlertDialogHeader>
                        <AlertDialogTitle
                          style={{
                            fontFamily: v2Serif,
                            fontSize: 24,
                            fontWeight: 500,
                            letterSpacing: "-0.01em",
                          }}
                        >
                          Delete this stream?
                        </AlertDialogTitle>
                        <AlertDialogDescription style={{ color: v2.inkSoft }}>
                          Permanent. The original paste in the destination app is not affected.
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
                          onClick={() => void remove(s.id)}
                          style={{ background: "#8c2f25", color: v2.cream }}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
