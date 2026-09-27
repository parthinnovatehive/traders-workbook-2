/// <reference types="vite/client" />

/**
 * Declared once. `ImportMetaEnv` is an interface, so a second declaration of it
 * is *merged* rather than replacing the first — which means a variable declared
 * in both places ends up with a union of both types, and a variable declared in
 * only the first place is easy to miss when reading the second. One block, one
 * place.
 *
 * Everything listed here is compiled into the client bundle. A secret declared
 * in this file is a secret on every visitor's machine.
 */
interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: 'local' | 'supabase' | 'api';
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;

  /**
   * Absolute origin used for canonical URLs, `robots.txt` and `sitemap.xml`.
   * Leave blank in production: `src/config/site.ts` and `vite.config.ts` both
   * fall back to `DEFAULT_SITE_ORIGIN`. Set it only to point a build at a
   * different host — a staging deploy, for example.
   */
  readonly VITE_SITE_URL?: string;

  /**
   * Injected at build time from the `version` field in `package.json` by
   * `vite.config.ts`, so a bug report can be tied to the build that produced it.
   */
  readonly VITE_APP_VERSION?: string;

  /**
   * Razorpay's PUBLISHABLE key id. Optional — the server returns the key id
   * alongside each order, which is the safer source.
   *
   * There is deliberately no entry for the key secret. Everything declared here
   * is compiled into the bundle; a secret in this interface is a secret on
   * every visitor's machine.
   */
  readonly VITE_RAZORPAY_KEY_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
