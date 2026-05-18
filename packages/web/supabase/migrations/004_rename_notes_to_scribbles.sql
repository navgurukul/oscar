do $$
begin
  if to_regclass('public.scribbles') is null
     and to_regclass('public.notes') is not null then
    alter table public.notes rename to scribbles;
  end if;
end $$;

alter table if exists public.scribbles
  add column if not exists dictation_category text,
  add column if not exists dictation_variant text,
  add column if not exists dictation_app_key text,
  add column if not exists dictation_context_source text,
  add column if not exists dictation_prompt_version text;

comment on table public.scribbles is
  'Saved Scribble records. Stream transcripts remain local unless explicitly saved as Scribble.';

comment on column public.scribbles.dictation_category is
  'Auto-detected dictation category: default, ide, email, docs, chat, or browser.';

comment on column public.scribbles.dictation_variant is
  'Prompt variant used for context-aware dictation cleanup.';

comment on column public.scribbles.dictation_app_key is
  'Stable mapped app/site key used for feedback grouping.';

comment on column public.scribbles.dictation_context_source is
  'How routing was chosen: app, site, or fallback.';

comment on column public.scribbles.dictation_prompt_version is
  'Context-aware dictation prompt version identifier.';
