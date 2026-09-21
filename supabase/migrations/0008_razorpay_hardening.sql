-- =============================================================================
-- RAZORPAY · lock the payment path down for real money
-- =============================================================================
-- Run after 0007. Idempotent — safe to re-run.
--
-- 0007 let the browser call create/confirm directly, which is fine for a mock
-- where nothing is at stake. It is NOT fine once money is involved: a client
-- that can call `confirm_payment_order` can hand itself Elite by inventing a
-- payment id.
--
-- From here, every payment mutation is SERVICE-ROLE ONLY. The browser talks to
-- Edge Functions (which hold the Razorpay key secret and verify signatures),
-- and the Edge Functions talk to these. EXECUTE is revoked from `anon` and
-- `authenticated`, so there is no path from a browser to an activated plan that
-- does not pass through signature verification.
--
-- The bypasses this file is written against, and where each is closed:
--
--   1. Forge a confirmation from the console      -> EXECUTE revoked (§4)
--   2. Tamper with the price                      -> amount read from `plans` (§1)
--   3. Pay ₹1 for an Elite order                  -> amount re-checked at capture (§2)
--   4. Replay one receipt to extend a plan        -> unique payment id + status gate (§2)
--   5. Settle someone else's order                -> user id must match the order (§2)
--   6. Attach a payment from a different order    -> provider_order_id must match (§2)
--   7. Replay a webhook                           -> processed-event ledger (§3)
--   8. Forge a webhook                            -> HMAC verified in the function
--   9. Uncaptured / authorized-only payment       -> status must be 'captured' (§2)
--  10. Write the tables directly via PostgREST    -> no INSERT/UPDATE policies (0007)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Order creation — explicit user, no reliance on auth.uid()
-- -----------------------------------------------------------------------------
-- Under the service role `auth.uid()` is null, so the caller (the Edge
-- Function, which has authenticated the user's JWT) passes the id in. The price
-- still comes from `plans` and never from the caller.
drop function if exists public.create_payment_order(text, text);

create or replace function public.create_payment_order(
  p_user_id  uuid,
  p_plan_id  text,
  p_provider text default 'razorpay'
)
returns public.payment_orders
language plpgsql security definer set search_path = public
as $$
declare
  v_plan  public.plans%rowtype;
  v_order public.payment_orders;
  v_suspended boolean;
begin
  if p_user_id is null then
    raise exception 'A user is required.';
  end if;

  select is_suspended into v_suspended from public.profiles where id = p_user_id;
  if v_suspended is null then
    raise exception 'Unknown user.';
  end if;
  if v_suspended then
    raise exception 'This account is suspended.';
  end if;

  select * into v_plan from public.plans where id = p_plan_id and is_active;
  if not found then
    raise exception 'That plan is not available.';
  end if;
  if v_plan.price <= 0 then
    raise exception 'The free plan does not require payment.';
  end if;

  insert into public.payment_orders (user_id, plan_id, amount, currency, provider)
  values (p_user_id, v_plan.id, v_plan.price, v_plan.currency, p_provider)
  returning * into v_order;

  return v_order;
end;
$$;

-- Records the gateway order id once the Edge Function has created it upstream.
create or replace function public.attach_provider_order(
  p_order_id          uuid,
  p_provider_order_id text
)
returns public.payment_orders
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.payment_orders;
begin
  update public.payment_orders
     set provider_order_id = p_provider_order_id
   where id = p_order_id and status = 'created'
  returning * into v_order;

  if not found then
    raise exception 'Order not found or no longer open.';
  end if;
  return v_order;
end;
$$;


-- -----------------------------------------------------------------------------
-- 2. Settlement — every field re-checked against what we issued
-- -----------------------------------------------------------------------------
-- The Edge Function has already verified the HMAC. This re-checks the facts the
-- signature does not cover: that the amount actually captured matches the price
-- we issued, that the payment belongs to OUR order, and that the order belongs
-- to the user being upgraded. A valid signature over the wrong order, or a
-- genuine ₹1 payment, still gets rejected here.
drop function if exists public.confirm_payment_order(uuid, text, text);

create or replace function public.confirm_payment_order(
  p_order_id            uuid,
  p_user_id             uuid,
  p_provider_order_id   text,
  p_provider_payment_id text,
  p_amount_paid         numeric,
  p_currency            text,
  p_payment_status      text
)
returns public.subscriptions
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.payment_orders;
  v_plan  public.plans%rowtype;
  v_sub   public.subscriptions;
  v_end   timestamptz;
begin
  -- Lock the row so two concurrent confirmations (browser handler racing the
  -- webhook — which happens routinely) cannot both activate.
  select * into v_order
  from public.payment_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  -- (5) The order must belong to the user being upgraded.
  if v_order.user_id <> p_user_id then
    raise exception 'Order does not belong to this user.';
  end if;

  -- (4) Already settled. Not an error for the webhook, which legitimately
  -- retries; the caller treats this as success and moves on.
  if v_order.status = 'paid' then
    select * into v_sub from public.subscriptions where user_id = p_user_id;
    return v_sub;
  end if;

  if v_order.status <> 'created' then
    raise exception 'That order can no longer be paid.';
  end if;

  -- (6) The payment must be against the gateway order we opened.
  if v_order.provider_order_id is distinct from p_provider_order_id then
    raise exception 'Payment does not match this order.';
  end if;

  -- (9) Authorized is not captured. Only money actually taken counts.
  if p_payment_status is distinct from 'captured' then
    raise exception 'Payment is not captured (status: %).', p_payment_status;
  end if;

  -- (3) The amount captured must be the amount we issued. Razorpay reports
  -- paise; the caller converts before passing it in.
  if p_amount_paid is distinct from v_order.amount then
    raise exception 'Amount mismatch: expected %, captured %.', v_order.amount, p_amount_paid;
  end if;

  if p_currency is distinct from v_order.currency then
    raise exception 'Currency mismatch: expected %, got %.', v_order.currency, p_currency;
  end if;

  select * into v_plan from public.plans where id = v_order.plan_id;
  v_end := now() + case when v_plan.billing_period = 'yearly'
                        then interval '1 year' else interval '1 month' end;

  update public.payment_orders
     set status = 'paid',
         provider_payment_id = p_provider_payment_id,
         paid_at = now()
   where id = v_order.id;

  insert into public.subscriptions
    (user_id, plan_id, status, current_period_start, current_period_end)
  values (v_order.user_id, v_order.plan_id, 'active', now(), v_end)
  on conflict (user_id) do update
    set plan_id = excluded.plan_id,
        status = excluded.status,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end
  returning * into v_sub;

  return v_sub;
end;
$$;

-- Failing an order also moves to the service role, so the user id is explicit.
drop function if exists public.fail_payment_order(uuid, text);

create or replace function public.fail_payment_order(
  p_order_id uuid,
  p_user_id  uuid,
  p_reason   text default 'Payment was not completed.'
)
returns public.payment_orders
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.payment_orders;
begin
  update public.payment_orders
     set status = 'failed', failure_reason = left(p_reason, 500)
   where id = p_order_id
     and user_id = p_user_id
     and status = 'created'
  returning * into v_order;

  if not found then
    raise exception 'Order not found or no longer open.';
  end if;
  return v_order;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. Webhook idempotency ledger
-- -----------------------------------------------------------------------------
-- Razorpay retries webhooks until it gets a 2xx, and delivers the same event to
-- every subscribed URL. Recording each event id makes reprocessing a no-op.
create table if not exists public.payment_webhook_events (
  id           text primary key,          -- Razorpay's x-razorpay-event-id
  event        text not null,
  order_id     uuid references public.payment_orders (id) on delete set null,
  payload      jsonb,
  received_at  timestamptz not null default now()
);

alter table public.payment_webhook_events enable row level security;
-- No policy at all: only the service role (which bypasses RLS) touches this.

create or replace function public.record_webhook_event(
  p_event_id text,
  p_event    text,
  p_order_id uuid,
  p_payload  jsonb
)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.payment_webhook_events (id, event, order_id, payload)
  values (p_event_id, p_event, p_order_id, p_payload);
  return true;
exception
  when unique_violation then
    return false;  -- already processed
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. THE LOCKDOWN
-- -----------------------------------------------------------------------------
-- Postgres grants EXECUTE on new functions to PUBLIC by default. Without these
-- revokes, any signed-in user could call confirm_payment_order straight from
-- the browser console and grant themselves any plan — the single most important
-- statement block in this file.
revoke all on function public.create_payment_order(uuid, text, text) from public, anon, authenticated;
revoke all on function public.attach_provider_order(uuid, text)      from public, anon, authenticated;
revoke all on function public.confirm_payment_order(uuid, uuid, text, text, numeric, text, text)
  from public, anon, authenticated;
revoke all on function public.fail_payment_order(uuid, uuid, text)   from public, anon, authenticated;
revoke all on function public.record_webhook_event(text, text, uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.create_payment_order(uuid, text, text) to service_role;
grant execute on function public.attach_provider_order(uuid, text)      to service_role;
grant execute on function public.confirm_payment_order(uuid, uuid, text, text, numeric, text, text)
  to service_role;
grant execute on function public.fail_payment_order(uuid, uuid, text)   to service_role;
grant execute on function public.record_webhook_event(text, text, uuid, jsonb)
  to service_role;

-- Cancelling involves no money, so it stays a normal user action.
grant execute on function public.cancel_my_subscription() to authenticated;

commit;

-- =============================================================================
-- 5. VERIFY — all four must come back as described
-- =============================================================================

-- a) CRITICAL: no payment function may be executable by anon or authenticated.
--    Expect ZERO rows. Any row here is a free-upgrade hole.
select p.proname, r.rolname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral (values ('anon'), ('authenticated')) as r(rolname)
where n.nspname = 'public'
  and p.proname in ('create_payment_order', 'confirm_payment_order',
                    'fail_payment_order', 'attach_provider_order',
                    'record_webhook_event')
  and has_function_privilege(r.rolname, p.oid, 'EXECUTE');

-- b) payment_orders still has exactly one policy, a SELECT.
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'payment_orders';

-- c) The replay guard on payment ids is present.
select indexname from pg_indexes
where tablename = 'payment_orders' and indexname = 'payment_orders_provider_payment_key';

-- d) The webhook ledger exists and has no policies (service role only).
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'payment_webhook_events') as ledger_exists,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'payment_webhook_events')    as policies;
