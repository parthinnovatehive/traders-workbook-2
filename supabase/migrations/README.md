# Phase 1 — what to run in Supabase

Run these in order in **SQL Editor**. Take a backup first
(*Database → Backups*), and if you have real user data, rehearse on a restored
copy before running on production.

| # | File | What it does | Destructive? |
|---|---|---|---|
| 1 | `0001_phase1_preflight.sql` | Read-only. Reports what data exists and which case you're in. | No |
| 2 | `0002_phase1_auth_and_schema.sql` | Auth cutover, RLS, new tables, backfills. | **Yes** — the FRESH START block is enabled (see below) |
| 3 | `0003_phase1_seed_instruments.sql` | Seeds the instrument master (starter set). | No |
| 4 | `0004_phase2_instrument_universe.sql` | **Phase 2.** Full universe: 78 forex symbols with correct metal/crypto specs, 8 indices + 468 NSE/BSE names. Adds `has_fno`. | No |
| 5 | `0005_phase3_admin_and_feedback.sql` | **Phase 3.** Account suspension, audit log, admin statistics functions. | No |

## Step 1 — Preflight

Run the whole file. It returns three result sets and changes nothing. Result 3
lists any app data belonging to a user that isn't in `auth.users`.

- **Result 3 empty** → go to Step 2.
- **Result 3 has rows, but Result 2 shows only demo/test accounts** → uncomment
  the FRESH START block at the top of `0002` (it deletes that test data), then
  run Step 2.
- **Result 3 has rows with real user data** → follow CASE C in the file: create
  each user in *Authentication → Users*, remap the old id to the new one with
  the five `UPDATE` statements provided, re-run the preflight until Result 3 is
  empty, then run Step 2.

`0002` refuses to run while orphans exist, so you can't get this wrong silently.

## Step 2 — Auth cutover + schema

> **The FRESH START block at the top of this file is ENABLED.** It deletes all
> app data belonging to the 3 leftover custom-auth accounts (confirmed as dev
> test data). If you ever run this file against a different database, comment
> that block out first, or use `0002a_optional_preserve_existing_users.sql`
> to migrate the accounts instead.

Run the whole file. It is wrapped in a transaction and is safe to re-run.

It ends with three verification queries. Check them:

- **(a)** every table shows `rls_enabled = true` and at least one policy.
- **(b)** returns **0 rows** — `login_user` and `create_user` are gone.
- **(c)** every user shows `accounts = 2`, one `forex=<ccy>` and one `indian=INR`.

## Step 3 — Seed instruments

Run the whole file. Expect `forex 27`, `indian 11`.

## Step 4 — Phase 2 instrument universe

Run `0004_phase2_instrument_universe.sql`. Expect `forex 78`, `indian 476`.

Its second verification query spot-checks the specs that were wrong before:
`XAU/USD` must come back with `contract_size 100` and `pip_size 0.01`, **not**
100000 / 0.0001.

**This file is generated.** Edit the datasets, never the SQL:

```bash
npm run gen:instruments
```

Source: `src/constants/data/forexPairs.json` and `indianInstruments.json` — the
same files the app imports, so the client and the database cannot drift apart.

> **Lot sizes still need a human check.** The bundled F&O and index lot sizes
> reflect the post-November-2024 revision (`_lotSizeAsOf: 2025-01` in the JSON).
> Reconcile them against the current NSE/BSE circular before launch. They are
> admin-editable and a trader can override the value on an individual trade, so
> a stale number can never silently corrupt anyone's P&L — but it is still worth
> a pass from someone who trades these contracts.

## Step 5 — Admin support

Run `0005_phase3_admin_and_feedback.sql`. Three verification queries follow it:

- **(a)** 7 admin functions exist.
- **(b)** **The important one.** `trades` must show exactly 4 policies, every one
  scoped to `user_id = auth.uid()`, and **none mentioning `is_admin()`**. If an
  `is_admin()` policy ever appears here, admins can read user trade data and the
  "no trade details" guarantee is broken.
- **(c)** `admin_audit_log` has one SELECT policy and no INSERT policy — entries
  are written only through `log_admin_action()`.

Admin statistics come from `SECURITY DEFINER` functions that return counts and
dates only. That is deliberate: there is no path from the admin UI to a symbol,
a price or a P&L figure.

---

## Dashboard settings (not SQL)

### Authentication → Providers → Email
- **Enable email provider**: on
- **Confirm email**: **OFF while there is no custom SMTP.** See below — this is
  a deliberate trade-off, not an oversight.
- **Minimum password length**: 8 (the signup form enforces this client-side too)

#### Why confirmation is off

Supabase's built-in email sender is capped at **2 messages per hour per
project**, and it will only deliver to addresses belonging to members of your
Supabase organisation. That cap is identical on the Free and Pro plans — it is a
property of the built-in sender, not of the billing tier.

So with confirmation **on** and no custom SMTP, a stranger cannot sign up at all:
their confirmation mail is rejected as "Email address not authorized", and the
third attempt in any hour fails with a 429 regardless.

With confirmation **off**, `signUp` returns a session immediately, the app walks
the user straight into the dashboard, and **no email is sent at any point**.
Signups are limited only by the ordinary 30-requests-per-5-minutes-per-IP rule.

The cost of leaving it off:
- Anyone can register with an address they do not own. Nothing in the product
  emails users, so the blast radius is a junk account rather than a hijacked one.
- **Password reset cannot work**, because it is an email. A user who forgets
  their password has no self-service way back in — see below.

#### Turning it back on (do this once you have SMTP)

Configure **Authentication → SMTP Settings** against any transactional provider
(Resend, Brevo and Mailgun all have free tiers in the thousands of mails per
month, and custom SMTP is included on the Supabase Free plan). Then:

1. Raise the email cap under **Authentication → Rate Limits** to match your
   provider's allowance — it stays at 2/hour until you do.
2. Switch **Confirm email** back on. No code change is needed: `register()`
   already returns `null` when there is no session, and `Register.tsx` shows the
   "check your inbox" screen for it.
3. Disable click-tracking on your provider for these messages. Link rewriting
   breaks Supabase's single-use confirmation and recovery tokens.

### Authentication → URL Configuration
- **Site URL**: your production URL (e.g. `https://app.yourdomain.com`)
- **Redirect URLs**: add both of these, or password reset will bounce once you
  have SMTP and the emails actually start arriving:
  - `http://localhost:5173/reset-password`
  - `https://<your-production-domain>/reset-password`

### Locked-out users, until SMTP exists

With no mail provider, **the "Forgot password" flow sends nothing**. The screen
is honest about it and points the user at support. To let someone back in,
either send them a one-time link from **Authentication → Users → ⋯ → Send
recovery**, or set a new password for them in place from the same menu.

### Make yourself an admin

There is no UI for this by design. Sign up normally, then run:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Sign out and back in for the change to take effect.

---

## App configuration

In `.env` (or your host's environment):

```
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

A production build now **refuses to start** if `VITE_DATA_SOURCE` isn't
`supabase`, so the demo-data repository can't reach real users.

---

## Verify the security fix

With only the anon key (log out, or use an incognito window), all four of these
must fail or return nothing:

```sql
-- 1. Read someone else's trades       → 0 rows
select * from public.trades;

-- 2. Read the user directory          → 0 rows
select * from public.profiles;

-- 3. Change a plan price              → permission denied
update public.plans set price = 0;

-- 4. The credentials table is gone    → relation does not exist
select * from public.users;
```

Signed in as a normal user, (1) and (2) return only that user's own rows, and
(3) still fails. Signed in as an admin, (2) and (3) work but (1) still returns
nothing — admins never see trade data.
