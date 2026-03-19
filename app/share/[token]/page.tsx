"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

type PublicNote = {
  title: string;
  text: string;
  created_at: string;
  updated_at: string;
};

export default function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [note, setNote] = useState<PublicNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { token } = await params;
      setToken(token);
    };
    init();
  }, [params]);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/notes/public/${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || "Note not available");
        } else {
          setNote(data as PublicNote);
        }
      } catch {
        setError("Failed to load note");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner className="text-cyan-500" />
      </main>
    );
  }

  if (error || !note) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl text-white mb-2">Link not available</h1>
          <p className="text-gray-400 mb-6">{error || "This share link is invalid or expired."}</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-cyan-700/30 text-gray-100 hover:text-cyan-300"
          >
            Go Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center px-5 pt-8 pb-24">
      <div className="w-full max-w-[800px]">
        <Card className="bg-slate-900 border-cyan-700/30 rounded-2xl shadow-xl overflow-hidden">
          <CardHeader>
            <div className="mb-2">
              <h1 className="text-xl font-semibold text-white truncate">{note.title}</h1>
              <p className="text-gray-400 text-sm">
                {new Date(note.created_at).toLocaleString()}
              </p>
            </div>
            <Separator className="w-24 h-0.5 bg-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-md text-start text-gray-300 whitespace-pre-wrap break-words">
              {note.text}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
