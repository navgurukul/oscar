-- 019_org_is_personal_flag.sql
--
-- Make the auto-created "personal" org distinguishable from a real team org so
-- the UI can hide ALL org/collaboration chrome from a solo user, and make
-- personal-org provisioning foolproof (every signup gets one, regardless of
-- which client authenticated — web OAuth, desktop deep-link, admin-created, or
-- a Bearer-only API caller that never hits the web /auth/callback).
--
-- Idempotent house style: every statement is safe to re-run.

-- 1. The discriminator. Default false = "team" so the column add touches no
--    rows; the backfill below flips genuine personal orgs to true.
alter table public.organizations
  add column if not exists is_personal boolean not null default false;

comment on column public.organizations.is_personal is
  'True for the auto-created single-user personal org (invisible container). '
  'False for real team orgs (created explicitly or joined). Drives whether org '
  'chrome is shown. Mutated only by ensure_default_org / createOrganization, '
  'never by client UPDATE.';

-- 2. Personal orgs created from here on are flagged is_personal=true and start
--    PRIVATE (a solo user must never have meetings auto-published to a public
--    link — that is org/collaboration behavior leaking; see migration 015 whose
--    table default is 'public').
create or replace function public.ensure_default_org(
  p_user_id    uuid,
  p_user_email text,
  p_user_name  text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_org_id uuid;
  v_slug   text;
  v_name   text;
  v_base   text;
  v_n      int := 0;
begin
  select organization_id into v_org_id
  from public.organization_members
  where user_id = p_user_id
  limit 1;

  if v_org_id is not null then
    insert into public.user_active_org (user_id, organization_id)
    values (p_user_id, v_org_id)
    on conflict (user_id) do nothing;
    return v_org_id;
  end if;

  v_base := lower(regexp_replace(
    coalesce(nullif(split_part(p_user_email, '@', 1), ''), 'user'),
    '[^a-z0-9-]+', '-', 'g'
  ));
  v_base := trim(both '-' from v_base);
  if v_base = '' then v_base := 'user'; end if;
  v_slug := v_base;

  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  end loop;

  v_name := coalesce(nullif(p_user_name, ''), split_part(p_user_email, '@', 1), 'Personal') || '''s workspace';

  insert into public.organizations (name, slug, created_by, is_personal, default_meeting_visibility)
  values (v_name, v_slug, p_user_id, true, 'private')
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, p_user_id, 'owner');

  insert into public.user_active_org (user_id, organization_id)
  values (p_user_id, v_org_id)
  on conflict (user_id) do update set organization_id = excluded.organization_id;

  return v_org_id;
end;
$$;

-- 3. One-shot backfill of pre-existing rows. Mark an org PERSONAL only when ALL hold:
--    - no auto_join_email_domain (a domain-join org is always a team),
--    - exactly one distinct member,
--    - that member is the creator AND an owner,
--    - it has never sent an invite (an invited-but-unjoined org is a real team).
--    Everything else stays is_personal=false (team). Err toward "team": a
--    mis-marked team only over-shows chrome, while a mis-marked personal org
--    would hide chrome a real team needs.
--
--    Guarded so a REPLAY can't re-mark a real single-member team (created later
--    via createOrganization, which sets is_personal=false) as personal: once any
--    org is flagged personal, the trigger below owns all new orgs and this
--    legacy backfill must not run again.
do $$
begin
  if not exists (select 1 from public.organizations where is_personal) then
    update public.organizations o
    set is_personal = true
    where o.is_personal = false
      and o.auto_join_email_domain is null
      and (
        select count(distinct m.user_id)
        from public.organization_members m
        where m.organization_id = o.id
      ) = 1
      and exists (
        select 1 from public.organization_members m2
        where m2.organization_id = o.id
          and m2.user_id = o.created_by
          and m2.role = 'owner'
      )
      and not exists (
        select 1 from public.organization_invites i
        where i.organization_id = o.id
      );

    -- Personal orgs default to private for NEW meetings (existing meetings keep
    -- their own per-row visibility; this only changes the org-level default).
    update public.organizations o
    set default_meeting_visibility = 'private'
    where o.is_personal = true
      and o.default_meeting_visibility <> 'private';
  end if;
end $$;

-- 4. Foolproof provisioning: an AFTER INSERT trigger on auth.users guarantees a
--    personal org for EVERY new account, independent of which client (web,
--    desktop deep-link, admin import) created it. Exception-safe so a provisioning
--    hiccup can never block account creation.
create or replace function public.handle_new_user_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.ensure_default_org(
      new.id,
      coalesce(new.email, ''),
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        null
      )
    );
  exception when others then
    raise warning '[handle_new_user_org] ensure_default_org failed for %: %', new.id, sqlerrm;
  end;

  -- Best-effort corp-domain auto-join (desktop-first corp users land in their
  -- team without ever visiting the web callback). Never undoes the personal org.
  begin
    perform public.auto_join_matching_org(new.id, coalesce(new.email, ''));
  exception when others then
    raise warning '[handle_new_user_org] auto_join_matching_org failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_org();

select pg_notify('pgrst', 'reload schema');
