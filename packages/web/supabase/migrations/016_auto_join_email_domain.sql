-- Phase 5 — Email-domain auto-join for organizations
-- Adds organizations.auto_join_email_domain. When a new user signs up with
-- an email that matches this domain, they are automatically added as a
-- Member of the matching org (in addition to keeping their personal org),
-- and their active org is flipped to the team org so they land in the team
-- workspace on first login.
--
-- Existing behaviour is untouched: ensure_default_org still creates the
-- personal org. auto_join_matching_org runs AFTER it and is a no-op when
-- no matching domain is configured.

-- ── organizations.auto_join_email_domain ────────────────────────────────────
alter table if exists public.organizations
  add column if not exists auto_join_email_domain text;

comment on column public.organizations.auto_join_email_domain is
  'Email domain (e.g. "navgurukul.org") that, when matching a new user''s email, auto-adds them as a Member of this org on signup. Stored lowercase. Only one org can claim a given domain (enforced by the partial unique index below). Generic public domains (gmail.com, yahoo.com, etc.) are blocked at the API layer, not here.';

-- One org per domain. Partial unique on lowercased value so case can't be
-- used to dodge the constraint. NULL values are not constrained.
create unique index if not exists uq_organizations_auto_join_email_domain
  on public.organizations (lower(auto_join_email_domain))
  where auto_join_email_domain is not null;

-- ── helper: extract domain from email ───────────────────────────────────────
create or replace function public.email_domain(p_email text)
returns text
language sql
immutable
as $$
  select lower(split_part(coalesce(p_email, ''), '@', 2));
$$;

-- ── server-side helper: auto-join user to matching org ──────────────────────
-- Called by the auth-callback server route AFTER ensure_default_org.
-- Finds the org (if any) whose auto_join_email_domain matches the user's
-- email domain and adds the user as a Member. Flips user_active_org to
-- the team org so the user lands there on first login.
--
-- Idempotent: safe to call repeatedly; skips if user is already a member.
-- Returns the matched org id, or null when no match.
create or replace function public.auto_join_matching_org(
  p_user_id    uuid,
  p_user_email text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_org_id  uuid;
  v_domain  text;
begin
  v_domain := public.email_domain(p_user_email);
  if v_domain = '' then return null; end if;

  select id into v_org_id
  from public.organizations
  where lower(auto_join_email_domain) = v_domain
  limit 1;

  if v_org_id is null then return null; end if;

  -- Add as Member if not already a member of this org
  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, p_user_id, 'member')
  on conflict (organization_id, user_id) do nothing;

  -- Flip active org to the team org (overrides personal so first login lands here)
  insert into public.user_active_org (user_id, organization_id)
  values (p_user_id, v_org_id)
  on conflict (user_id) do update set
    organization_id = excluded.organization_id,
    updated_at = now();

  return v_org_id;
end;
$$;

grant execute on function public.auto_join_matching_org(uuid, text) to service_role;

-- ── backfill helper: list existing users who could be auto-joined ───────────
-- Returns users whose email domain matches the org's auto_join_email_domain
-- but who aren't members yet. Used by the Settings UI to show "X existing
-- users with @domain emails — add them all?" prompt.
create or replace function public.list_auto_join_candidates(
  p_org_id uuid
)
returns table (
  user_id      uuid,
  email        text,
  display_name text
)
language sql
security definer
as $$
  select
    u.id as user_id,
    u.email,
    coalesce(
      nullif(u.raw_user_meta_data->>'full_name', ''),
      nullif(u.raw_user_meta_data->>'name', ''),
      split_part(u.email, '@', 1)
    ) as display_name
  from auth.users u
  where u.email is not null
    and public.email_domain(u.email) = (
      select lower(auto_join_email_domain)
      from public.organizations
      where id = p_org_id
    )
    and not exists (
      select 1
      from public.organization_members m
      where m.organization_id = p_org_id
        and m.user_id = u.id
    );
$$;

grant execute on function public.list_auto_join_candidates(uuid) to service_role;

-- ── backfill helper: batch-add candidates as Members ────────────────────────
-- Adds multiple users as Members of an org. Used by the "Add them all" CTA.
-- Returns the count added. Idempotent — skips users already in the org.
create or replace function public.backfill_auto_join_members(
  p_org_id   uuid,
  p_user_ids uuid[]
)
returns integer
language plpgsql
security definer
as $$
declare
  v_added integer := 0;
  v_uid   uuid;
begin
  if p_user_ids is null then return 0; end if;

  foreach v_uid in array p_user_ids loop
    insert into public.organization_members (organization_id, user_id, role)
    values (p_org_id, v_uid, 'member')
    on conflict (organization_id, user_id) do nothing;
    if found then
      v_added := v_added + 1;
    end if;
  end loop;

  return v_added;
end;
$$;

grant execute on function public.backfill_auto_join_members(uuid, uuid[]) to service_role;
