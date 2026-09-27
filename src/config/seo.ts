import { ROUTES } from '@/constants/routes';
import { normalizePath } from '@/utils/seo/url';
import seoRoutesJson from './seo.routes.json';

/**
 * Per-route metadata: title, description and — the part that actually matters
 * for a trading journal — whether the page is allowed in an index at all.
 *
 * The data lives in `./seo.routes.json` rather than here for one specific
 * reason: `vite.config.ts` generates `public/robots.txt` and `public/sitemap.xml`
 * from this same table at build time, and the `@/` alias does not resolve inside
 * the Vite config. JSON is readable from both sides, so the sitemap, the robots
 * file and the document head are guaranteed to be describing the same site.
 * A test asserts this table covers every route in the router.
 *
 * The rules that shaped this table:
 *
 * - The 9 marketing pages are the entire indexable surface. They are the only
 *   pages that render for an anonymous visitor, so they are the only pages a
 *   search result could honestly point at.
 * - Everything under `/app` is the signed-in user's own journal: balances,
 *   positions, P&L, strategies, psychology. Nothing there may be indexed, and
 *   nothing there may appear in a sitemap.
 * - Everything under `/admin` is internal platform administration.
 * - Auth pages are excluded because a `/login` result is a dead end for a
 *   visitor, and because "reset my password" in a search index is noise.
 *
 * `robots.txt` alone is not the protection here and must never be treated as
 * it. These routes are gated by Supabase row-level security and server-side
 * authorization; a crawler that ignores robots.txt still receives an empty
 * response, because it has no session. Blocking in robots.txt and marking the
 * head `noindex` are both just tidy-ups on top of that.
 */

export type SeoSection = 'marketing' | 'auth' | 'app' | 'admin';

export interface SeoRouteEntry {
  path: string;
  section: SeoSection;
  /**
   * `true` only for pages that should appear in search results. Anything
   * `false` is omitted from the sitemap and served with `noindex, nofollow`.
   */
  indexable: boolean;
  title: string;
  /**
   * Only required for indexable pages. Absent on the private sections, which
   * are never rendered to a crawler and have no snippet to write.
   */
  description?: string;
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
}

const registry = seoRoutesJson.routes as SeoRouteEntry[];

/** Path prefixes that must never be crawled, longest first so `/admin` does not shadow `/admin/users`. */
export const PRIVATE_PATH_PREFIXES: readonly string[] = [
  '/app',
  '/admin',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

/**
 * True for a path that must stay out of the index.
 *
 * Prefix matching is anchored on a path boundary, so `/app` and `/app/journal`
 * are private but `/apparel` is not — the same trap `resolvePostAuthRoute` in
 * `src/routes/landing.ts` already guards against.
 */
export function isPrivatePath(path: string): boolean {
  const normalized = normalizePath(path);
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

const byPath = new Map(registry.map((entry) => [normalizePath(entry.path), entry]));

/**
 * Metadata for a route, or `undefined` for a URL the router does not know —
 * which is exactly the 404 case, and is handled separately by `NOT_FOUND`.
 */
export function seoForPath(path: string): SeoRouteEntry | undefined {
  return byPath.get(normalizePath(path));
}

export function allSeoRoutes(): readonly SeoRouteEntry[] {
  return registry;
}

/** The pages that belong in the sitemap: public, canonical, indexable. */
export function indexableRoutes(): SeoRouteEntry[] {
  return registry.filter((entry) => entry.indexable);
}

/**
 * Every path the router defines. Kept as an explicit list rather than derived
 * so the completeness test can compare it against the registry in both
 * directions and name the offending path.
 */
export const ROUTED_PATHS: readonly string[] = Object.values(ROUTES);

/**
 * The 404 page.
 *
 * Not in the registry because it has no path — it answers for *every* unmatched
 * URL, including typos of real pages. `noindex, nofollow` keeps a mistyped URL
 * from being indexed and served as a thin duplicate of a real page, and the
 * title tells a human what happened.
 */
export const NOT_FOUND: Pick<SeoRouteEntry, 'title' | 'description'> = {
  title: "Page not found | Trader's Workbook",
  description: 'That page does not exist. Return to the home page to continue.',
};
