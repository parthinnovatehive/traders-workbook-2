import { create } from 'zustand';
import type { User } from '@/types';
import { api } from '@/services';
import type { ProfilePatch, RegisterInput } from '@/services';

interface AuthState {
  user: User | null;
  ready: boolean;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  ready: false,
  bootstrap: async () => {
    const user = await api.auth.getCurrentUser();
    set({ user, ready: true });
  },
  login: async (email, password) => {
    const user = await api.auth.login(email, password);
    set({ user });
  },
  register: async (input) => {
    const user = await api.auth.register(input);
    set({ user });
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
}));
