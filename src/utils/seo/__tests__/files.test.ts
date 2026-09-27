import { describe, expect, it } from 'vitest';
import { buildRobotsTxt, buildSitemapXml } from '../files';
import { allSeoRoutes, indexableRoutes, PRIVATE_PATH_PREFIXES } from '@/config/seo';

const ORIGIN = 'https://tradersworkbook.com';

describe('buildRobotsTxt', () => {
  const robots = buildRobotsTxt(ORIGIN, PRIVATE_PATH_PREFIXES);

  it('advertises the sitemap so a crawler can find it without guessing', () => {
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  it('allows crawling generally, so public pages stay reachable', () => {
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
  });

  it('blocks every private section', () => {
    for (const prefix of PRIVATE_PATH_PREFIXES) {
      expect(robots, `expected Disallow for ${prefix}`).toContain(`Disallow: ${prefix}`);
    }
  });

  it('blocks the signed-in app, the admin console and the auth pages', () => {
    expect(robots).toContain('Disallow: /app');
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Disallow: /login');
    expect(robots).toContain('Disallow: /register');
  });

  it('uses the configured origin rather than a hardcoded one', () => {
    expect(buildRobotsTxt('https://staging.example.com', [])).toContain(
      'Sitemap: https://staging.example.com/sitemap.xml',
    );
  });

  it('states in the file itself that this is not the access control', () => {
    // A future reader must not mistake robots.txt for the security boundary.
    expect(robots).toMatch(/row-level security/i);
  });
});

describe('buildSitemapXml', () => {
  const xml = buildSitemapXml(ORIGIN, allSeoRoutes());

  it('is a well-formed urlset with an XML declaration', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
    // Every entry opened must also be closed.
    expect(xml.match(/<url>/g)?.length).toBe(xml.match(/<\/url>/g)?.length);
  });

  it('lists exactly the indexable pages', () => {
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const expected = indexableRoutes().map((entry) => `${ORIGIN}${entry.path}`);
    expect(locs).toEqual(expected);
  });

  it('never lists a private, authenticated or admin URL', () => {
    for (const entry of allSeoRoutes()) {
      if (entry.indexable) continue;
      expect(xml, `${entry.path} must not be in the sitemap`).not.toContain(`<loc>${ORIGIN}${entry.path}`);
    }
    expect(xml).not.toContain('/app');
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain('/login');
  });

  it('omits lastmod rather than inventing one', () => {
    // Nothing in the repo knows when a page last changed; a fabricated
    // lastmod would tell crawlers the page is fresher than it is.
    expect(xml).not.toContain('<lastmod>');
  });

  it('emits changefreq and priority only where the registry sets them', () => {
    const withPriority = indexableRoutes().filter((entry) => typeof entry.priority === 'number');
    for (const entry of withPriority) {
      expect(xml).toContain(`<priority>${entry.priority?.toFixed(1)}</priority>`);
    }
    // Priorities are formatted to one decimal, as the spec expects.
    for (const match of xml.matchAll(/<priority>([^<]+)<\/priority>/g)) {
      expect(match[1]).toMatch(/^\d\.\d$/);
    }
  });

  it('includes the home page as the bare origin', () => {
    expect(xml).toContain(`<loc>${ORIGIN}/</loc>`);
  });

  it('escapes XML metacharacters in a loc', () => {
    // A query string never reaches the XML — `normalizePath` strips it, which
    // is the point of the canonical. A `&` inside the path itself does, so
    // that is what the escaping has to survive.
    const hostile = buildSitemapXml(ORIGIN, [{ path: '/a&b<c>', indexable: true }]);
    expect(hostile).toContain('<loc>https://tradersworkbook.com/a&amp;b&lt;c&gt;</loc>');
  });

  it('never emits a query string, so tracking parameters cannot fork the sitemap', () => {
    const xml2 = buildSitemapXml(ORIGIN, [{ path: '/pricing?utm_source=x', indexable: true }]);
    expect(xml2).toContain('<loc>https://tradersworkbook.com/pricing</loc>');
    for (const [, loc] of xml2.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      expect(loc, 'no loc may carry a query string').not.toContain('?');
    }
  });
});
