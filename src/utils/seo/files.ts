import { absoluteUrl, normalizeOrigin } from './url';

/**
 * Builders for `public/robots.txt` and `public/sitemap.xml`.
 *
 * Both are generated at build time by the plugin in `vite.config.ts` rather
 * than committed by hand, because a hand-maintained sitemap rots the moment
 * somebody adds a route. The route list is passed in from
 * `src/config/seo.routes.json`, so these stay pure functions with no imports
 * the Vite config cannot resolve.
 */

/** A sitemap entry, reduced to the fields this file actually needs. */
export interface SitemapEntry {
  path: string;
  indexable: boolean;
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * `robots.txt`.
 *
 * Notes on what is and is not here:
 *
 * - This file is crawl *hygiene*, not access control. Everything it blocks is
 *   already protected by Supabase row-level security and server-side
 *   authorization, so a crawler that ignores this file still receives nothing.
 *   Treating robots.txt as the protection would be the actual vulnerability.
 * - `Disallow: /*?*` drops every URL carrying a query string. No indexable page
 *   in this app uses one, and tracking parameters are the usual source of
 *   infinite duplicate URLs. If a page ever needs a parameter to be indexable,
 *   this line has to be narrowed or removed first.
 * - `Sitemap:` is the discovery mechanism. Without it a crawler has to find
 *   `/sitemap.xml` by guessing.
 */
export function buildRobotsTxt(
  originInput?: string,
  privatePrefixes: readonly string[] = [],
): string {
  const origin = normalizeOrigin(originInput);
  const disallows = privatePrefixes.map((prefix) => `Disallow: ${prefix}`);

  return [
    "# Trader's Workbook",
    '# The signed-in app, the admin console and the auth pages are blocked from',
    '# crawling here for crawl-budget reasons only. They are protected by database',
    '# row-level security, not by this file.',
    '',
    'User-agent: *',
    'Allow: /',
    ...disallows,
    '',
    '# No indexable page in this app uses a query string; tracking parameters are',
    '# the usual source of duplicate URLs.',
    'Disallow: /*?*',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

/**
 * `sitemap.xml`.
 *
 * Only `indexable` entries are emitted. Authenticated, admin and `noindex` pages
 * are excluded by the same flag that puts `noindex` in their head, so the two
 * can never disagree about what is public.
 *
 * `<lastmod>` is intentionally omitted. Nothing in this repository knows when a
 * page last changed, and a `<lastmod>` that is really "the day we wrote this
 * build script" tells a crawler the page is fresher than it is — which is worse
 * than saying nothing. Google treats a missing `lastmod` as "unknown", which is
 * the truth.
 */
export function buildSitemapXml(
  originInput?: string,
  entries: readonly SitemapEntry[] = [],
): string {
  const origin = normalizeOrigin(originInput);

  const urls = entries
    .filter((entry) => entry.indexable)
    .map((entry) => {
      const lines = [`    <loc>${xmlEscape(absoluteUrl(entry.path, origin))}</loc>`];
      if (entry.changefreq) lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
      if (typeof entry.priority === 'number') {
        lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
      }
      return `  <url>\n${lines.join('\n')}\n  </url>`;
    });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}
