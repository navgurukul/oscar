-- Migration 016 — streams feedback column
-- Stream is a local-only desktop feature: a row is persisted to public.streams
-- ONLY when the user submits free-text feedback on a dictation. This column
-- holds that feedback, stored alongside the row's raw_transcript + formatted_text.

alter table if exists public.streams
  add column if not exists feedback text;

comment on column public.streams.feedback is
  'Free-text user feedback on a dictation. A streams row is only created when the user submits feedback, so this is non-empty in practice.';

select pg_notify('pgrst', 'reload schema');
