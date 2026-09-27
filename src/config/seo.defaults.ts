/**
 * The site identity that must be in the served HTML *before* any JavaScript runs.
 *
 * A crawler that does not execute JavaScript sees only `index.html`. So the title,
 * description, canonical and Open Graph tags cannot live in a React component —
 * they have to be written into the shell at build time by `vite.config.ts`.
 *
 * That creates a genuine tension: the app knows the site identity at runtime
 * (`./site.ts`), and the build knows it at config time. The tempting answer is to
 * write the values twice and add a test that compares the two copies. This module
 * is the better answer — `vite.config.ts` already imports plain TypeScript for
 * `robots.txt` and `sitemap.xml`, so it can import this too, and there is then only
 * one copy and nothing to drift.
 *
 * Constraint: this file must not use the `@/` alias. The Vite config cannot
 * resolve it. `./site.ts` imports *this* module, so the dependency only ever runs
 * in one direction.
 *
 * The home page's title and description are deliberately *absent* here. They live
 * in `seo.routes.json`, which `vite.config.ts` already reads — so the static shell
 * and the client-rendered home page are guaranteed to ship identical text rather
 * than two hand-copied versions that quietly diverge.
 */

export const SEO_HEAD_DEFAULTS = {
  name: "Trader's Workbook",
  /** Used where the full name would wrap or repeat the title. */
  shortName: 'Workbook',

  /**
   * The product is sold in rupees to Indian retail traders and the terms are
   * governed by Indian law, so the declared locale is `en_IN` rather than `en`.
   */
  locale: 'en_IN',
  lang: 'en',

  /** Matches `--bg` in the dark theme (`src/index.css`), the default theme. */
  themeColor: '#0a0d14',

  /** Social preview image, rendered from `scripts/` at 1200×630. */
  ogImage: '/og-image.png',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt:
    "Trader's Workbook — the trading journal, analytics and performance management system for Forex and Indian market traders.",

  /**
   * `summary_large_image` because the product is visual and the 1200×630 image
   * is already generated for Open Graph.
   *
   * Deliberately no `site`/`creator` handle: no X account is published anywhere in
   * this repo, and a guessed handle attributes the product to a stranger.
   */
  twitterCard: 'summary_large_image',

  /**
   * The address published on the Terms, Privacy, Refunds and Contact pages.
   * NOTE: this is `.app` while the canonical origin is `.com` — see docs/SEO.md.
   */
  supportEmail: 'support@tradersworkbook.app',
} as const;
