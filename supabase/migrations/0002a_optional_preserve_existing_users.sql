-- =============================================================================
-- Phase 1 · Step 2a (OPTIONAL) — PRESERVE EXISTING ACCOUNTS
-- =============================================================================
-- Only needed if 0002 stopped with "N row(s) reference a user that does not
-- exist in auth.users" AND you want to KEEP those accounts' data.
--
-- If the accounts are just your own dev/test logins, skip this file and use the
-- FRESH START block at the top of 0002 instead — it's one step.
--
-- Passwords cannot be carried over either way: Supabase Auth will not accept an
-- imported bcrypt hash, so every preserved account gets a password reset email.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Who are they? Run this first and write down the ids + emails.
-- -----------------------------------------------------------------------------
select
  u.id                                                           as old_id,
  u.email,
  u.display_name,
  u.role,
  (select count(*) from public.trades t where t.user_id = u.id)   as trades,
  u.created_at
from public.users u
where not exists (select 1 from auth.users a where a.id = u.id)
order by trades desc, u.created_at;


-- -----------------------------------------------------------------------------
-- 2. For EACH account above, create the Auth user by hand:
--      Supabase dashboard → Authentication → Users → "Add user"
--        • Email: the SAME email as above
--        • Password: anything (the user will reset it)
--        • Auto Confirm User: ON  ← otherwise they cannot log in
--      Then copy the NEW uuid Supabase shows for that user.
-- -----------------------------------------------------------------------------


-- -----------------------------------------------------------------------------
-- 3. Remap old id → new id. Repeat this block once per account.
--    Order matters: profiles LAST, because the others still reference it.
-- -----------------------------------------------------------------------------
do $$
declare
  -- ⬇⬇ EDIT THESE TWO LINES FOR EACH ACCOUNT ⬇⬇
  v_old uuid := '00000000-0000-0000-0000-000000000000';  -- old_id from step 1
  v_new uuid := '11111111-1111-1111-1111-111111111111';  -- new uuid from step 2
  -- ⬆⬆ ------------------------------------- ⬆⬆
  v_moved integer;
begin
  if v_old = v_new then
    raise exception 'Set v_old and v_new to the real uuids before running this.';
  end if;

  if not exists (select 1 from auth.users where id = v_new) then
    raise exception 'No auth.users row with id %. Create the user in the dashboard first (step 2).', v_new;
  end if;

  -- A profile row for the new id may already exist (Supabase creates one via
  -- the trigger once 0002 has run). Drop it so the old one can take its place.
  delete from public.profiles where id = v_new;

  update public.trades        set user_id = v_new where user_id = v_old;
  get diagnostics v_moved = row_count;
  raise notice 'trades moved: %', v_moved;

  update public.strategies    set user_id = v_new where user_id = v_old;
  update public.risk_settings set user_id = v_new where user_id = v_old;
  update public.subscriptions set user_id = v_new where user_id = v_old;
  update public.profiles      set id      = v_new where id      = v_old;

  raise notice 'Remapped % -> %', v_old, v_new;
end $$;


-- -----------------------------------------------------------------------------
-- 4. Re-run 0001_phase1_preflight.sql. When its Result 3 is EMPTY, run 0002.
-- -----------------------------------------------------------------------------

-- 5. After 0002 completes, send each preserved account a reset link:
--      Authentication → Users → (row) → "Send password recovery"
--    or let them use "Forgot your password?" on the login page.
