-- =============================================================================
-- 0010 — Quarterly billing, discounts, and a period-length bug fix
--
-- Three changes:
--
--   1. `billing_period` gains 'quarterly'.
--   2. `plans.discount_percent` records the admin's intent — the discount a
--      longer commitment represents against the same tier's monthly price.
--      `price` stays authoritative: `create_payment_order` charges what it
--      says, and nothing the browser sends can influence it.
--   3. A REAL BUG in confirm_payment_order:
--
--          v_end := now() + case when v_plan.billing_period = 'yearly'
--                                then interval '1 year' else interval '1 month' end;
--
--      Anything that is not 'yearly' fell into the ELSE and got one month. A
--      quarterly plan would take three months of money and grant one month of
--      access. Fixed before 'quarterly' can be selected anywhere.
--
-- The reserved `ai_insights` flag is also stripped from every plan's limits —
-- nothing in the application ever checked it.
--
-- Run in the Supabase SQL Editor. Verification queries at the bottom.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Periods
-- -----------------------------------------------------------------------------
alter table public.plans drop constraint if exists plans_billing_period_check;
alter table public.plans
  add constraint plans_billing_period_check
  check (billing_period in ('monthly', 'quarterly', 'yearly'));

-- -----------------------------------------------------------------------------
-- 2. Discount
-- -----------------------------------------------------------------------------
alter table public.plans
  add column if not exists discount_percent numeric not null default 0
  check (discount_percent >= 0 and discount_percent < 100);

comment on column public.plans.discount_percent is
  'Discount vs paying monthly for the same span. Presentation and admin intent only — price is what gets charged.';

-- Backfill from what each plan already charges, so existing rows do not all
-- report 0% beside a price that is plainly discounted — which would make every
-- longer plan look "stale" in the admin editor the moment this runs.
-- Derived from the same tier's monthly plan; a tier without one keeps 0.
with monthly as (
  select code, price
  from public.plans
  where billing_period = 'monthly' and price > 0
),
target as (
  select p.id,
         p.price as period_price,
         m.price as monthly_price,
         case p.billing_period when 'yearly' then 12 when 'quarterly' then 3 else 1 end as months
  from public.plans p
  join monthly m on m.code = p.code
  where p.billing_period <> 'monthly' and p.price > 0
)
update public.plans p
   set discount_percent = greatest(
         0,
         least(
           99,
           round(
             ((t.monthly_price * t.months - t.period_price) / (t.monthly_price * t.months)) * 100
           )
         )
       )
  from target t
 where p.id = t.id
   and t.monthly_price * t.months > 0;

-- -----------------------------------------------------------------------------
-- 3. Drop the flag nothing enforced, and stop selling it
-- -----------------------------------------------------------------------------
update public.plans
   set limits = limits - 'ai_insights'
 where limits ? 'ai_insights';

-- The flag was only half the problem. The Elite plans in this database carry a
-- marketing bullet — "Early access to AI reviews" — that promises a capability
-- no code implements, on a page people pay from. Remove the claim, not just the
-- flag behind it.
--
-- NOTE: "Performance intelligence engine" is also on those plans and maps to
-- nothing specific either. It is left alone because it is arguably a
-- description of the analytics that do exist — decide that one yourself in
-- Admin → Plans rather than having a migration decide it for you.
update public.plans
   set features = coalesce(
         (
           select jsonb_agg(bullet order by ord)
           from jsonb_array_elements_text(features) with ordinality as t(bullet, ord)
           where bullet !~* 'ai\s*(review|insight)'
         ),
         '[]'::jsonb
       )
 where features::text ~* 'ai\s*(review|insight)';

-- -----------------------------------------------------------------------------
-- 4. The period-length fix
--
-- Same signature, so the EXECUTE grants from 0008 carry over untouched. The
-- only change is v_end. Verification query (a) in 0008 must still return zero
-- rows after this runs.
-- -----------------------------------------------------------------------------
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
  -- Grant exactly the span that was paid for.
  --
  -- This previously read `case when billing_period = 'yearly' then 1 year else
  -- 1 month end`, so every non-yearly period fell into the ELSE. A quarterly
  -- plan would take three months of money and grant one month of access.
  -- An unrecognised period still falls back to one month deliberately: a period
  -- added to the table without updating this function should under-grant rather
  -- than give access away.
  v_end := now() + case v_plan.billing_period
                     when 'yearly'    then interval '1 year'
                     when 'quarterly' then interval '3 months'
                     when 'monthly'   then interval '1 month'
                     else interval '1 month'
                   end;

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

-- `create or replace` preserves grants, but re-assert them so this migration is
-- correct even if run against a database where 0008 was edited.
revoke all on function public.confirm_payment_order(uuid, uuid, text, text, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.confirm_payment_order(uuid, uuid, text, text, numeric, text, text)
  to service_role;

commit;

-- =============================================================================
-- VERIFY
-- =============================================================================

-- a) Quarterly is accepted. Expect one row.
select conname from pg_constraint
where conrelid = 'public.plans'::regclass and conname = 'plans_billing_period_check';

-- b) Discounts backfilled sensibly. Yearly rows should show a positive percent
--    if they are cheaper than 12× the monthly price.
select code, billing_period, price, discount_percent
from public.plans order by code, billing_period;

-- c) Nothing still carries or advertises the unbuilt feature. Expect 0 and 0.
select
  (select count(*) from public.plans where limits ? 'ai_insights')            as flag_rows,
  (select count(*) from public.plans where features::text ~* 'ai\s*(review|insight)') as copy_rows;

-- d) STILL zero rows — the payment function must not be callable from a browser.
select p.proname, r.rolname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral (values ('anon'), ('authenticated')) as r(rolname)
where n.nspname = 'public'
  and p.proname = 'confirm_payment_order'
  and has_function_privilege(r.rolname, p.oid, 'EXECUTE');
