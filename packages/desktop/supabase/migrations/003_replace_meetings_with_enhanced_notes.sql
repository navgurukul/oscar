drop table if exists public.meetings cascade;

create table public.meetings (
  id                    text primary key,
  user_id               uuid not null references auth.users(id) on delete cascade,
  started_at            timestamptz not null,
  meeting_title         text not null default '',
  meeting_local_datetime text not null default '',
  attendees_compact     text not null default '',
  attendees_full        jsonb not null default '[]'::jsonb,
  calendar_context      jsonb null,
  meeting_type_hint     text not null default 'auto',
  transcript            text not null default '',
  transcript_segments   jsonb not null default '[]'::jsonb,
  my_notes_markdown     text not null default '',
  notes_markdown        text not null default '',
  created_at            timestamptz not null default now()
);

alter table public.meetings enable row level security;

create policy "owner_select" on public.meetings
  for select using (auth.uid() = user_id);

create policy "owner_insert" on public.meetings
  for insert with check (auth.uid() = user_id);

create policy "owner_delete" on public.meetings
  for delete using (auth.uid() = user_id);
