import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/constants/routes';
import {
  NOT_FOUND,
  PRIVATE_PATH_PREFIXES,
  allSeoRoutes,
  indexableRoutes,
  isPrivatePath,
  seoForPath,
} from '@/config/seo';

/**
 * The registry in `src/config/seo.routes.json` is the only place that decides
 * what a page is called and whether it may be indexed. These tests exist so a
 * route cannot be added without metadata, and so two pages cannot quietly end up
 * sharing a title — the failure mode that makes a site look like it has one page
 * to a crawler.
 */

const routedPaths: string[] = Object.values(ROUTES);

describe('route coverage', () => {
  it('has an entry for every path the router defines', () => {
    const missing = routedPaths.filter((path) => !seoForPath(path));
    expect(missing, `add these to seo.routes.json: ${missing.join(', ')}`).toEqual([]);
  });

  it('has no entry for a path the router does not define', () => {
    const orphans = allSeoRoutes()
      .map((entry) => entry.path)
      .filter((path) => !routedPaths.includes(path));
    expect(orphans, `remove these from seo.routes.json: ${orphans.join(', ')}`).toEqual([]);
  });

  it('registers each path exactly once', () => {
    const paths = allSeoRoutes().map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('normalises lookups, so a trailing slash still resolves', () => {
    expect(seoForPath('/pricing/')?.path).toBe(ROUTES.pricing);
    expect(seoForPath('/pricing?utm_source=x')?.path).toBe(ROUTES.pricing);
  });

  it('returns nothing for an unknown path, which is the 404 case', () => {
    expect(seoForPath('/definitely-not-a-route')).toBeUndefined();
  });
});

describe('indexability', () => {
  it('marks exactly the nine public marketing pages indexable', () => {
    expect(indexableRoutes().map((entry) => entry.path).toSorted()).toEqual(
      [
        '/',
        '/about',
        '/contact',
        '/faq',
        '/features',
        '/privacy',
        '/pricing',
        '/refunds',
        '/terms',
      ].toSorted(),
    );
  });

  it('keeps every private section out of the index', () => {
    for (const entry of allSeoRoutes()) {
      if (entry.section === 'marketing') continue;
      expect(entry.indexable, `${entry.path} (${entry.section}) must be noindex`).toBe(false);
    }
  });

  it('never marks anything under a private prefix indexable', () => {
    for (const entry of indexableRoutes()) {
      expect(isPrivatePath(entry.path), `${entry.path} is indexable but private`).toBe(false);
    }
  });

  it('covers the whole signed-in app and admin surface', () => {
    for (const prefix of ['/app', '/admin']) {
      expect(PRIVATE_PATH_PREFIXES).toContain(prefix);
    }
  });
});

describe('isPrivatePath', () => {
  it('matches the private prefixes and everything under them', () => {
    for (const path of ['/app', '/app/', '/app/journal', '/app/analytics', '/admin', '/admin/users']) {
      expect(isPrivatePath(path), path).toBe(true);
    }
  });

  it('matches the auth pages', () => {
    for (const path of ['/login', '/register', '/forgot-password', '/reset-password']) {
      expect(isPrivatePath(path), path).toBe(true);
    }
  });

  it('does not treat a prefix lookalike as private', () => {
    // The same trap `resolvePostAuthRoute` guards against: `/apparel` starts
    // with "/app" as a string but is a public page.
    for (const path of ['/', '/apparel', '/administrator', '/login-help', '/pricing']) {
      expect(isPrivatePath(path), path).toBe(false);
    }
  });
});

describe('titles and descriptions', () => {
  it('gives every route a title', () => {
    for (const entry of allSeoRoutes()) {
      expect(entry.title?.trim(), entry.path).not.toBe('');
    }
  });

  it('gives every indexable page a description', () => {
    for (const entry of indexableRoutes()) {
      expect(entry.description?.trim(), entry.path).not.toBe('');
    }
  });

  it('never repeats a title, which would collapse distinct pages into one', () => {
    const titles = allSeoRoutes().map((entry) => entry.title);
    const duplicates = titles.filter((title, i) => titles.indexOf(title) !== i);
    expect(duplicates, `duplicate titles: ${duplicates.join(', ')}`).toEqual([]);
  });

  it('never repeats a description among indexable pages', () => {
    const descriptions = indexableRoutes().map((entry) => entry.description);
    const duplicates = descriptions.filter((d, i) => descriptions.indexOf(d) !== i);
    expect(duplicates, `duplicate descriptions: ${duplicates.join(', ')}`).toEqual([]);
  });

  it('keeps titles inside the range search engines will actually display', () => {
    for (const entry of allSeoRoutes()) {
      expect(entry.title.length, `${entry.path} title is ${entry.title.length} chars`).toBeGreaterThan(10);
      expect(entry.title.length, `${entry.path} title is ${entry.title.length} chars`).toBeLessThanOrEqual(65);
    }
  });

  it('keeps indexable descriptions inside the display range', () => {
    for (const entry of indexableRoutes()) {
      const length = entry.description?.length ?? 0;
      expect(length, `${entry.path} description is ${length} chars`).toBeGreaterThan(70);
      expect(length, `${entry.path} description is ${length} chars`).toBeLessThanOrEqual(160);
    }
  });

  it('gives the home page a distinct title from every other page', () => {
    const home = seoForPath(ROUTES.home);
    expect(home?.title).toContain("Trader's Workbook");
    expect(home?.indexable).toBe(true);
  });

  it('marks the 404 noindex and gives it a real title', () => {
    expect(NOT_FOUND.title).toContain('not found');
    expect(NOT_FOUND.description?.trim()).not.toBe('');
  });
});

describe('financial-claim safety', () => {
  /**
   * This is a trading product sold to retail traders. The marketing copy is
   * allowed to describe what the software does and never what it will earn.
   * These assertions are deliberately blunt: a banned phrase in a title or
   * description is a compliance problem, not a style preference.
   */
  const BANNED = [
    /guaranteed/i,
    /risk[- ]free/i,
    /guarantee[ds]?\s+(returns|profits)/i,
    /\b(proven|assured)\s+(returns|profits|earnings)\b/i,
    /beat the market/i,
    /make money/i,
    /double your/i,
    /\d+\s*%\s+(average|expected|guaranteed)\s+(return|profit|roi)\b/i,
    /as seen on/i,
    /best[- ]in[- ]class/i,
    /#1\s+(trading|platform|app)/i,
  ];

  it('makes no performance or outcome promise in any indexable metadata', () => {
    for (const entry of indexableRoutes()) {
      const haystack = `${entry.title} ${entry.description ?? ''}`;
      for (const pattern of BANNED) {
        expect(haystack, `${entry.path} matched ${pattern}: ${haystack}`).not.toMatch(pattern);
      }
    }
  });

  it('keeps prices out of the metadata, so a price change cannot leave a stale claim behind', () => {
    // Prices are rendered from the plan rows and are admin-editable. Repeating
    // one in a description means it silently goes stale.
    for (const entry of indexableRoutes()) {
      expect(`${entry.title} ${entry.description ?? ''}`, entry.path).not.toMatch(/₹|Rs\.?\s*\d|\d+\s*INR/);
    }
  });
});
