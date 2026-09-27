import {
  DEFAULT_SITE_ORIGIN,
  absoluteUrl,
  absoluteUrlWithFragment,
  assetPath,
  normalizeOrigin,
} from '@/utils/seo/url';
import { SEO_HEAD_DEFAULTS } from './seo.defaults';

/**
 * Site-wide identity, in one place.
 *
 * These facts have to agree with each other across the footer, the document
 * head, the JSON-LD and `robots.txt`. Spelling the brand or the origin a second
 * time somewhere is how a canonical URL ends up disagreeing with a sitemap, so
 * everything reads from here.
 *
 * The literal values live in `./seo.defaults` because `vite.config.ts` has to
 * write the same facts into the static HTML shell at build time and cannot use
 * the `@/` alias. This file re-exports them with the runtime origin attached.
 *
 * `DEFAULT_CONTENT.marketing` in `./content.ts` covers *editable marketing
 * copy*. This file covers *facts about the business* — the kind that should
 * change when the company changes, not when marketing copy is edited.
 */

/** Read per build; see `.env.example`. Left blank, production is assumed. */
const configuredOrigin = import.meta.env.VITE_SITE_URL;

export const SITE = {
  name: SEO_HEAD_DEFAULTS.name,
  /** Used where the full name would wrap or repeat the title. */
  shortName: SEO_HEAD_DEFAULTS.shortName,
  origin: normalizeOrigin(configuredOrigin || DEFAULT_SITE_ORIGIN),

  /**
   * The product is sold in rupees to Indian retail traders and the terms are
   * governed by Indian law, so the declared locale is `en_IN` rather than `en`.
   */
  locale: SEO_HEAD_DEFAULTS.locale,
  lang: SEO_HEAD_DEFAULTS.lang,

  /**
   * Matches `--bg` in the dark theme (`src/index.css`), which is the default
   * theme. Used for `theme-color`, which tints the mobile browser chrome.
   */
  themeColor: SEO_HEAD_DEFAULTS.themeColor,

  /**
   * The address published on the Terms, Privacy, Refunds and Contact pages.
   * Single source so those pages and any future `sameAs`/contact markup agree.
   */
  supportEmail: SEO_HEAD_DEFAULTS.supportEmail,
} as const;

/** Social preview image, rendered from `scripts/` at 1200×630. */
export const OG_IMAGE = {
  path: SEO_HEAD_DEFAULTS.ogImage,
  width: SEO_HEAD_DEFAULTS.ogImageWidth,
  height: SEO_HEAD_DEFAULTS.ogImageHeight,
  alt: SEO_HEAD_DEFAULTS.ogImageAlt,
} as const;

/**
 * Twitter/X card. `summary_large_image` because the product is visual and the
 * 1200×630 image is already generated for Open Graph.
 *
 * Deliberately no `site`/`creator` handle: no X account is published anywhere in
 * this repo, and a guessed handle attributes the product to a stranger.
 */
export const TWITTER_CARD = {
  card: SEO_HEAD_DEFAULTS.twitterCard,
  imageAlt: SEO_HEAD_DEFAULTS.ogImageAlt,
} as const;

/** Absolute URL helper bound to the configured origin. */
export function siteUrl(path: string): string {
  return absoluteUrl(path, SITE.origin);
}

/** Absolute URL for a public asset. */
export function siteAssetUrl(file: string): string {
  return siteUrl(assetPath(file));
}

/**
 * A stable `@id` for a node in the JSON-LD graph, so `WebPage.isPartOf` can point
 * at the `WebSite` and `WebSite.publisher` at the `Organization` instead of
 * restating them inline.
 */
export function siteRef(node: 'website' | 'organization'): string {
  return absoluteUrlWithFragment('/', node);
}
