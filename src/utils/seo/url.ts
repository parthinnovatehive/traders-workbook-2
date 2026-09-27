/**
 * URL helpers shared by the runtime metadata layer and the build-time
 * robots/sitemap generator.
 *
 * Deliberately dependency-free and side-effect-free: `vite.config.ts` imports
 * this module directly to emit `robots.txt` and `sitemap.xml` from the same
 * route registry the app renders, so a page cannot appear in one and not the
 * other. Anything added here must stay importable under plain Node.
 */

/**
 * The production origin.
 *
 * Canonical URLs, `og:url` and the sitemap are all meaningless — and actively
 * harmful, because a wrong canonical actively de-indexes a page — if this is not
 * the domain that actually serves the site. It is overridable per build so a
 * staging deploy can never emit production canonicals by accident.
 */
export const DEFAULT_SITE_ORIGIN = 'https://tradersworkbook.com';

/**
 * Reduces a configured origin to exactly `scheme://host[:port]`.
 *
 * Trailing slashes, whitespace, a bare `example.com` and a full URL with a path
 * all collapse to the same thing, so a misconfigured variable degrades into
 * something valid instead of producing `https://example.com//pricing`.
 */
export function normalizeOrigin(value: string | undefined | null): string {
  const raw = (value ?? '').trim();
  if (!raw) return DEFAULT_SITE_ORIGIN;

  // A scheme that is not http(s) must be rejected outright, not merely skipped:
  // prepending `https://` to `ftp://host` parses as host `ftp`, which would
  // silently publish every canonical on the site to the wrong domain.
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(raw)?.[1]?.toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https') return DEFAULT_SITE_ORIGIN;

  const withScheme = scheme ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    // Not parseable as a URL. Falling back keeps the site shippable; the
    // alternative is a build that fails over a typo in an env file.
    return DEFAULT_SITE_ORIGIN;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return DEFAULT_SITE_ORIGIN;
  // A bare host like `foo` parses but is not a usable origin.
  if (!url.hostname.includes('.') && url.hostname !== 'localhost') return DEFAULT_SITE_ORIGIN;
  return `${url.protocol}//${url.host}`;
}

/**
 * An absolute URL with a fragment, e.g. `https://site/#website`.
 *
 * Kept separate from `absoluteUrl` on purpose. `normalizePath` strips fragments
 * so a canonical can never carry one, which means routing a `#website` suffix
 * through `absoluteUrl` silently returns the bare origin and breaks every
 * schema `@id` that points at another node.
 */
export function absoluteUrlWithFragment(path: string, fragment: string): string {
  return `${absoluteUrl(path)}#${fragment.replace(/^#/, '')}`;
}

/**
 * The canonical form of a route path.
 *
 * Every URL that reaches the metadata layer goes through this so `/pricing`,
 * `/pricing/`, `/pricing/?utm_source=x` and `/pricing#faq` cannot produce four
 * different canonicals for one page. The Vercel rewrite answers all four with
 * the same 200, so the duplicate has to be resolved here.
 *
 * Root stays `/`; every other path loses its trailing slash.
 */
export function normalizePath(path: string): string {
  const withoutQuery = path.split(/[?#]/, 1)[0] ?? '';
  const trimmed = withoutQuery.replace(/\/{2,}/g, '/');
  if (trimmed === '/' || trimmed === '') return '/';
  return trimmed.replace(/\/+$/, '') || '/';
}

/** Absolute, canonical URL for a route path. */
export function absoluteUrl(path: string, origin?: string): string {
  return `${normalizeOrigin(origin)}${normalizePath(path)}`;
}

/** A site-absolute path for an asset in `public/` (e.g. `/og-image.png`). */
export function assetPath(file: string): string {
  return normalizePath(file.startsWith('/') ? file : `/${file}`);
}
