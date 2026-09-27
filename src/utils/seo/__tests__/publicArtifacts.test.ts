import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildRobotsTxt, buildSitemapXml } from '../files';
import { allSeoRoutes, PRIVATE_PATH_PREFIXES } from '@/config/seo';
import { ROUTES } from '@/constants/routes';

/**
 * The build plugin (`vite.config.ts`) writes `public/robots.txt` and
 * `public/sitemap.xml` from these same builders. This suite checks the committed
 * copies still match, so editing a route without rebuilding fails here rather
 * than shipping a sitemap that quietly disagrees with the site.
 */

const ORIGIN = 'https://tradersworkbook.com';
// Four levels up from src/utils/seo/__tests__ reaches the repo root. Three would
// land on src/ and fail with a confusing ENOENT for src/public/robots.txt.
const PUBLIC_DIR = path.resolve(__dirname, '../../../../public');

describe('committed public/robots.txt', () => {
  it('matches what the builder produces', () => {
    const onDisk = readFileSync(path.join(PUBLIC_DIR, 'robots.txt'), 'utf8');
    expect(onDisk).toBe(buildRobotsTxt(ORIGIN, PRIVATE_PATH_PREFIXES));
  });
});

describe('committed public/sitemap.xml', () => {
  it('matches what the builder produces', () => {
    const onDisk = readFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), 'utf8');
    expect(onDisk).toBe(buildSitemapXml(ORIGIN, allSeoRoutes()));
  });
});

describe('private prefixes', () => {
  it('covers every section the registry marks non-indexable', () => {
    // The Vite plugin keeps its own copy of this list, because it cannot
    // resolve the `@/` alias. This is the assertion that the two agree.
    const pluginPrefixes = [
      '/app',
      '/admin',
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
    ];
    expect(pluginPrefixes.toSorted()).toEqual([...PRIVATE_PATH_PREFIXES].toSorted());
  });

  it('blocks the whole signed-in and admin surface, which is every non-marketing route', () => {
    for (const routePath of Object.values(ROUTES) as string[]) {
      const section = allSeoRoutes().find((entry) => entry.path === routePath)?.section;
      if (section === 'marketing') continue;
      const blocked = PRIVATE_PATH_PREFIXES.some(
        (prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`),
      );
      expect(blocked, `${routePath} (${section}) is not covered by robots.txt`).toBe(true);
    }
  });
});
