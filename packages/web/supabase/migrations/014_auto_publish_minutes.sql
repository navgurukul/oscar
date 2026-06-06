-- Migration 014 — auto-publish meeting minutes per workspace
-- Adds organizations.auto_publish_minutes. When a workspace turns it on, every
-- new meeting a member records is born public (visibility='public' + a freshly
-- minted share token) so the generated summary can carry a shareable /m/{token}
-- link, Granola-style. Default OFF — existing private-by-default behaviour and
-- every pre-existing meeting are untouched (the trigger only fires on INSERT).

-- gen_random_bytes() lives in pgcrypto. Supabase ships it in the extensions
-- schema; the guarded create keeps this migration idempotent across envs.
create extension if not exists pgcrypto with schema extensions;

-- ── organizations.auto_publish_minutes ──────────────────────────────────────
alter table if exists public.organizations
  add column if not exists auto_publish_minutes boolean not null default false;

comment on column public.organizations.auto_publish_minutes is
  'When true, meetings recorded by members are auto-published (visibility=public + share token) so the summary surfaces a public link. Default false.';

-- ── trigger function ─────────────────────────────────────────────────────────
-- SECURITY DEFINER so the lookup of user_active_org + organizations succeeds
-- regardless of the inserting client''s RLS. Mirrors the share API: a public row
-- gets shared_with_org=true, shared_at, organization_id, and a 22-char base64url
-- token identical in shape to mintPublicShareToken() (randomBytes(16).base64url).
create or replace function public.apply_meeting_auto_publish()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_org_id uuid;
  v_auto   boolean;
begin
  -- Respect an explicit visibility choice: only act on rows still sitting at the
  -- private default with no token yet.
  if coalesce(new.visibility, 'private') <> 'private'
     or new.public_share_token is not null then
    return new;
  end if;

  select uao.organization_id
    into v_org_id
    from public.user_active_org uao
   where uao.user_id = new.user_id;

  if v_org_id is null then
    return new;
  end if;

  select o.auto_publish_minutes
    into v_auto
    from public.organizations o
   where o.id = v_org_id;

  if not coalesce(v_auto, false) then
    return new;
  end if;

  new.visibility         := 'public';
  new.public_share_token := rtrim(
    translate(encode(gen_random_bytes(16), 'base64'), '+/', '-_'),
    '='
  );
  new.shared_with_org := true;
  new.shared_at       := coalesce(new.shared_at, now());
  new.organization_id := coalesce(new.organization_id, v_org_id);
  return new;
end;
$fn$;

-- ── attach trigger (guarded — meetings may not exist on web-only envs) ───────
do $$
begin
  if to_regclass('public.meetings') is not null then
    execute 'drop trigger if exists trg_meeting_auto_publish on public.meetings';
    execute $sql$
      create trigger trg_meeting_auto_publish
        before insert on public.meetings
        for each row execute function public.apply_meeting_auto_publish()
    $sql$;
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
