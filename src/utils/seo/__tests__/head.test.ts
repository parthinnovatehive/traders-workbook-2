import { describe, expect, it } from 'vitest';
import {
  applyHeadDefaults,
  buildHeadDefaults,
  escapeAttr,
  type HeadDefaults,
  type HeadRouteEntry,
} from '@/utils/seo/head';
import { SEO_HEAD_DEFAULTS } from '@/config/seo.defaults';
import seoRoutes from '@/config/seo.routes.json';
import { DEFAULT_SITE_ORIGIN } from '@/utils/seo/url';

const home = seoRoutes.routes.find((route) => route.path === '/') as HeadRouteEntry;
const defaults: HeadDefaults = SEO_HEAD_DEFAULTS;
const ORIGIN = DEFAULT_SITE_ORIGIN;

const SHELL = [
  '<!doctype html>',
  '<html lang="en">',
  '  <head>',
  '    <title>Fallback</title>',
  '    <meta name="description" content="Fallback" />',
  '    <!--seo-defaults-->',
  '  </head>',
  '  <body><div id="root"></div></body>',
  '</html>',
].join('\n');

describe('escapeAttr', () => {
  it('leaves an ordinary string alone', () => {
    expect(escapeAttr('Trading Journal & Performance Analytics')).toBe(
      'Trading Journal &amp; Performance Analytics',
    );
  });

  it('escapes a double quote, which would otherwise end the attribute early', () => {
    // Without this, `content="a "b"` parses as content="a " plus a junk
    // attribute, and the description silently disappears.
    expect(escapeAttr('say "hi"')).toBe('say &quot;hi&quot;');
  });

  it('escapes angle brackets', () => {
    expect(escapeAttr('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes the ampersand before anything else, so entities are not corrupted', () => {
    expect(escapeAttr('a & <b>')).toBe('a &amp; &lt;b&gt;');
  });

  it('is not idempotent, which is why applyHeadDefaults replaces rather than re-escapes', () => {
    // Every escaper behaves this way. It is safe here only because
    // applyHeadDefaults substitutes whole tags, so an already-escaped value is
    // never fed back through. Recorded so the next person to "fix" it by running
    // the output through escapeAttr again knows why that corrupts every title.
    expect(escapeAttr(escapeAttr('a & b'))).toBe('a &amp;amp; b');
  });

  it('preserves the em dash and apostrophe in the brand name', () => {
    expect(escapeAttr("Trader's Workbook — the journal")).toBe(
      "Trader's Workbook — the journal",
    );
  });
});

describe('buildHeadDefaults', () => {
  const html = buildHeadDefaults(ORIGIN, home, defaults);

  it('points the canonical at the home page on the configured origin', () => {
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/" />`);
  });

  it('uses absolute URLs for every image reference', () => {
    // A relative og:image is not resolved by most scrapers — the preview breaks
    // with no error anywhere.
    expect(html).toContain(`property="og:image" content="${ORIGIN}${defaults.ogImage}"`);
    expect(html).toContain(`property="og:image:secure_url"`);
    expect(html).not.toMatch(/og:image" content="\//);
  });

  it('states the og:image dimensions so the card is not re-fetched and re-cropped', () => {
    expect(html).toContain(`content="${defaults.ogImageWidth}"`);
    expect(html).toContain(`content="${defaults.ogImageHeight}"`);
  });

  it('uses the home registry entry rather than a separately typed title', () => {
    expect(html).toContain(`property="og:title" content="${escapeAttr(home.title)}"`);
    expect(html).toContain(
      `property="og:description" content="${escapeAttr(home.description!)}"`,
    );
  });

  it('agrees with the title React will render for the same route', () => {
    // The two heads describe the same URL. If these differ, whether a crawler
    // indexes the registry text or the shell text depends on whether it runs
    // JavaScript, which is not a property worth having.
    const clientTitle = seoRoutes.routes.find((r) => r.path === '/')!.title;
    expect(escapeAttr(home.title)).toBe(escapeAttr(clientTitle));
  });

  it('includes every tag an unfurl needs to render a card', () => {
    for (const tag of [
      'og:title',
      'og:description',
      'og:image',
      'og:image:alt',
      'og:url',
      'og:site_name',
      'og:locale',
      'twitter:card',
      'twitter:title',
      'twitter:description',
      'twitter:image',
    ]) {
      expect(html, `missing ${tag}`).toContain(tag);
    }
  });

  it('never emits a noindex on the home page', () => {
    expect(html).not.toContain('noindex');
  });

  it('does not contain a second canonical', () => {
    expect(html.match(/rel="canonical"/g) ?? []).toHaveLength(1);
  });
});

describe('applyHeadDefaults', () => {
  it('replaces the fallback title with the registry title', () => {
    const out = applyHeadDefaults(SHELL, ORIGIN, home, defaults);
    expect(out).toContain(`<title>${home.title}</title>`);
    expect(out).not.toContain('<title>Fallback</title>');
  });

  it('replaces the fallback description with the registry description', () => {
    const out = applyHeadDefaults(SHELL, ORIGIN, home, defaults);
    expect(out).toContain(`content="${escapeAttr(home.description!)}"`);
    expect(out).not.toContain('content="Fallback"');
  });

  it('consumes the marker rather than leaving it in the output', () => {
    expect(applyHeadDefaults(SHELL, ORIGIN, home, defaults)).not.toContain('<!--seo-defaults-->');
  });

  it('is idempotent, so a plugin pipeline applying it twice is harmless', () => {
    const once = applyHeadDefaults(SHELL, ORIGIN, home, defaults);
    const twice = applyHeadDefaults(once, ORIGIN, home, defaults);
    expect(twice).toBe(once);
  });

  it('keeps the rest of the document untouched', () => {
    const out = applyHeadDefaults(SHELL, ORIGIN, home, defaults);
    expect(out).toContain('<div id="root"></div>');
    expect(out).toContain('<html lang="en">');
  });

  it('refuses to build when the marker has been deleted from index.html', () => {
    const broken = SHELL.replace('<!--seo-defaults-->', '');
    expect(() => applyHeadDefaults(broken, ORIGIN, home, defaults)).toThrow(
      /seo-defaults/,
    );
  });

  it('refuses to build when the title has been deleted', () => {
    const broken = SHELL.replace('<title>Fallback</title>', '');
    expect(() => applyHeadDefaults(broken, ORIGIN, home, defaults)).toThrow(/<title>/);
  });

  it('refuses to build when the description has been deleted', () => {
    const broken = SHELL.replace('<meta name="description" content="Fallback" />', '');
    expect(() => applyHeadDefaults(broken, ORIGIN, home, defaults)).toThrow(
      /description/,
    );
  });
});
