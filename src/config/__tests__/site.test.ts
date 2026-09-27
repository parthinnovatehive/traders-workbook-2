import { describe, expect, it } from 'vitest';
import { SITE, OG_IMAGE, TWITTER_CARD, siteUrl, siteAssetUrl, siteRef } from '@/config/site';
import { SEO_HEAD_DEFAULTS } from '@/config/seo.defaults';
import seoRoutes from '@/config/seo.routes.json';
import { DEFAULT_SITE_ORIGIN } from '@/utils/seo/url';

/**
 * The static `<head>` is generated at build time by `vite.config.ts` and the
 * client-rendered head is generated at runtime by `Seo`. Both describe the same
 * site, and the only thing keeping them in agreement is the fact that they read
 * from the same files.
 *
 * These tests assert that agreement where it is cheap to assert, and — more
 * usefully — they document which values must be *identical* for the two heads to
 * agree. A failure here means a crawler that does not run JavaScript and a
 * crawler that does are being told different things about the same URL.
 */

describe('canonical origin', () => {
  it('defaults to the production domain when VITE_SITE_URL is unset', () => {
    // Vitest sets no VITE_SITE_URL, so this is the production path.
    expect(SITE.origin).toBe(DEFAULT_SITE_ORIGIN);
    expect(SITE.origin).toBe('https://tradersworkbook.com');
  });

  it('never carries a trailing slash, so origin + path never doubles up', () => {
    expect(SITE.origin.endsWith('/')).toBe(false);
  });
});

describe('site identity is defined once', () => {
  it('re-exports the build-time defaults rather than restating them', () => {
    // If these ever fail, someone has typed a literal back into site.ts. That is
    // the drift this refactor removed — the runtime and the static shell would
    // then describe the site differently.
    expect(SITE.name).toBe(SEO_HEAD_DEFAULTS.name);
    expect(SITE.shortName).toBe(SEO_HEAD_DEFAULTS.shortName);
    expect(SITE.locale).toBe(SEO_HEAD_DEFAULTS.locale);
    expect(SITE.lang).toBe(SEO_HEAD_DEFAULTS.lang);
    expect(SITE.themeColor).toBe(SEO_HEAD_DEFAULTS.themeColor);
    expect(SITE.supportEmail).toBe(SEO_HEAD_DEFAULTS.supportEmail);
    expect(OG_IMAGE.path).toBe(SEO_HEAD_DEFAULTS.ogImage);
    expect(OG_IMAGE.width).toBe(SEO_HEAD_DEFAULTS.ogImageWidth);
    expect(OG_IMAGE.height).toBe(SEO_HEAD_DEFAULTS.ogImageHeight);
    expect(OG_IMAGE.alt).toBe(SEO_HEAD_DEFAULTS.ogImageAlt);
    expect(TWITTER_CARD.card).toBe(SEO_HEAD_DEFAULTS.twitterCard);
    expect(TWITTER_CARD.imageAlt).toBe(OG_IMAGE.alt);
  });

  it('has an og:image that is square-cornered and the size Open Graph expects', () => {
    // 1.91:1 is the ratio Facebook, LinkedIn and X crop to. A square image gets
    // letterboxed or cropped, which usually cuts the wordmark.
    expect(OG_IMAGE.width / OG_IMAGE.height).toBeCloseTo(1200 / 630, 2);
    expect(OG_IMAGE.width).toBe(1200);
    expect(OG_IMAGE.height).toBe(630);
  });

  it('describes the brand as a large Twitter card', () => {
    expect(TWITTER_CARD.card).toBe('summary_large_image');
  });
});

describe('absolute URL helpers', () => {
  it('resolves the home page to the bare origin', () => {
    expect(siteUrl('/')).toBe(`${SITE.origin}/`);
  });

  it('joins origin and path with exactly one slash', () => {
    expect(siteUrl('/pricing')).toBe(`${SITE.origin}/pricing`);
  });

  it('builds asset URLs the same way as page URLs', () => {
    expect(siteUrl(OG_IMAGE.path)).toBe(siteAssetUrl('og-image.png'));
  });

  it('gives each JSON-LD node a stable, distinct @id', () => {
    const website = siteRef('website');
    const organization = siteRef('organization');

    expect(website).toBe(`${SITE.origin}/#website`);
    expect(organization).toBe(`${SITE.origin}/#organization`);
    expect(website).not.toBe(organization);
  });
});

describe('the static shell and the home page describe the same URL', () => {
  const home = seoRoutes.routes.find((route) => route.path === '/');

  it('has a home entry for the build to read', () => {
    expect(home, 'vite.config.ts throws the build without this').toBeDefined();
  });

  it('gives the home page both a title and a description', () => {
    // vite.config.ts generates the static <head> from these exact two fields. An
    // empty description here ships an empty <meta name="description"> to every
    // crawler that does not run JavaScript.
    expect(home?.title.trim()).not.toBe('');
    expect(home?.description?.trim()).toBeTruthy();
  });

  it('keeps the title inside the length search engines will actually display', () => {
    // Google truncates around 60 characters. A longer title is not wrong, it is
    // just that the distinguishing words get cut, so this is a canary for a
    // title that has grown by accretion.
    expect(home!.title.length).toBeLessThanOrEqual(60);
  });

  it('keeps the description inside the length search engines will actually display', () => {
    expect(home!.description!.length).toBeLessThanOrEqual(160);
  });

  it('is indexable', () => {
    expect(home?.indexable).toBe(true);
  });
});
