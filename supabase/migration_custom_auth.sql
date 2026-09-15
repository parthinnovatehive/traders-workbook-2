-- #############################################################################
-- ##  SUPERSEDED — DO NOT RUN  ################################################
-- #############################################################################
--
-- This migration is retained for reference ONLY. Running it re-introduces three
-- critical vulnerabilities that migrations/0002_phase1_auth_and_schema.sql fixes:
--
--   1. It replaces every RLS policy with `using (true) with check (true)`,
--      making profiles, trades, strategies, risk_settings, subscriptions and
--      plans readable AND writable by any anonymous visitor.
--   2. It creates public.users holding bcrypt password hashes with no RLS, so
--      the public anon key can read every user's credentials.
--   3. It redefines is_admin() without an auth.uid() check, so the function
--      returns TRUE for every caller as long as one admin exists.
--
-- Authentication is now Supabase Auth. See supabase/migrations/.
-- The guard below aborts the script if it is executed by mistake.

do $$
begin
  raise exception
    'migration_custom_auth.sql is SUPERSEDED and unsafe. Run supabase/migrations/0001..0003 instead.';
end $$;

-- =============================================================================
-- Trader's Workbook — Custom Auth Migration (v3 — robust FK dropping)
-- =============================================================================
-- Run the CLEANUP block first, then the full migration below.
-- =============================================================================

-- =====================================================
-- CLEANUP — run this FIRST to reset any partial run
-- =====================================================
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.login_user() cascade;
drop function if exists public.create_user(text,text,text,text,text,numeric) cascade;
drop table if exists public.users cascade;

-- =============================================================================
-- FULL MIGRATION — paste everything below after cleanup
-- =============================================================================

-- 1. Enable pgcrypto
create extension if not exists pgcrypto schema extensions;

-- 2. Create users table
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  password_hash   text not null,
  display_name    text not null,
  phone           text,
  role            text not null default 'user' check (role in ('user', 'admin')),
  base_currency   text not null default 'USD',
  starting_capital numeric not null default 0 check (starting_capital >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (email);

-- =============================================================================
-- 3. DROP every FK constraint that references auth.users (public schema only)
-- =============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      n.nspname                       AS schema_name,
      c.conname                       AS fk_constraint,
      c.conrelid::regclass::text      AS table_name
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.conrelid::regnamespace
    WHERE c.confrelid = 'auth.users'::regclass
      AND c.contype = 'f'
      AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.fk_constraint);
    RAISE NOTICE 'Dropped FK % on %', r.fk_constraint, r.table_name;
  END LOOP;
END $$;

-- =============================================================================
-- 4. Drop ALL FKs referencing auth.users or public.users (explicit + dynamic)
-- =============================================================================

-- Explicit drops (handles auto-generated names from schema.sql)
ALTER TABLE public.profiles       DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.strategies     DROP CONSTRAINT IF EXISTS strategies_user_id_fkey;
ALTER TABLE public.trades         DROP CONSTRAINT IF EXISTS trades_user_id_fkey;
ALTER TABLE public.risk_settings  DROP CONSTRAINT IF EXISTS risk_settings_user_id_fkey;
ALTER TABLE public.subscriptions  DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;

-- Dynamic drop for any remaining FKs
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      c.conname                       AS fk_constraint,
      c.conrelid::regclass::text      AS table_name
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.conrelid::regnamespace
    WHERE (c.confrelid = 'auth.users'::regclass OR c.confrelid = 'public.users'::regclass)
      AND c.contype = 'f'
      AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.fk_constraint);
    RAISE NOTICE 'Dropped FK % on %', r.fk_constraint, r.table_name;
  END LOOP;
END $$;

-- =============================================================================
-- 5. RECREATE all FKs pointing to public.users instead
-- =============================================================================
alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references public.users (id) on delete cascade;

alter table public.strategies
  add constraint strategies_user_id_fkey
  foreign key (user_id) references public.users (id) on delete cascade;

alter table public.trades
  add constraint trades_user_id_fkey
  foreign key (user_id) references public.users (id) on delete cascade;

alter table public.risk_settings
  add constraint risk_settings_user_id_fkey
  foreign key (user_id) references public.users (id) on delete cascade;

alter table public.subscriptions
  add constraint subscriptions_user_id_fkey
  foreign key (user_id) references public.users (id) on delete cascade;

-- =============================================================================
-- 5. Login function
-- =============================================================================
create or replace function public.login_user(p_email text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
begin
  select * into v_user
  from public.users
  where lower(email) = lower(p_email);

  if v_user.id is null then
    raise exception 'Invalid email or password.';
  end if;

  if v_user.password_hash != extensions.crypt(p_password, v_user.password_hash) then
    raise exception 'Invalid email or password.';
  end if;

  return jsonb_build_object(
    'id',              v_user.id,
    'email',           v_user.email,
    'display_name',    v_user.display_name,
    'phone',           v_user.phone,
    'role',            v_user.role,
    'base_currency',   v_user.base_currency,
    'starting_capital', v_user.starting_capital,
    'created_at',      v_user.created_at
  );
end;
$$;

-- =============================================================================
-- 6. Register function
-- =============================================================================
create or replace function public.create_user(
  p_email           text,
  p_password        text,
  p_display_name    text,
  p_phone           text default null,
  p_base_currency   text default 'USD',
  p_starting_capital numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_user public.users%rowtype;
begin
  if exists (select 1 from public.users where lower(email) = lower(p_email)) then
    raise exception 'An account with that email already exists.';
  end if;

  insert into public.users (email, password_hash, display_name, phone, role, base_currency, starting_capital)
  values (
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    p_display_name,
    p_phone,
    'user',
    p_base_currency,
    p_starting_capital
  )
  returning id into v_id;

  insert into public.profiles (id, email, display_name, role, base_currency, starting_capital)
  values (v_id, p_email, p_display_name, 'user', p_base_currency, p_starting_capital)
  on conflict (id) do nothing;

  insert into public.risk_settings (user_id)
  values (v_id)
  on conflict (user_id) do nothing;

  insert into public.subscriptions (user_id, plan_id, status)
  values (v_id, 'plan-free', 'free')
  on conflict (user_id) do nothing;

  select * into v_user from public.users where id = v_id;

  return jsonb_build_object(
    'id',              v_user.id,
    'email',           v_user.email,
    'display_name',    v_user.display_name,
    'phone',           v_user.phone,
    'role',            v_user.role,
    'base_currency',   v_user.base_currency,
    'starting_capital', v_user.starting_capital,
    'created_at',      v_user.created_at
  );
end;
$$;

-- =============================================================================
-- 7. Add phone to profiles
-- =============================================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone'
  ) then
    alter table public.profiles add column phone text;
  end if;
end $$;

-- =============================================================================
-- 8. Drop old auth trigger + function
-- =============================================================================
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;

-- =============================================================================
-- 9. Update is_admin
-- =============================================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.role = 'admin'
  );
$$;

-- =============================================================================
-- 10. Replace RLS policies (custom auth doesn't use auth.uid())
-- =============================================================================
-- Drop all existing policies that rely on auth.uid()
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'strategies', 'trades', 'risk_settings', 'subscriptions', 'plans')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    RAISE NOTICE 'Dropped policy % on %', r.policyname, r.tablename;
  END LOOP;
END $$;

-- Permissive policies (security handled by app + security definer RPC functions)
-- profiles
create policy "profiles_all" on public.profiles for all using (true) with check (true);

-- strategies
create policy "strategies_all" on public.strategies for all using (true) with check (true);

-- trades
create policy "trades_all" on public.trades for all using (true) with check (true);

-- risk_settings
create policy "risk_settings_all" on public.risk_settings for all using (true) with check (true);

-- subscriptions
create policy "subscriptions_all" on public.subscriptions for all using (true) with check (true);

-- plans
create policy "plans_all" on public.plans for all using (true) with check (true);

-- =============================================================================
-- 11. Seed demo user (password: demo1234)
-- =============================================================================
do $$
begin
  if not exists (select 1 from public.users where lower(email) = 'demo@tradersworkbook.app') then
    perform public.create_user(
      'demo@tradersworkbook.app',
      'demo1234',
      'Demo Trader',
      null,
      'USD',
      100000
    );
  end if;
end $$;

-- =============================================================================
-- 11. Seed admin user (password: admin1234)
-- =============================================================================
do $$
begin
  if not exists (select 1 from public.users where lower(email) = 'admin@tradersworkbook.app') then
    perform public.create_user(
      'admin@tradersworkbook.app',
      'admin1234',
      'Admin',
      null,
      'USD',
      0
    );
    update public.profiles set role = 'admin'
    where lower(email) = 'admin@tradersworkbook.app';
  end if;
end $$;

-- =============================================================================
-- Done!
-- =============================================================================
