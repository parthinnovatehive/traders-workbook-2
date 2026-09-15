# Trader's Workbook

**The complete trading journal, analytics & performance management system.**

> Turn every trade into data. Turn your data into discipline.

A professional trading performance operating system — journal, risk management,
analytics, psychology tracking and trader improvement in one place.

Core loop: **RECORD → ANALYZE → IDENTIFY MISTAKES → MEASURE PERFORMANCE → IMPROVE → REPEAT**

---

## Tech stack

| Area          | Choice                                        |
| ------------- | --------------------------------------------- |
| Framework     | React 19 + Vite (SPA)                         |
| Language      | TypeScript (strict)                           |
| Routing       | React Router v7                               |
| Styling       | Tailwind CSS v4 (CSS-first tokens, dark-first)|
| Server state  | TanStack Query                                |
| App state     | Zustand                                        |
| Forms         | React Hook Form + Zod                         |
| Tables        | TanStack Table                                |
| Charts        | Recharts                                      |
| Testing       | Vitest + React Testing Library                |
| Lint / format | oxlint + Prettier                             |

Business logic (the **calculation engine**) lives in `src/calculations/` as pure,
fully-tested functions and is never embedded in UI components.

---

## Getting started

```bash
npm install
cp .env.example .env.local   # optional; defaults run fully local (no backend)
npm run dev
```

The app runs with **zero backend** by default — data is stored in the browser via
a local mock repository (`VITE_DATA_SOURCE=local`).

## Scripts

```bash
npm run dev          # start the dev server
npm run build        # typecheck (tsc -b) + production build to dist/
npm run preview      # preview the production build locally
npm run typecheck    # TypeScript, no emit
npm run lint         # oxlint
npm run format       # Prettier write
npm run test         # run the test suite (calculation engine + components)
npm run test:watch   # watch mode
```

## Environment variables

See [`.env.example`](.env.example). Only `VITE_`-prefixed variables reach the
client bundle — **never** put secrets or service-role keys in them.

| Variable                 | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `VITE_DATA_SOURCE`       | `local` (mock, default) or `supabase` (real backend)|
| `VITE_API_URL`           | Backend base URL (reserved, future use)             |
| `VITE_SUPABASE_URL`      | Supabase project URL (when `VITE_DATA_SOURCE=supabase`) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key — requires RLS on every table     |

## Architecture

```
UI (pages/components)
  ↓ intents / view models
Hooks + State (TanStack Query, Zustand)
  ↓ commands
Services (repository interfaces)  →  Local mock  |  Real API / DB
  ↓
Calculation engine (pure, tested)   ← single source of truth for all math
```

- **Repository pattern:** UI depends on interfaces (`ITradeRepository`, …), never
  on a concrete data source, so the mock layer swaps for a real backend with no
  UI changes.
- **Derive, don't store:** metrics are computed from raw trades; performance
  summaries may be cached later but the engine remains the single source of truth.

## Backend / database configuration

The frontend is designed to connect cleanly to Supabase (Postgres with
Row-Level Security) so users can only read their own rows.

1. Create a Supabase project.
2. Open **SQL Editor** and paste the whole `supabase/schema.sql` file (tables,
   RLS policies, triggers and seed data) — Run.
3. Copy `.env.example` → `.env.local` and set:

   ```
   VITE_DATA_SOURCE=supabase
   VITE_SUPABASE_URL=<your-project-url>
   VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
   ```

4. Register an account in the app, then promote it to admin:
   `SQL Editor → update public.profiles set role = 'admin' where id = (select id from auth.users where email = '<your-email>');`

Extending the app to another backend is the same swap — implement the `Api`
interface from `src/services/interfaces.ts` and return it from
`src/services/index.ts`.

## Testing

The calculation engine is the priority for testing (P&L, risk, R-multiple, ROI,
drawdown, win rate, expectancy, and their edge cases). Run:

```bash
npm run test
```

## Deployment

Static SPA — `npm run build` outputs `dist/`, deployable to Vercel, Netlify,
Cloudflare Pages, Render, or any static host (with an SPA fallback rewrite to
`index.html`).

---

## Status

Under active development. See the phased roadmap in the project brief.
