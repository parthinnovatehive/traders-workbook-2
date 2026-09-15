# Trader's Workbook — What's Missing

An audit of the codebase as it stands. Every item below is something that is
**broken, half-built, or sold but not delivered** — not a wishlist. Each carries
the evidence that proves it.

Ordered by priority. P0 items block launch; P3 items are things that bite within
weeks of launch.

> **Status — 15 September 2026.** Nine items are now **FIXED** and marked below:
> P0-3, P1-4, P1-5, P1-6, P2-10, P2-11, P2-13, P2-14 and P3-22. Typecheck and
> lint are clean and 226 tests pass (+32). The Supabase side of that work is
> `supabase/migrations/0006_risk_per_mode_entitlements_content.sql`, which has
> **not been run against the live project yet** — until it is, the app expects
> columns and a table that are not there.
>
> Everything unmarked is still open. **P0-1 and P0-2 remain the launch blockers.**

---

## P0 — Blocks launch

### 1. There is no working way to set up the database from scratch

The migration chain assumes the old custom-auth database already exists.
`0002_phase1_auth_and_schema.sql` creates only `trading_accounts`,
`instruments`, `user_favourites` and `feedback` — it never creates `profiles`,
`plans`, `trades`, `risk_settings` or `subscriptions`, but its very first
statements delete from them (`0002:38`). On a new Supabase project it fails on
line 38.

Worse, **no migration ever creates or seeds `public.plans`**. Plans exist only in
`supabase/schema.sql:51` (table) and `:415` (seed rows). If `plans` is empty:

- `handle_new_user` (`0002:378`) finds no FREE plan → no `subscriptions` row for
  new users;
- `enforce_trade_limit` (`0002:312`) has no free plan to enforce against;
- every user silently falls back to the hardcoded `30` in
  `src/lib/entitlements.ts:70`;
- the Membership and Pricing pages render empty.

Compounding it, the two setup docs contradict each other:
`README.md:95` says paste `supabase/schema.sql`; `supabase/migrations/README.md`
never mentions `schema.sql` at all. And the insecure
`supabase/migration_custom_auth.sql` is still in the repo — running it
reintroduces `using (true) with check (true)` on every table plus a plaintext-
adjacent `public.users` with no RLS.

**Fix:** one ordered, idempotent migration path for a fresh project (base tables
+ plan seed + the 0002–0005 chain), delete `migration_custom_auth.sql`, and make
the root README point at `supabase/migrations/README.md` instead of duplicating
it.

### 2. The paid upgrade path does not work — and there are no payments

`MembershipPanel.tsx:52` → `useSubscribe` → `billing.subscribe()`
(`src/services/supabase.ts:1146`) upserts into `subscriptions` from the browser.
RLS allows users to INSERT their own row but restricts UPDATE to admins
(`0002:499-502`), and `handle_new_user` has *already inserted* a FREE row at
signup — so the upsert resolves to an UPDATE and is rejected. Every "Choose Pro"
click ends in *"Could not change plan."* `billing.cancel()` fails the same way.

In local dev mode the same call succeeds and hands out Pro for free
(`src/services/local.ts` billing block), which is why this has gone unnoticed.

There is no payment gateway, no order/webhook table, and no cancel button —
`useCancelSubscription` (`src/hooks/useBilling.ts:57`) is never imported by any
component, while `/refunds` promises a cancellation flow.

**Fix:** either (a) hide/disable plan selection until Razorpay lands, or (b) ship
the payment seam — an `admin_set_subscription`-style SECURITY DEFINER function
invoked only after a verified payment webhook. Today's UI promises a purchase it
cannot complete.

### 3. Every user sees a "Demo data" badge  ✅ FIXED

`src/components/layout/Header.tsx:31-33` renders `<Badge>Demo data</Badge>`
unconditionally — including against the real Supabase backend with a real user's
real trades. One-line fix, but it is the first thing a paying customer sees.

---

## P1 — Correctness bugs in numbers users act on

### 4. The Journal page was missed by the mode-aware currency audit  ✅ FIXED

`src/pages/Journal.tsx:34-35` is the only page still reading the deprecated
profile fields:

```ts
const currency = useAuthStore((s) => s.user?.baseCurrency ?? 'USD');
const startingCapital = useAuthStore((s) => s.user?.startingCapital ?? 0);
```

`baseCurrency` is legacy (`src/types/user.ts:19` marks `startingCapital`
deprecated; `supabase.ts:471` falls back to `'USD'`). Result: switch to Indian
mode and the dashboard shows ₹ while the Journal table shows the same P&L with a
`$`. `src/pages/Journal.tsx:65` also keeps the `tradingMode === undefined`
fallback that Phase 2 removed everywhere else.

**Fix:** `usePortfolio()`, exactly like every other page.

### 5. Risk settings are global, so the daily loss limit is currency-ambiguous  ✅ FIXED

`risk_settings` is one row per user (`supabase/schema.sql:106-115`,
`user_id ... unique`), but `RiskManagement.tsx:105-111` renders
`dailyLossLimit`, `riskPerTradeAmt` and `maxPositionValue` in the *active mode's*
currency against the *active mode's* capital. A trader who sets "10,000" for
their ₹ book gets a $10,000 limit the moment they toggle to Forex.

Phase 2 §2.4 specified `risk_settings` keyed on `(user_id, trading_mode)`. It was
not implemented — trading accounts were split per mode but risk rules were not.

### 6. Five of the eight plan features are never enforced  ✅ FIXED

`src/types/plan.ts:43-52` declares 8 gateable features. Only three are actually
gated (`grep 'feature="'`): `advanced_analytics`, `psychology_analytics`,
`reports`. Not enforced anywhere:

| Feature / limit | Sold as | Reality |
|---|---|---|
| `advanced_risk` | Pro | `/app/risk` is fully open to Free |
| `strategy_analytics` | Pro | `/app/strategies` is fully open to Free |
| `export` | Pro | Settings → export CSV/JSON is open to Free |
| `customStrategies: 1` | Free limit | zero references outside the plan config |
| `ai_insights` | **Elite only** | no implementation exists anywhere in `src/` |
| Hall of Fame / Shame | listed under Elite (`config/plans.ts:36`) | ungated |

Elite is priced ₹3,299/mo over Pro's ₹1,599 on features that are either absent
(`ai_insights`) or already free to everyone.

---

## P2 — Half-implemented features

### 7. Indian options cannot be journalled
`OPT` is a selectable segment (`TradeForm.tsx:114-119`) and `strike`, `expiry`,
`option_type` columns were added to `trades` in Phase 1 — but nothing in `src/`
reads or writes them (`grep strike|optionType|expiry` → no hits outside an
unrelated comment). Index options are where most Indian retail volume is; today
those trades record as an untagged number.

### 8. Lot sizes are ~20 months stale
`src/constants/data/indianInstruments.json` carries `_lotSizeAsOf: "2025-01"`
(the post-Nov-2024 revision) for 213 F&O names and 8 indices. NSE revises these
several times a year. The file's own warning says they "MUST be re-verified
against the current exchange circular before launch". They are admin-editable and
per-trade overridable, so nothing corrupts silently — but the defaults are wrong.

### 9. FX rates are still the mock table
`src/services/fx.ts:19-37` ships `INR: 83`, `EUR: 0.92`, `JPY: 150`… as static
constants. The trade form pre-fills from it, flags the value as an estimate and
lets the trader override (`TradeForm.tsx:216-217`) — that is the Phase 2 decision
and it is fine. But anyone who accepts the default on a non-account-currency pair
gets P&L off by however far the mock has drifted. A daily `fx_rates` cache was
the documented "later" step; it hasn't happened.

### 10. No onboarding, and no trade-limit warning until you hit the wall  ✅ FIXED
A new user lands on an empty dashboard with two zero-capital accounts and no
prompt to set them. The free limit is invisible until the 31st trade is refused
(`AppShell.tsx:16-19` → `UpgradeModal`); `entitlements.tradesRemaining` exists and
is only rendered on the Membership page. The planned "22 of 30 used" shell
indicator and 80% warning were never built.

### 11. Open trades have nowhere to live  ✅ FIXED
Every metric uses `closedTradesInOrder` (correctly). But an open position appears
only as a row with an `open` badge in the Journal — no open-positions panel, no
unrealized exposure, no count on the dashboard — while still consuming one of the
30 free trade slots.

### 12. Deleting a trade is unrecoverable
`Journal.tsx:268` says so explicitly. No `deleted_at`, no undo toast. A journal
where a misclick permanently destroys history is a journal people stop trusting.

### 13. Admin "Content" page was never built  ✅ FIXED
`AdminShell.tsx:19-27` ships 7 of the 8 planned admin pages. The missing one is
Content (marketing copy, FAQ entries, announcement banner) — so all marketing and
FAQ copy remains hardcoded in `src/pages/marketing/*` and needs a redeploy to
change.

### 14. Reports: "Print / PDF" prints the whole app, and only the current period  ✅ FIXED
`Reports.tsx:91` calls `window.print()`, and `src/index.css` (87 lines) has no
`@media print` block — the sidebar, header and nav print with the report.
Separately, `periodRange()` (`Reports.tsx:33`) always resolves to *now*: there is
no way to produce last month's or last quarter's report, which is the main reason
to have periods at all.

### 15. Missing, previously flagged, still absent
Timezone handling (no user timezone; `entry_time` is zone-free), trade
screenshots (the top request in the seeded feedback, `seed.ts:374`), partial
exits / scale-outs (one entry + one exit per row distorts win rate and R for
anyone who scales out), Indian charges estimator.

---

## P3 — Production hygiene

### 16. Zero UI tests
194 tests, all under `calculations/`, `constants/`, `lib/`, `services/`,
`utils/`. React Testing Library, `user-event` and jsdom are installed and
unused — there is not a single component or page test, while `README.md:55`
claims the suite covers "calculation engine + components". The riskiest code
(TradeForm's 633 lines of derived state, entitlement gating, the mode toggle) has
no coverage.

### 17. No CI and no deploy configuration
No `.github/`, so nothing runs typecheck/lint/test on a push. No `vercel.json`,
`netlify.toml` or `public/_redirects` — on any static host, a refresh on
`/app/journal` returns 404 because there is no SPA fallback rewrite.

### 18. Nothing reports errors
`ErrorBoundary` logs to the console with a TODO for Sentry. In production a
render crash is invisible to you and terminal to the user.

### 19. Modal is not accessible
`src/components/ui/Modal.tsx` has `role="dialog"` and Escape-to-close, but no
focus trap, no initial focus, no focus restoration and no `aria-labelledby`.
Every form in the app — add trade, edit trade, feedback, admin actions — lives in
this modal, so keyboard and screen-reader users can tab straight out of it into
the page behind.

### 20. Marketing pages can't be found
`index.html` has a title and description and nothing else: no Open Graph or
Twitter tags, no canonical, no `robots.txt`, no sitemap. It is a client-rendered
SPA with no prerendering, so the Home/Features/Pricing pages that exist to
acquire users are close to invisible to search and share previews.

### 21. Legal pages are placeholders
`src/pages/marketing/Legal.tsx:12-14` — `COMPANY = "Trader's Workbook"`,
`SUPPORT_EMAIL = 'support@tradersworkbook.app'` (also used in
`Settings.tsx:415` as the *only* route to account deletion). No legal entity
name, address, or GSTIN. Razorpay onboarding will ask for all three, and the
delete-my-account path currently points at an address that may not receive mail.

### 22. Every page loads every trade  ✅ FIXED
`useTrades` (`src/hooks/useTrades.ts:10`) calls `trades.list(userId)` with no
filter, and `supabase.ts:608` selects all rows; mode and date filtering happen
client-side. Correct, and fine at 200 trades; it becomes the app's slowest thing
somewhere past a thousand.

### 23. Dev runs against production data
`.env` has `VITE_DATA_SOURCE=supabase` with live project credentials, so
`npm run dev` reads and writes the real database. It's correctly gitignored and
untracked — but there is no staging project, so any destructive migration
rehearsal or seed script hits real rows.

### 24. Suspended users see a generic failure
Suspension is properly enforced in RLS (`0005:23-31`), which is the right place.
But the client has no idea — `profiles.is_suspended` is never read by the app, so
a suspended user just sees "Could not save" on every action with no explanation.

---

## Deliberately not listed

Things that look like gaps and aren't, so nobody re-audits them:

- **The calculation engine is sound.** P&L, R-multiple, expectancy, drawdown,
  profit factor are pure, tested, and correctly keyed on realization date
  (`series.ts:13,27,49` all use `exitDate ?? entryDate`) — not entry date.
- **RLS is correct** and the "admins never see trade data" guarantee holds:
  `trades` has four policies, all `user_id = auth.uid()`, none with `is_admin()`.
- **The repository seam works.** `local` and `supabase` both satisfy `Api`; the
  production build refuses to start on the local source (`services/index.ts:32`).
- **The instrument datasets are real** — 78 forex symbols with correct metal and
  crypto specs, 8 indices + 468 deduplicated NSE/BSE names, generated into SQL by
  `npm run gen:instruments` so client and DB cannot drift.
- Lint is clean (4 cosmetic warnings), typecheck is clean, and the four remaining
  Phase 3 deferrals (self-service deletion, PITR backups, mobile pass, pagination)
  were conscious calls documented in `IMPLEMENTATION_PLAN.md`, not oversights.

---

## Suggested order of work

1. **#1, #2, #3** — the DB can't be stood up, the upgrade button errors, and every
   user sees "Demo data". Nothing ships past these.
2. **#4, #5, #6** — wrong currency symbols and unenforced plan limits are what
   generate refund requests and support tickets.
3. **#16, #17, #18** — CI, SPA fallback and error reporting, before real traffic.
4. **#8, #9** — a trader signs off the lot-size dataset; FX rates get a real
   source.
5. Everything else, by what your users ask for first. #7 (options) and #15
   (screenshots) are the two that would most widen the addressable user base.
