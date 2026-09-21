import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression tests for a stale-session bug.
 *
 * `getSession()` reads localStorage and returns whatever it finds, including a
 * session the server no longer accepts. Trusting it produced a shell that
 * looked signed in — clicking "Log in" jumped straight into the previous
 * account with no password — while every server call 401'd, because the Edge
 * Functions verify the JWT and the guard did not.
 *
 * The rule these tests hold in place: a session is only real once the server
 * has confirmed it, and we never invent a user to paper over the difference.
 */

const getSession = vi.fn();
const getUser = vi.fn();
const signOut = vi.fn();
const from = vi.fn();

vi.mock('../supabaseClient', () => ({
  isSupabaseConfigured: true,
  getSupabase: () => ({
    auth: { getSession, getUser, signOut, onAuthStateChange: vi.fn() },
    from,
  }),
}));

const { supabaseApi } = await import('../supabase');

const SESSION = {
  access_token: 'stored.but.not.necessarily.valid',
  user: { id: 'user-1', email: 'trader@example.com', user_metadata: {} },
};

const PROFILE_ROW = {
  id: 'user-1',
  email: 'trader@example.com',
  display_name: 'Trader',
  phone: null,
  role: 'admin',
  base_currency: 'INR',
  starting_capital: 100000,
  created_at: '2026-01-01T00:00:00.000Z',
  is_suspended: false,
  suspended_reason: null,
  last_active_at: null,
  onboarded_at: '2026-01-02T00:00:00.000Z',
};

/** Minimal stand-in for the two chains `fetchProfile` uses. */
function profilesTable(opts: { row?: unknown; created?: unknown; createError?: unknown } = {}) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: opts.row ?? null, error: null }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: opts.created ?? null,
          error: opts.createError ?? null,
        }),
      }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  signOut.mockResolvedValue({ error: null });
});

describe('getCurrentUser', () => {
  it('returns null when a stored session is rejected by the server', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } });

    expect(await supabaseApi.auth.getCurrentUser()).toBeNull();
  });

  it('clears the stale tokens so the next visit is not confused the same way', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } });

    await supabaseApi.auth.getCurrentUser();

    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('never reads the profile for a session the server rejected', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } });

    await supabaseApi.auth.getCurrentUser();

    expect(from).not.toHaveBeenCalled();
  });

  it('returns the profile when the server confirms the session', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    getUser.mockResolvedValue({ data: { user: SESSION.user }, error: null });
    from.mockReturnValue(profilesTable({ row: PROFILE_ROW }));

    const user = await supabaseApi.auth.getCurrentUser();

    expect(user).toMatchObject({ id: 'user-1', role: 'admin', onboardedAt: expect.any(String) });
  });

  it('returns null without touching the network when nothing is stored', async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    expect(await supabaseApi.auth.getCurrentUser()).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('signs the user out rather than inventing one when the profile cannot be created', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    getUser.mockResolvedValue({ data: { user: SESSION.user }, error: null });
    from.mockReturnValue(profilesTable({ createError: { message: 'row-level security' } }));

    // The old fallback returned a synthetic `{ role: 'user' }` here, which is
    // how an unauthenticated visitor ended up inside the app.
    expect(await supabaseApi.auth.getCurrentUser()).toBeNull();
  });

  it('self-heals a genuinely missing profile row for a verified session', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    getUser.mockResolvedValue({ data: { user: SESSION.user }, error: null });
    from.mockReturnValue(profilesTable({ created: PROFILE_ROW }));

    expect(await supabaseApi.auth.getCurrentUser()).toMatchObject({ id: 'user-1' });
  });
});
