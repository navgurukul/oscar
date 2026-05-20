-- Phase 1 — Organizations workflow
-- Creates orgs, members, invites, user_active_org. No content-sharing wiring yet.
-- Existing scribbles/meetings RLS untouched: org access is additive in Phase 2.

-- ── organizations ────────────────────────────────────────────────────────────
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_organizations_slug on public.organizations (slug);
create index if not exists idx_organizations_created_by on public.organizations (created_by);

-- ── organization_members ─────────────────────────────────────────────────────
create table if not exists public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'member' check (role in ('owner','admin','member')),
  joined_at       timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists idx_org_members_user on public.organization_members (user_id);
create index if not exists idx_org_members_org on public.organization_members (organization_id);

-- ── organization_invites ─────────────────────────────────────────────────────
create table if not exists public.organization_invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token_hash      text not null unique,
  email           text,
  role            text not null default 'member' check (role in ('admin','member')),
  invited_by      uuid references auth.users(id) on delete set null,
  expires_at      timestamptz,
  accepted_at     timestamptz,
  accepted_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_org_invites_org on public.organization_invites (organization_id);
create index if not exists idx_org_invites_email on public.organization_invites (email);
create index if not exists idx_org_invites_pending
  on public.organization_invites (organization_id)
  where accepted_at is null;

-- ── user_active_org ──────────────────────────────────────────────────────────
-- One row per user, tracks which org they're currently scoped to.
create table if not exists public.user_active_org (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  updated_at      timestamptz not null default now()
);

-- ── helpers ──────────────────────────────────────────────────────────────────

-- Membership check used by RLS across org-scoped tables.
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org and user_id = auth.uid()
  );
$$;

-- Admin/owner check for invite + member management.
create or replace function public.is_org_admin(org uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org
      and user_id = auth.uid()
      and role in ('owner','admin')
  );
$$;

-- updated_at trigger reuses public.set_updated_at() from 000_bootstrap_scribbles.sql.
drop trigger if exists trg_organizations_updated_at on public.organizations;
create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_user_active_org_updated_at on public.user_active_org;
create trigger trg_user_active_org_updated_at
  before update on public.user_active_org
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.organization_invites  enable row level security;
alter table public.user_active_org       enable row level security;

drop policy if exists "orgs_member_select" on public.organizations;
drop policy if exists "orgs_admin_update"  on public.organizations;
drop policy if exists "orgs_authed_insert" on public.organizations;

create policy "orgs_member_select" on public.organizations
  for select using (public.is_org_member(id));

create policy "orgs_admin_update" on public.organizations
  for update using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

create policy "orgs_authed_insert" on public.organizations
  for insert with check (auth.uid() is not null and auth.uid() = created_by);

drop policy if exists "org_members_self_select"  on public.organization_members;
drop policy if exists "org_members_org_select"   on public.organization_members;
drop policy if exists "org_members_admin_insert" on public.organization_members;
drop policy if exists "org_members_self_insert"  on public.organization_members;
drop policy if exists "org_members_admin_update" on public.organization_members;
drop policy if exists "org_members_admin_delete" on public.organization_members;

-- Members see the full roster of their orgs.
create policy "org_members_org_select" on public.organization_members
  for select using (public.is_org_member(organization_id));

-- A user creating their own personal org inserts themselves as owner.
create policy "org_members_self_insert" on public.organization_members
  for insert with check (user_id = auth.uid());

-- Admin/owner can manage the roster.
create policy "org_members_admin_update" on public.organization_members
  for update using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "org_members_admin_delete" on public.organization_members
  for delete using (public.is_org_admin(organization_id));

drop policy if exists "org_invites_admin_select" on public.organization_invites;
drop policy if exists "org_invites_admin_insert" on public.organization_invites;
drop policy if exists "org_invites_admin_delete" on public.organization_invites;

create policy "org_invites_admin_select" on public.organization_invites
  for select using (public.is_org_admin(organization_id));

create policy "org_invites_admin_insert" on public.organization_invites
  for insert with check (public.is_org_admin(organization_id));

create policy "org_invites_admin_delete" on public.organization_invites
  for delete using (public.is_org_admin(organization_id));

drop policy if exists "user_active_org_self_select" on public.user_active_org;
drop policy if exists "user_active_org_self_upsert" on public.user_active_org;
drop policy if exists "user_active_org_self_update" on public.user_active_org;
drop policy if exists "user_active_org_self_delete" on public.user_active_org;

create policy "user_active_org_self_select" on public.user_active_org
  for select using (user_id = auth.uid());

create policy "user_active_org_self_upsert" on public.user_active_org
  for insert with check (user_id = auth.uid() and public.is_org_member(organization_id));

create policy "user_active_org_self_update" on public.user_active_org
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_org_member(organization_id));

create policy "user_active_org_self_delete" on public.user_active_org
  for delete using (user_id = auth.uid());

-- ── server-side helpers (service_role) ───────────────────────────────────────

-- Creates a personal org + owner membership + active-org pointer for the user.
-- Idempotent: skips if user already belongs to any org.
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

  insert into public.organizations (name, slug, created_by)
  values (v_name, v_slug, p_user_id)
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, p_user_id, 'owner');

  insert into public.user_active_org (user_id, organization_id)
  values (p_user_id, v_org_id)
  on conflict (user_id) do update set organization_id = excluded.organization_id;

  return v_org_id;
end;
$$;

-- Accepts an invite by hashed token. Returns the org id, or null on failure.
create or replace function public.accept_org_invite(
  p_token_hash text,
  p_user_id    uuid,
  p_user_email text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_invite public.organization_invites%rowtype;
begin
  select * into v_invite
  from public.organization_invites
  where token_hash = p_token_hash
  limit 1;

  if not found then
    return null;
  end if;

  if v_invite.accepted_at is not null and v_invite.email is not null then
    return null;
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    return null;
  end if;

  if v_invite.email is not null
     and lower(v_invite.email) <> lower(coalesce(p_user_email, '')) then
    return null;
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_invite.organization_id, p_user_id, v_invite.role)
  on conflict (organization_id, user_id) do nothing;

  if v_invite.email is not null then
    update public.organization_invites
       set accepted_at = now(),
           accepted_by = p_user_id
     where id = v_invite.id;
  end if;

  insert into public.user_active_org (user_id, organization_id)
  values (p_user_id, v_invite.organization_id)
  on conflict (user_id) do update set organization_id = excluded.organization_id;

  return v_invite.organization_id;
end;
$$;

-- ── backfill personal orgs for existing users ────────────────────────────────
-- One personal org per user not already in an org. Wrapped in a do-block so
-- re-runs are safe (insert guarded by NOT EXISTS).
do $$
declare
  r record;
begin
  for r in
    select u.id as user_id,
           u.email,
           coalesce(u.raw_user_meta_data->>'full_name',
                    u.raw_user_meta_data->>'name',
                    split_part(u.email, '@', 1)) as display_name
    from auth.users u
    where not exists (
      select 1 from public.organization_members m where m.user_id = u.id
    )
  loop
    perform public.ensure_default_org(r.user_id, r.email, r.display_name);
  end loop;
end $$;

-- ── comments ─────────────────────────────────────────────────────────────────
comment on table public.organizations         is 'Workspaces / teams. Subscription anchor in Phase 4.';
comment on table public.organization_members  is 'User ↔ org link with role (owner|admin|member).';
comment on table public.organization_invites  is 'Invite-link tokens (hashed). Optional email pin.';
comment on table public.user_active_org       is 'Last-selected org per user, drives org-scoped API context.';
comment on function public.is_org_member(uuid) is 'RLS helper: true if auth.uid() is a member of the given org.';
comment on function public.is_org_admin(uuid)  is 'RLS helper: true if auth.uid() is owner/admin of the given org.';

select pg_notify('pgrst', 'reload schema');
