-- Phase 2 — sharing + documents library
-- Extends scribbles + meetings with org-share flags, adds documents table
-- and the org-documents Storage bucket with RLS.

-- ── scribbles: add org sharing ──────────────────────────────────────────────
alter table if exists public.scribbles
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists shared_with_org boolean not null default false,
  add column if not exists shared_at timestamptz;

create index if not exists idx_scribbles_org_shared
  on public.scribbles (organization_id, created_at desc)
  where shared_with_org;

-- SELECT policy is replaced to additively allow org members to see
-- scribbles that the owner explicitly shared. Mutations still restricted to
-- the owner (existing insert/update/delete policies stay in place).
drop policy if exists "scribbles_owner_select" on public.scribbles;
create policy "scribbles_owner_select" on public.scribbles
  for select using (
    auth.uid() = user_id
    or (
      shared_with_org
      and organization_id is not null
      and public.is_org_member(organization_id)
    )
  );

-- ── meetings: add org sharing (guarded — table may not exist on web-only env) ─
do $$
begin
  if to_regclass('public.meetings') is not null then
    execute $sql$
      alter table public.meetings
        add column if not exists organization_id uuid references public.organizations(id) on delete set null,
        add column if not exists shared_with_org boolean not null default false,
        add column if not exists shared_at timestamptz
    $sql$;

    execute $sql$
      create index if not exists idx_meetings_org_shared
        on public.meetings (organization_id, started_at desc)
        where shared_with_org
    $sql$;

    execute $sql$ drop policy if exists "owner_select" on public.meetings $sql$;
    execute $sql$
      create policy "owner_select" on public.meetings
        for select using (
          auth.uid() = user_id
          or (
            shared_with_org
            and organization_id is not null
            and public.is_org_member(organization_id)
          )
        )
    $sql$;
  end if;
end $$;

-- ── documents ────────────────────────────────────────────────────────────────
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by     uuid references auth.users(id) on delete set null,
  title           text not null,
  source_kind     text not null default 'upload' check (source_kind in ('upload','url','paste')),
  source_url      text,
  storage_path    text,
  mime_type       text,
  size_bytes      bigint,
  extracted_text  text,
  summary         text,
  tags            text[] not null default '{}',
  search_tsv      tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(extracted_text, '')), 'C')
  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_documents_org_created on public.documents (organization_id, created_at desc);
create index if not exists idx_documents_search_tsv on public.documents using gin (search_tsv);
create index if not exists idx_documents_tags on public.documents using gin (tags);

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

alter table public.documents enable row level security;

drop policy if exists "documents_org_select"               on public.documents;
drop policy if exists "documents_org_insert"               on public.documents;
drop policy if exists "documents_org_update"               on public.documents;
drop policy if exists "documents_uploader_or_admin_delete" on public.documents;

create policy "documents_org_select" on public.documents
  for select using (public.is_org_member(organization_id));

create policy "documents_org_insert" on public.documents
  for insert with check (
    public.is_org_member(organization_id) and uploaded_by = auth.uid()
  );

create policy "documents_org_update" on public.documents
  for update using (
    uploaded_by = auth.uid() or public.is_org_admin(organization_id)
  ) with check (
    uploaded_by = auth.uid() or public.is_org_admin(organization_id)
  );

create policy "documents_uploader_or_admin_delete" on public.documents
  for delete using (
    uploaded_by = auth.uid() or public.is_org_admin(organization_id)
  );

-- ── Storage bucket for org documents ─────────────────────────────────────────
-- Path layout: {organization_id}/{uuid}.{ext}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-documents',
  'org-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
    'text/plain'
  ]
)
on conflict (id) do nothing;

-- Pull the leading UUID segment out of a storage path; null when malformed
-- so the RLS predicate fails closed instead of raising.
create or replace function public.org_doc_org_id(path text)
returns uuid
language sql
immutable
as $$
  select case
    when path ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/'
      then substring(path from 1 for 36)::uuid
    else null
  end;
$$;

drop policy if exists "org_docs_member_select"             on storage.objects;
drop policy if exists "org_docs_member_insert"             on storage.objects;
drop policy if exists "org_docs_uploader_or_admin_update"  on storage.objects;
drop policy if exists "org_docs_uploader_or_admin_delete"  on storage.objects;

create policy "org_docs_member_select" on storage.objects
  for select using (
    bucket_id = 'org-documents'
    and public.org_doc_org_id(name) is not null
    and public.is_org_member(public.org_doc_org_id(name))
  );

create policy "org_docs_member_insert" on storage.objects
  for insert with check (
    bucket_id = 'org-documents'
    and public.org_doc_org_id(name) is not null
    and public.is_org_member(public.org_doc_org_id(name))
    and owner = auth.uid()
  );

create policy "org_docs_uploader_or_admin_update" on storage.objects
  for update using (
    bucket_id = 'org-documents'
    and (
      owner = auth.uid()
      or public.is_org_admin(public.org_doc_org_id(name))
    )
  );

create policy "org_docs_uploader_or_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'org-documents'
    and (
      owner = auth.uid()
      or public.is_org_admin(public.org_doc_org_id(name))
    )
  );

comment on table public.documents is 'Org-shared reference library. Used by Phase 3 AI context injection.';

select pg_notify('pgrst', 'reload schema');
