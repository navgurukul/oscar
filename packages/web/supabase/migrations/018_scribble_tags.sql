-- Scribble tags — a denormalized text[] column (mirrors the documents.tags
-- pattern from 008). Backs per-scribble tagging and the bulk "Add tag" action
-- in the desktop Scribble redesign. Additive and backward-compatible: existing
-- rows default to an empty array, so no backfill is required.

alter table if exists public.scribbles
  add column if not exists tags text[] not null default '{}';

-- GIN index so tag membership / overlap queries stay fast as the column fills.
create index if not exists idx_scribbles_tags
  on public.scribbles using gin (tags);

-- Reload the PostgREST schema cache so the new column is queryable immediately.
select pg_notify('pgrst', 'reload schema');
