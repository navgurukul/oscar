-- Phase 6 — public share links for scribbles + meetings
-- Adds a 3-level visibility ladder (private → org → public) and a unique
-- public_share_token that the anonymous /s/[token] and /m/[token] viewer
-- routes look up via the service-role client. shared_with_org stays as a
-- legacy boolean kept in sync by app code so Phase 2 surfaces keep working.

-- ── scribbles ──────────────────────────────────────────────────────────────
alter table if exists public.scribbles
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private','org','public')),
  add column if not exists public_share_token text;

-- Sparse UNIQUE: enforce uniqueness only on rows that actually have a token.
create unique index if not exists idx_scribbles_public_share_token
  on public.scribbles (public_share_token)
  where public_share_token is not null;

create index if not exists idx_scribbles_public_visibility
  on public.scribbles (visibility)
  where visibility = 'public';

-- Backfill existing shared_with_org rows to visibility='org' so the new
-- ladder reflects what the workspace already exposes.
update public.scribbles
   set visibility = 'org'
 where shared_with_org = true
   and visibility = 'private';

-- ── meetings (guarded — may not exist on web-only Supabase envs) ───────────
do $$
begin
  if to_regclass('public.meetings') is not null then
    execute $sql$
      alter table public.meetings
        add column if not exists visibility text not null default 'private'
          check (visibility in ('private','org','public')),
        add column if not exists public_share_token text
    $sql$;

    execute $sql$
      create unique index if not exists idx_meetings_public_share_token
        on public.meetings (public_share_token)
        where public_share_token is not null
    $sql$;

    execute $sql$
      create index if not exists idx_meetings_public_visibility
        on public.meetings (visibility)
        where visibility = 'public'
    $sql$;

    execute $sql$
      update public.meetings
         set visibility = 'org'
       where shared_with_org = true
         and visibility = 'private'
    $sql$;
  end if;
end $$;

-- ── RLS for public viewer (defence-in-depth) ───────────────────────────────
-- The anonymous /s and /m routes use the service-role client so they bypass
-- RLS anyway, but we still loosen the SELECT predicate so a future authed
-- viewer could read public rows directly without needing the service role.
-- Mutations stay locked to the owner (existing INSERT/UPDATE/DELETE policies
-- untouched).
drop policy if exists "scribbles_owner_select" on public.scribbles;
create policy "scribbles_owner_select" on public.scribbles
  for select using (
    auth.uid() = user_id
    or (visibility = 'public' and public_share_token is not null)
    or (
      visibility in ('org','public')
      and organization_id is not null
      and public.is_org_member(organization_id)
    )
    -- Legacy back-compat: rows that pre-date the visibility column may still
    -- carry shared_with_org = true without visibility = 'org'.
    or (
      shared_with_org
      and organization_id is not null
      and public.is_org_member(organization_id)
    )
  );

do $$
begin
  if to_regclass('public.meetings') is not null then
    execute 'drop policy if exists "owner_select" on public.meetings';
    execute $sql$
      create policy "owner_select" on public.meetings
        for select using (
          auth.uid() = user_id
          or (visibility = 'public' and public_share_token is not null)
          or (
            visibility in ('org','public')
            and organization_id is not null
            and public.is_org_member(organization_id)
          )
          or (
            shared_with_org
            and organization_id is not null
            and public.is_org_member(organization_id)
          )
        )
    $sql$;
  end if;
end $$;

comment on column public.scribbles.visibility is
  'Sharing scope: private | org | public. Authoritative; shared_with_org is kept in sync for back-compat.';
comment on column public.scribbles.public_share_token is
  'Random token surfaced as /s/{token}. Null when visibility is not public.';

select pg_notify('pgrst', 'reload schema');
