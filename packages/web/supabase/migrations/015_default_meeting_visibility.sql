-- Migration 015 — default meeting visibility (public-by-default Minutes)
-- Supersedes the boolean organizations.auto_publish_minutes (migration 014)
-- with a tri-state default. Every new meeting a member records is born with the
-- workspace's default visibility so its summary can carry a shareable
-- /m/{token} link, Granola-style.
--
--   public  → visibility='public' + a freshly minted share token (anyone with
--             the link can read, no sign-in). This is the PRODUCT DEFAULT.
--   org     → shared with the workspace only (members can read).
--   private → owner only; no token.
--
-- Adding the column NOT NULL DEFAULT 'public' fills every existing org with
-- 'public', matching the new default. Existing meeting rows are NOT touched —
-- the trigger fires on INSERT only, so nothing already recorded becomes public.
-- A workspace can dial this back to org/private in Settings → Sharing.

-- gen_random_bytes() lives in pgcrypto (extensions schema on Supabase).
create extension if not exists pgcrypto with schema extensions;

-- ── organizations.default_meeting_visibility ────────────────────────────────
alter table if exists public.organizations
  add column if not exists default_meeting_visibility text not null default 'public'
    check (default_meeting_visibility in ('private', 'org', 'public'));

comment on column public.organizations.default_meeting_visibility is
  'Visibility applied to new meetings a member records: private | org | public. Product default public. Applied at INSERT via trg_meeting_default_visibility. Supersedes auto_publish_minutes.';

-- ── trigger function ─────────────────────────────────────────────────────────
-- SECURITY DEFINER so the lookup of user_active_org + organizations succeeds
-- regardless of the inserting client''s RLS. A public row gets shared_at + a
-- 22-char base64url token identical in shape to mintPublicShareToken()
-- (randomBytes(16).base64url). Org-less users fall back to the product default
-- ('public') so solo accounts get a shareable link too.
create or replace function public.apply_meeting_default_visibility()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_org_id   uuid;
  v_default  text;
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

  if v_org_id is not null then
    select o.default_meeting_visibility
      into v_default
      from public.organizations o
     where o.id = v_org_id;
  end if;

  -- Missing org / missing column → product default.
  v_default := coalesce(v_default, 'public');

  if v_default = 'public' then
    new.visibility         := 'public';
    new.public_share_token := rtrim(
      translate(encode(gen_random_bytes(16), 'base64'), '+/', '-_'),
      '='
    );
    new.shared_at := coalesce(new.shared_at, now());
    if v_org_id is not null then
      new.shared_with_org := true;
      new.organization_id := coalesce(new.organization_id, v_org_id);
    end if;
  elsif v_default = 'org' and v_org_id is not null then
    new.visibility      := 'org';
    new.shared_with_org := true;
    new.shared_at       := coalesce(new.shared_at, now());
    new.organization_id := coalesce(new.organization_id, v_org_id);
  end if;
  -- 'private' (or 'org' with no workspace) → leave the private default as-is.

  return new;
end;
$fn$;

-- ── attach trigger (guarded — meetings may not exist on web-only envs) ───────
-- Replaces trg_meeting_auto_publish from migration 014.
do $$
begin
  if to_regclass('public.meetings') is not null then
    execute 'drop trigger if exists trg_meeting_auto_publish on public.meetings';
    execute 'drop trigger if exists trg_meeting_default_visibility on public.meetings';
    execute $sql$
      create trigger trg_meeting_default_visibility
        before insert on public.meetings
        for each row execute function public.apply_meeting_default_visibility()
    $sql$;
  end if;
end $$;

-- Old function is no longer referenced by any trigger.
drop function if exists public.apply_meeting_auto_publish();

select pg_notify('pgrst', 'reload schema');
