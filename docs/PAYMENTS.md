# Payments — Razorpay

Razorpay is integrated. This document is the setup runbook and the record of how
each bypass is closed.

---

## The flow

```
  browser                     Edge Function                Razorpay        Postgres
  ─────────────────────────────────────────────────────────────────────────────────
  "Choose Pro"
     └─ payments-create-order ──►  verify JWT
                                   create_payment_order() ─────────────────►  price
                                                                              from
                                                                              `plans`
                                   POST /v1/orders ──────►  order_…
                                   attach_provider_order() ────────────────►  saved
     ◄── { order, keyId }
     │
  Razorpay Checkout opens ──────────────────────────────►  user pays
     ◄────────────────────────────────────────────────────  payment_id + signature
     │
     └─ payments-verify ────────►  1. verify HMAC
                                   2. GET /v1/payments/:id  ◄── captured? amount?
                                   3. confirm_payment_order() ─────────────►  plan
                                                                              granted
     ◄── { subscription }

  …and independently, Razorpay ──►  payments-webhook  (payment.captured)
                                    verifies its own HMAC, settles the same order
```

The webhook is not a nicety. A user can close the tab mid-redirect and their
money is still taken — the webhook is what grants the plan anyway.

---

## Setup

### 1. Run the migrations

```bash
# In the Supabase SQL Editor, in order:
#   supabase/migrations/0007_payment_orders.sql
#   supabase/migrations/0008_razorpay_hardening.sql
```

Check the verification queries at the bottom of 0008. **Query (a) must return
zero rows** — any row there means a payment function is callable from a browser.

### 2. Set the secrets

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
supabase secrets set RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
```

Three distinct values. The **webhook secret is not the key secret** — you choose
it when creating the webhook. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

Nothing goes in `.env`. The build refuses to start if a `VITE_RAZORPAY_KEY_SECRET`
exists — see `vite.config.ts`.

### 3. Deploy the functions

Link the repo to your project first — `secrets set` and `functions deploy` both
need it, and neither is useful until the functions actually exist on the server:

```bash
supabase login
supabase link --project-ref trpnggoqaoaswksthopx
```

```bash
supabase functions deploy payments-create-order payments-verify payments-fail-order
supabase functions deploy payments-webhook
```

No `--no-verify-jwt` flag is needed: `supabase/config.toml` declares
`verify_jwt = false` for `payments-webhook` and `true` for the rest, so the
setting survives a redeploy by someone who has never read this page. Razorpay
does not send a Supabase token — the HMAC over the raw body authenticates it.

**Until this step runs, upgrading fails with a CORS error, not a 404.** The
gateway answers the browser's preflight with a 404 carrying no CORS headers, so
the browser reports "Response to preflight request doesn't pass access control
check" and hides the status. Confirm what is really happening with:

```bash
curl -i -X OPTIONS https://<project-ref>.supabase.co/functions/v1/payments-create-order
```

`{"code":"NOT_FOUND"}` means not deployed. A `200` means deployed, and a CORS
error then points at `ALLOWED_ORIGIN` instead.

### 4. Register the webhook

Razorpay Dashboard → Settings → Webhooks → Add:

- **URL** — `https://<project-ref>.supabase.co/functions/v1/payments-webhook`
- **Secret** — the same value as `RAZORPAY_WEBHOOK_SECRET`
- **Events** — `payment.captured`, `payment.failed`

### 5. Test with test keys first

Use `rzp_test_…` keys and a **domestic** test instrument. Indian Razorpay
accounts have international cards disabled by default, so the widely-copied
`4111 1111 1111 1111` is rejected with "International cards are not supported"
before it ever reaches our code — a confusing failure that looks like a broken
integration but is not one.

| Method | Value |
|---|---|
| UPI success | `success@razorpay` |
| UPI failure | `failure@razorpay` |
| Visa debit | `4100 2800 0000 1007` |
| Mastercard credit | `5555 5100 0008 1006` |
| RuPay credit | `6527 6589 0000 1005` |

Random CVV, any future expiry. On the simulated bank page an OTP of 4–10 digits
succeeds and one under 4 digits fails. In test mode a *cancelled* UPI payment
records as successful, so test cancellation by closing the checkout instead.

Verify all of:

- a successful payment grants the plan and appears in Billing history
- closing the checkout marks the order `failed`, grants nothing
- a failed card marks the order `failed`, grants nothing
- the plan still lands if you kill the tab immediately after paying (webhook)

---

## Bypasses, and where each is closed

| # | Attack | Closed by |
|---|---|---|
| 1 | Call `confirm_payment_order` from the console with a made-up payment id | `EXECUTE` revoked from `anon`/`authenticated` (0008 §4). Only the service role can call it, and only Edge Functions hold that. |
| 2 | Send a cheaper price in the request | The request body is only a plan id. `create_payment_order` reads the amount from `plans`. |
| 3 | Pay ₹1 against a ₹3,299 order | `payments-verify` re-reads the payment from Razorpay's API and `confirm_payment_order` rejects any amount mismatch. |
| 4 | Replay one receipt to keep extending a plan | Unique index on `provider_payment_id`, plus a status gate — an order settles once. |
| 5 | Settle someone else's order | Order ownership checked against the JWT-derived user id, never the body. |
| 6 | Attach a payment from a different order | `provider_order_id` must match what we issued. |
| 7 | Replay a webhook | `payment_webhook_events` ledger keyed on Razorpay's event id. |
| 8 | Forge a webhook | HMAC over the raw body with the webhook secret, compared in constant time. |
| 9 | Use an authorized-but-not-captured payment | Status must be exactly `captured`. |
| 10 | `INSERT`/`UPDATE` `payment_orders` via PostgREST | The table has exactly one policy, a `SELECT`. |
| 11 | Forge the signature by timing the comparison | `timingSafeEqual`, not `===`. |
| 12 | Read the key secret from the bundle | It is never in `src/`. `vite.config.ts` fails the build if a `VITE_`-prefixed secret exists. |

Two rules, if you change nothing else:

**Never add an INSERT or UPDATE policy to `payment_orders`.** That hands every
user a free Elite plan.

**Never grant EXECUTE on the payment functions to `authenticated`.** Same
outcome. Verification query (a) in 0008 exists to catch exactly this.

---

## Without Razorpay keys

If the secrets are unset, `payments-create-order` fails and the upgrade button
reports it. Local development (`VITE_DATA_SOURCE=local`) uses the in-browser mock
repository, which keeps its own `mock` provider and the `CheckoutModal` stand-in
so the flow is testable offline — see `src/services/local.ts`.

---

## Still open

- **Refunds.** `payment_orders.status` has a `refunded` state; nothing writes it.
  Add a `refund.processed` webhook handler when you need it.
- **Renewals.** Subscriptions are one-off payments with a period end, not
  Razorpay Subscriptions. When a period lapses, `isPaidActive()` falls back to
  Free — correct, but nobody is emailed and nothing retries.
- **Invoices.** Billing history shows orders, not GST invoices. An Indian
  business selling to consumers will need proper invoices.
- **Company details.** Razorpay onboarding checks your Terms, Privacy and Refund
  pages. They exist at `/terms`, `/privacy`, `/refunds` but still carry
  placeholder details — see `docs/GAPS.md` #21.
