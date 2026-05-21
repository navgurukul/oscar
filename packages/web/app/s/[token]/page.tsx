import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { MarkdownView } from "@/components/meetings/MarkdownView";
import { v2, v2Serif } from "@/components/v2/V2Primitives";

interface PageParams {
  params: Promise<{ token: string }>;
}

interface PublicScribble {
  id: string;
  user_id: string;
  title: string;
  original_formatted_text: string;
  edited_text: string | null;
  created_at: string;
}

interface AuthorInfo {
  name: string | null;
  email: string | null;
}

async function fetchPublicScribble(token: string): Promise<{
  scribble: PublicScribble;
  author: AuthorInfo | null;
} | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("scribbles")
    .select(
      "id, user_id, title, original_formatted_text, edited_text, created_at, visibility, public_share_token, deleted_at"
    )
    .eq("public_share_token", token)
    .eq("visibility", "public")
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;

  const { data: usersData } = await supabase.auth.admin.listUsers({
    perPage: 200,
  });
  const u = usersData?.users.find((u) => u.id === data.user_id);
  const author: AuthorInfo | null = u
    ? {
        name:
          (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          null,
        email: u.email ?? null,
      }
    : null;

  return { scribble: data as PublicScribble, author };
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { token } = await params;
  const fetched = await fetchPublicScribble(token);
  if (!fetched) return { title: "Oscar — Shared Scribble" };
  const { scribble } = fetched;
  const title = scribble.title || "Shared Scribble";
  const preview = (scribble.edited_text || scribble.original_formatted_text || "")
    .replace(/\s+/g, " ")
    .slice(0, 180);
  return {
    title: `${title} · Oscar`,
    description: preview,
    openGraph: {
      title,
      description: preview,
      type: "article",
      siteName: "Oscar",
    },
    twitter: {
      card: "summary",
      title,
      description: preview,
    },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function PublicScribblePage({ params }: PageParams) {
  const { token } = await params;
  const fetched = await fetchPublicScribble(token);
  if (!fetched) return notFound();
  const { scribble, author } = fetched;
  const body = scribble.edited_text || scribble.original_formatted_text || "";

  return (
    <main
      className="min-h-screen px-4 py-16"
      style={{ background: v2.cream, color: v2.ink }}
    >
      <article className="max-w-2xl mx-auto">
        <header className="mb-6">
          <h1
            className="leading-tight"
            style={{
              fontFamily: v2Serif,
              fontSize: 40,
              fontWeight: 500,
              letterSpacing: "-0.02em",
            }}
          >
            {scribble.title || "Untitled Scribble"}
          </h1>
          <p className="mt-3 text-sm" style={{ color: v2.inkSoft }}>
            {author?.name ?? author?.email ?? "Unknown"} · {formatDate(scribble.created_at)}
          </p>
        </header>
        <div className="prose max-w-none">
          <MarkdownView>{body}</MarkdownView>
        </div>
        <footer
          className="mt-12 pt-6 text-xs flex items-center justify-between"
          style={{ borderTop: `1px solid ${v2.rule}`, color: v2.inkFaint }}
        >
          <span>Shared from Oscar</span>
          <Link href="/" style={{ color: v2.accent }} className="hover:opacity-80">
            Try Oscar
          </Link>
        </footer>
      </article>
    </main>
  );
}
