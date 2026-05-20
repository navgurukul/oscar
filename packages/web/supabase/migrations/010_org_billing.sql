-- Phase 4 — org-scoped billing + usage
-- Pivots subscriptions and usage_tracking from user-keyed to org-keyed, adds
-- a transfer_org_ownership helper, and a partial UNIQUE so each org has at
-- most one live subscription row. user_id stays on every row as a legacy
-- pointer so existing code keeps compiling during rollout.

-- ── subscriptions: gain organization_id ─────────────────────────────────────
alter table if exists public.subscriptions
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

create index if not exists idx_subscriptions_organization_id
  on public.subscriptions(organization_id)
  where organization_id is not null;

-- Backfill: every existing subscription is reassigned to the row owner's
-- personal org (the one ensure_default_org created in migration 007).
-- Idempotent: skips rows that already have organization_id.
do $$
declare
  r record;
  v_org uuid;
begin
  for r in
    select id, user_id
    from public.subscriptions
    where organization_id is null
      and user_id is not null
  loop
    select organization_id into v_org
    from public.organization_members
    where user_id = r.user_id
    order by joined_at asc
    limit 1;

    if v_org is null then
      raise notice 'subscriptions backfill: no org for user %, skipping row %', r.user_id, r.id;
      continue;
    end if;

    update public.subscriptions
       set organization_id = v_org
     where id = r.id;
  end loop;
end $$;

-- Drop the old (user_id) UNIQUE so multiple admins of one org cannot each
-- create competing subscription rows for the same workspace, and so the same
-- user can later be in multiple orgs.
do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and constraint_name = 'subscriptions_user_id_key'
      and constraint_type = 'UNIQUE'
  ) then
    execute 'alter table public.subscriptions drop constraint subscriptions_user_id_key';
  end if;
end $$;

create unique index if not exists idx_subscriptions_organization_unique
  on public.subscriptions(organization_id)
  where organization_id is not null;

-- ── usage_tracking: gain organization_id ────────────────────────────────────
alter table if exists public.usage_tracking
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

create index if not exists idx_usage_tracking_org_month
  on public.usage_tracking(organization_id, month_year)
  where organization_id is not null;

-- Backfill same as subscriptions.
do $$
declare
  r record;
  v_org uuid;
begin
  for r in
    select id, user_id
    from public.usage_tracking
    where organization_id is null
      and user_id is not null
  loop
    select organization_id into v_org
    from public.organization_members
    where user_id = r.user_id
    order by joined_at asc
    limit 1;

    if v_org is null then
      continue;
    end if;

    update public.usage_tracking
       set organization_id = v_org
     where id = r.id;
  end loop;
end $$;

-- Drop old UNIQUE (user_id, month_year), replace with the org-keyed variant.
do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'usage_tracking'
      and constraint_name = 'usage_tracking_user_id_month_year_key'
      and constraint_type = 'UNIQUE'
  ) then
    execute 'alter table public.usage_tracking drop constraint usage_tracking_user_id_month_year_key';
  end if;
end $$;

create unique index if not exists idx_usage_tracking_org_month_unique
  on public.usage_tracking(organization_id, month_year)
  where organization_id is not null;

-- ── increment_org_recording_usage ────────────────────────────────────────────
-- Org-scoped variant of increment_recording_usage. Counts every member's
-- recording against the shared org row for the current month.
create or replace function public.increment_org_recording_usage(
  p_org_id     uuid,
  p_user_id    uuid,
  p_month_year text
)
returns integer
language plpgsql
security definer
as $$
declare
  v_new_count integer;
begin
  insert into public.usage_tracking (organization_id, user_id, month_year, recording_count, updated_at)
  values (p_org_id, p_user_id, p_month_year, 1, now())
  on conflict (organization_id, month_year)
  where organization_id is not null
  do update set
    recording_count = public.usage_tracking.recording_count + 1,
    updated_at      = now()
  returning recording_count into v_new_count;

  return v_new_count;
end;
$$;

revoke all on function public.increment_org_recording_usage(uuid, uuid, text) from public;
grant execute on function public.increment_org_recording_usage(uuid, uuid, text) to service_role;

-- ── transfer_org_ownership ──────────────────────────────────────────────────
-- Atomic owner→admin / admin|member→owner swap. Caller (current owner) is
-- verified in the API layer; here we only enforce that both rows exist for
-- the same org and the new owner is currently a member.
create or replace function public.transfer_org_ownership(
  p_org_id        uuid,
  p_current_owner uuid,
  p_new_owner     uuid
)
returns void
language plpgsql
security definer
as $$
begin
  if p_current_owner = p_new_owner then
    raise exception 'new owner must differ from current owner';
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = p_current_owner
      and role = 'owner'
  ) then
    raise exception 'caller is not the current owner of this organization';
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = p_new_owner
  ) then
    raise exception 'new owner must already be a member of this organization';
  end if;

  update public.organization_members
     set role = 'admin'
   where organization_id = p_org_id
     and user_id = p_current_owner;

  update public.organization_members
     set role = 'owner'
   where organization_id = p_org_id
     and user_id = p_new_owner;
end;
$$;

revoke all on function public.transfer_org_ownership(uuid, uuid, uuid) from public;
grant execute on function public.transfer_org_ownership(uuid, uuid, uuid) to service_role;

-- ── RLS refresh ────────────────────────────────────────────────────────────
-- Members can read their org's subscription / usage rows so the billing UI
-- works for everyone. Mutations stay locked to service_role.
drop policy if exists "Users can view their own subscription" on public.subscriptions;
drop policy if exists "Users can view their org subscription" on public.subscriptions;

create policy "Users can view their org subscription" on public.subscriptions
  for select using (
    organization_id is not null and public.is_org_member(organization_id)
  );

drop policy if exists "Users can view their own usage"     on public.usage_tracking;
drop policy if exists "Users can view their org usage"     on public.usage_tracking;

create policy "Users can view their org usage" on public.usage_tracking
  for select using (
    organization_id is not null and public.is_org_member(organization_id)
  );

comment on column public.subscriptions.organization_id is
  'Workspace the subscription belongs to. Authoritative since Phase 4; user_id is a legacy ownership pointer.';
comment on column public.usage_tracking.organization_id is
  'Workspace the usage row belongs to. All members of the org share the same monthly counter.';

select pg_notify('pgrst', 'reload schema');
