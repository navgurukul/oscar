do $$
begin
  if to_regclass('public.scribbles') is null
     and to_regclass('public.notes') is not null then
    alter table public.notes rename to scribbles;
  end if;
end $$;

alter table if exists public.scribbles
  add column if not exists deleted_at timestamptz,
  add column if not exists is_starred boolean not null default false,
  add column if not exists folder text;

create index if not exists idx_scribbles_deleted_at
  on public.scribbles (deleted_at);

create index if not exists idx_scribbles_user_deleted_created
  on public.scribbles (user_id, deleted_at, created_at desc);
