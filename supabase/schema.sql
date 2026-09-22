-- =============================================================================
-- Trader's Workbook — Supabase schema
-- =============================================================================
-- Paste the ENTIRE file into your new Supabase project (Dashboard → SQL Editor
-- → Run). It creates:
--   1. Tables:      profiles, strategies, plans, trades, risk_settings, subscriptions
--   2. Functions:   is_admin, can_edit_profile, enforce_trade_limit, handle_new_user
--   3. RLS policies so users can only touch their OWN rows
--   4. Triggers:    profile + free subscription + default risk on signup,
--                   updated_at maintenance, server-side free-plan trade limit
--   5. Seed data:   pricing plans and system strategies
--
-- NOTE: tables are created BEFORE the functions that reference them (Postgres
-- parses `language sql` function bodies at CREATE time, and PL/pgSQL
-- %ROWTYPE/%TYPE references also need the target table to exist).
--
-- After running, set your .env.local:
--   VITE_DATA_SOURCE=supabase
--   VITE_SUPABASE_URL=<project-url>
--   VITE_SUPABASE_ANON_KEY=<anon-public-key>
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

-- 1a. profiles  (one row per auth.users account)
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  display_name    text not null,
  role            text not null default 'user' check (role in ('user', 'admin')),
  base_currency   text not null default 'USD',
  starting_capital numeric not null default 0 check (starting_capital >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 1b. strategies  (system rows: user_id NULL + is_system = true)
create table if not exists public.strategies (
  id          text primary key,          -- system slugs ('sys-smc') or uuid for custom
  user_id     uuid references auth.users (id) on delete cascade, -- null => system default
  name        text not null,
  description text,
  is_system   boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 1c. plans  (admin-managed pricing; read by everybody)
create table if not exists public.plans (
  id             text primary key,       -- 'plan-free', 'plan-pro-monthly', ...
  code           text not null check (code in ('FREE', 'PRO', 'ELITE')),
  name           text not null,
  price          numeric not null default 0 check (price >= 0),
  billing_period text not null check (billing_period in ('monthly', 'quarterly', 'yearly')),
  currency       text not null default 'INR',
  features       jsonb not null default '[]'::jsonb,
  limits         jsonb not null default '{}'::jsonb,
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  -- Discount vs paying monthly for the same span. Display/intent only —
  -- `price` is what create_payment_order charges.
  discount_percent numeric not null default 0
                 check (discount_percent >= 0 and discount_percent < 100)
);

-- 1d. trades  (the journal)
create table if not exists public.trades (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  trading_mode    text check (trading_mode in ('forex', 'indian')),
  entry_date      date not null,
  entry_time      text,                   -- 'HH:mm'
  exit_date       date,
  exit_time       text,
  symbol          text not null,
  market          text not null check (market in ('Equity', 'Futures', 'Options', 'Forex', 'Crypto', 'Commodities', 'Index', 'Other')),
  direction       text not null check (direction in ('long', 'short')),
  base_currency   text,
  quote_currency  text,
  lot_type        text,
  exchange        text,
  segment         text,
  account_currency text,
  entry_price     numeric not null,
  exit_price      numeric,                 -- null => open trade
  quantity        numeric not null,
  lot_size        numeric,
  stop_loss       numeric,
  target          numeric,
  charges         numeric not null default 0 check (charges >= 0),
  conversion_rate numeric,
  pip_distance    numeric,
  pip_value       numeric,
  strategy_id     text references public.strategies (id),
  setup           text,
  market_condition text,
  notes           text,
  psychology      text[] not null default '{}',
  mistakes        text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists trades_user_created_idx on public.trades (user_id, created_at desc);
create index if not exists trades_strategy_idx  on public.trades (strategy_id);

-- 1e. risk_settings  (one row per user PER TRADING MODE)
-- `daily_loss_limit` is an absolute amount in that book's own currency, so a
-- single global row cannot express both a rupee limit and a dollar one.
-- See 0006_risk_per_mode_entitlements_content.sql.
create table if not exists public.risk_settings (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  trading_mode       text not null default 'forex' check (trading_mode in ('forex','indian')),
  risk_per_trade_pct numeric not null default 1,
  daily_loss_limit   numeric not null default 1000 check (daily_loss_limit >= 0),
  max_drawdown_pct   numeric not null default 15,
  max_position_pct   numeric not null default 25,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, trading_mode)
);

-- 1f. subscriptions  (one active subscription per user)
create table if not exists public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references auth.users (id) on delete cascade,
  plan_id             text not null references public.plans (id),
  status              text not null default 'free' check (status in ('free', 'active', 'trialing', 'past_due', 'expired', 'canceled')),
  current_period_start timestamptz,
  current_period_end  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Functions
-- -----------------------------------------------------------------------------

-- Keep updated_at in sync on row changes. (No table deps — safe anywhere.)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Is the current (ANON) user an admin? Used by every write policy.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Users edit their own name / currency / capital ONLY (role + email locked).
-- Admins may edit anything (used to grant the 'admin' role).
create or replace function public.can_edit_profile(target public.profiles)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
         or (
           auth.uid() = target.id
           and target.role   = (select role   from public.profiles where id = auth.uid())
           and target.email  = (select email  from public.profiles where id = auth.uid())
         );
$$;

-- Server-side enforcement of the free-plan trade limit (source of truth).
create or replace function public.enforce_trade_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  free_plan public.plans%rowtype;
  v_plan    public.plans%rowtype;
  v_sub     public.subscriptions%rowtype;
  v_limit   numeric;
  v_used    integer;
begin
  select * into free_plan from public.plans where code = 'FREE' limit 1;
  if free_plan.id is null then return new; end if;

  select * into v_sub
  from public.subscriptions
  where user_id = new.user_id
  order by created_at desc
  limit 1;

  if v_sub.id is not null
     and v_sub.status in ('active', 'trialing')
     and (v_sub.current_period_end is null or v_sub.current_period_end > now()) then
    select * into v_plan from public.plans where id = v_sub.plan_id;
  end if;

  if v_plan.id is null then
    v_plan := free_plan;  -- expired / canceled / no subscription => free limits
  end if;

  v_limit := coalesce((v_plan.limits ->> 'maxTrades')::numeric, 30);
  if v_limit >= 0 then
    v_used := (select count(*) from public.trades where user_id = new.user_id);
    if v_used >= v_limit then
      raise exception 'You''ve reached your free trade limit.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- On every new Supabase Auth signup: create the profile, a FREE subscription
-- and default risk settings. Registration metadata (display_name,
-- base_currency, starting_capital) comes from the client's signUp() call.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta            jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_display_name  text  := coalesce(meta ->> 'display_name', split_part(new.email, '@', 1));
  v_currency      text  := coalesce(meta ->> 'base_currency', 'USD');
  v_capital       numeric := coalesce((meta ->> 'starting_capital')::numeric, 0);
begin
  insert into public.profiles (id, email, display_name, role, base_currency, starting_capital)
  values (new.id, new.email, v_display_name, 'user', v_currency, v_capital)
  on conflict (id) do nothing;

  -- One rule set per book: a daily loss limit is an amount in that book's
  -- own currency, so the two cannot share a row.
  insert into public.risk_settings (user_id, trading_mode, daily_loss_limit)
  values (new.id, 'forex',  1000),
         (new.id, 'indian', 25000)
  on conflict (user_id, trading_mode) do nothing;

  insert into public.subscriptions (user_id, plan_id, status)
  values (new.id, 'plan-free', 'free')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Row-Level Security policies
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Anyone can view their own profile; admins can view all (Admin panel).
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (public.is_admin() or auth.uid() = id);

-- Created automatically by the auth trigger (below); self-insert as a fallback.
create policy "profiles_insert_self"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_self_or_admin"
  on public.profiles for update
  using (public.can_edit_profile(profiles))
  with check (public.can_edit_profile(profiles));

alter table public.strategies enable row level security;

-- Everyone can read system strategies; users also read (and manage) their own.
create policy "strategies_select_system_or_own"
  on public.strategies for select
  using (public.is_admin() or is_system = true or user_id = auth.uid());

create policy "strategies_insert_own"
  on public.strategies for insert
  with check (user_id = auth.uid());

create policy "strategies_update_own_or_admin"
  on public.strategies for update
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());

create policy "strategies_delete_own_or_admin"
  on public.strategies for delete
  using (public.is_admin() or user_id = auth.uid());

alter table public.plans enable row level security;

create policy "plans_public_read"
  on public.plans for select
  using (true);

create policy "plans_admin_write"
  on public.plans for insert
  with check (public.is_admin());

create policy "plans_admin_update"
  on public.plans for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "plans_admin_delete"
  on public.plans for delete
  using (public.is_admin());

alter table public.trades enable row level security;

create policy "trades_select_own_or_admin"
  on public.trades for select
  using (public.is_admin() or auth.uid() = user_id);

create policy "trades_insert_own"
  on public.trades for insert
  with check (auth.uid() = user_id);

create policy "trades_update_own"
  on public.trades for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "trades_delete_own"
  on public.trades for delete
  using (auth.uid() = user_id);

alter table public.risk_settings enable row level security;

create policy "risk_select_own"
  on public.risk_settings for select
  using (auth.uid() = user_id);

create policy "risk_insert_own"
  on public.risk_settings for insert
  with check (auth.uid() = user_id);

create policy "risk_update_own"
  on public.risk_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "risk_delete_own"
  on public.risk_settings for delete
  using (auth.uid() = user_id);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own_or_admin"
  on public.subscriptions for select
  using (public.is_admin() or auth.uid() = user_id);

create policy "subscriptions_insert_own"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);

create policy "subscriptions_update_own_or_admin"
  on public.subscriptions for update
  using (public.is_admin() or auth.uid() = user_id)
  with check (public.is_admin() or auth.uid() = user_id);

create policy "subscriptions_delete_own_or_admin"
  on public.subscriptions for delete
  using (public.is_admin() or auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. Triggers
-- -----------------------------------------------------------------------------

-- Auto-create profile + free subscription + risk settings on Auth signup.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trades_set_updated_at
  before update on public.trades
  for each row execute function public.set_updated_at();

create trigger risk_settings_set_updated_at
  before update on public.risk_settings
  for each row execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Enforce the free-plan trade limit before every INSERT into trades.
create trigger trades_enforce_limit
  before insert on public.trades
  for each row execute function public.enforce_trade_limit();

-- -----------------------------------------------------------------------------
-- 5. Seed data
-- -----------------------------------------------------------------------------

-- Pricing plans (mirrors src/config/plans.ts). Free = fallback when no plan.
insert into public.plans (id, code, name, price, billing_period, currency, features, limits, is_active, sort_order)
values
  (
    'plan-free',
    'FREE',
    'Free',
    0,
    'monthly',
    'INR',
    '["Up to 30 trades", "Journal, calendar & core metrics", "Dashboard", "1 custom strategy"]'::jsonb,
    '{"maxTrades": 30, "customStrategies": 1, "advanced_analytics": false, "advanced_risk": false, "reports": false, "export": false, "strategy_analytics": false, "psychology_analytics": false, "halls": false}'::jsonb,
    true,
    0
  ),
  (
    'plan-pro-monthly',
    'PRO',
    'Pro',
    1599,
    'monthly',
    'INR',
    '["Unlimited trades", "Full analytics suite", "Advanced risk tools", "Strategy & psychology analytics", "Reports + CSV export", "Unlimited custom strategies"]'::jsonb,
    '{"maxTrades": -1, "customStrategies": -1, "advanced_analytics": true, "advanced_risk": true, "reports": true, "export": true, "strategy_analytics": true, "psychology_analytics": true, "halls": false}'::jsonb,
    true,
    1
  ),
  (
    'plan-elite-monthly',
    'ELITE',
    'Elite',
    3299,
    'monthly',
    'INR',
    '["Everything in Pro", "Hall of Fame & Hall of Shame", "Priority support"]'::jsonb,
    '{"maxTrades": -1, "customStrategies": -1, "advanced_analytics": true, "advanced_risk": true, "reports": true, "export": true, "strategy_analytics": true, "psychology_analytics": true, "halls": true}'::jsonb,
    true,
    2
  ),
  (
    'plan-pro-yearly',
    'PRO',
    'Pro',
    15499,
    'yearly',
    'INR',
    '["Unlimited trades", "Full analytics suite", "Advanced risk tools", "Strategy & psychology analytics", "Reports + CSV export", "Unlimited custom strategies"]'::jsonb,
    '{"maxTrades": -1, "customStrategies": -1, "advanced_analytics": true, "advanced_risk": true, "reports": true, "export": true, "strategy_analytics": true, "psychology_analytics": true, "halls": false}'::jsonb,
    true,
    3
  ),
  (
    'plan-elite-yearly',
    'ELITE',
    'Elite',
    31999,
    'yearly',
    'INR',
    '["Everything in Pro", "Hall of Fame & Hall of Shame", "Priority support"]'::jsonb,
    '{"maxTrades": -1, "customStrategies": -1, "advanced_analytics": true, "advanced_risk": true, "reports": true, "export": true, "strategy_analytics": true, "psychology_analytics": true, "halls": true}'::jsonb,
    true,
    4
  )
on conflict (id) do nothing;

-- System strategies visible to every user (mirrors src/constants/strategies.ts).
insert into public.strategies (id, user_id, name, description, is_system, is_active)
values
  ('sys-smc',          null, 'SMC',          'Smart Money Concepts',                true, true),
  ('sys-order-flow',   null, 'Order Flow',   'Order flow / footprint reading',      true, true),
  ('sys-price-action', null, 'Price Action', 'Naked price action',                 true, true),
  ('sys-breakout',     null, 'Breakout',     'Range / level breakout',              true, true),
  ('sys-reversal',     null, 'Reversal',     'Counter-trend reversal',              true, true),
  ('sys-scalping',     null, 'Scalping',     'Very short-term scalps',              true, true),
  ('sys-swing',        null, 'Swing',        'Multi-day swing trades',              true, true),
  ('sys-none',         null, 'None',         'No defined strategy',                 true, true)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Post-setup (run manually, ONE TIME, after creating your account):
--   Grant YOUR account the admin role:
--     update public.profiles set role = 'admin'
--     where id = (select id from auth.users where email = '<your-email>');
--   Note: the free-plan trade limit trigger only fires when the user has a
--   subscription row (auto-created on signup). Paid limits apply once the user
--   subscribes through the app.
-- =============================================================================