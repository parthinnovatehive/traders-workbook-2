// `loadEnv` comes from `vite`, not `vitest/config` — the latter re-exports
// `defineConfig` and `Plugin` but not the env loader.
import { loadEnv } from 'vite';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROUTES } from './src/constants/routes';
import { SEO_HEAD_DEFAULTS } from './src/config/seo.defaults';
import { buildRobotsTxt, buildSitemapXml } from './src/utils/seo/files';
import { applyHeadDefaults } from './src/utils/seo/head';
import { DEFAULT_SITE_ORIGIN, normalizeOrigin } from './src/utils/seo/url';

const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, './package.json'), 'utf8'),
) as { version: string };

/**
 * Refuse to build if a secret has been put somewhere it would be published.
 *
 * Every `VITE_`-prefixed variable is inlined into the JavaScript bundle, so a
 * key secret in `.env` is a key secret on every visitor's machine. This is the
 * kind of mistake that is invisible in review and expensive in production, so
 * the build fails rather than shipping it.
 */
function forbidPublishedSecrets(env: Record<string, string | undefined>): Plugin {
  const FORBIDDEN = [
    'VITE_RAZORPAY_KEY_SECRET',
    'VITE_RAZORPAY_WEBHOOK_SECRET',
    'VITE_SUPABASE_SERVICE_ROLE_KEY',
    'VITE_SERVICE_ROLE_KEY',
  ];

  return {
    name: 'forbid-published-secrets',
    enforce: 'pre',
    config(_config, { mode }) {
      const leaked = FORBIDDEN.filter((name) => env[name]);
      if (leaked.length > 0) {
        throw new Error(
          `\n\nRefusing to build (${mode}): ${leaked.join(', ')} ` +
            'would be compiled into the client bundle and readable by anyone.\n' +
            'Secrets belong in Supabase Edge Function secrets:\n' +
            '  supabase secrets set RAZORPAY_KEY_SECRET=...\n' +
            'Remove the VITE_ variable and rotate the key — assume it is burned.\n',
        );
      }
    },
  };
}

/**
 * Routes that must never be crawled.
 *
 * Kept here rather than imported from `src/config/seo.ts` because that module
 * reaches for the `@/` alias, which the Vite config cannot resolve. The values
 * are asserted against `PRIVATE_PATH_PREFIXES` in `src/utils/seo/__tests__` so
 * the two cannot drift.
 */
const PRIVATE_PATH_PREFIXES = [
  '/app',
  '/admin',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

interface SeoRouteFile {
  routes: {
    path: string;
    section: string;
    indexable: boolean;
    title: string;
    description?: string;
    changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    priority?: number;
  }[];
}

const ROUTE_FILE = path.resolve(__dirname, './src/config/seo.routes.json');
const PUBLIC_DIR = path.resolve(__dirname, './public');

function readRouteFile(): SeoRouteFile {
  return JSON.parse(readFileSync(ROUTE_FILE, 'utf8')) as SeoRouteFile;
}

/**
 * The home entry, which supplies the static shell's title and description.
 *
 * Throws rather than defaulting: without this the shell would silently ship a
 * generic description, and the crawler that does not run JavaScript would see
 * different text from every other crawler for the same URL. A missing home entry
 * is a mistake worth failing a build over.
 */
function readHomeRoute(): SeoRouteFile['routes'][number] {
  const home = readRouteFile().routes.find((route) => route.path === '/');
  if (!home) {
    throw new Error(
      '\n\nsrc/config/seo.routes.json has no entry for "/".\n' +
        'The static <head> is generated from it, so index.html cannot be built.\n',
    );
  }
  if (!home.description) {
    throw new Error(
      '\n\nThe "/" entry in src/config/seo.routes.json has no description.\n' +
        'An indexable page with an empty <meta name="description"> is treated as\n' +
        'a duplicate of nothing rather than as an error.\n',
    );
  }
  return home;
}

/**
 * Generates `robots.txt` and `sitemap.xml` from `src/config/seo.routes.json`.
 *
 * A hand-maintained sitemap is stale within one deploy, and the failure is
 * silent: the file keeps parsing, it is just wrong. Generating it from the same
 * table the app renders its metadata from makes that impossible.
 *
 * The registry is also checked against `ROUTES` at build time, so adding a route
 * without adding its metadata fails the build instead of shipping a page that
 * silently inherits the previous route's title and canonical.
 */
function seoFiles(configuredSiteUrl?: string): Plugin {
  const origin = normalizeOrigin(configuredSiteUrl || DEFAULT_SITE_ORIGIN);

  const build = () => {
    const file = readRouteFile();
    return {
      robots: buildRobotsTxt(origin, PRIVATE_PATH_PREFIXES),
      sitemap: buildSitemapXml(origin, file.routes),
    };
  };

  const assertRegistryMatchesRouter = () => {
    const { routes } = readRouteFile();
    const declared = new Set(routes.map((route) => route.path));
    const routed = Object.values(ROUTES) as string[];

    const missing = routed.filter((routePath) => !declared.has(routePath));
    const orphaned = routes.map((route) => route.path).filter((routePath) => !routed.includes(routePath));

    if (missing.length > 0) {
      throw new Error(
        `\n\nSEO registry is missing metadata for: ${missing.join(', ')}\n` +
          'Add each to src/config/seo.routes.json, or the page ships with the\n' +
          "previous route's title and canonical.\n",
      );
    }
    if (orphaned.length > 0) {
      throw new Error(
        `\n\nSEO registry lists paths the router does not define: ${orphaned.join(', ')}\n` +
          'Remove them from src/config/seo.routes.json.\n',
      );
    }
  };

  return {
    name: 'seo-files',

    /**
     * Fill the `<!--seo-defaults-->` marker in `index.html`.
     *
     * A crawler that does not run JavaScript sees only the static shell, so the
     * Open Graph and Twitter tags have to be in the served HTML, not injected by
     * React at runtime. Generating them here rather than hand-writing them in
     * `index.html` keeps the production origin in exactly one place — the same
     * one the canonicals and the sitemap use.
     */
    transformIndexHtml(html) {
      return applyHeadDefaults(html, origin, readHomeRoute(), SEO_HEAD_DEFAULTS);
    },

    // Dev server: answer /robots.txt and /sitemap.xml from the same builders,
    // so what a crawler sees locally matches production.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Named `requestPath` because `path` is the node:path import in scope.
        const requestPath = req.url?.split('?')[0];
        if (requestPath !== '/robots.txt' && requestPath !== '/sitemap.xml') {
          return next();
        }
        const { robots, sitemap } = build();
        res.setHeader(
          'Content-Type',
          requestPath === '/robots.txt' ? 'text/plain' : 'application/xml',
        );
        res.end(requestPath === '/robots.txt' ? robots : sitemap);
      });
    },

    buildStart() {
      assertRegistryMatchesRouter();
      // Refresh the committed copies so they stay reviewable in a diff and are
      // available to `vite preview` without a build.
      const { robots, sitemap } = build();
      writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), robots, 'utf8');
      writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemap, 'utf8');
    },

    // Also emit them into the bundle, so a cleaned `public/` still deploys a
    // correct sitemap rather than silently shipping none.
    generateBundle() {
      const { robots, sitemap } = build();
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  /**
   * `loadEnv` reads `.env`, `.env.local`, `.env.<mode>` and `.env.<mode>.local`.
   *
   * The static `<head>`, `robots.txt` and `sitemap.xml` are generated at build
   * time, which is *before* Vite substitutes `import.meta.env` into the bundle.
   * Reading `process.env` alone therefore honours a variable exported by the
   * deploy platform but silently ignores the same variable in a local `.env` —
   * so a staging build would emit production canonicals and a production sitemap.
   * `process.env` still wins, so real deployment variables are unaffected.
   */
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };

  return {
    plugins: [forbidPublishedSecrets(env), seoFiles(env.VITE_SITE_URL), react(), tailwindcss()],
    define: {
      /**
       * The sidebar and the feedback form both report a version. Hardcoding it in
       * two places means the app claims a version it was not built from, and a
       * bug report then cannot be matched to a build. Sourced from `package.json`
       * so there is one answer.
       */
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      css: false,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        include: ['src/calculations/**', 'src/utils/**'],
      },
    },
  };
});
