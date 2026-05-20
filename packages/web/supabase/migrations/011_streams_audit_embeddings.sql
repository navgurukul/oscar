-- Phase 5 — streams persistence, share audit log, pgvector retrieval
-- Adds three independent surfaces. Streams are owner-only (no org sharing by
-- design). The audit log captures share/unshare transitions on scribbles +
-- meetings. pgvector enables semantic doc retrieval to replace the recency
-- heuristic in buildOrgContext.

-- ── pgvector extension ──────────────────────────────────────────────────────
create extension if not exists vector;

-- ── streams ────────────────────────────────────────────────────────────────
-- Persisted desktop pill dictations. Each row = one paste. Lives even after
-- the user removes the dictation from their destination app, so they can
-- recover it from the web /streams history.
create table if not exists public.streams (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  organization_id     uuid references public.organizations(id) on delete set null,
  app_key             text,
  destination_app     text,
  raw_transcript      text not null default '',
  formatted_text      text not null default '',
  duration_ms         integer,
  dictation_category  text,
  dictation_variant   text,
  dictation_context_source text,
  dictation_prompt_version text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_streams_user_created
  on public.streams (user_id, created_at desc);
create index if not exists idx_streams_org_created
  on public.streams (organization_id, created_at desc)
  where organization_id is not null;

alter table public.streams enable row level security;

drop policy if exists "streams_owner_select" on public.streams;
drop policy if exists "streams_owner_insert" on public.streams;
drop policy if exists "streams_owner_update" on public.streams;
drop policy if exists "streams_owner_delete" on public.streams;

-- Streams are strictly owner-only. Phase 5 deliberately keeps them out of the
-- workspace share surface; org members do NOT see each other's streams.
create policy "streams_owner_select" on public.streams
  for select using (auth.uid() = user_id);
create policy "streams_owner_insert" on public.streams
  for insert with check (auth.uid() = user_id);
create policy "streams_owner_update" on public.streams
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "streams_owner_delete" on public.streams
  for delete using (auth.uid() = user_id);

comment on table public.streams is
  'Persisted desktop pill dictations. Owner-only — not part of the workspace share surface.';

-- ── share_audit ────────────────────────────────────────────────────────────
create table if not exists public.share_audit (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id   uuid references auth.users(id) on delete set null,
  kind            text not null check (kind in ('scribble','meeting')),
  target_id       text not null,
  action          text not null check (action in ('shared','unshared')),
  created_at      timestamptz not null default now()
);

create index if not exists idx_share_audit_org_created
  on public.share_audit (organization_id, created_at desc);

alter table public.share_audit enable row level security;

drop policy if exists "share_audit_admin_select" on public.share_audit;
create policy "share_audit_admin_select" on public.share_audit
  for select using (public.is_org_admin(organization_id));

-- service_role does the inserts (triggers run as definer below).
drop policy if exists "share_audit_service_insert" on public.share_audit;
create policy "share_audit_service_insert" on public.share_audit
  for insert with check (auth.role() = 'service_role');

-- Trigger functions: log when shared_with_org transitions on a scribble or
-- a meeting. SECURITY DEFINER so the row is written even if the calling user
-- only has UPDATE on the underlying table.
create or replace function public.log_scribble_share_change()
returns trigger
language plpgsql
security definer
as $$
begin
  if (coalesce(old.shared_with_org, false) is distinct from coalesce(new.shared_with_org, false))
     and new.organization_id is not null then
    insert into public.share_audit (organization_id, actor_user_id, kind, target_id, action)
    values (
      new.organization_id,
      new.user_id,
      'scribble',
      new.id::text,
      case when new.shared_with_org then 'shared' else 'unshared' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_scribbles_share_audit on public.scribbles;
create trigger trg_scribbles_share_audit
  after update of shared_with_org on public.scribbles
  for each row execute function public.log_scribble_share_change();

do $$
begin
  if to_regclass('public.meetings') is not null then
    execute $sql$
      create or replace function public.log_meeting_share_change()
      returns trigger
      language plpgsql
      security definer
      as $body$
      begin
        if (coalesce(old.shared_with_org, false) is distinct from coalesce(new.shared_with_org, false))
           and new.organization_id is not null then
          insert into public.share_audit (organization_id, actor_user_id, kind, target_id, action)
          values (
            new.organization_id,
            new.user_id,
            'meeting',
            new.id::text,
            case when new.shared_with_org then 'shared' else 'unshared' end
          );
        end if;
        return new;
      end;
      $body$;
    $sql$;

    execute 'drop trigger if exists trg_meetings_share_audit on public.meetings';
    execute $sql$
      create trigger trg_meetings_share_audit
        after update of shared_with_org on public.meetings
        for each row execute function public.log_meeting_share_change()
    $sql$;
  end if;
end $$;

comment on table public.share_audit is
  'Append-only history of share/unshare actions on org-scoped scribbles and meetings.';

-- ── documents.embedding + match_documents RPC ──────────────────────────────
-- Gemini text-embedding-004 emits 768-dim vectors. Stored alongside the
-- existing FTS tsv so queries can mix lexical + semantic ranking.
alter table if exists public.documents
  add column if not exists embedding vector(768);

-- IVFFlat index for cosine similarity. Recommended list count is ~sqrt(n).
-- A workspace library is small (tens to low hundreds), so 32 is fine; the
-- planner will fall back to seq scan when there are too few rows anyway.
create index if not exists idx_documents_embedding_cosine
  on public.documents using ivfflat (embedding vector_cosine_ops) with (lists = 32);

-- Cosine similarity match within an org. Returns the n closest documents
-- to the supplied query vector, filtered to one organisation so RLS-like
-- isolation holds even when called via the service role.
create or replace function public.match_documents(
  p_query_embedding vector(768),
  p_organization_id uuid,
  p_match_count     integer default 5,
  p_min_score       float8  default 0.0
)
returns table (
  id          uuid,
  title       text,
  summary     text,
  tags        text[],
  extracted_text text,
  similarity  float8
)
language sql
stable
as $$
  select
    d.id,
    d.title,
    d.summary,
    d.tags,
    d.extracted_text,
    1 - (d.embedding <=> p_query_embedding) as similarity
  from public.documents d
  where d.organization_id = p_organization_id
    and d.embedding is not null
    and 1 - (d.embedding <=> p_query_embedding) >= p_min_score
  order by d.embedding <=> p_query_embedding
  limit p_match_count;
$$;

revoke all on function public.match_documents(vector(768), uuid, integer, float8) from public;
grant execute on function public.match_documents(vector(768), uuid, integer, float8) to authenticated, service_role;

comment on column public.documents.embedding is
  'Gemini text-embedding-004 vector (768d) of title + summary + extracted_text. Backfill lives in the web /api/org/documents pipeline.';

select pg_notify('pgrst', 'reload schema');
