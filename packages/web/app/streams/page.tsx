"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Trash2, Copy } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="text-cyan-500" />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pt-28 pb-24 max-w-3xl mx-auto">
      <header className="mb-6 space-y-1">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Mic className="w-7 h-7 text-cyan-400" />
          Stream history
        </h1>
        <p className="text-slate-400 text-sm">
          Every dictation pasted through the desktop pill, kept private to you. Not shared with workspace members.
        </p>
      </header>

      {streams.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm">
          No streams yet. Dictate something through the desktop pill and it will appear here.
        </div>
      ) : (
        <ul className="space-y-3">
          {streams.map((s) => (
            <li
              key={s.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{formatDate(s.created_at)}</p>
                  {s.destination_app || s.app_key ? (
                    <p className="text-xs text-cyan-300 mt-0.5">
                      {s.destination_app ?? s.app_key}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void copy(s.formatted_text || s.raw_transcript)}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-cyan-300 hover:bg-cyan-400/10"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this stream?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                          Permanent. The original paste in the destination app is not affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => void remove(s.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              {s.formatted_text ? (
                <p className="text-slate-100 text-sm whitespace-pre-wrap">{s.formatted_text}</p>
              ) : (
                <p className="text-slate-400 text-sm italic whitespace-pre-wrap">{s.raw_transcript}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
