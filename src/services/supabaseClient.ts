import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when the app is configured to talk to a real Supabase project. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/**
 * Lazily-built Supabase client. Only the ANON key is ever used — Row-Level
 * Security on every table is what keeps a user's data private (see the schema
 * in `supabase/schema.sql`). Never put the service_role key in a VITE_ variable.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  client = createClient(url as string, anonKey as string);
  return client;
}