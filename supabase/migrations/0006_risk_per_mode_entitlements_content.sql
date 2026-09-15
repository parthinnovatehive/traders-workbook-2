-- =============================================================================
-- RISK PER MODE · ENTITLEMENT ENFORCEMENT · SITE CONTENT · ONBOARDING
-- =============================================================================
-- Run after 0005. Idempotent — safe to re-run.
--
-- Four independent fixes that happen to share a migration:
--
--   1. risk_settings becomes per (user, trading_mode). A daily loss limit is an
--      absolute amount in the book's own currency, so one global row could not
--      express both: the same "10000" rendered as ₹10,000 or $10,000 depending
--      on which mode the user was looking at.
--   2. The plans' `halls` entitlement, plus a server-side strategy limit. The
--      custom-strategy allowance was advertised on every plan and enforced
--      nowhere, so Free users had unlimited strategies.
--   3. site_content — marketing copy, FAQ and announcement banner, editable by
--      an admin instead of hardcoded in components.
--   4. profiles.onboarded_at, so the first-run wizard shows exactly once.
--
-- Plus the index that makes the now mode-scoped trade queries cheap.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Risk settings per trading mode
-- -----------------------------------------------------------------------------
alter table public.risk_settings
  add column if not exists trading_mode text;

-- Existing rows describe the book the user was actually trading when they set
-- them. Forex is the historical default (it is what the old single account
-- was), so adopt them there rather than discarding anyone's configuration.
update public.risk_settings set trading_mode = 'forex' where trading_mode is null;

alter table public.risk_settings
  alter column trading_mode set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'risk_settings_trading_mode_check'
  ) then
    alter table public.risk_settings
      add constraint risk_settings_trading_mode_check
      check (trading_mode in ('forex', 'indian'));
  end if;
end $$;

-- One row per user per book replaces one row per user.
alter table public.risk_settings drop constraint if exists risk_settings_user_id_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'risk_settings_user_mode_key'
  ) then
    alter table public.risk_settings
      add constraint risk_settings_user_mode_key unique (user_id, trading_mode);
  end if;
end $$;

-- Open the missing Indian book for every existing user, seeded in rupees.
insert into public.risk_settings
  (user_id, trading_mode, risk_per_trade_pct, daily_loss_limit, max_drawdown_pct, max_position_pct)
select p.id, 'indian', 1, 25000, 15, 25
from public.profiles p
on conflict (user_id, trading_mode) do nothing;


-- -----------------------------------------------------------------------------
-- 1b. Re-point the signup bootstrap at the new key
-- -----------------------------------------------------------------------------
-- MUST accompany the constraint change above: handle_new_user() from 0002 ends
-- with `on conflict (user_id) do nothing` on risk_settings. That unique index no
-- longer exists, so leaving the old function in place makes every new signup
-- fail outright. It now opens both books, like trading_accounts already does.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  meta             jsonb   := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_display_name   text    := coalesce(nullif(meta ->> 'display_name', ''), split_part(new.email, '@', 1));
  v_phone          text    := nullif(meta ->> 'phone', '');
  v_forex_ccy      text    := coalesce(nullif(meta ->> 'forex_currency', ''), 'USD');
  v_forex_capital  numeric := coalesce((meta ->> 'forex_starting_capital')::numeric, 0);
  v_indian_capital numeric := coalesce((meta ->> 'indian_starting_capital')::numeric, 0);
  v_free_plan_id   text;
begin
  insert into public.profiles (id, email, display_name, phone, role, base_currency, starting_capital)
  values (new.id, new.email, v_display_name, v_phone, 'user', v_forex_ccy, v_forex_capital)
  on conflict (id) do nothing;

  insert into public.trading_accounts (user_id, trading_mode, currency, starting_capital)
  values (new.id, 'forex',  v_forex_ccy, v_forex_capital),
         (new.id, 'indian', 'INR',       v_indian_capital)
  on conflict (user_id, trading_mode) do nothing;

  -- One rule set per book, each denominated in that book's own currency.
  insert into public.risk_settings (user_id, trading_mode, daily_loss_limit)
  values (new.id, 'forex',  1000),
         (new.id, 'indian', 25000)
  on conflict (user_id, trading_mode) do nothing;

  select id into v_free_plan_id from public.plans where code = 'FREE' order by sort_order limit 1;
  if v_free_plan_id is not null then
    insert into public.subscriptions (user_id, plan_id, status, current_period_start)
    values (new.id, v_free_plan_id, 'free', now())
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- 2a. Entitlements — add the `halls` flag to every plan
-- -----------------------------------------------------------------------------
-- Hall of Fame / Hall of Shame are sold under Elite. `canAccessFeature` treats a
-- missing key as denied, so without this backfill an Elite subscriber would
-- lose access to what they are paying for.
update public.plans
   set limits = limits || jsonb_build_object('halls', code = 'ELITE')
 where not (limits ? 'halls');

-- `ai_insights` stays in the schema as a reserved flag. It is deliberately not
-- advertised in any plan's feature list: the AI review layer does not exist yet.


-- -----------------------------------------------------------------------------
-- 2b. Server-side custom-strategy limit
-- -----------------------------------------------------------------------------
-- The twin of `enforce_trade_limit`. The client checks first for a friendly
-- message; this is what makes the limit real.
create or replace function public.enforce_strategy_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_sub     public.subscriptions%rowtype;
  v_plan    public.plans%rowtype;
  v_limit   numeric;
  v_used    integer;
begin
  -- System strategies ship with the app and never count against a user's plan.
  if new.is_system or new.user_id is null then
    return new;
  end if;

  select * into v_sub from public.subscriptions where user_id = new.user_id;

  if found then
    select * into v_plan from public.plans where id = v_sub.plan_id;
  end if;

  -- An expired or cancelled paid plan falls back to Free's allowance, matching
  -- `effectivePlan()` in src/lib/entitlements.ts.
  if v_plan.id is null
     or v_plan.code = 'FREE'
     or v_sub.status not in ('active', 'trialing')
     or (v_sub.current_period_end is not null and v_sub.current_period_end < now())
  then
    select * into v_plan from public.plans where code = 'FREE' order by sort_order limit 1;
  end if;

  v_limit := coalesce((v_plan.limits ->> 'customStrategies')::numeric, 1);
  if v_limit < 0 then
    return new;  -- unlimited
  end if;

  select count(*) into v_used
  from public.strategies
  where user_id = new.user_id and is_system = false;

  if v_used >= v_limit then
    raise exception 'Your plan includes % custom strategies. Upgrade to add more.', v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists strategies_enforce_limit on public.strategies;
create trigger strategies_enforce_limit
  before insert on public.strategies
  for each row execute function public.enforce_strategy_limit();


-- -----------------------------------------------------------------------------
-- 3. Editable site content
-- -----------------------------------------------------------------------------
-- A single row (id = 'site'). Public read like `plans` and `instruments`;
-- writes go through admin_update_content() so they are audited.
create table if not exists public.site_content (
  id           text primary key default 'site',
  announcement jsonb not null default '{"enabled": false, "message": "", "tone": "info"}'::jsonb,
  marketing    jsonb not null default '{}'::jsonb,
  faqs         jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now(),
  constraint site_content_single_row check (id = 'site')
);

insert into public.site_content (id) values ('site') on conflict (id) do nothing;

create or replace function public.admin_update_content(
  p_announcement jsonb default null,
  p_marketing    jsonb default null,
  p_faqs         jsonb default null
)
returns public.site_content
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.site_content;
begin
  if not public.is_admin() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  update public.site_content
     set announcement = coalesce(p_announcement, announcement),
         marketing    = coalesce(p_marketing, marketing),
         faqs         = coalesce(p_faqs, faqs),
         updated_at   = now()
   where id = 'site'
  returning * into v_row;

  -- Which sections moved, not their contents: whole marketing pages in the
  -- audit log would bury the entries that matter.
  perform public.log_admin_action(
    'update_content', 'content', 'site', null,
    jsonb_build_object(
      'sections',
      (select jsonb_agg(s) from unnest(array[
        case when p_announcement is not null then 'announcement' end,
        case when p_marketing    is not null then 'marketing'    end,
        case when p_faqs         is not null then 'faqs'         end
      ]) s where s is not null)
    )
  );

  return v_row;
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. Onboarding
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists onboarded_at timestamptz;

-- Anyone who already has trades has plainly found their way around; don't
-- interrupt them with a first-run wizard on their next visit.
update public.profiles p
   set onboarded_at = now()
 where onboarded_at is null
   and exists (select 1 from public.trades t where t.user_id = p.id);

-- A user may record that they finished onboarding, but nothing else new:
-- `can_edit_profile` still blocks changing their own role or email.


-- -----------------------------------------------------------------------------
-- 5. Index for mode-scoped trade queries
-- -----------------------------------------------------------------------------
-- Every page now fetches one book rather than filtering both on the client.
create index if not exists trades_user_mode_idx
  on public.trades (user_id, trading_mode);


-- -----------------------------------------------------------------------------
-- 6. RLS
-- -----------------------------------------------------------------------------
alter table public.site_content enable row level security;

drop policy if exists site_content_public_read on public.site_content;
create policy site_content_public_read on public.site_content
  for select to anon, authenticated using (true);

drop policy if exists site_content_admin_write on public.site_content;
create policy site_content_admin_write on public.site_content
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.site_content to anon;
grant select, update on public.site_content to authenticated;  -- gated by RLS to admins

commit;

-- =============================================================================
-- 7. VERIFY
-- =============================================================================

-- a) Every user has exactly two risk rows, one per book.
select trading_mode, count(*) as rows
from public.risk_settings
group by trading_mode
order by trading_mode;

-- b) Every plan carries the `halls` flag, and only ELITE has it on.
select code, billing_period, limits -> 'halls' as halls, limits -> 'customStrategies' as strategies
from public.plans
order by sort_order;

-- c) The strategy limit is live (expect 1 row).
select tgname from pg_trigger where tgname = 'strategies_enforce_limit';

-- d) Content is publicly readable but admin-write only (expect 2 policies).
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'site_content'
order by policyname;
