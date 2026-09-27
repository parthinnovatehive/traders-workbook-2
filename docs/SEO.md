# SEO

Everything a crawler, a link unfurler or a social scraper sees about this site, and
how to change it without breaking it.

Read this before editing anything in `src/config/seo*` or `index.html`.

---

## The one-paragraph version

This is a **Vite + React 19 single-page application**, not a Next.js app. It has no
server rendering, so per-route metadata is produced in the browser and hoisted into
`<head>` by React. Because a crawler that does not execute JavaScript would
therefore see *no* metadata at all, the home page's title, description, canonical
and Open Graph tags are additionally **written into `index.html` at build time** by
a Vite plugin. Those two heads must always agree, and they are kept in agreement by
both reading the same files.

---

## Where things live

| Concern | Source of truth | Consumed by |
| --- | --- | --- |
| Per-route title, description, indexability | `src/config/seo.routes.json` | `<RouteSeo>`, `sitemap.xml`, the static `<head>` |
| Brand, locale, theme colour, OG image facts | `src/config/seo.defaults.ts` | `src/config/site.ts` (runtime) **and** the static `<head>` |
| Which prefixes are private | `src/config/seo.ts` → `PRIVATE_PATH_PREFIXES` | `<RouteSeo>`, tests |
| Canonical origin | `VITE_SITE_URL`, else `DEFAULT_SITE_ORIGIN` | everything |
| `robots.txt` / `sitemap.xml` bytes | `src/utils/seo/files.ts` | build plugin, dev server, tests |
| Static `<head>` bytes | `src/utils/seo/head.ts` | build plugin |
| Cache and security headers | `vercel.json` | Vercel |

**Rule: never type a canonical URL, the brand name or the support address a second
time.** Add it to the table above. Several of the bugs that existed before this work
were exactly hand-copied values that had drifted.

---

## Adding or changing a route

1. Add the path to `src/constants/routes.ts` (`ROUTES`).
2. Add a matching entry to `src/config/seo.routes.json`.

The build **fails** if you do only one of these, naming the offending path. This is
deliberate: a route with no registry entry silently inherits the previous route's
title and canonical, which is the single most damaging SEO failure in an SPA because
nothing errors.

A test (`src/config/__tests__/seo.test.ts`) asserts the same thing for the test run.

### Choosing `indexable`

`true` **only** for the nine public marketing pages. They are the only pages that
render for an anonymous visitor, so they are the only pages a search result could
honestly point at.

`false` for everything under `/app` (the user's own balances, positions, P&L,
strategies, psychology), everything under `/admin`, and the four auth pages.

A `/login` search result is a dead end for a visitor, and "reset my password" in a
search index is noise.

---

## `robots.txt` is not access control

`robots.txt` here is **crawl-budget hygiene only**. The signed-in app and the admin
console are protected by Supabase row-level security and server-side authorization. A
crawler that ignores `robots.txt` still receives an empty response, because it has no
session.

The `noindex, nofollow` in each private page's `<head>` is likewise a tidy-up on top
of that. **Never treat either as the security boundary.** Removing `Disallow` from
`robots.txt` must not expose a single row of user data, and it does not.

---

## The two heads

`index.html` is served to crawlers that never run JavaScript. React then takes over
and renders the same facts from the registry. Both read `seo.defaults.ts` and
`seo.routes.json`, so they cannot describe the same URL differently.

`index.html` carries readable fallback `<title>` and `<meta name="description">`
values. **The build overwrites both** with the `/` registry entry. They are only read
if the transform is bypassed entirely.

`applyHeadDefaults` **throws** if `index.html` is missing the `<!--seo-defaults-->`
marker, the `<title>`, or the description meta. That is not pedantry: a silently
skipped injection ships a site with no canonical and no Open Graph, and nothing
downstream reports it.

### The known limitation

Per-route metadata for `/pricing`, `/features`, `/app/journal` and every other
non-home route exists **only after JavaScript runs**. A crawler that does not run
JavaScript sees the home page's metadata for every URL. This is inherent to
client-side rendering. It is mitigated, not solved:

- the sitemap lists only real, indexable URLs,
- those URLs are linked internally with plain `<a href>`/`<Link>`,
- the 9 marketing routes are the only ones that matter for ranking, and they all
  render server-visible text.

**The real fix is migrating to SSR/SSG (Next.js, or Vite SSR).** That is a rewrite,
not a config change, and is out of scope here. If organic search becomes a growth
channel rather than a secondary one, it is the highest-value change available.

---

## Adding structured data

Use the builders in `src/components/seo/schema.ts` and pass the result to `<Seo>`'s
`schema` prop. Do not hand-write JSON-LD in a page.

Available: `organizationSchema`, `webSiteSchema`, `webPageSchema`,
`softwareApplicationSchema`, `faqPageSchema`, `breadcrumbSchema`.

Deliberately **absent**, and should stay absent until they are true:

- `aggregateRating` / `review` — there are no published reviews. Inventing one is a
  manual-action risk under Google's structured-data policy, and it is a lie.
- `offers` with a `price` — pricing is read live from the plans table so the markup
  cannot contradict the checkout page.
- `sameAs` social profiles — no accounts are published in this repo. A guessed handle
  attributes the product to a stranger.
- `potentialAction`/`SearchAction` — there is no site search.

`<JsonLd>` escapes `<` in its output, so a `</script>` inside any string field cannot
break out of the script block.

---

## Images

Social previews need a real 1200×630 image. It is generated, not hand-drawn:

```bash
npm run gen:images
```

Sources are `scripts/og-image.html` and `scripts/icon.html`, rendered with the
locally installed Chrome. The output is committed so a build never depends on a
browser being present. If the brand changes, edit the HTML sources and re-run.

Verified sizes: `og-image.png` 1200×630, `apple-touch-icon.png` 180×180,
`icon-512.png` 512×512, `icon-maskable-512.png` 512×512.

---

## Verifying a change

```bash
npm run typecheck
npm test              # 427 tests
npm run lint
npm run build
```

Then check the built output, not the source — the source is not what gets served:

```bash
# static head present and correct
grep -E 'canonical|og:title|og:image' dist/index.html

# sitemap contains only indexable, absolute URLs
grep -c '<loc>' dist/sitemap.xml      # expect 9
grep -E '/app|/admin|/login' dist/sitemap.xml   # expect no output

# registry drift
npx vitest run src/utils/seo/__tests__/publicArtifacts.test.ts
```

A preview server is the closest thing to production:

```bash
npm run build && npm run preview
```

---

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_SITE_URL` | `https://tradersworkbook.com` | Leave blank in production. Set only to point a *build* at another host, e.g. staging. |

Set it **only** in `.env`/`.env.local` or the deploy platform. It is read by both the
Vite config (for the static head, robots and sitemap) and the app (for runtime
canonicals), via `loadEnv`.

A wrong value is worse than a blank one: a staging build keeping the production
origin tells Google the staging copy is the real site, and vice versa.

`vite.config.ts` also **refuses to build** if a `VITE_`-prefixed secret
(`VITE_RAZORPAY_KEY_SECRET`, `VITE_SUPABASE_SERVICE_ROLE_KEY`, …) is present, because
everything with that prefix is compiled into the client bundle and readable in
devtools.

---

## Outstanding issues

### 1. Support address does not match the domain — needs a decision

`supportEmail` is `support@tradersworkbook.app` while the canonical domain is
`tradersworkbook.com`. It appears on four legal pages, the contact page, the
forgot-password screen, account deletion, and the error boundary.

It is now defined once, in `src/config/seo.defaults.ts`, so changing it is a one-line
edit. **It has not been changed**, because publishing an address at a domain nobody
controls means support mail silently bounces. Confirm which address is real.

### 2. Unknown URLs return HTTP 200

`vercel.json` rewrites non-file paths to `index.html`, so a mistyped URL returns the
SPA shell with a 200 rather than a 404. That is a soft 404.

Mitigated by `noindex` on the 404 route. Not eliminated — Vercel cannot serve the SPA
shell with a 404 status and have React Router take over. A real fix needs a
server-rendered 404.

The rewrite *is* narrowed so that a request for a **missing file** (anything with a
dot in it) falls through to Vercel's static handling and correctly 404s. Previously
`/assets/missing.js` returned HTML with a JavaScript content type.

### 3. `Content-Security-Policy` is not set

Deliberately. A CSP needs a nonce-based policy that accounts for Supabase, Razorpay
and the Google Fonts stylesheet, and getting it wrong breaks checkout. The security
headers that cannot affect behaviour (`nosniff`, `Referrer-Policy`,
`Permissions-Policy`, HSTS) are set in `vercel.json`.

**Before adding a CSP, smoke-test a real payment.** The specific risk is
`frame-ancestors`/`X-Frame-Options`: Razorpay's checkout is an iframe, and blocking
framing incorrectly can break the payment button.

### 4. The Supabase SDK ships to anonymous visitors — largest perf win available

Measured on the current build: the entry chunk is **813 kB** raw (~238 kB gzip) and
contains the entire Supabase client — GoTrue, Realtime, PostgREST.

An anonymous visitor landing on `/` or `/pricing` downloads the whole auth and
realtime stack, and can never use any of it. The cause is a single line:

```ts
// src/services/index.ts
import { supabaseApi } from './supabase';
export const api: Api = resolveApi();   // resolved eagerly, at module load
```

`src/hooks/useContent.ts` (via `AnnouncementBanner`) needs the real `api`, so this is
not fixable by trimming imports.

**The fix** is to make resolution lazy — `await import('./supabase')` — so the SDK
splits into its own chunk and is fetched only by routes that need it.

**This has deliberately not been done.** It changes a synchronous, module-level
contract that the whole app consumes, and the brief for this work was to harden SEO
without altering behaviour. It is a refactor with its own test pass, not a
hardening tweak. It is the highest-value performance change available and should be
scheduled as its own piece of work.

### 5. `www` vs apex

`vercel.json` 308-redirects `www.tradersworkbook.com` to the apex so the two hosts
cannot split ranking signals. Harmless if only one host resolves. Confirm it matches
the live DNS setup.

---

## Content guidance

- Titles ≤ 60 characters, descriptions ≤ 160. Asserted for the home page in
  `src/config/__tests__/site.test.ts`.
- One `h1` per page, no level skipped. The FAQ accordion uses `h2` + `button` with
  `aria-expanded`/`aria-controls` so the questions are both headings and operable.
- Internal links use `<Link>`/`<a href>` with real paths, never a click handler, so
  crawlers can follow them without JavaScript.
- Legal pages state a real `dateModified`. Do not replace it with a build timestamp;
  it is an editorial date and `Legal.tsx` keeps the ISO and display forms in step by
  hand precisely so a locale cannot shift it.
