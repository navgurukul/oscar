-- Phase 7 — Org Context Map + Retrieval Compiler Architecture
-- Creates schemas for document_chunks, org_terms, org_people_aliases, and feedback loops.

-- ── document_chunks ──────────────────────────────────────────────────────────
create table if not exists public.document_chunks (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.documents(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  chunk_index     integer not null,
  content         text not null,
  chunk_embedding vector(768),
  created_at      timestamptz not null default now(),
  constraint document_chunks_index_unique unique(document_id, chunk_index)
);

create index if not exists idx_document_chunks_org on public.document_chunks (organization_id);
create index if not exists idx_document_chunks_doc on public.document_chunks (document_id);
create index if not exists idx_document_chunks_embedding_cosine
  on public.document_chunks using ivfflat (chunk_embedding vector_cosine_ops) with (lists = 32);

alter table public.document_chunks enable row level security;

drop policy if exists "document_chunks_org_select" on public.document_chunks;
create policy "document_chunks_org_select" on public.document_chunks
  for select using (public.is_org_member(organization_id));

drop policy if exists "document_chunks_org_insert" on public.document_chunks;
create policy "document_chunks_org_insert" on public.document_chunks
  for insert with check (public.is_org_member(organization_id));

drop policy if exists "document_chunks_org_update" on public.document_chunks;
create policy "document_chunks_org_update" on public.document_chunks
  for update using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists "document_chunks_org_delete" on public.document_chunks;
create policy "document_chunks_org_delete" on public.document_chunks
  for delete using (public.is_org_member(organization_id));

-- ── match_document_chunks RPC ────────────────────────────────────────────────
create or replace function public.match_document_chunks(
  p_query_embedding vector(768),
  p_organization_id uuid,
  p_match_count     integer default 5,
  p_min_score       float8  default 0.0
)
returns table (
  id              uuid,
  document_id     uuid,
  content         text,
  similarity      float8
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    c.content,
    1 - (c.chunk_embedding <=> p_query_embedding) as similarity
  from public.document_chunks c
  where c.organization_id = p_organization_id
    and c.chunk_embedding is not null
    and 1 - (c.chunk_embedding <=> p_query_embedding) >= p_min_score
  order by c.chunk_embedding <=> p_query_embedding
  limit p_match_count;
$$;

revoke all on function public.match_document_chunks(vector(768), uuid, integer, float8) from public;
grant execute on function public.match_document_chunks(vector(768), uuid, integer, float8) to authenticated, service_role;

-- ── org_terms ───────────────────────────────────────────────────────────────
create table if not exists public.org_terms (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  canonical_term        text not null,
  aliases               text[] not null default '{}',
  category              text not null check (category in ('acronym', 'product', 'project', 'tool', 'terminology')),
  definition_or_context text,
  confidence            float8 not null default 1.0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint org_terms_org_term_unique unique (organization_id, canonical_term)
);

create index if not exists idx_org_terms_org on public.org_terms (organization_id);
create index if not exists idx_org_terms_aliases on public.org_terms using gin (aliases);

drop trigger if exists trg_org_terms_updated_at on public.org_terms;
create trigger trg_org_terms_updated_at
  before update on public.org_terms
  for each row execute function public.set_updated_at();

alter table public.org_terms enable row level security;

drop policy if exists "org_terms_org_select" on public.org_terms;
create policy "org_terms_org_select" on public.org_terms
  for select using (public.is_org_member(organization_id));

drop policy if exists "org_terms_org_insert" on public.org_terms;
create policy "org_terms_org_insert" on public.org_terms
  for insert with check (public.is_org_member(organization_id));

drop policy if exists "org_terms_org_update" on public.org_terms;
create policy "org_terms_org_update" on public.org_terms
  for update using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists "org_terms_org_delete" on public.org_terms;
create policy "org_terms_org_delete" on public.org_terms
  for delete using (public.is_org_member(organization_id));

-- ── org_people_aliases ──────────────────────────────────────────────────────
create table if not exists public.org_people_aliases (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  canonical_name    text not null,
  email             text,
  role              text,
  aliases           text[] not null default '{}',
  phonetic_aliases  text[] not null default '{}',
  common_asr_errors text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint org_people_aliases_org_name_unique unique (organization_id, canonical_name)
);

create index if not exists idx_org_people_aliases_org on public.org_people_aliases (organization_id);
create index if not exists idx_org_people_aliases_names on public.org_people_aliases using gin (aliases);
create index if not exists idx_org_people_aliases_phonetic on public.org_people_aliases using gin (phonetic_aliases);
create index if not exists idx_org_people_aliases_asr on public.org_people_aliases using gin (common_asr_errors);

drop trigger if exists trg_org_people_aliases_updated_at on public.org_people_aliases;
create trigger trg_org_people_aliases_updated_at
  before update on public.org_people_aliases
  for each row execute function public.set_updated_at();

alter table public.org_people_aliases enable row level security;

drop policy if exists "org_people_aliases_org_select" on public.org_people_aliases;
create policy "org_people_aliases_org_select" on public.org_people_aliases
  for select using (public.is_org_member(organization_id));

drop policy if exists "org_people_aliases_org_insert" on public.org_people_aliases;
create policy "org_people_aliases_org_insert" on public.org_people_aliases
  for insert with check (public.is_org_member(organization_id));

drop policy if exists "org_people_aliases_org_update" on public.org_people_aliases;
create policy "org_people_aliases_org_update" on public.org_people_aliases
  for update using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists "org_people_aliases_org_delete" on public.org_people_aliases;
create policy "org_people_aliases_org_delete" on public.org_people_aliases
  for delete using (public.is_org_member(organization_id));

-- ── org_term_candidates ─────────────────────────────────────────────────────
create table if not exists public.org_term_candidates (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  term              text not null,
  correction_count  integer not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint org_term_candidates_unique unique (organization_id, term)
);

create index if not exists idx_org_term_candidates_org on public.org_term_candidates (organization_id);

alter table public.org_term_candidates enable row level security;

drop policy if exists "org_term_candidates_org_select" on public.org_term_candidates;
create policy "org_term_candidates_org_select" on public.org_term_candidates
  for select using (public.is_org_member(organization_id));

drop policy if exists "org_term_candidates_org_insert" on public.org_term_candidates;
create policy "org_term_candidates_org_insert" on public.org_term_candidates
  for insert with check (public.is_org_member(organization_id));

drop policy if exists "org_term_candidates_org_update" on public.org_term_candidates;
create policy "org_term_candidates_org_update" on public.org_term_candidates
  for update using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists "org_term_candidates_org_delete" on public.org_term_candidates;
create policy "org_term_candidates_org_delete" on public.org_term_candidates
  for delete using (public.is_org_member(organization_id));

-- ── Correction trigger function and trigger definitions ──────────────────────
create or replace function public.handle_text_correction(
  p_org_id uuid,
  p_old_text text,
  p_new_text text
)
returns void
language plpgsql
security definer
as $$
declare
  v_old_words text[];
  v_new_words text[];
  v_old_clean text;
  v_new_clean text;
  r_person record;
  v_word text;
  v_count integer;
  v_stop_words text[];
  v_idx_old integer;
  v_idx_new integer;
  v_mismatch_words text[];
  v_mismatch_phrase text;
begin
  if p_org_id is null or p_old_text is null or p_new_text is null or p_old_text = p_new_text then
    return;
  end if;

  -- Clean and lowercase texts
  v_old_clean := lower(regexp_replace(p_old_text, '[^\w\s]', '', 'g'));
  v_new_clean := lower(regexp_replace(p_new_text, '[^\w\s]', '', 'g'));

  -- Split into words
  v_old_words := regexp_split_to_array(v_old_clean, '\s+');
  v_new_words := regexp_split_to_array(v_new_clean, '\s+');

  -- 1. Check for Person Correction
  for r_person in 
    select id, canonical_name, aliases, common_asr_errors
    from public.org_people_aliases
    where organization_id = p_org_id
  loop
    if position(lower(r_person.canonical_name) in v_new_clean) > 0
       and position(lower(r_person.canonical_name) in v_old_clean) = 0 then
       
       v_idx_old := 1;
       v_idx_new := 1;
       v_mismatch_words := array[]::text[];
       
       while v_idx_old <= array_length(v_old_words, 1) and v_idx_new <= array_length(v_new_words, 1) loop
         if v_old_words[v_idx_old] = v_new_words[v_idx_new] then
           if array_length(v_mismatch_words, 1) > 0 then
             if v_new_words[v_idx_new] = lower(r_person.canonical_name) or
                (v_idx_new + 1 <= array_length(v_new_words, 1) and v_new_words[v_idx_new+1] = lower(r_person.canonical_name)) then
                v_mismatch_phrase := array_to_string(v_mismatch_words, ' ');
                if v_mismatch_phrase is not null and v_mismatch_phrase != '' and not (v_mismatch_phrase = any(r_person.common_asr_errors)) then
                  update public.org_people_aliases
                  set common_asr_errors = array_append(common_asr_errors, v_mismatch_phrase)
                  where id = r_person.id;
                end if;
             end if;
             v_mismatch_words := array[]::text[];
           end if;
           v_idx_old := v_idx_old + 1;
           v_idx_new := v_idx_new + 1;
         else
           if array_length(v_mismatch_words, 1) < 4 then
             v_mismatch_words := array_append(v_mismatch_words, v_old_words[v_idx_old]);
           end if;
           v_idx_old := v_idx_old + 1;
         end if;
       end loop;

       if array_length(v_mismatch_words, 1) > 0 then
         v_mismatch_phrase := array_to_string(v_mismatch_words, ' ');
         if v_mismatch_phrase is not null and v_mismatch_phrase != '' and not (v_mismatch_phrase = any(r_person.common_asr_errors)) then
           update public.org_people_aliases
           set common_asr_errors = array_append(common_asr_errors, v_mismatch_phrase)
           where id = r_person.id;
         end if;
       end if;

    end if;
  end loop;

  -- 2. Check for Term Correction candidate
  v_stop_words := array['the', 'and', 'a', 'of', 'to', 'in', 'is', 'that', 'it', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'i', 'at', 'be', 'this', 'have', 'from', 'or', 'one', 'had', 'by', 'but', 'not', 'what', 'all', 'were', 'we', 'when', 'your', 'can', 'there', 'use', 'an', 'each', 'which', 'do', 'how', 'their', 'if', 'will', 'up', 'other', 'about', 'out', 'then', 'them', 'these', 'so', 'some', 'her', 'would', 'make', 'like', 'into', 'has', 'more', 'go', 'see', 'no', 'could', 'my', 'than', 'been', 'who', 'its', 'now'];

  foreach v_word in array v_new_words loop
    if length(v_word) > 3 and not (v_word = any(v_stop_words)) and not (v_word = any(v_old_words)) then
      insert into public.org_term_candidates (organization_id, term, correction_count)
      values (p_org_id, v_word, 1)
      on conflict (organization_id, term) do update
      set correction_count = org_term_candidates.correction_count + 1,
          updated_at = now();

      select correction_count into v_count
      from public.org_term_candidates
      where organization_id = p_org_id and term = v_word;

      if v_count >= 3 then
        insert into public.org_terms (organization_id, canonical_term, category, confidence, definition_or_context)
        values (p_org_id, v_word, 'terminology', 0.5, 'Automatically suggested candidate term from manual corrections.')
        on conflict (organization_id, canonical_term) do nothing;
      end if;
    end if;
  end loop;
end;
$$;

-- Triggers calling the correction logic
create or replace function public.trg_on_scribble_update_corrections()
returns trigger
language plpgsql
security definer
as $$
declare
  v_old_text text;
begin
  if new.organization_id is not null then
    if (new.edited_text is distinct from old.edited_text) and new.edited_text is not null then
      v_old_text := coalesce(old.edited_text, old.original_formatted_text, old.raw_text);
      if v_old_text is not null and v_old_text != new.edited_text then
        perform public.handle_text_correction(new.organization_id, v_old_text, new.edited_text);
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_scribbles_corrections on public.scribbles;
create trigger trg_scribbles_corrections
  after update on public.scribbles
  for each row execute function public.trg_on_scribble_update_corrections();

create or replace function public.trg_on_stream_update_corrections()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.organization_id is not null then
    if (new.formatted_text is distinct from old.formatted_text) and new.formatted_text is not null then
      if old.formatted_text is not null and old.formatted_text != new.formatted_text then
        perform public.handle_text_correction(new.organization_id, old.formatted_text, new.formatted_text);
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_streams_corrections on public.streams;
create trigger trg_streams_corrections
  after update on public.streams
  for each row execute function public.trg_on_stream_update_corrections();

select pg_notify('pgrst', 'reload schema');
