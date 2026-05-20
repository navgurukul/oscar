-- Bootstrap migration: creates scribbles + user_vocabulary tables from scratch
-- on a fresh Supabase project. Safe to run before existing 001–006 web
-- migrations: those use `if exists` / `add column if not exists` guards and
-- skip the notes→scribbles rename when scribbles already exists.

-- ── scribbles ─────────────────────────────────────────────────────────────────
create table if not exists public.scribbles (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users(id) on delete cascade,
  title                       text not null default '',
  raw_text                    text not null default '',
  original_formatted_text     text not null default '',
  edited_text                 text,
  feedback_helpful            boolean,
  feedback_reasons            jsonb,
  feedback_timestamp          timestamptz,
  deleted_at                  timestamptz,
  is_starred                  boolean not null default false,
  folder                      text,
  -- Dictation context metadata (see web migration 005)
  dictation_category          text,
  dictation_variant           text,
  dictation_app_key           text,
  dictation_context_source    text,
  dictation_prompt_version    text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists idx_scribbles_user_created
  on public.scribbles (user_id, created_at desc);
create index if not exists idx_scribbles_deleted_at
  on public.scribbles (deleted_at);
create index if not exists idx_scribbles_user_deleted_created
  on public.scribbles (user_id, deleted_at, created_at desc);

alter table public.scribbles enable row level security;

drop policy if exists "scribbles_owner_select"  on public.scribbles;
drop policy if exists "scribbles_owner_insert"  on public.scribbles;
drop policy if exists "scribbles_owner_update"  on public.scribbles;
drop policy if exists "scribbles_owner_delete"  on public.scribbles;

create policy "scribbles_owner_select" on public.scribbles
  for select using (auth.uid() = user_id);
create policy "scribbles_owner_insert" on public.scribbles
  for insert with check (auth.uid() = user_id);
create policy "scribbles_owner_update" on public.scribbles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "scribbles_owner_delete" on public.scribbles
  for delete using (auth.uid() = user_id);

-- Auto-update updated_at on any row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_scribbles_updated_at on public.scribbles;
create trigger trg_scribbles_updated_at
  before update on public.scribbles
  for each row execute function public.set_updated_at();

comment on table public.scribbles is
  'Saved Scribble records. Stream transcripts remain local unless explicitly saved as a Scribble.';

-- ── user_vocabulary ───────────────────────────────────────────────────────────
-- Queried by /api/ai/format to bias the formatter toward user-specific terms.
create table if not exists public.user_vocabulary (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  term          text not null,
  pronunciation text,
  context       text,
  created_at    timestamptz not null default now(),
  unique (user_id, term)
);

create index if not exists idx_user_vocabulary_user_created
  on public.user_vocabulary (user_id, created_at desc);

alter table public.user_vocabulary enable row level security;

drop policy if exists "vocab_owner_select" on public.user_vocabulary;
drop policy if exists "vocab_owner_insert" on public.user_vocabulary;
drop policy if exists "vocab_owner_update" on public.user_vocabulary;
drop policy if exists "vocab_owner_delete" on public.user_vocabulary;

create policy "vocab_owner_select" on public.user_vocabulary
  for select using (auth.uid() = user_id);
create policy "vocab_owner_insert" on public.user_vocabulary
  for insert with check (auth.uid() = user_id);
create policy "vocab_owner_update" on public.user_vocabulary
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "vocab_owner_delete" on public.user_vocabulary
  for delete using (auth.uid() = user_id);
