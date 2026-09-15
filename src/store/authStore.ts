import { create } from 'zustand';
import type { User } from '@/types';
import { api } from '@/services';
import type { ProfilePatch, RegisterInput } from '@/services';

interface AuthState {
  user: User | null;
  ready: boolean;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  /**
   * Resolves to `true` when a session started, `false` when the account was
   * created but needs email confirmation first.
   */
  register: (input: RegisterInput) => Promise<boolean>;
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
    const user = await api.auth.getCurrentUser();
    set({ user, ready: true });

    // Keep the store honest when the session changes outside this tab — a
    // sign-out elsewhere, an expired refresh token, or the recovery link
    // opening a new session. Without this the UI would show a logged-in shell
    // whose every request 401s.
    unsubscribe?.();
    unsubscribe = api.auth.onAuthStateChange((next) => {
      set({ user: next, ready: true });
    });
  },

  login: async (email, password) => {
    const user = await api.auth.login(email, password);
    set({ user });
  },

  register: async (input) => {
    const user = await api.auth.register(input);
    if (!user) return false; // awaiting email confirmation
    set({ user });
    return true;
  },

  logout: async () => {
    await api.auth.logout();
    set({ user: null });
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
    // Optimistic: the wizard closes immediately. If the write fails the user is
    // simply asked again next session — far better than trapping them in it.
    set({ user: { ...current, onboardedAt: new Date().toISOString() } });
    try {
      const user = await api.auth.completeOnboarding(current.id);
      set({ user });
    } catch {
      // keep the optimistic value for this session
    }
  },
}));
