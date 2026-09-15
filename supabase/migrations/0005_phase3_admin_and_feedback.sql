-- =============================================================================
-- Phase 3 · ADMIN + FEEDBACK SUPPORT
-- =============================================================================
-- Run after 0004. Idempotent — safe to re-run.
--
-- The governing rule (client request #8): an admin manages the platform, never
-- reads anyone's book. There is deliberately NO admin SELECT policy on
-- public.trades. Everything an admin needs is served by SECURITY DEFINER
-- functions that return COUNTS AND DATES ONLY — never a symbol, a price, a
-- quantity or a P&L figure. Adding an admin read policy on `trades` later would
-- silently undo that guarantee.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Account status + activity on profiles
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists is_suspended boolean not null default false;
alter table public.profiles add column if not exists suspended_reason text;
alter table public.profiles add column if not exists last_active_at timestamptz;

-- A suspended user keeps their data but cannot write. Enforced in RLS below so
-- it holds even if the client is bypassed.
create or replace function public.is_active_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_suspended = false
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. Admin audit log — every privileged mutation, who/what/when/before→after
-- -----------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  actor_email text,
  action      text not null,
  target_type text not null,            -- 'user' | 'plan' | 'instrument' | 'feedback' | 'subscription'
  target_id   text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_created_idx
  on public.admin_audit_log (created_at desc);

create or replace function public.log_admin_action(
  p_action      text,
  p_target_type text,
  p_target_id   text,
  p_before      jsonb default null,
  p_after       jsonb default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  select email into v_email from public.profiles where id = auth.uid();

  insert into public.admin_audit_log
    (actor_id, actor_email, action, target_type, target_id, before, after)
  values (auth.uid(), v_email, p_action, p_target_type, p_target_id, p_before, p_after);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Aggregate-only statistics
-- -----------------------------------------------------------------------------
-- Per-user activity. Returns HOW MANY trades and WHEN, never WHAT was traded.
create or replace function public.admin_user_stats()
returns table (
  user_id        uuid,
  trade_count    bigint,
  first_trade_at timestamptz,
  last_trade_at  timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  return query
    select t.user_id, count(*)::bigint, min(t.created_at), max(t.created_at)
    from public.trades t
    group by t.user_id;
end;
$$;

-- Platform totals for the admin overview.
create or replace function public.admin_overview_stats()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'totalUsers',        (select count(*) from public.profiles),
    'suspendedUsers',    (select count(*) from public.profiles where is_suspended),
    'adminUsers',        (select count(*) from public.profiles where role = 'admin'),
    'newUsers7d',        (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'newUsers30d',       (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'activeUsers7d',     (select count(*) from public.profiles where last_active_at > now() - interval '7 days'),
    'totalTrades',       (select count(*) from public.trades),
    'tradesLast7d',      (select count(*) from public.trades where created_at > now() - interval '7 days'),
    'tradingUsers',      (select count(distinct user_id) from public.trades),
    'paidSubscriptions', (select count(*) from public.subscriptions s
                           join public.plans p on p.id = s.plan_id
                          where s.status in ('active','trialing') and p.code <> 'FREE'),
    'freeSubscriptions', (select count(*) from public.subscriptions s
                           join public.plans p on p.id = s.plan_id
                          where p.code = 'FREE' or s.status = 'free'),
    'openFeedback',      (select count(*) from public.feedback where status in ('new','in_review'))
  ) into result;

  return result;
end;
$$;

-- Daily signup counts for the overview chart.
create or replace function public.admin_signup_series(p_days integer default 30)
returns table (day date, signups bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  return query
    select d::date, count(p.id)::bigint
    from generate_series(
      (current_date - (p_days - 1) * interval '1 day'), current_date, interval '1 day'
    ) d
    left join public.profiles p on p.created_at::date = d::date
    group by d
    order by d;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Admin mutations — each re-checks is_admin() and writes an audit entry
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_before text;
begin
  if not public.is_admin() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  if p_role not in ('user', 'admin') then
    raise exception 'Invalid role.';
  end if;
  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'You cannot remove your own admin role.';
  end if;

  select role into v_before from public.profiles where id = p_user_id;
  update public.profiles set role = p_role where id = p_user_id;

  perform public.log_admin_action(
    'set_role', 'user', p_user_id::text,
    jsonb_build_object('role', v_before), jsonb_build_object('role', p_role)
  );
end;
$$;

create or replace function public.admin_set_user_suspended(
  p_user_id uuid,
  p_suspended boolean,
  p_reason text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_before boolean;
begin
  if not public.is_admin() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot suspend your own account.';
  end if;

  select is_suspended into v_before from public.profiles where id = p_user_id;
  update public.profiles
     set is_suspended = p_suspended,
         suspended_reason = case when p_suspended then p_reason else null end
   where id = p_user_id;

  perform public.log_admin_action(
    case when p_suspended then 'suspend_user' else 'unsuspend_user' end,
    'user', p_user_id::text,
    jsonb_build_object('isSuspended', v_before),
    jsonb_build_object('isSuspended', p_suspended, 'reason', p_reason)
  );
end;
$$;

-- Manually grant or change a plan. This is the seam a payment provider plugs
-- into later — nothing else needs to change when Razorpay is added.
create or replace function public.admin_set_subscription(
  p_user_id uuid,
  p_plan_id text,
  p_status  text default 'active',
  p_months  integer default 1
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_before jsonb;
  v_end    timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  select to_jsonb(s) into v_before from public.subscriptions s where s.user_id = p_user_id;
  v_end := case when p_status in ('active','trialing') then now() + (p_months || ' months')::interval end;

  insert into public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
  values (p_user_id, p_plan_id, p_status, now(), v_end)
  on conflict (user_id) do update
    set plan_id = excluded.plan_id,
        status = excluded.status,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end;

  perform public.log_admin_action(
    'set_subscription', 'subscription', p_user_id::text, v_before,
    jsonb_build_object('planId', p_plan_id, 'status', p_status, 'months', p_months)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Track activity so "active users" means something
-- -----------------------------------------------------------------------------
create or replace function public.touch_last_active()
returns void
language sql security definer set search_path = public
as $$
  update public.profiles set last_active_at = now() where id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- 6. RLS
-- -----------------------------------------------------------------------------
alter table public.admin_audit_log enable row level security;

drop policy if exists audit_admin_read on public.admin_audit_log;
create policy audit_admin_read on public.admin_audit_log
  for select to authenticated using (public.is_admin());
-- No INSERT policy: entries are written only by log_admin_action().

-- Suspended users become read-only. Re-created rather than altered so the
-- suspension check is part of the same policy that grants the write.
drop policy if exists trades_insert_own on public.trades;
create policy trades_insert_own on public.trades
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user());

drop policy if exists trades_update_own on public.trades;
create policy trades_update_own on public.trades
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_active_user());

commit;

-- =============================================================================
-- 7. VERIFY
-- =============================================================================

-- a) The admin helper functions exist (expect 7 rows).
select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'admin_user_stats', 'admin_overview_stats', 'admin_signup_series',
    'admin_set_user_role', 'admin_set_user_suspended', 'admin_set_subscription',
    'log_admin_action'
  )
order by routine_name;

-- b) CRITICAL: there must be NO admin read policy on trades.
--    Expect exactly 4 rows, all scoped to `user_id = auth.uid()` and none
--    mentioning is_admin(). If an is_admin() policy appears here, admins can
--    read user trade data and request #8 is violated.
select policyname, cmd, qual::text
from pg_policies
where schemaname = 'public' and tablename = 'trades'
order by policyname;

-- c) The audit log is admin-read-only (expect 1 select policy, no insert policy).
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'admin_audit_log';
