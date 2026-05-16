alter table if exists public.meetings
  add column if not exists started_at timestamptz not null default now(),
  add column if not exists meeting_title text not null default '',
  add column if not exists meeting_local_datetime text not null default '',
  add column if not exists attendees_compact text not null default '',
  add column if not exists attendees_full jsonb not null default '[]'::jsonb,
  add column if not exists calendar_context jsonb,
  add column if not exists meeting_type_hint text not null default 'auto',
  add column if not exists transcript_segments jsonb not null default '[]'::jsonb,
  add column if not exists my_notes_markdown text not null default '',
  add column if not exists notes_markdown text not null default '';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'meetings'
      and column_name = 'date'
  ) then
    execute 'update public.meetings set started_at = coalesce(started_at, date, created_at, now())';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'meetings'
      and column_name = 'title'
  ) then
    execute 'update public.meetings set meeting_title = coalesce(nullif(meeting_title, ''''), title, '''')';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'meetings'
      and column_name = 'participants'
  ) then
    execute 'update public.meetings set attendees_compact = coalesce(nullif(attendees_compact, ''''), array_to_string(participants, '', ''), '''')';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'meetings'
      and column_name = 'notes'
  ) then
    execute 'update public.meetings set notes_markdown = coalesce(nullif(notes_markdown, ''''), notes, '''')';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'meetings'
      and column_name = 'template_id'
  ) then
    execute 'update public.meetings set meeting_type_hint = case when template_id = ''meeting_standup'' then ''standup'' else meeting_type_hint end';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'meetings'
      and policyname = 'owner_update'
  ) then
    create policy "owner_update" on public.meetings
      for update using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
