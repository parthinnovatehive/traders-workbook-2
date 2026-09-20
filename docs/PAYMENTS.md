# Payments — how checkout works, and how to add Razorpay

The checkout flow is complete and working against a **mock provider**. Nothing
about its shape is provisional: switching to Razorpay changes three things and
touches no page, hook or interface.

---

## The flow

```
  Membership page          server (Postgres)              provider
  ──────────────────────────────────────────────────────────────────────
  click "Choose Pro"
        │
        └─ createOrder(planId) ──►  create_payment_order()
                                    reads the price from `plans`
                                    inserts payment_orders (status=created)
        ◄───────────────────────────  PaymentOrder
        │
  CheckoutModal opens  ─────────────────────────────►  user pays
        ◄─────────────────────────────────────────────  { paymentId, signature }
        │
        └─ confirmPayment(orderId, result) ──►  confirm_payment_order()
                                                 verifies the signature
                                                 marks the order paid
                                                 upserts `subscriptions`
        ◄──────────────────────────────────────  Subscription (active)
```

## Two invariants this design exists to protect

**1. The client never sets the price.** `create_payment_order` reads `amount`
from the `plans` row. The browser sends a plan id and nothing else, so a
tampered request cannot buy Elite for ₹1.

**2. The client never activates a plan.** `payment_orders` has exactly one RLS
policy — a `SELECT`. There is no INSERT or UPDATE policy, so PostgREST will not
let a client mint a paid order. Only the `SECURITY DEFINER` functions write, and
only `confirm_payment_order` touches `subscriptions`.

If you ever find yourself adding an INSERT or UPDATE policy to `payment_orders`,
stop: that hands every user a free Elite plan.

A third guard worth knowing about: `payment_orders_provider_payment_key` is a
unique index on `provider_payment_id`. One payment id can settle one order, so a
replayed receipt cannot extend a subscription repeatedly.

---

## What "mock" means today

- `VITE_PAYMENT_PROVIDER` is unset (or anything other than `razorpay`), so
  orders are created with `provider = 'mock'`.
- `CheckoutModal` stands in for the gateway's hosted UI. It shows the real
  server-priced amount, waits ~900ms, and returns a `pay_mock_…` id.
- `confirm_payment_order` skips signature verification **for mock orders only**.
  A `razorpay` order with no signature is rejected outright, so the provider
  cannot be switched on before verification exists.
- The modal also offers "Simulate a declined payment" so the failure path is
  exercised rather than discovered by the first real customer whose card fails.

---

## Adding Razorpay

### 1. An Edge Function to create the order

Razorpay's Orders API needs your **key secret**, which must never reach the
browser. So order creation moves server-side:

```ts
// supabase/functions/create-order/index.ts
const plan = await db.from('plans').select('*').eq('id', planId).single();

const rzp = await fetch('https://api.razorpay.com/v1/orders', {
  method: 'POST',
  headers: {
    Authorization: `Basic ${btoa(`${KEY_ID}:${KEY_SECRET}`)}`,
    'Content-Type': 'application/json',
  },
  // Razorpay works in the smallest currency unit — paise, not rupees.
  body: JSON.stringify({
    amount: Math.round(plan.price * 100),
    currency: plan.currency,
    receipt: orderId,
  }),
}).then((r) => r.json());
```

Store `rzp.id` on the row as `provider_order_id`.

Then in [`src/services/supabase.ts`](../src/services/supabase.ts), `createOrder`
calls the function instead of the RPC. **Its return type does not change.**

### 2. An Edge Function to verify the signature

This is the part that must not be skipped:

```ts
const expected = createHmac('sha256', KEY_SECRET)
  .update(`${razorpay_order_id}|${razorpay_payment_id}`)
  .digest('hex');

if (expected !== razorpay_signature) return new Response('Invalid signature', { status: 400 });
```

Only after that passes does it call `confirm_payment_order` with the service
role. Also register a **webhook** for `payment.captured` pointing at the same
verification — the browser can close before the handler fires, and the webhook
is what makes the payment land anyway.

### 3. Replace the modal with Razorpay's checkout

In [`MembershipPanel`](../src/components/billing/MembershipPanel.tsx), swap
`<CheckoutModal>` for:

```ts
new Razorpay({
  key: import.meta.env.VITE_RAZORPAY_KEY_ID,   // publishable id, safe in the bundle
  order_id: order.providerOrderId,
  amount: order.amount * 100,
  currency: order.currency,
  handler: (r) => onPaid({ paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
  modal: { ondismiss: () => onFailed('Checkout was closed before payment.') },
}).open();
```

`onPaid` and `onFailed` already take exactly these shapes. Nothing else moves.

### 4. Flip the switch

Set `VITE_PAYMENT_PROVIDER=razorpay`. New orders are created as `razorpay` and
`confirm_payment_order` starts demanding a signature.

---

## Before taking real money

- [ ] Signature verification lives in an Edge Function, never in the database
      and never in the browser.
- [ ] `payment.captured` webhook registered and verified — do not rely on the
      browser handler alone.
- [ ] Razorpay amounts are in **paise**; the `plans` table is in rupees. Getting
      this wrong charges 100× or 1/100×.
- [ ] Test the failure and abandonment paths, not just the happy one.
- [ ] Refunds: `payment_orders.status` already has a `refunded` state; nothing
      writes it yet.
- [ ] Razorpay onboarding will ask for the Terms, Privacy and Refund pages —
      they exist at `/terms`, `/privacy`, `/refunds`, but still carry
      placeholder company details (see `docs/GAPS.md` #21).
- [ ] Decide what happens when a subscription lapses. `isPaidActive()` already
      treats a past `current_period_end` as expired and falls back to Free, but
      nothing currently emails the user or retries a payment.
