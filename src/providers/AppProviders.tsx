import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/Toaster';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { queryClient } from './queryClient';

/** Applies the persisted theme to <html> whenever it changes. */
function useThemeEffect() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.setAttribute('data-theme', theme);
  }, [theme]);
}

export function AppProviders({ children }: { children: ReactNode }) {
  useThemeEffect();
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
