-- =============================================================================
-- 0009 — Admin plan management
--
-- The admin Plans page could only edit plans that already existed. Three things
-- stopped it doing more:
--
--   1. `grant update on public.plans` (0002) — no INSERT, no DELETE, so an
--      admin creating a plan got "permission denied for table plans" even
--      though the `plans_admin_write` policy allows `for all`. A policy grants
--      nothing on its own; the table GRANT has to exist first.
--   2. `check (code in ('FREE','PRO','ELITE'))` — no new tier could ever be
--      added without a schema change.
--   3. Nothing protected the FREE plan. `handle_new_user()` puts every new
--      signup on it; delete that row and registration breaks for everyone,
--      with an error that points at the trigger rather than at the cause.
--
-- Run this in the Supabase SQL Editor. Verification queries at the bottom.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Let admins create and remove plans
--
-- RLS still decides WHO: `plans_admin_write` is `for all ... using (is_admin())`,
-- so these grants widen the verbs available, not the audience. A non-admin with
-- these grants still writes nothing.
-- -----------------------------------------------------------------------------
grant insert, delete on public.plans to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Allow custom tier codes
--
-- Still constrained — an uppercase identifier, so `code` stays usable as a
-- stable key in application logic (`code = 'FREE'` is load-bearing in
-- handle_new_user, enforce_trade_limit and the entitlement helpers).
-- -----------------------------------------------------------------------------
alter table public.plans drop constraint if exists plans_code_check;
alter table public.plans
  add constraint plans_code_check check (code ~ '^[A-Z][A-Z0-9_]{1,23}$');

-- -----------------------------------------------------------------------------
-- 3. Protect the things other code depends on
--
-- Both of these are enforced here rather than only in the admin UI, because the
-- UI is not the only way a row can be changed — the SQL editor and any future
-- script reach the same table.
-- -----------------------------------------------------------------------------
create or replace function public.protect_plan_invariants()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_free_left int;
  v_subs      int;
begin
  if tg_op = 'DELETE' then
    -- A plan someone is paying for must not vanish: `subscriptions.plan_id`
    -- references it, and the raw FK error names a constraint, not a fix.
    select count(*) into v_subs from public.subscriptions where plan_id = old.id;
    if v_subs > 0 then
      raise exception
        'Cannot delete "%" — % subscriber(s) are on this plan. Hide it instead so nobody new can pick it.',
        old.name, v_subs
        using errcode = 'P0001';
    end if;

    select count(*) into v_free_left
      from public.plans where code = 'FREE' and id <> old.id;
    if old.code = 'FREE' and v_free_left = 0 then
      raise exception
        'Cannot delete the last FREE plan — handle_new_user() places every new signup on it, so registration would break.'
        using errcode = 'P0001';
    end if;

    return old;
  end if;

  -- UPDATE: renaming the last FREE plan's code is the same outage by another
  -- route.
  if old.code = 'FREE' and new.code <> 'FREE' then
    select count(*) into v_free_left
      from public.plans where code = 'FREE' and id <> old.id;
    if v_free_left = 0 then
      raise exception
        'Cannot change the code of the last FREE plan — new signups depend on a plan with code FREE.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists plans_protect_invariants on public.plans;
create trigger plans_protect_invariants
  before update or delete on public.plans
  for each row execute function public.protect_plan_invariants();

commit;

-- =============================================================================
-- VERIFY
-- =============================================================================

-- a) authenticated can now insert/delete (RLS still gates it to admins).
--    Expect rows for INSERT, DELETE, SELECT and UPDATE.
select privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'plans' and grantee = 'authenticated'
order by privilege_type;

-- b) The code constraint accepts a new tier. Expect: true.
select 'STARTER' ~ '^[A-Z][A-Z0-9_]{1,23}$' as custom_code_allowed;

-- c) The guard trigger is attached. Expect one row.
select tgname from pg_trigger
where tgrelid = 'public.plans'::regclass and not tgisinternal
  and tgname = 'plans_protect_invariants';

-- d) A FREE plan still exists for handle_new_user(). Expect >= 1.
select count(*) as free_plans from public.plans where code = 'FREE';
