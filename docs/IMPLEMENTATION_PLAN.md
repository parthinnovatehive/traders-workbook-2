# Trader's Workbook — Implementation Plan (Production Readiness)

Scope: the 11 change requests from the client, plus the fixes required before real,
paying users can be let onto the platform. Payments (Razorpay) are explicitly **out
of scope** for now — the plan keeps the subscription model intact so payments drop
in later without rework.

Delivered in **3 phases**. Phase 1 is a blocker for launch; Phases 2 and 3 are the
visible feature work.

---

## Coverage matrix — the client's 11 requests

| # | Request | Where it's handled | Phase |
|---|---|---|---|
| 1 | All currency pairs, real-life lot sizes | §2.1 | 2 |
| 2 | Indian account currency defaults to INR | §1.2 (locked at DB level) + §2.2 | 1 + 2 |
| 3 | All major NSE + BSE stocks, union, no duplicates | §1.3 (table) + §2.2 (dataset) | 1 + 2 |
| 4 | Star / favourite instruments, per user, both modes | §1.4 (table) + §2.3 (Combobox) | 1 + 2 |
| 5 | Two starting capitals (Forex + Indian) | §1.2 (`trading_accounts`) + §2.7 (UI) | 1 + 2 |
| 6 | Dashboard in ₹ for Indian; verify all formulas & both capitals | §2.4 (full audit checklist) | 2 |
| 7 | Calendar page with per-day trade details | §2.5 | 2 |
| 8 | Admin dashboards & pages, no user trade details / P&L | §3.1 | 3 |
| 9 | User feedback, visible to admin | §1.4 (table) + §3.2 | 1 + 3 |
| 10 | Reports: compact large values (K / Lakh) by mode | §2.6 | 2 |
| 11 | Any issues / improvements I spot | §0 (B1–B10), §2.8, §3.3 | all |

---

## 0. Current state — what's already solid vs. what's broken

**Solid (do not rewrite):**

- The calculation engine (`src/calculations/*`) is pure, decoupled and unit-tested.
  P&L, R-multiple, expectancy, drawdown, profit factor formulas are correct.
  Money flows through `conversionRate` and `lotSize`, which is the right design.
- The repository seam (`src/services/interfaces.ts` → `local.ts` / `supabase.ts`)
  means new data (favourites, accounts, feedback) plugs in without touching the UI.
- Entitlements / feature gating (`src/lib/entitlements.ts`) is centralised and tested.
- Routing, lazy chunks, theming, chart components are all in good shape.

**Broken / blocking:**

| # | Issue | Evidence |
|---|---|---|
| B1 | Every table is world-readable **and** world-writable | `supabase/migration_custom_auth.sql:270-286` — `using (true) with check (true)` on profiles, strategies, trades, risk_settings, subscriptions, plans |
| B2 | `public.users` holds `password_hash` with **no RLS**, read directly with the public anon key | `supabase/migration_custom_auth.sql:22-40`, `src/services/supabase.ts:322-330, 609-616` |
| B3 | Session = a user id in `localStorage`; paste an admin UUID → you are admin | `src/services/supabase.ts:354-371`, `src/routes/guards.tsx:27-41` |
| B4 | No email verification, no password reset, no rate limit on `login_user` | `supabase/migration_custom_auth.sql:119` |
| B5 | One `startingCapital` + one `baseCurrency` per user, shared by both trading modes | `src/types/user.ts:12-13`, `src/hooks/usePortfolio.ts:30-31` |
| B6 | Dashboard renders every mode in `user.baseCurrency`; Indian trades show as `$` | `src/hooks/usePortfolio.ts:31` → `src/pages/Dashboard.tsx:57` |
| B7 | Per-trade free-text `accountCurrency` means one account can mix USD and EUR trades, and the dashboard sums them as if they were the same unit | `src/components/forms/TradeForm.tsx:321-329` |
| B8 | Trades with no `tradingMode` (legacy) are counted in **both** Forex and Indian | `src/hooks/usePortfolio.ts:20-23` |
| B9 | Only 11 Indian instruments; Forex pairs are a free-text `datalist` with a fixed 100k contract size for everything | `src/constants/indianInstruments.ts:28-40`, `src/constants/instruments.ts:52-57, 93` |
| B10 | Large values overflow their cards on Reports | `src/pages/Reports.tsx:106-113` — `formatCurrency` without `compact` |
| B11 | Every FK points at `public.users`, not `auth.users` — the auth migration must re-point all five | `profiles`, `trades`, `strategies`, `risk_settings`, `subscriptions` |
| B12 | Indian cash-equity quantity is labelled "Quantity (**Lots**)" when it's actually shares (`lot_size = 1`) | `src/components/forms/TradeForm.tsx:362` |
| B13 | `OPT` is an offered segment, but there are no strike / expiry / option-type columns — Indian options can't really be journalled | `src/constants/indianInstruments.ts:42`, `trades` table |
| B14 | Forex `conversionRate` comes from a **mock** FX table, so P&L on any non-account-currency pair is wrong | `src/services/fx.ts:19-37` |
| B15 | The default data source is `local`, and `localApi` must implement every new repository or dev mode breaks | `src/services/index.ts:13`, `src/services/local.ts:301` |

---

# Phase 1 — Foundation: security, auth, and the data model

> **Status: implemented.** Migrations in `supabase/migrations/` (run order and
> dashboard settings in that folder's `README.md`). Typecheck, lint and build
> clean; 128 tests pass, including 22 new ones for the Phase 1 repositories.
>
> Two deviations from the plan as written, both to keep the app coherent:
> - **Settings account editing (§2.7) was pulled forward.** `ProfilePatch` no
>   longer carries `baseCurrency`/`startingCapital`, so leaving Settings alone
>   would have broken the build and made `trading_accounts` unreachable.
>   Register's two-account form came with it.
> - **Nullable options columns** (`strike`, `expiry`, `option_type`) were added
>   to `trades` now, since open question 6 is unanswered and adding them later
>   means a second migration against a live table. No UI reads them yet.

**Goal:** the platform can hold real users' data safely, and the DB shape supports
every Phase 2/3 feature. Mostly backend + migrations; little visible UI change.

### 1.1 Replace custom auth with Supabase Auth *(blocker B1–B4)*

The original `supabase/schema.sql` was already written against `auth.uid()` — the
custom-auth migration was a regression. Go back to it.

- Drop `public.users`, `login_user`, `create_user`. Use `auth.users` +
  `public.profiles` (already in `schema.sql:257-272`, keyed to `auth.users.id`).
- Restore the real RLS policies from `schema.sql:257-366` (own-row access, admin
  override via a `SECURITY DEFINER is_admin()` helper). Re-enable RLS on **every**
  public table including any new ones.
- Rewrite `src/services/supabase.ts` auth block to `supabase.auth.signUp` /
  `signInWithPassword` / `onAuthStateChange` / `signOut`. Delete the
  `localStorage` session (`SESSION_KEY`) entirely.
- `handle_new_user` trigger: on signup, insert `profiles`, default
  `risk_settings`, a FREE `subscriptions` row, and both `trading_accounts` rows.
- Turn on email confirmation; add "forgot password" (`resetPasswordForEmail`) and
  a `/auth/reset` page. Supabase gives rate limiting and lockout for free.
- **Re-point every foreign key** *(B11)*: `profiles.id`, `trades.user_id`,
  `strategies.user_id`, `risk_settings.user_id` and `subscriptions.user_id` all
  reference `public.users(id)` today. Each must be dropped and recreated against
  `auth.users(id) on delete cascade`, in one transaction, after the id remap below.
- Preserve the `trades_enforce_limit` and `set_updated_at` triggers through the
  migration — `enforce_trade_limit` is the server-side source of truth for the free
  plan limit and must survive (re-check any reference it makes to `public.users`).
- Migration path for the handful of existing accounts: script that creates
  `auth.users` rows and re-points `profiles.id`, then emails a password reset.
  (Existing bcrypt hashes cannot be imported into Supabase Auth — everyone resets.)
  Do this on a **restored copy of the database first** and verify row counts per
  table before running it for real.
- `AdminRoute` stays as a UX guard, but security now lives in RLS, not the client.

**Files:** `supabase/` (new `002_restore_rls.sql`, delete `migration_custom_auth.sql`),
`src/services/supabase.ts`, `src/services/supabaseClient.ts`, `src/store/authStore.ts`,
`src/pages/auth/*`, `src/routes/guards.tsx`.

### 1.2 Two trading accounts per user *(B5, request #5)*

New table — cleaner than adding `starting_capital_forex` / `_indian` columns, and it
gives us a natural home for per-mode settings later:

```sql
create table public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trading_mode text not null check (trading_mode in ('forex','indian')),
  currency text not null,              -- forex: user's choice; indian: always 'INR'
  starting_capital numeric not null default 0 check (starting_capital >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, trading_mode)
);
```

- Indian row is **forced** to `INR` by a check/trigger — that is what makes
  request #2 and #6 correct rather than cosmetic.
- Backfill: existing `users.starting_capital` + `base_currency` → the Forex row;
  Indian row seeded at 0/INR.
- `profiles.starting_capital` / `base_currency` stay for one release as read-only
  legacy, then get dropped.
- Types: `TradingAccount` in `src/types/user.ts`; `ITradingAccountRepository` in
  `src/services/interfaces.ts`; `useTradingAccounts()` hook.

### 1.3 Instruments as data, not hardcoded arrays *(supports #1, #3)*

Lot sizes are revised by NSE/BSE several times a year; shipping them in a `.ts`
array means a redeploy every revision. Move them to the DB, seeded from a checked-in
file, editable by admin (Phase 3).

```sql
create table public.instruments (
  id text primary key,                    -- 'NSE:RELIANCE' | 'FX:EURUSD'
  trading_mode text not null check (trading_mode in ('forex','indian')),
  symbol text not null,
  name text not null,
  exchange text,                          -- NSE | BSE | null for FX
  segment text,                           -- EQ | FUT | OPT | INDEX
  base_currency text, quote_currency text,-- FX only
  contract_size numeric not null default 1,
  lot_size numeric not null default 1,
  pip_size numeric, tick_size numeric not null default 0.05,
  category text,                          -- major | minor | exotic | metal
  is_active boolean not null default true,
  unique (trading_mode, symbol)
);
```

Public read (RLS `select true`), admin-only write. Cached client-side via React
Query with a long `staleTime`; the existing `getForexSpec` / `getIndianSpec`
functions keep their signatures and read from the cache, so the calculation engine
and `TradeForm` need no signature changes.

### 1.4 Favourites & feedback tables *(requests #4, #9)*

```sql
create table public.user_favourites (
  user_id uuid not null references auth.users(id) on delete cascade,
  trading_mode text not null check (trading_mode in ('forex','indian')),
  symbol text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, trading_mode, symbol)
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('bug','feature','general')),
  rating smallint check (rating between 1 and 5),
  message text not null,
  page text,                              -- route it was sent from
  app_version text,
  status text not null default 'new' check (status in ('new','in_review','resolved','wont_fix')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

RLS: favourites — own rows only. Feedback — insert own, select own; admins select
and update all.

### 1.5 Data-integrity fixes *(B7, B8)*

- Backfill `trades.trading_mode` from `market` (`Forex` → forex, else indian) and
  make the column `not null` going forward. Fixes the double-count in `usePortfolio`.
- Backfill `trades.account_currency` from the owning `trading_accounts` row, then
  stop letting the user pick it per trade (see 2.2).

### 1.6 Keep the local data source at parity *(B15)*

`src/services/index.ts:13` defaults to `VITE_DATA_SOURCE ?? 'local'`, so every
developer (and every `npm run dev`) runs against `localApi`. It is not dead code —
if it doesn't implement the new repositories, dev and tests break immediately.

- Extend `Database` in `src/services/db.ts` with `tradingAccounts`, `favourites`,
  `feedback`, `instruments`; bump `version` 2 → 3 (`local.ts:27` gates on the
  version, so old browser data self-heals to the new seed).
- Implement the new repositories in `src/services/local.ts` and extend
  `src/services/seed.ts` with two accounts per demo user, a few starred symbols,
  and sample feedback so the admin inbox isn't empty in dev.
- Add a build-time guard so a production bundle can never ship with
  `VITE_DATA_SOURCE=local`.

**Phase 1 exit criteria:** anon key can read nothing but `plans` and `instruments`;
a logged-in user provably cannot read another user's trades; both trading accounts
exist for every user; `npm run typecheck && npm run test` green.

---

# Phase 2 — Trader-facing features

> **Status: implemented.** Typecheck, lint and build clean; 173 tests pass
> (+45 new). Verified in the browser against local demo data.
>
> Decisions taken where the plan left a question open:
> - **FX rates (§2.8) — option 1 chosen:** the trade form pre-fills the
>   provider's rate and lets the trader type their broker's actual fill rate,
>   with the field flagged while it is still an estimate. A live rate API stays
>   the Phase 3+ option.
> - **Instrument model:** one row per company with a `has_fno` flag, rather than
>   a row per (company, segment). This is what makes the NSE/BSE union dedupe
>   correctly — RELIANCE appears once and the *form* picks EQ/FUT/OPT, so cash
>   equity gets a multiplier of 1 while futures get the contract lot.
> - **Lot-size staleness:** beyond making the table admin-editable, the trade
>   form now exposes the lot size as an editable field pre-filled from the spec.
>   A revision the dataset has not caught up with can be corrected per trade.

**Goal:** everything the client listed that a trader actually touches.

### 2.1 Full forex universe with real contract specs *(request #1)*

- Seed ~65 pairs: 7 majors, ~21 crosses, ~30 exotics (incl. USD/INR, EUR/INR,
  GBP/INR, JPY/INR for the Indian currency-derivatives crowd), plus XAU/USD,
  XAG/USD, and optionally BTC/USD, ETH/USD.
- Real-life sizing, which the current code gets wrong by hardcoding 100,000:
  - FX: 1 standard lot = **100,000 units of the base currency** (mini 10k, micro
    1k, nano 100) — correct today.
  - Pip size 0.0001, except **0.01 for any JPY-quoted pair** — correct today.
  - **XAU/USD: 100 oz per lot, pip 0.01. XAG/USD: 5,000 oz, pip 0.001.** Currently
    wrong (treated as 100,000 units / 0.0001).
  - Indian currency futures (USD/INR etc. on NSE-CD): 1 lot = 1,000 USD, tick
    0.0025 — a separate `lot_type` so pip value is right.
- `getForexSpec` keeps deriving a sensible spec for an unknown pair so nothing
  breaks, but curated specs win.
- Pip-value verification tests per category in `src/calculations/__tests__/forex.test.ts`
  (USD-quoted, JPY-quoted, cross, metal) against textbook values.

### 2.2 Indian instruments: NSE + BSE union, INR by default *(requests #2, #3)*

- Seed the union of Nifty 500 + BSE-only names (~550 symbols), deduplicated by
  symbol, with a single primary `exchange` per name (NSE where dual-listed) and a
  `also_on` array — so "Reliance" appears once, not twice, exactly as asked.
- ~190 F&O names carry their real lot size; cash-only equity gets `lot_size = 1`.
  Indices: NIFTY 75, BANKNIFTY 35, FINNIFTY 65, MIDCPNIFTY 140, SENSEX 20,
  BANKEX 30 — **these must be re-verified against the current NSE/BSE circular at
  build time**; that's exactly why 1.3 makes them admin-editable.
- Account currency: the Indian account is INR, full stop. The per-trade "Account
  Currency" dropdown (`TradeForm.tsx:321-329`) is replaced by a **read-only display
  of the active account's currency** — INR in Indian mode, the account currency in
  Forex mode. This closes B7 (no more mixed-currency sums) and satisfies request #2
  in a way that can't be broken by a user.

### 2.3 Searchable instrument picker with favourites *(request #4)*

New `src/components/ui/Combobox.tsx` — the current `<datalist>`/`<select>` can't do
this. Behaviour, TradingView-style:

- Type to filter on symbol **and** company name (`RELI` → RELIANCE; `bank` →
  HDFCBANK, ICICIBANK, BANKNIFTY).
- Star icon on each row; starred items pin to a **Favourites** group at the top,
  above a grouped list (Indices / F&O / Equity for Indian; Majors / Crosses /
  Exotics / Metals for Forex).
- Favourites are per user **and per mode** (`user_favourites`), so a user's Forex
  stars don't pollute their Indian list.
- Optimistic toggle via React Query; full keyboard nav and ARIA combobox roles.

### 2.4 Mode-aware dashboard + engine audit *(request #6)*

- `usePortfolio` returns the **active mode's** account: `{ currency, startingCapital }`
  from `trading_accounts`, not from the profile. Indian mode → `₹` everywhere,
  Forex → that account's currency.
- Drop the `tradingMode === undefined` fallback once Phase 1 backfill lands.
- Full audit pass across Dashboard, Analytics, Reports, Risk, Psychology, Hall of
  Fame/Shame confirming each one: (a) uses the mode's own starting capital for ROI,
  drawdown, ending capital; (b) formats with the mode's currency; (c) never mixes
  the two modes in one number.
- Risk settings are currently one global row with a `daily_loss_limit` in an
  unstated currency — make `risk_settings` per `(user_id, trading_mode)` so "₹10,000
  daily loss limit" and "$200 daily loss limit" can coexist.
- New engine tests: same trade set under both modes produces the right ROI/DD
  against the right capital base.

### 2.5 Calendar page *(request #7)*

New route `/app/calendar`, nav entry between Journal and Analytics.

- Month grid; each day cell shows net P&L (green/red intensity by magnitude),
  trade count, and a win-rate dot. Mode- and currency-aware.
- Click a day → side panel: every trade that day with symbol, direction, entry/exit,
  net P&L, R, strategy, mistakes/psychology tags, notes; day totals; quick edit /
  delete; "add trade for this date".
- Right-hand weekly summary column (P&L + trade count per week) and a month header
  strip: month P&L, best/worst day, win days vs. loss days, current streak, most
  active day.
- Month navigation, "today" jump, and a mini legend. Built from the existing
  `dailyPnlSeries` calculation — no new math.

### 2.6 Compact currency formatting *(request #10)*

`formatCompactCurrency(value, currency)` in `src/utils/format.ts`:

- **INR** → Indian numbering: `₹1.25 L`, `₹3.4 Cr` (thresholds 1e5 / 1e7), with
  `en-IN` grouping below a lakh.
- Everything else → `$12.5K`, `$1.2M`, `$3.4B`.
- Full value in a `title` tooltip so precision is never lost.
- Apply to `MetricCard` (auto-compact above a width threshold), Reports tiles,
  chart axis/tooltip formatters, and the Admin metric cards. Add `tabular-nums` +
  `min-w-0 truncate` to the card value so nothing can overflow again.

### 2.7 Signup & Settings for two accounts *(completes request #5)*

The `trading_accounts` table from §1.2 is invisible until these two screens expose it:

- **Register** (`src/pages/auth/Register.tsx:78-91`) currently asks for one "Base
  currency" + one "Starting capital". Replace with: Forex account currency +
  starting capital, and Indian starting capital (currency shown as a locked ₹).
  Both may be left at 0 and set later — don't block signup on them.
- **Settings** (`src/pages/Settings.tsx:65-78`) currently edits one capital field.
  Replace with two clearly-labelled account cards (Forex / Indian), each showing
  its currency, starting capital, and current capital. Editing a starting capital
  retroactively changes ROI and drawdown, so show a short warning before saving.
- `RegisterInput` and `ProfilePatch` in `src/services/interfaces.ts:11-20` change
  shape accordingly, in both the Supabase and local implementations.

### 2.8 Trade-form correctness fixes *(B12, B14 — my additions)*

- **Shares vs. lots** — for Indian `EQ` (where `lot_size = 1`) the field must read
  "Quantity (Shares)", and "Quantity (Lots)" only for FUT/OPT/INDEX. Today it always
  says Lots (`TradeForm.tsx:362`), which will make users enter the wrong size.
- **FX conversion rate** — `src/services/fx.ts` ships hardcoded mock rates
  (`INR: 83`, `EUR: 0.92`…) and `TradeForm.tsx:125` uses them to set the
  `conversionRate` stored on every trade. For a USD account trading EUR/GBP, P&L
  is silently wrong by whatever the mock rate has drifted. Three options, pick one:
  1. **Let the user enter/override the rate** on the trade form, pre-filled from the
     provider and clearly labelled (cheapest, fully accurate, zero dependencies).
  2. Integrate a real FX rate API, cache daily rates in a `fx_rates` table.
  3. Restrict the Forex account currency to USD, so the vast majority of pairs
     quote in USD and the rate is genuinely 1.
  Recommendation: **(1) now, (2) later.** Whatever is chosen, the stored
  `conversionRate` keeps the engine deterministic — that design is already right.
- Both are small changes, but they affect the numbers users make decisions on, so
  they belong in Phase 2 rather than "polish".

**Phase 2 exit criteria:** a trader can journal in both modes end-to-end with
correct sizing, correct currency, starred instruments, and a working calendar.

---

# Phase 3 — Admin, feedback, and go-live polish

> **Status: implemented.** Typecheck, lint and build clean; 194 tests pass
> (+21 new). Verified in the browser.
>
> Delivered: the admin section (Overview, Users, Subscriptions, Plans,
> Instruments, Feedback, Audit Log), the feedback loop end to end, legal pages
> with a risk disclaimer in the footer, an error boundary, password change and
> data export.
>
> Deferred from §3.3 with reasons:
> - **Self-service account deletion** — implemented as a support-email flow
>   rather than a button. Irreversible deletion from a possibly-hijacked session
>   needs an identity check; the export path next to it is self-service.
> - **Timezone handling, onboarding wizard, soft-delete, Sentry wiring,
>   pagination, Indian charges calculator** — genuinely useful, none blocking.
>   The error boundary logs to console with a marked TODO for Sentry.

### 3.1 Admin area *(request #8)*

Promote `/admin` from one page to a proper section with its own shell + sidebar.
**Deliberately excludes individual users' trade details, P&L and positions** — admins
see counts and aggregates only, and the existing copy on `Admin.tsx:91` becomes an
enforced RLS rule, not just a promise.

| Page | Contents |
|---|---|
| Overview | Total / active / new users (7d, 30d), signups chart, plan mix, active vs. free, trades **recorded count only**, feedback awaiting review |
| Users | Search, filter by plan/role/status; row detail = profile, plan, join date, last active, trade **count**; actions: change role, grant/revoke a plan, suspend, force password reset |
| Subscriptions | Current subscribers by plan, status breakdown, expiring soon, manual grant/extend/cancel (the seam Razorpay later plugs into) |
| Plans & Pricing | Existing editor, extended to name/features/limits/sort order/visibility |
| Instruments | CRUD + CSV import over `instruments` — this is how lot sizes get updated without a deploy |
| Feedback | Inbox (3.2) |
| Content | Marketing copy, FAQ entries, announcement banner |
| Audit log | Every admin mutation: who, what, when, before → after |

All writes go through `SECURITY DEFINER` functions that re-check `is_admin()`, so a
forged client can't act as admin.

### 3.2 Feedback loop *(request #9)*

- Persistent "Feedback" item in the profile menu + a small floating button in the
  app shell. Modal: type (bug / feature / general), 1–5 star rating, message;
  auto-captures the current route and app version.
- User sees their own past submissions and their status in Settings.
- Admin inbox: filter by type/status, mark in-review/resolved/won't-fix, internal
  note. Unread badge in the admin sidebar.

### 3.3 Production-readiness items *(my additions — needed because real users are coming)*

These are not on the client's list but will bite within a week of launch:

1. **Legal pages** — Terms, Privacy Policy, Refund/Cancellation policy, Contact.
   Mandatory for an Indian payment-gateway onboarding later, and for handling
   personal data now. Plus a "not investment advice" disclaimer on every analytics
   page — you're showing performance figures to retail traders.
2. **Account self-service** — change password, change email, export all my data
   (JSON + CSV), delete my account. Low effort, high legal value.
3. **Error boundary + error reporting** — right now a single render error shows a
   blank page. Add a route-level boundary with a recovery action, and wire Sentry
   (or Supabase logs) so you hear about failures before the client does.
4. **Timezone handling** — `entry_time` is free text with no zone; Indian traders
   are IST, forex traders aren't. Store a user timezone and render day boundaries
   with it, otherwise the Calendar's "which day was this trade" will be wrong for
   some users.
5. **Onboarding** — a 3-step first-run wizard (pick mode, set both starting
   capitals, star a few instruments) plus an empty-state "record your first trade"
   CTA. Directly improves activation.
6. **Trade limit UX** — the free limit currently fails at save time. Show
   "22 of 30 trades used" in the shell and warn at 80%.
7. **Login hardening** — with Supabase Auth this is mostly free, but add captcha on
   signup if abuse appears, and keep email confirmation on.
8. **Soft delete for trades** (`deleted_at`) + undo toast — deleting a journal entry
   by accident is unrecoverable today.
9. **Performance** — `trades.list()` fetches every trade for every page. Add
   server-side date/mode filtering and pagination in the Journal once users pass
   ~1,000 trades.
10. **Indian charges helper** (optional, nice) — auto-estimate brokerage + STT +
    exchange fees + GST + stamp duty for equity/F&O so `charges` isn't guesswork.
11. **Mobile pass** — Calendar and the new Combobox need explicit small-screen
    layouts; the app is otherwise responsive.
12. **Backups** — turn on Supabase PITR and document a restore drill before launch.
13. **Options support for Indian traders** *(B13 — worth discussing with the client)*
    — most Indian retail volume is index options, but `OPT` is offered as a segment
    with no strike, expiry or CE/PE fields, so an options trade can't be recorded
    accurately or analysed (no expiry-day stats, no CE vs PE breakdown). Adding
    `strike`, `expiry`, `option_type` to `trades` plus three conditional form fields
    is roughly a day's work and would materially widen the addressable users. Flagged
    rather than assumed — it's beyond what was asked.
14. **Chart screenshots on trades** — the single most-requested feature in trading
    journals; needs a Supabase Storage bucket with per-user RLS paths and an upload
    control on the trade form. Optional, but it is what makes a journal sticky.
15. **Partial exits / scaling out** — the model is one entry and one exit per trade.
    Traders who scale out must split a position into multiple rows, which distorts
    win rate and R-multiple. A real limitation; a proper fix (an `executions` child
    table) is a large change, so document it as a known constraint for now.

### 3.4 QA & launch

- Unit tests: new forex specs, compact INR formatting, per-mode metrics, favourites
  reducer, entitlements unchanged.
- Manual matrix: signup → verify → onboarding → both modes → trade CRUD → calendar
  → reports → feedback → admin review, on desktop + mobile, light + dark.
- Security pass: with only the anon key, attempt to read another user's trades,
  read `profiles`, escalate to admin, and edit plans — all four must fail.
- Seed a demo account; document env vars in `.env.example`; deploy runbook.

---

## Sequencing & rough effort

| Phase | Content | Est. |
|---|---|---|
| 1 | Auth + RLS rewrite, FK re-point, trading_accounts, instruments/favourites/feedback tables, backfills, local-source parity | ~5–7 days |
| 2 | Forex specs, NSE/BSE dataset, Combobox + favourites, mode-aware dashboard audit, Calendar, compact formatting, signup/settings for 2 accounts, trade-form fixes | ~7–9 days |
| 3 | Admin section, feedback loop, legal + account self-service, polish, QA | ~5–7 days |

Phase 1 must land before any user is invited. Phases 2 and 3 can overlap slightly
(the admin shell only depends on Phase 1).

## Open questions for the client

1. Forex account currency — should the user pick it (USD/EUR/GBP/INR…), or is it
   always USD? The plan lets them pick once, at account level.
2. Should the free-plan trade limit (30) count both modes together or per mode?
3. Existing accounts: confirm it's acceptable that everyone resets their password
   during the auth migration (it is unavoidable).
4. Who verifies the NSE/BSE lot-size dataset before launch? I'll seed it from the
   latest known circular, but a trader on the client's side should sign off.
5. FX conversion rates (§2.8) — user-entered override, a live rate API, or restrict
   Forex accounts to USD? Default assumption: user-entered override now.
6. Do Indian **options** need to be journalled properly (strike / expiry / CE-PE)?
   Not in the client's list, but it's where most Indian retail volume is, and the
   segment is already offered in the UI. Yes/no changes the `trades` schema, so it's
   cheapest to decide before Phase 1 migrations run.
7. Are trade **screenshots** wanted? Also a schema/storage decision best made early.
