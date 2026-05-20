-- Phase 3 — vocabulary scope
-- Adds an optional organization_id to user_vocabulary so terms can be either
-- user-private or workspace-shared. Drops the old (user_id, term) UNIQUE
-- constraint and replaces it with two partial unique indexes so that the
-- same term can exist once per user-private namespace and once per
-- (organization, term) namespace. RLS opens up reads to org members and
-- restricts org-scoped writes to admins.

alter table if exists public.user_vocabulary
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

create index if not exists idx_user_vocabulary_org
  on public.user_vocabulary (organization_id)
  where organization_id is not null;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'user_vocabulary'
      and constraint_type = 'UNIQUE'
      and constraint_name = 'user_vocabulary_user_id_term_key'
  ) then
    execute 'alter table public.user_vocabulary drop constraint user_vocabulary_user_id_term_key';
  end if;
end $$;

create unique index if not exists idx_user_vocabulary_user_term
  on public.user_vocabulary (user_id, lower(term))
  where organization_id is null;

create unique index if not exists idx_user_vocabulary_org_term
  on public.user_vocabulary (organization_id, lower(term))
  where organization_id is not null;

drop policy if exists "vocab_owner_select" on public.user_vocabulary;
drop policy if exists "vocab_owner_insert" on public.user_vocabulary;
drop policy if exists "vocab_owner_update" on public.user_vocabulary;
drop policy if exists "vocab_owner_delete" on public.user_vocabulary;

create policy "vocab_select" on public.user_vocabulary
  for select using (
    (organization_id is null and user_id = auth.uid())
    or (organization_id is not null and public.is_org_member(organization_id))
  );

-- Personal: creator inserts/updates/deletes their own user-scoped term.
-- Org-shared: admin or owner inserts/updates/deletes for that org;
-- created_by lineage stays on user_id so attribution is intact.
create policy "vocab_insert" on public.user_vocabulary
  for insert with check (
    (organization_id is null and user_id = auth.uid())
    or (organization_id is not null and public.is_org_admin(organization_id) and user_id = auth.uid())
  );

create policy "vocab_update" on public.user_vocabulary
  for update using (
    (organization_id is null and user_id = auth.uid())
    or (organization_id is not null and public.is_org_admin(organization_id))
  ) with check (
    (organization_id is null and user_id = auth.uid())
    or (organization_id is not null and public.is_org_admin(organization_id))
  );

create policy "vocab_delete" on public.user_vocabulary
  for delete using (
    (organization_id is null and user_id = auth.uid())
    or (organization_id is not null and public.is_org_admin(organization_id))
  );

select pg_notify('pgrst', 'reload schema');
