/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
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

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: 'local' | 'supabase' | 'api';
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
