import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Seo, resolve } from '../Seo';
import { ROUTES } from '@/constants/routes';
import { NOT_FOUND, seoForPath } from '@/config/seo';

/** Reads a `<meta>` the browser would see, by name or property. */
function meta(selector: 'name' | 'property', key: string): string | null {
  return document.head.querySelector(`meta[${selector}="${key}"]`)?.getAttribute('content') ?? null;
}

describe('<Seo> head output', () => {
  it('hoists the title into <head> rather than leaving it in the body', () => {
    const { container } = render(<Seo path={ROUTES.pricing} />);
    // React 19 hoists <title>/<meta>/<link>. If this ever regresses to inline
    // output the metadata is invisible to anything reading <head>.
    expect(document.head.querySelector('title')?.textContent).toBe(
      "Pricing — Free, Pro & Elite Plans | Trader's Workbook",
    );
    expect(container.querySelector('title')).toBeNull();
  });

  it('emits a description, canonical and Open Graph tags for an indexable page', () => {
    render(<Seo path={ROUTES.features} />);
    const entry = seoForPath(ROUTES.features);

    expect(meta('name', 'description')).toBe(entry?.description);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://tradersworkbook.com/features',
    );
    expect(meta('property', 'og:title')).toBe(entry?.title);
    expect(meta('property', 'og:url')).toBe('https://tradersworkbook.com/features');
    expect(meta('property', 'og:type')).toBe('website');
    expect(meta('property', 'og:site_name')).toBe("Trader's Workbook");
    expect(meta('property', 'og:locale')).toBe('en_IN');
    expect(meta('property', 'og:image')).toBe('https://tradersworkbook.com/og-image.png');
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
    expect(meta('name', 'twitter:image')).toBe('https://tradersworkbook.com/og-image.png');
  });

  it('omits robots on an indexable page, since the default is already index/follow', () => {
    render(<Seo path={ROUTES.home} />);
    expect(meta('name', 'robots')).toBeNull();
  });

  it('marks every private surface noindex, nofollow', () => {
    for (const path of [
      ROUTES.app,
      ROUTES.journal,
      ROUTES.membership,
      ROUTES.admin,
      ROUTES.adminUsers,
      ROUTES.login,
      ROUTES.register,
      ROUTES.resetPassword,
    ]) {
      const { unmount } = render(<Seo path={path} />);
      expect(meta('name', 'robots'), `expected noindex on ${path}`).toBe('noindex, nofollow');
      unmount();
    }
  });

  it('swaps metadata between routes instead of stacking duplicates', () => {
    const { rerender } = render(<Seo path={ROUTES.home} />);
    rerender(<Seo path={ROUTES.about} />);

    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(meta('name', 'description')).toBe(seoForPath(ROUTES.about)?.description);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://tradersworkbook.com/about',
    );
  });

  it('renders JSON-LD blocks when given them, and nothing when given none', () => {
    const { rerender } = render(
      <Seo path={ROUTES.home} schema={{ '@type': 'Organization', name: "Trader's Workbook" }} />,
    );
    const block = document.querySelector('script[type="application/ld+json"]');
    expect(block).not.toBeNull();
    expect(JSON.parse(block?.textContent ?? '{}')).toMatchObject({ '@type': 'Organization' });
    // React 19 hoists <title>/<meta>/<link> but renders an inline <script>
    // in place, so the block lands in the body. That is valid: consumers parse
    // JSON-LD anywhere in the document, not only in <head>.
    expect(block?.closest('head')).toBeNull();

    rerender(<Seo path={ROUTES.home} />);
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it('accepts several schema blocks at once and drops nullish ones', () => {
    render(
      <Seo
        path={ROUTES.home}
        schema={[{ '@type': 'WebSite' }, null, undefined, { '@type': 'Organization' }]}
      />,
    );
    const types = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(
      (node) => JSON.parse(node.textContent ?? '{}')['@type'],
    );
    expect(types).toEqual(['WebSite', 'Organization']);
  });
});

describe('resolve', () => {
  it('defaults an unknown path to noindex', () => {
    // The 404 handler and any future route must never default to indexable.
    expect(resolve({ entry: undefined, path: '/does-not-exist' }).noIndex).toBe(true);
  });

  it('derives the canonical from the path, ignoring query strings and trailing slashes', () => {
    const canonicals = ['/pricing', '/pricing/', '/pricing?utm_source=x', '/pricing#plans'].map(
      (path) => resolve({ entry: seoForPath(ROUTES.pricing), path }).canonical,
    );
    expect(new Set(canonicals)).toEqual(new Set(['https://tradersworkbook.com/pricing']));
  });

  it('falls back rather than emitting an empty description', () => {
    const result = resolve({ entry: undefined, path: ROUTES.app, description: '   ' });
    expect(result.description.length).toBeGreaterThan(0);
  });

  it('lets an explicit noIndex override an indexable entry', () => {
    expect(resolve({ entry: seoForPath(ROUTES.home), path: ROUTES.home, noIndex: true }).noIndex).toBe(
      true,
    );
  });

  it('never produces a title or description that is only whitespace', () => {
    for (const path of Object.values(ROUTES)) {
      const result = resolve({ entry: seoForPath(path), path, title: ' ', description: ' ' });
      expect(result.title.trim()).not.toBe('');
      expect(result.description.trim()).not.toBe('');
    }
  });
});

describe('404 metadata', () => {
  it('is noindex and names the situation', () => {
    render(<Seo path="/nope" title={NOT_FOUND.title} description={NOT_FOUND.description} />);
    expect(meta('name', 'robots')).toBe('noindex, nofollow');
    expect(document.head.querySelector('title')?.textContent).toBe(NOT_FOUND.title);
  });
});
