import type { ReactNode } from 'react';
import { SITE, OG_IMAGE, TWITTER_CARD, siteUrl } from '@/config/site';
import { seoForPath, type SeoRouteEntry } from '@/config/seo';
import { JsonLd } from './JsonLd';

/**
 * Per-route document metadata.
 *
 * Renders `<title>`, `<meta>` and `<link>` from the registry in
 * `@/config/seo` and lets React 19 hoist them into `<head>`. No head-management
 * library, no `document.querySelector`, and nothing that reaches around React
 * to mutate the DOM — which matters here because the alternative in a
 * client-rendered SPA is exactly the kind of thing that leaves a stale canonical
 * behind after a route change.
 *
 * Every page gets a title, a canonical and a robots decision from one table, so
 * two pages cannot accidentally share a title and a private page cannot
 * accidentally ship without `noindex`.
 *
 * Renders no visible output. `schema` is for `JsonLd` blocks a particular page
 * should emit.
 */

export interface SeoProps {
  /** The route this component is rendering. Looked up in the registry. */
  path: string;
  /** Overrides the registry title. Used where live content supplies one. */
  title?: string;
  /** Overrides the registry description. */
  description?: string;
  /** Forces `noindex, nofollow` regardless of the registry. */
  noIndex?: boolean;
  /** One or more schema.org objects for this page. `null` entries are skipped. */
  schema?: unknown | readonly unknown[];
}

export function Seo({ path, title, description, noIndex, schema }: SeoProps) {
  const entry = seoForPath(path);
  const resolved = resolve({ entry, path, title, description, noIndex });

  return (
    <>
      <title>{resolved.title}</title>
      <meta name="description" content={resolved.description} />
      <link rel="canonical" href={resolved.canonical} />

      {/*
        Rendered only when the page must stay out of the index. Omitting the tag
        on an indexable page is equivalent to `index, follow` and keeps the head
        free of a directive that says nothing.
      */}
      {resolved.noIndex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:locale" content={SITE.locale} />
      <meta property="og:title" content={resolved.title} />
      <meta property="og:description" content={resolved.description} />
      <meta property="og:url" content={resolved.canonical} />
      <meta property="og:image" content={siteUrl(OG_IMAGE.path)} />
      <meta property="og:image:secure_url" content={siteUrl(OG_IMAGE.path)} />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content={String(OG_IMAGE.width)} />
      <meta property="og:image:height" content={String(OG_IMAGE.height)} />
      <meta property="og:image:alt" content={OG_IMAGE.alt} />

      <meta name="twitter:card" content={TWITTER_CARD.card} />
      <meta name="twitter:title" content={resolved.title} />
      <meta name="twitter:description" content={resolved.description} />
      <meta name="twitter:image" content={siteUrl(OG_IMAGE.path)} />
      <meta name="twitter:image:alt" content={TWITTER_CARD.imageAlt} />

      {renderSchema(schema)}
    </>
  );
}

/** Normalises the `schema` prop into `JsonLd` blocks, dropping nullish entries. */
function renderSchema(schema: SeoProps['schema']): ReactNode {
  if (schema === null || schema === undefined) return null;
  const blocks = Array.isArray(schema) ? schema : [schema];
  return blocks
    .filter((block): block is NonNullable<unknown> => block !== null && block !== undefined)
    .map((block, index) => <JsonLd key={schemaKey(block, index)} data={block} />);
}

/**
 * A key for a schema block that survives re-render.
 *
 * The array index is technically stable for a fixed prop list, but it is the wrong
 * key: these blocks are data about the page, and `@id`/`@type` identify a block on
 * its own terms. Reordering the array — which happens whenever a page adds or drops
 * a schema node — would otherwise make React reuse the wrong `<script>` DOM node
 * and leave a stale block mounted.
 */
function schemaKey(block: NonNullable<unknown>, index: number): string {
  if (block && typeof block === 'object') {
    const record = block as Record<string, unknown>;
    if (typeof record['@id'] === 'string') return record['@id'];
    if (typeof record['@type'] === 'string') return `${record['@type']}:${index}`;
  }
  return `schema:${index}`;
}

/**
 * The fallback description for an indexable page whose registry entry is
 * missing one. Returning *something* beats returning an empty `content`, which
 * Google treats as a duplicate-of-nothing rather than as an error.
 */
const FALLBACK_DESCRIPTION =
  'Trader\'s Workbook is a trading journal and performance analytics tool for Forex and Indian market traders.';

interface ResolvedMeta {
  title: string;
  description: string;
  canonical: string;
  noIndex: boolean;
}

/**
 * The one place title, description, canonical and robots are decided.
 *
 * Two rules worth stating:
 *
 * - `noIndex` is the *default* for anything the registry does not mark
 *   indexable. An unknown path must never default to indexable, because the
 *   404 handler and any future route would then advertise itself.
 * - The canonical is derived from the path, never from the current URL, so
 *   `?utm_source=…` and a trailing slash cannot fork the canonical.
 */
export function resolve(input: {
  entry: SeoRouteEntry | undefined;
  path: string;
  title?: string;
  description?: string;
  noIndex?: boolean;
}): ResolvedMeta {
  const { entry, path, title, description, noIndex } = input;

  const resolvedTitle = title?.trim() || entry?.title?.trim() || SITE.name;
  const resolvedDescription =
    description?.trim() || entry?.description?.trim() || FALLBACK_DESCRIPTION;

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    canonical: siteUrl(path),
    noIndex: noIndex ?? !(entry?.indexable ?? false),
  };
}
