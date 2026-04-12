alter table public.notes
  add column if not exists dictation_category text,
  add column if not exists dictation_variant text,
  add column if not exists dictation_app_key text,
  add column if not exists dictation_context_source text,
  add column if not exists dictation_prompt_version text;

comment on column public.notes.dictation_category is
  'Auto-detected dictation category: default, ide, email, docs, chat, or browser.';

comment on column public.notes.dictation_variant is
  'Prompt variant used for context-aware dictation cleanup.';

comment on column public.notes.dictation_app_key is
  'Stable mapped app/site key used for feedback grouping.';

comment on column public.notes.dictation_context_source is
  'How routing was chosen: app, site, or fallback.';

comment on column public.notes.dictation_prompt_version is
  'Context-aware dictation prompt version identifier.';
