-- =============================================================================
-- Phase 1 · Step 2 of 3 — AUTH CUTOVER + SCHEMA
-- =============================================================================
-- Run AFTER 0001_phase1_preflight.sql, and after taking a backup.
-- Idempotent: safe to re-run.
--
-- What this does:
--   A. Undoes the custom-auth security regressions
--        - every table was `using (true) with check (true)` (world read+write)
--        - public.users stored bcrypt hashes with NO row-level security
--        - is_admin() had no auth.uid() check, so it returned TRUE for everyone
--   B. Moves authentication to Supabase Auth (auth.users)
--   C. Adds the Phase 1 tables: trading_accounts, instruments,
--      user_favourites, feedback
--   D. Backfills trades.trading_mode / account_currency and creates both
--      trading accounts for every existing user
--   E. Re-enables real Row-Level Security on everything
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. "FRESH START" — DESTRUCTIVE. **ENABLED.**
-- -----------------------------------------------------------------------------
-- Deletes ALL app data belonging to users that do not exist in auth.users —
-- i.e. the leftover custom-auth accounts. Plans and strategies marked
-- is_system are kept. There is no undo.
--
-- Enabled deliberately: the preflight found 3 legacy accounts sharing 1 trade,
-- confirmed as development test data. If you are re-running this file against a
-- DIFFERENT database, comment this block out again first.
--
-- To keep those accounts instead, comment this block out and follow
-- 0002a_optional_preserve_existing_users.sql before running this file.
-- -----------------------------------------------------------------------------
delete from public.trades        where user_id not in (select id from auth.users);
delete from public.strategies    where user_id is not null and user_id not in (select id from auth.users);
delete from public.risk_settings where user_id not in (select id from auth.users);
delete from public.subscriptions where user_id not in (select id from auth.users);
delete from public.profiles      where id      not in (select id from auth.users);


-- -----------------------------------------------------------------------------
-- 1. Guard — refuse to continue if app data references non-auth users
-- -----------------------------------------------------------------------------
do $$
declare
  v_orphans integer;
begin
  select
      (select count(*) from public.trades        where user_id not in (select id from auth.users))
    + (select count(*) from public.strategies    where user_id is not null and user_id not in (select id from auth.users))
    + (select count(*) from public.risk_settings where user_id not in (select id from auth.users))
    + (select count(*) from public.subscriptions where user_id not in (select id from auth.users))
    + (select count(*) from public.profiles      where id      not in (select id from auth.users))
  into v_orphans;

  if v_orphans > 0 then
    raise exception
      'Migration stopped: % row(s) reference a user that does not exist in auth.users. Re-read 0001_phase1_preflight.sql (CASE B or CASE C) and resolve them first.',
      v_orphans;
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 2. Extensions
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;


-- -----------------------------------------------------------------------------
-- 3. Shared helper functions
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Restores the auth.uid() check the custom-auth migration removed.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Users may edit their own profile but never their own role or email.
create or replace function public.can_edit_profile(target public.profiles)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin()
         or (
           auth.uid() = target.id
           and target.role  = (select role  from public.profiles where id = auth.uid())
           and target.email = (select email from public.profiles where id = auth.uid())
         );
$$;


-- -----------------------------------------------------------------------------
-- 4. Phase 1 tables
-- -----------------------------------------------------------------------------

-- 4a. Two trading accounts per user (request #5) --------------------------------
create table if not exists public.trading_accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  trading_mode     text not null check (trading_mode in ('forex', 'indian')),
  currency         text not null,
  starting_capital numeric not null default 0 check (starting_capital >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint trading_accounts_user_mode_key unique (user_id, trading_mode),
  -- The Indian account is ALWAYS INR (request #2, enforced in the database so
  -- no client bug can produce a rupee account denominated in dollars).
  constraint trading_accounts_indian_is_inr
    check (trading_mode <> 'indian' or currency = 'INR')
);

drop trigger if exists trading_accounts_set_updated_at on public.trading_accounts;
create trigger trading_accounts_set_updated_at
  before update on public.trading_accounts
  for each row execute function public.set_updated_at();

-- 4b. Instrument master (requests #1, #3) ---------------------------------------
-- Lot sizes are revised by the exchanges several times a year, so they live in
-- the database and are admin-editable — never a redeploy.
create table if not exists public.instruments (
  id             text primary key,             -- 'NSE:RELIANCE' | 'FX:EURUSD'
  trading_mode   text not null check (trading_mode in ('forex', 'indian')),
  symbol         text not null,
  name           text not null,
  exchange       text,                          -- NSE | BSE | null for FX
  also_on        text[] not null default '{}',  -- other exchanges the name trades on
  segment        text check (segment in ('INDEX', 'FUT', 'OPT', 'EQ')),
  base_currency  text,
  quote_currency text,
  contract_size  numeric not null default 1 check (contract_size > 0),
  lot_size       numeric not null default 1 check (lot_size > 0),
  pip_size       numeric,
  tick_size      numeric not null default 0.05 check (tick_size > 0),
  category       text,                          -- major | minor | exotic | metal | crypto
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint instruments_mode_symbol_key unique (trading_mode, symbol)
);

create index if not exists instruments_mode_active_idx
  on public.instruments (trading_mode, is_active, sort_order);

drop trigger if exists instruments_set_updated_at on public.instruments;
create trigger instruments_set_updated_at
  before update on public.instruments
  for each row execute function public.set_updated_at();

-- 4c. Per-user favourites (request #4) ------------------------------------------
create table if not exists public.user_favourites (
  user_id      uuid not null,
  trading_mode text not null check (trading_mode in ('forex', 'indian')),
  symbol       text not null,
  created_at   timestamptz not null default now(),
  primary key (user_id, trading_mode, symbol)
);

-- 4d. Feedback (request #9) -----------------------------------------------------
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  type        text not null default 'general' check (type in ('bug', 'feature', 'general')),
  rating      smallint check (rating between 1 and 5),
  message     text not null check (length(btrim(message)) > 0),
  page        text,
  app_version text,
  status      text not null default 'new' check (status in ('new', 'in_review', 'resolved', 'wont_fix')),
  admin_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists feedback_status_created_idx
  on public.feedback (status, created_at desc);

drop trigger if exists feedback_set_updated_at on public.feedback;
create trigger feedback_set_updated_at
  before update on public.feedback
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 5. trades — options columns + data-integrity backfill
-- -----------------------------------------------------------------------------
-- Nullable options columns are added now so Indian F&O journalling can be turned
-- on later without a second migration against a live table. No UI uses them yet.
alter table public.trades add column if not exists strike      numeric;
alter table public.trades add column if not exists expiry      date;
alter table public.trades add column if not exists option_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trades_option_type_check'
  ) then
    alter table public.trades
      add constraint trades_option_type_check
      check (option_type is null or option_type in ('CE', 'PE'));
  end if;
end $$;

-- Legacy trades with no trading_mode were being counted in BOTH Forex and
-- Indian by the dashboard. Derive it from the market, then make it required.
update public.trades
   set trading_mode = case when market = 'Forex' then 'forex' else 'indian' end
 where trading_mode is null;

alter table public.trades alter column trading_mode set not null;

-- Every Indian trade settles in INR.
update public.trades
   set account_currency = 'INR'
 where trading_mode = 'indian'
   and (account_currency is null or account_currency <> 'INR');

update public.trades t
   set account_currency = coalesce(p.base_currency, 'USD')
  from public.profiles p
 where p.id = t.user_id
   and t.trading_mode = 'forex'
   and t.account_currency is null;

create index if not exists trades_user_mode_entry_idx
  on public.trades (user_id, trading_mode, entry_date desc);


-- -----------------------------------------------------------------------------
-- 6. Re-point every foreign key from public.users to auth.users
-- -----------------------------------------------------------------------------
alter table public.profiles      drop constraint if exists profiles_id_fkey;
alter table public.trades        drop constraint if exists trades_user_id_fkey;
alter table public.strategies    drop constraint if exists strategies_user_id_fkey;
alter table public.risk_settings drop constraint if exists risk_settings_user_id_fkey;
alter table public.subscriptions drop constraint if exists subscriptions_user_id_fkey;

alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;

alter table public.trades
  add constraint trades_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.strategies
  add constraint strategies_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.risk_settings
  add constraint risk_settings_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.subscriptions
  add constraint subscriptions_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- New tables point at auth.users too.
alter table public.trading_accounts drop constraint if exists trading_accounts_user_id_fkey;
alter table public.trading_accounts
  add constraint trading_accounts_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.user_favourites drop constraint if exists user_favourites_user_id_fkey;
alter table public.user_favourites
  add constraint user_favourites_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.feedback drop constraint if exists feedback_user_id_fkey;
alter table public.feedback
  add constraint feedback_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;


-- -----------------------------------------------------------------------------
-- 7. Remove custom auth entirely
-- -----------------------------------------------------------------------------
drop function if exists public.login_user(text, text);
drop function if exists public.create_user(text, text, text, text, text, numeric);
drop table if exists public.users cascade;


-- -----------------------------------------------------------------------------
-- 8. Free-plan trade limit — server-side source of truth (recreated)
-- -----------------------------------------------------------------------------
create or replace function public.enforce_trade_limit()
returns trigger
language plpgsql security definer set search_path = public
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
    v_plan := free_plan;  -- expired / canceled / none => free limits
  end if;

  v_limit := coalesce((v_plan.limits ->> 'maxTrades')::numeric, 30);
  if v_limit >= 0 then
    select count(*) into v_used from public.trades where user_id = new.user_id;
    if v_used >= v_limit then
      raise exception 'You''ve reached your free trade limit.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trades_enforce_limit on public.trades;
create trigger trades_enforce_limit
  before insert on public.trades
  for each row execute function public.enforce_trade_limit();


-- -----------------------------------------------------------------------------
-- 9. New-signup bootstrap — profile, BOTH trading accounts, risk, free plan
-- -----------------------------------------------------------------------------
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

  insert into public.risk_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  select id into v_free_plan_id from public.plans where code = 'FREE' order by sort_order limit 1;
  if v_free_plan_id is not null then
    insert into public.subscriptions (user_id, plan_id, status, current_period_start)
    values (new.id, v_free_plan_id, 'free', now())
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 10. Backfill — give every existing user both trading accounts
-- -----------------------------------------------------------------------------
-- The old single starting_capital becomes the FOREX account; Indian starts at 0
-- and the user sets it in Settings (Phase 2).
insert into public.trading_accounts (user_id, trading_mode, currency, starting_capital)
select p.id, 'forex', coalesce(p.base_currency, 'USD'), coalesce(p.starting_capital, 0)
from public.profiles p
on conflict (user_id, trading_mode) do nothing;

insert into public.trading_accounts (user_id, trading_mode, currency, starting_capital)
select p.id, 'indian', 'INR', 0
from public.profiles p
on conflict (user_id, trading_mode) do nothing;

-- Any auth user without a profile (e.g. created in the dashboard) gets one.
insert into public.profiles (id, email, display_name, role, base_currency, starting_capital)
select a.id, a.email, split_part(a.email, '@', 1), 'user', 'USD', 0
from auth.users a
where not exists (select 1 from public.profiles p where p.id = a.id)
on conflict (id) do nothing;


-- -----------------------------------------------------------------------------
-- 11. Row-Level Security — replace the world-readable policies
-- -----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','strategies','trades','risk_settings',
                        'subscriptions','plans','trading_accounts',
                        'instruments','user_favourites','feedback')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.profiles         enable row level security;
alter table public.strategies       enable row level security;
alter table public.trades           enable row level security;
alter table public.risk_settings    enable row level security;
alter table public.subscriptions    enable row level security;
alter table public.plans            enable row level security;
alter table public.trading_accounts enable row level security;
alter table public.instruments      enable row level security;
alter table public.user_favourites  enable row level security;
alter table public.feedback         enable row level security;

-- profiles ---------------------------------------------------------------------
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (public.can_edit_profile(profiles));

-- trading_accounts --------------------------------------------------------------
create policy trading_accounts_select_own on public.trading_accounts
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy trading_accounts_insert_own on public.trading_accounts
  for insert to authenticated with check (user_id = auth.uid());
create policy trading_accounts_update_own on public.trading_accounts
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- trades — strictly private, NOT readable by admins (request #8) -----------------
create policy trades_select_own on public.trades
  for select to authenticated using (user_id = auth.uid());
create policy trades_insert_own on public.trades
  for insert to authenticated with check (user_id = auth.uid());
create policy trades_update_own on public.trades
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy trades_delete_own on public.trades
  for delete to authenticated using (user_id = auth.uid());

-- strategies --------------------------------------------------------------------
create policy strategies_select_system_or_own on public.strategies
  for select to authenticated using (is_system or user_id = auth.uid());
create policy strategies_insert_own on public.strategies
  for insert to authenticated with check (user_id = auth.uid() and not is_system);
create policy strategies_update_own on public.strategies
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy strategies_delete_own on public.strategies
  for delete to authenticated using (user_id = auth.uid() and not is_system);

-- risk_settings -----------------------------------------------------------------
create policy risk_select_own on public.risk_settings
  for select to authenticated using (user_id = auth.uid());
create policy risk_insert_own on public.risk_settings
  for insert to authenticated with check (user_id = auth.uid());
create policy risk_update_own on public.risk_settings
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- subscriptions — users read their own; only admins may change one ---------------
create policy subscriptions_select_own_or_admin on public.subscriptions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy subscriptions_insert_own on public.subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy subscriptions_update_admin on public.subscriptions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- plans — public read, admin write ----------------------------------------------
create policy plans_public_read on public.plans
  for select to anon, authenticated using (true);
create policy plans_admin_write on public.plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- instruments — public read, admin write ----------------------------------------
create policy instruments_public_read on public.instruments
  for select to anon, authenticated using (true);
create policy instruments_admin_write on public.instruments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- user_favourites ---------------------------------------------------------------
create policy favourites_select_own on public.user_favourites
  for select to authenticated using (user_id = auth.uid());
create policy favourites_insert_own on public.user_favourites
  for insert to authenticated with check (user_id = auth.uid());
create policy favourites_delete_own on public.user_favourites
  for delete to authenticated using (user_id = auth.uid());

-- feedback — users write & read their own; admins read all and triage ------------
create policy feedback_select_own_or_admin on public.feedback
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy feedback_insert_own on public.feedback
  for insert to authenticated with check (user_id = auth.uid());
create policy feedback_update_admin on public.feedback
  for update to authenticated using (public.is_admin()) with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- 12. Grants — anon can only read the two public catalogues
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select on public.plans       to anon;
grant select on public.instruments to anon;

grant select, insert, update, delete on
  public.profiles, public.trades, public.strategies, public.risk_settings,
  public.subscriptions, public.trading_accounts, public.user_favourites,
  public.feedback
to authenticated;
grant select on public.plans, public.instruments to authenticated;
grant update on public.plans, public.instruments to authenticated;  -- gated by RLS to admins

commit;


-- =============================================================================
-- 13. VERIFY (run after the commit — all three must look right)
-- =============================================================================

-- a) Every app table has RLS on and no `true` catch-all policy.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       count(p.policyname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.tablename = c.relname and p.schemaname = 'public'
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by c.relname;

-- b) The custom auth surface is gone (expect 0 rows).
select routine_name from information_schema.routines
where routine_schema = 'public' and routine_name in ('login_user', 'create_user');

-- c) Every user has exactly two trading accounts (expect 2 per user).
select user_id, count(*) as accounts, string_agg(trading_mode || '=' || currency, ', ' order by trading_mode)
from public.trading_accounts group by user_id order by accounts;
