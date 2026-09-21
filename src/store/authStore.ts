import { create } from 'zustand';
import type { User } from '@/types';
import { api } from '@/services';
import type { ProfilePatch, RegisterInput } from '@/services';
import { queryClient } from '@/providers/queryClient';

interface AuthState {
  user: User | null;
  ready: boolean;
  bootstrap: () => Promise<void>;
  /** Resolves to the signed-in user so the caller can route on their role. */
  login: (email: string, password: string) => Promise<User>;
  /**
   * Resolves to the new user when a session started, or `null` when the account
   * was created but needs email confirmation before it can be used.
   */
  register: (input: RegisterInput) => Promise<User | null>;
  logout: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  /** Marks the first-run wizard as done so it never shows again. */
  completeOnboarding: () => Promise<void>;
}

let unsubscribe: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  ready: false,

  bootstrap: async () => {
    try {
      const user = await api.auth.getCurrentUser();
      set({ user, ready: true });
    } catch (err) {
      console.error('[auth] Failed to bootstrap session', err);
      set({ user: null, ready: true });
    }

    // Keep the store honest when the session changes outside this tab — a
    // sign-out elsewhere, an expired refresh token, or the recovery link
    // opening a new session. Without this the UI would show a logged-in shell
    // whose every request 401s.
    unsubscribe?.();
    unsubscribe = api.auth.onAuthStateChange((next) => {
      const previous = get().user;
      set({ user: next, ready: true });

      // A session can end without anyone pressing "Log out" — an expired
      // refresh token, or a sign-out in another tab. `logout()` clears the
      // cache on its own path; this covers the ones it never sees, so the next
      // person to sign in on this machine cannot be shown the last one's rows.
      if (previous && !next) queryClient.clear();
    });
  },

  login: async (email, password) => {
    const user = await api.auth.login(email, password);
    set({ user });
    return user;
  },

  register: async (input) => {
    const user = await api.auth.register(input);
    if (!user) return null; // awaiting email confirmation
    set({ user });
    return user;
  },

  logout: async () => {
    try {
      await api.auth.logout();
    } finally {
      // Always clear locally, even if the sign-out request failed. A network
      // error must not strand someone in a session they asked to end.
      set({ user: null });
      // Drop every cached query too: without this the previous user's trades,
      // feedback and admin rows stay in memory, and signing in as someone else
      // in the same tab can paint them for a frame before the refetch lands.
      queryClient.clear();
    }
  },

  updateProfile: async (patch) => {
    const current = get().user;
    if (!current) return;
    const user = await api.auth.updateProfile(current.id, patch);
    set({ user });
  },

  requestPasswordReset: async (email) => {
    await api.auth.requestPasswordReset(email);
  },

  updatePassword: async (newPassword) => {
    await api.auth.updatePassword(newPassword);
  },

  completeOnboarding: async () => {
    const current = get().user;
    if (!current || current.onboardedAt) return;
    // Optimistic: the wizard closes immediately rather than blocking on a
    // round-trip the user does not care about.
    set({ user: { ...current, onboardedAt: new Date().toISOString() } });
    try {
      const user = await api.auth.completeOnboarding(current.id);
      set({ user });
    } catch (err) {
      // Swallowing this silently is what let "the wizard opens every time" go
      // unexplained: the optimistic value only lives for the session, so a
      // failing write means the user is re-onboarded on every visit with no
      // clue why. Keep going, but say so.
      console.error(
        '[auth] Could not record onboarding completion — the wizard will reappear next session.',
        err,
      );
    }
  },
}));
