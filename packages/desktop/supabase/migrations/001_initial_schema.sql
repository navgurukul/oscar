-- ── Personal Dictionary ────────────────────────────────────────────────────────
-- One row per word per user. Synced from/to the desktop app.

create table if not exists public.user_dictionary (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  word        text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, word)
);

-- RLS: users can only see/modify their own words
alter table public.user_dictionary enable row level security;

create policy "owner_select" on public.user_dictionary
  for select using (auth.uid() = user_id);

create policy "owner_insert" on public.user_dictionary
  for insert with check (auth.uid() = user_id);

create policy "owner_delete" on public.user_dictionary
  for delete using (auth.uid() = user_id);

-- ── Usage Logs ─────────────────────────────────────────────────────────────────
-- Written by the Edge Function (service role) — users can read their own rows.

create table if not exists public.usage_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  input_chars   integer not null default 0,
  output_chars  integer not null default 0,
  tone          text not null default 'none'
);

-- RLS
alter table public.usage_logs enable row level security;

create policy "owner_select" on public.usage_logs
  for select using (auth.uid() = user_id);

-- Only service role can insert (done from Edge Function)
-- No insert policy for anon/authenticated — service role bypasses RLS
