"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function PublicNotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState<string>("Shared Note");
  const [text, setText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

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
      setIsLoading(true);
      try {
        const res = await fetch(`/api/notes/public/${token}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Note not available");
        } else {
          setTitle(data.title || "Shared Note");
          setText(data.text || "");
        }
      } catch {
        setError("Failed to load note");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [token]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <Spinner className="text-cyan-500" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-red-400">{error}</div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 bg-slate-950">
      <div className="w-full max-w-2xl">
        <Card className="bg-slate-900 border-cyan-700/30 rounded-2xl shadow-xl overflow-hidden">
          <CardHeader>
            <h1 className="text-2xl font-semibold text-white">{title}</h1>
            <Separator className="w-24 h-0.5 bg-cyan-500 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="text-gray-300 whitespace-pre-wrap">{text}</div>
          </CardContent>
        </Card>
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/")}
            className="text-cyan-400 hover:text-cyan-300"
          >
            Go to home
          </button>
        </div>
      </div>
    </main>
  );
}

