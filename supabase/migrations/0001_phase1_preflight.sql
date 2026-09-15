-- =============================================================================
-- Phase 1 · Step 1 of 3 — PREFLIGHT (READ-ONLY)
-- =============================================================================
-- Run this FIRST in the Supabase SQL editor. It changes nothing. It tells you
-- how much real data exists, which decides how Step 2 handles the auth cutover.
--
-- Read the three result sets, then follow the guidance printed at the end.
-- =============================================================================

-- 1. How many rows are in each app table, and how many real auth users exist?
select 'auth.users'            as table_name, count(*) as rows from auth.users
union all select 'public.users',          count(*) from public.users
union all select 'public.profiles',       count(*) from public.profiles
union all select 'public.trades',         count(*) from public.trades
union all select 'public.strategies',     count(*) from public.strategies where user_id is not null
union all select 'public.risk_settings',  count(*) from public.risk_settings
union all select 'public.subscriptions',  count(*) from public.subscriptions
union all select 'public.plans',          count(*) from public.plans
order by table_name;


-- 2. Which custom-auth accounts exist, and do they have any trades worth keeping?
select
  u.id,
  u.email,
  u.display_name,
  u.role,
  u.created_at,
  (select count(*) from public.trades t where t.user_id = u.id) as trade_count,
  exists (select 1 from auth.users a where a.id = u.id)         as already_in_auth_users
from public.users u
order by trade_count desc, u.created_at;


-- 3. Any user_id referenced by app data that is NOT in auth.users?
--    Every row listed here would break the foreign keys in Step 2.
select 'trades' as source, user_id, count(*) as rows
from public.trades where user_id not in (select id from auth.users) group by user_id
union all
select 'strategies', user_id, count(*)
from public.strategies where user_id is not null and user_id not in (select id from auth.users) group by user_id
union all
select 'risk_settings', user_id, count(*)
from public.risk_settings where user_id not in (select id from auth.users) group by user_id
union all
select 'subscriptions', user_id, count(*)
from public.subscriptions where user_id not in (select id from auth.users) group by user_id
union all
select 'profiles', id, count(*)
from public.profiles where id not in (select id from auth.users) group by id
order by source, rows desc;


-- =============================================================================
-- HOW TO READ THE RESULTS
-- =============================================================================
--
-- CASE A — Result 3 is EMPTY (no orphans).
--   Nothing to migrate. Run Step 2 as-is.
--
-- CASE B — Result 3 has rows, but Result 2 shows only demo/test accounts with
--          trades you do not care about (the usual case for this project).
--   Uncomment the "FRESH START" block at the top of Step 2. It deletes that
--   test data. Read it before you run it — it is the only destructive part of
--   this migration.
--
-- CASE C — Result 3 has rows AND those accounts hold real user data.
--   Do NOT run Step 2 yet. For each account in Result 2:
--     1. Create the user in Authentication → Users in the Supabase dashboard
--        (same email). Note the NEW uuid Supabase assigns.
--     2. Remap the old id to the new one across all five tables:
--
--        update public.trades        set user_id = '<new>' where user_id = '<old>';
--        update public.strategies    set user_id = '<new>' where user_id = '<old>';
--        update public.risk_settings set user_id = '<new>' where user_id = '<old>';
--        update public.subscriptions set user_id = '<new>' where user_id = '<old>';
--        update public.profiles      set id      = '<new>' where id      = '<old>';
--
--     3. Re-run this preflight until Result 3 is empty, then run Step 2.
--   Passwords cannot be carried over — send those users a password reset.
--
-- ALWAYS: take a backup first (Database → Backups, or `pg_dump`), and if you
-- have real data, rehearse Step 2 on a restored copy before running it here.
-- =============================================================================
