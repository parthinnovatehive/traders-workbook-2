/**
 * Builds the static `<head>` in `index.html` at build time.
 *
 * Why this exists at all: this is a client-rendered SPA, so `<Seo>` only reaches
 * the document head after the bundle is parsed. A crawler that does not execute
 * JavaScript — some link unfurlers, some social scrapers, and the first pass of
 * several crawlers — sees only the bytes in `index.html`. If the title, canonical
 * and Open Graph tags are not already in those bytes, the site has no metadata for
 * exactly the visitors who cannot run the code that would have produced it.
 *
 * Lives outside `vite.config.ts` so it can be unit-tested. HTML assembled inside a
 * Vite plugin is only verifiable by running a build and grepping `dist/`, which is
 * slow and easy to stop doing.
 *
 * Deliberately does not use the `@/` alias: `vite.config.ts` cannot resolve it.
 */

export interface HeadRouteEntry {
  path: string;
  title: string;
  description?: string;
}

export const HEAD_TITLE_PATTERN = /<title>[\s\S]*?<\/title>/i;
export const HEAD_DESCRIPTION_PATTERN =
  /<meta\s+name="description"[\s\S]*?\/>/i;

/**
 * Escape a value for a double-quoted HTML attribute.
 *
 * The brand name and every registry title contain an apostrophe and an em dash,
 * which are both legal in an attribute, but a future `&` must become an entity and
 * a `"` must be escaped — either would end the value early and leave the rest of
 * the tag parsed as a junk attribute, silently dropping the tag.
 */
export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The identity shared with the running app. Kept in step by `src/config/site.ts`. */
export interface HeadDefaults {
  name: string;
  locale: string;
  themeColor: string;
  ogImage: string;
  ogImageWidth: number;
  ogImageHeight: number;
  ogImageAlt: string;
  twitterCard: string;
}

/**
 * The full set of tags injected at the `<!--seo-defaults-->` marker.
 *
 * `og:url` and the canonical are both pinned to the home page: this block only
 * ever describes `/`, and a client-side route replaces them once React boots.
 */
export function buildHeadDefaults(
  origin: string,
  home: HeadRouteEntry,
  defaults: HeadDefaults,
): string {
  const image = `${origin}${defaults.ogImage}`;
  const title = escapeAttr(home.title);
  const description = escapeAttr(home.description ?? '');

  return [
    `<link rel="canonical" href="${origin}/" />`,
    `<meta name="theme-color" content="${defaults.themeColor}" />`,
    `<meta name="color-scheme" content="dark light" />`,
    `<link rel="manifest" href="/site.webmanifest" />`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeAttr(defaults.name)}" />`,
    `<meta property="og:locale" content="${defaults.locale}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${origin}/" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:secure_url" content="${image}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="${defaults.ogImageWidth}" />`,
    `<meta property="og:image:height" content="${defaults.ogImageHeight}" />`,
    `<meta property="og:image:alt" content="${escapeAttr(defaults.ogImageAlt)}" />`,
    `<meta name="twitter:card" content="${defaults.twitterCard}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<meta name="twitter:image:alt" content="${escapeAttr(defaults.ogImageAlt)}" />`,
  ].join('\n    ');
}

/**
 * Writes the head defaults into `index.html`.
 *
 * Three things happen, in this order, and all three are overwrite-not-append:
 *
 * 1. The `<title>` and the description meta are *replaced* with the registry's
 *    home entry. `index.html` still carries readable fallback text so the file is
 *    not useless on its own, but the shipped value is the registry's — otherwise
 *    the static shell and the client-rendered home page describe the same URL
 *    with two different sentences.
 * 2. The `<!--seo-defaults-->` marker is replaced with the tag block.
 * 3. A missing marker is only tolerated if the tags are *already* there, in which
 *    case the document has been through this function before and is returned
 *    untouched. A marker missing from an untouched `index.html` is a different
 *    situation — the site would ship with no canonical and no Open Graph and
 *    nothing would say so — so that throws.
 */
export function applyHeadDefaults(
  html: string,
  origin: string,
  home: HeadRouteEntry,
  defaults: HeadDefaults,
): string {
  const description = escapeAttr(home.description ?? '');

  if (!html.includes('<!--seo-defaults-->')) {
    if (html.includes('rel="canonical"')) return html;
    throw new Error(
      'index.html is missing the <!--seo-defaults--> marker; the static Open Graph ' +
        'and canonical tags cannot be injected.',
    );
  }
  if (!HEAD_TITLE_PATTERN.test(html)) {
    throw new Error('index.html has no <title> to replace.');
  }
  if (!HEAD_DESCRIPTION_PATTERN.test(html)) {
    throw new Error('index.html has no <meta name="description"> to replace.');
  }

  return html
    .replace(HEAD_TITLE_PATTERN, `<title>${home.title}</title>`)
    .replace(
      HEAD_DESCRIPTION_PATTERN,
      `<meta name="description" content="${description}" />`,
    )
    .replace('<!--seo-defaults-->', buildHeadDefaults(origin, home, defaults));
}
