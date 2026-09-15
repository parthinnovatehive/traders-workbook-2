import type { Api } from './interfaces';
import { localApi } from './local';
import { supabaseApi } from './supabase';
import { isSupabaseConfigured } from './supabaseClient';

/**
 * Dependency-injection seam. Swap the data source with VITE_DATA_SOURCE:
 *   - "local"     → in-browser mock repository (IndexedDB/localStorage, no backend)
 *   - "supabase"  → real Supabase backend (requires VITE_SUPABASE_URL + anon key)
 * Both implementations satisfy the same `Api` interface — no UI/hook changes
 * required when switching.
 */
const dataSource = import.meta.env.VITE_DATA_SOURCE ?? 'local';

/** True when this bundle is running against the mock in-browser repository. */
export const isLocalDataSource = dataSource !== 'supabase';

function resolveApi(): Api {
  if (dataSource === 'supabase') {
    if (!isSupabaseConfigured) {
      throw new Error(
        'VITE_DATA_SOURCE=supabase requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. ' +
          'Create a Supabase project and run the migrations in supabase/migrations/.',
      );
    }
    return supabaseApi;
  }

  // The local repository keeps demo credentials and data in localStorage. It is
  // a development tool — shipping it to production would mean every visitor
  // shares one fake account, so fail the build-time bundle loudly instead.
  if (import.meta.env.PROD) {
    throw new Error(
      'Refusing to start: VITE_DATA_SOURCE is not "supabase" in a production build. ' +
        'Set VITE_DATA_SOURCE=supabase (plus VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) before deploying.',
    );
  }

  return localApi;
}

export const api: Api = resolveApi();

export * from './interfaces';
export { resetLocalData } from './local';
export { getFxProvider, setFxProvider, convertAmount } from './fx';
export {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
} from './seed';
export { getSupabase, isSupabaseConfigured } from './supabaseClient';