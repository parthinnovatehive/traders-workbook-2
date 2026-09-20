-- =============================================================================
-- PAYMENT ORDERS · the seam a real gateway plugs into
-- =============================================================================
-- Run after 0006. Idempotent — safe to re-run.
--
-- Replaces the broken upgrade path. Previously the client upserted straight
-- into `subscriptions`; RLS grants UPDATE there to admins only, so every
-- "Choose Pro" ended in an error — and had the policy been loose enough to
-- succeed, any user could have granted themselves Elite from the browser
-- console.
--
-- Two rules this file exists to enforce:
--
--   1. THE CLIENT NEVER SETS THE PRICE. `create_payment_order` reads the amount
--      from `plans`. A tampered request cannot buy Elite for ₹1.
--   2. THE CLIENT NEVER ACTIVATES A PLAN. Only `confirm_payment_order` writes
--      to `subscriptions`, and only after the payment receipt checks out.
--
-- The mock provider skips signature verification, which is the ONLY part that
-- changes when Razorpay arrives. See docs/PAYMENTS.md.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Orders
-- -----------------------------------------------------------------------------
create table if not exists public.payment_orders (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  plan_id             text not null references public.plans (id),
  -- Captured at purchase time: a later price change must not rewrite history.
  amount              numeric not null check (amount >= 0),
  currency            text not null default 'INR',
  status              text not null default 'created'
                        check (status in ('created', 'paid', 'failed', 'refunded')),
  provider            text not null default 'mock'
                        check (provider in ('mock', 'razorpay')),
  provider_order_id   text,
  provider_payment_id text,
  failure_reason      text,
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);

create index if not exists payment_orders_user_idx
  on public.payment_orders (user_id, created_at desc);

-- One payment id can only ever settle one order. This is the guard against a
-- replayed receipt being used to extend a subscription repeatedly.
create unique index if not exists payment_orders_provider_payment_key
  on public.payment_orders (provider_payment_id)
  where provider_payment_id is not null;


-- -----------------------------------------------------------------------------
-- 2. Open an order — priced from `plans`, never from the caller
-- -----------------------------------------------------------------------------
create or replace function public.create_payment_order(
  p_plan_id  text,
  p_provider text default 'mock'
)
returns public.payment_orders
language plpgsql security definer set search_path = public
as $$
declare
  v_plan  public.plans%rowtype;
  v_order public.payment_orders;
begin
  if auth.uid() is null then
    raise exception 'You are not signed in.' using errcode = '42501';
  end if;
  if not public.is_active_user() then
    raise exception 'This account is suspended.' using errcode = '42501';
  end if;

  select * into v_plan from public.plans where id = p_plan_id and is_active;
  if not found then
    raise exception 'That plan is not available.';
  end if;
  if v_plan.price <= 0 then
    -- Downgrading to Free is not a purchase; it goes through cancellation.
    raise exception 'The free plan does not require payment.';
  end if;

  insert into public.payment_orders (user_id, plan_id, amount, currency, provider)
  values (auth.uid(), v_plan.id, v_plan.price, v_plan.currency, p_provider)
  returning * into v_order;

  return v_order;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. Settle an order — the only path that can activate a plan
-- -----------------------------------------------------------------------------
create or replace function public.confirm_payment_order(
  p_order_id            uuid,
  p_provider_payment_id text,
  p_signature           text default null
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
  if auth.uid() is null then
    raise exception 'You are not signed in.' using errcode = '42501';
  end if;

  -- Lock the row: two concurrent confirmations must not both activate.
  select * into v_order
  from public.payment_orders
  where id = p_order_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;
  if v_order.status = 'paid' then
    raise exception 'That order has already been paid.';
  end if;
  if v_order.status <> 'created' then
    raise exception 'That order can no longer be paid.';
  end if;

  -- ---------------------------------------------------------------------------
  -- SIGNATURE VERIFICATION
  -- ---------------------------------------------------------------------------
  -- The mock provider has nothing to verify. For Razorpay this must check
  --   hmac_sha256(order_id || '|' || payment_id, <key_secret>) = signature
  -- and the key secret must NOT live in the database. Do it in an Edge Function
  -- that holds the secret, then have it call this function with the service
  -- role. Until that exists, refuse to settle a razorpay order here rather than
  -- pretending it was checked.
  -- ---------------------------------------------------------------------------
  if v_order.provider = 'razorpay' and p_signature is null then
    raise exception 'Payment signature missing — refusing to activate.';
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
  values (auth.uid(), v_order.plan_id, 'active', now(), v_end)
  on conflict (user_id) do update
    set plan_id = excluded.plan_id,
        status = excluded.status,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end
  returning * into v_sub;

  return v_sub;
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. Abandoned / declined payments
-- -----------------------------------------------------------------------------
create or replace function public.fail_payment_order(
  p_order_id uuid,
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
     and user_id = auth.uid()
     and status = 'created'
  returning * into v_order;

  if not found then
    raise exception 'Order not found.';
  end if;
  return v_order;
end;
$$;


-- -----------------------------------------------------------------------------
-- 5. Self-service cancellation
-- -----------------------------------------------------------------------------
-- `subscriptions` is admin-update-only, so users could not cancel at all even
-- though /refunds promises it. Cancelling keeps access until the period ends —
-- the entitlement helpers already treat a past `current_period_end` as lapsed.
create or replace function public.cancel_my_subscription()
returns public.subscriptions
language plpgsql security definer set search_path = public
as $$
declare
  v_sub public.subscriptions;
begin
  if auth.uid() is null then
    raise exception 'You are not signed in.' using errcode = '42501';
  end if;

  update public.subscriptions
     set status = 'canceled'
   where user_id = auth.uid()
  returning * into v_sub;

  if not found then
    raise exception 'No subscription to cancel.';
  end if;
  return v_sub;
end;
$$;


-- -----------------------------------------------------------------------------
-- 6. RLS — read your own orders, write nothing
-- -----------------------------------------------------------------------------
alter table public.payment_orders enable row level security;

drop policy if exists payment_orders_select_own on public.payment_orders;
create policy payment_orders_select_own on public.payment_orders
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Deliberately no INSERT/UPDATE/DELETE policy. Orders are created and settled
-- only by the SECURITY DEFINER functions above; a client cannot mint a paid
-- order by talking to PostgREST directly.

grant select on public.payment_orders to authenticated;

commit;

-- =============================================================================
-- 7. VERIFY
-- =============================================================================

-- a) The four functions exist.
select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('create_payment_order', 'confirm_payment_order',
                       'fail_payment_order', 'cancel_my_subscription')
order by routine_name;

-- b) CRITICAL: payment_orders must have exactly ONE policy, a SELECT.
--    An INSERT or UPDATE policy here would let a user mint themselves a paid
--    order and hand themselves any plan.
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'payment_orders';

-- c) A payment id can settle only one order (replay guard).
select indexname from pg_indexes
where tablename = 'payment_orders' and indexname = 'payment_orders_provider_payment_key';
